import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import { DEFAULT_KEYBOARD_PRESET, KEYBOARD_PRESETS, type KeyboardPreset } from './config';
import type { ActiveSource } from './devices/DevicePicker';
import { DevicePicker } from './devices/DevicePicker';
import { downloadJson } from './downloadJson';
import type { Loop } from './engine/types';
import { KeyboardRangePicker } from './keyboard/KeyboardRangePicker';
import { PianoKeyboard } from './keyboard/PianoKeyboard';
import { ReplayMidiSource } from './midi/ReplayMidiSource';
import { VirtualKeyboardSource } from './midi/VirtualKeyboardSource';
import type { MidiInputDescriptor } from './midi/WebMidiSource';
import {
  WebMidiSource,
  isWebMidiSupported,
  listMidiInputs,
  subscribeToMidiInputChanges,
} from './midi/WebMidiSource';
import { downloadRecording } from './midi/recording';
import type { MidiEvent, MidiSource } from './midi/types';
import { FallingNotes } from './practice/FallingNotes';
import { LoopPicker } from './practice/LoopPicker';
import { formatPosition } from './practice/positionReadout';
import { toPracticeStateSnapshot } from './practice/practiceState';
import {
  advancePracticeView,
  createInitialPracticeViewState,
  notesAt,
  restartPractice,
  setPracticeLoop,
  type PracticeViewState,
} from './practice/practiceView';
import { AttemptHistory } from './progress/AttemptHistory';
import {
  isAttemptRecordArray,
  loadAttempts,
  saveAttempts,
} from './progress/attemptStore';
import { mergeAttempts } from './progress/mergeAttempts';
import type { AttemptRecord } from './progress/types';
import { cichaNocScore } from './score/cichaNoc';
import { filterScoreByHand, type HandSelection } from './score/filterScoreByHand';

function isMidiEventArray(value: unknown): value is MidiEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item.type === 'noteOn' || item.type === 'noteOff') &&
        typeof item.note === 'number' &&
        typeof item.time === 'number' &&
        (item.type === 'noteOff' || typeof item.velocity === 'number'),
    )
  );
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Browser support for the Web MIDI API doesn't change during a session.
const webMidiSupported = isWebMidiSupported();

// Radios rather than a <select>: a focused select jumps option on the first letter
// typed, and "Both hands" would answer to B, which VirtualKeyboardSource reads as G3.
const HAND_OPTIONS: readonly { value: HandSelection; label: string }[] = [
  { value: 'both', label: 'Both hands' },
  { value: 'left', label: 'Left hand' },
  { value: 'right', label: 'Right hand' },
];

export function App() {
  const [view, setView] = useState<PracticeViewState>(createInitialPracticeViewState);
  const [active, setActive] = useState<ActiveSource>({ kind: 'none' });
  const [webMidiInputs, setWebMidiInputs] = useState<MidiInputDescriptor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [attempts, setAttempts] = useState<AttemptRecord[]>(loadAttempts);
  const [keyboardPreset, setKeyboardPreset] = useState<KeyboardPreset>(
    DEFAULT_KEYBOARD_PRESET,
  );
  const [hands, setHands] = useState<HandSelection>('both');

  // The piece as the selected hand plays it. A plain const: nothing depends on the
  // score's identity across renders, and filtering 41 events costs nothing.
  const score = filterScoreByHand(cichaNocScore, hands);

  const openAttemptRef = useRef<number | null>(null);
  const sourceRef = useRef<MidiSource | null>(null);
  const connectedDeviceIdRef = useRef<string | null>(null);
  const recordedEventsRef = useRef<MidiEvent[]>([]);
  const isRecordingRef = useRef(false);
  // handleEvent is registered once, at attach() time, so it can't close over the score
  // of the render that changed the hand — it reads the current one through this ref.
  const scoreRef = useRef(score);

  function handleEvent(event: MidiEvent) {
    if (isRecordingRef.current) recordedEventsRef.current.push(event);
    setView((prev) => advancePracticeView(prev, scoreRef.current, event, event.time));
  }

  function handleLoopChange(loop: Loop | undefined) {
    setView((prev) => setPracticeLoop(prev, loop));
  }

  function handleRestart() {
    setView(restartPractice);
  }

  function handleHandsChange(next: HandSelection) {
    setHands(next);
    // nextEventIndex indexes the event list, and the other hand's is a different list,
    // so the same number would be a different note — start the attempt again.
    setView(restartPractice);
  }

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (import.meta.env.DEV) window.__practiceState = toPracticeStateSnapshot(view);
  }, [view]);

  // The wall clock lives here, not in the clock-free reducer; the open record is written
  // through on every change rather than at an end of attempt — see DECISIONS.md.
  useEffect(() => {
    const { notesPlayed, wrongNoteCount } = view.attempt;
    // Restart, attach() and disconnect() all zero the counters, so this catches every
    // path that ends an attempt. An attempt with no notes is never written down.
    if (notesPlayed === 0) {
      openAttemptRef.current = null;
      return;
    }

    const now = Date.now();
    const summary = {
      endedAt: now,
      notesPlayed,
      wrongNoteCount,
      reachedEnd: view.engine.status === 'complete',
      loop: view.engine.loop,
    };
    const openStartedAt = openAttemptRef.current;

    if (openStartedAt === null) {
      openAttemptRef.current = now;
      setAttempts((prev) => [{ startedAt: now, ...summary }, ...prev]);
      return;
    }

    // Matched by startedAt rather than by position: step 8's import can put another
    // record at the head while this one is still open.
    setAttempts((prev) =>
      prev.map((record) =>
        record.startedAt === openStartedAt
          ? { startedAt: openStartedAt, ...summary }
          : record,
      ),
    );
  }, [view]);

  useEffect(() => saveAttempts(attempts), [attempts]);

  function attach(
    source: MidiSource,
    nextStatus: ActiveSource,
    deviceId: string | null = null,
  ) {
    sourceRef.current?.stop();
    sourceRef.current = source;
    connectedDeviceIdRef.current = deviceId;
    source.onEvent(handleEvent);
    setView(createInitialPracticeViewState());
    setError(null);
    setActive(nextStatus);
    source.start().catch((err: unknown) => {
      if (sourceRef.current !== source) return; // superseded by a later attach()
      setError(describeError(err));
      setActive({ kind: 'none' });
    });
  }

  // Stable because the device-list effect below depends on it; every other handler
  // here is only ever called from a JSX event and doesn't need referential stability.
  const disconnect = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    connectedDeviceIdRef.current = null;
    setView(createInitialPracticeViewState());
    setActive({ kind: 'none' });
  }, []);

  function connectWebMidi(deviceId: string) {
    const device = webMidiInputs.find((input) => input.id === deviceId);
    attach(
      new WebMidiSource(deviceId),
      { kind: 'webmidi', deviceName: device?.name ?? deviceId },
      deviceId,
    );
  }

  function connectVirtual() {
    attach(new VirtualKeyboardSource(), { kind: 'virtual' });
  }

  async function loadReplayFile(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isMidiEventArray(parsed)) {
        throw new Error('File does not contain a MidiEvent[] array.');
      }
      attach(new ReplayMidiSource(parsed), { kind: 'replay', fileName: file.name });
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function importProgress(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isAttemptRecordArray(parsed)) {
        throw new Error('That file is not a piano-tutor progress export.');
      }
      setAttempts((prev) => mergeAttempts(prev, parsed));
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void importProgress(file);
    event.target.value = '';
  }

  useEffect(() => {
    if (!webMidiSupported) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const refreshInputs = () => {
      listMidiInputs()
        .then((inputs) => {
          if (cancelled) return;
          // A port that's unplugged stays in the map with state 'disconnected'
          // rather than disappearing, so filter rather than compare presence.
          const connected = inputs.filter((input) => input.state === 'connected');
          setWebMidiInputs(connected);
          if (
            connectedDeviceIdRef.current &&
            !connected.some((input) => input.id === connectedDeviceIdRef.current)
          ) {
            disconnect();
          }
        })
        .catch((err: unknown) => setError(describeError(err)));
    };

    refreshInputs();
    subscribeToMidiInputChanges(refreshInputs)
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      .catch((err: unknown) => setError(describeError(err)));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [disconnect]);

  function toggleRecording() {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      downloadRecording(recordedEventsRef.current);
      recordedEventsRef.current = [];
    } else {
      isRecordingRef.current = true;
      setIsRecording(true);
    }
  }

  return (
    <div>
      <h1>piano-tutor</h1>
      {error && <p role="alert">{error}</p>}
      <DevicePicker
        active={active}
        webMidiSupported={webMidiSupported}
        webMidiInputs={webMidiInputs}
        onConnectWebMidi={connectWebMidi}
        onConnectVirtual={connectVirtual}
        onLoadReplayFile={(file) => void loadReplayFile(file)}
        onDisconnect={disconnect}
      />
      {import.meta.env.DEV && active.kind !== 'none' && (
        <button type="button" onClick={toggleRecording} data-testid="toggle-recording">
          {isRecording ? 'Stop recording & download' : 'Start recording'}
        </button>
      )}
      {active.kind !== 'none' && (
        <button type="button" onClick={handleRestart} data-testid="restart-practice">
          Restart
        </button>
      )}
      <LoopPicker
        measureCount={score.measureCount}
        loop={view.engine.loop}
        onChange={handleLoopChange}
      />
      <FallingNotes
        events={score.events}
        status={view.engine.status}
        nextEventIndex={view.engine.nextEventIndex}
        satisfiedNoteIds={view.engine.satisfiedNoteIds}
        hasWrongNote={view.wrongNotes.size > 0}
      />
      {/* Below the queue: above it, the queue shifts by a sub-pixel and its committed
          screenshots fail on an edge sliver. */}
      <p data-testid="position-readout">{formatPosition(score, view.engine)}</p>
      {/* Below the queue for the same screenshot reason as the readout above. */}
      <div>
        Hands{' '}
        {HAND_OPTIONS.map((option) => (
          <label key={option.value} htmlFor={`hands-${option.value}`}>
            <input
              id={`hands-${option.value}`}
              type="radio"
              name="hands"
              data-testid={`hands-${option.value}`}
              checked={hands === option.value}
              onChange={() => handleHandsChange(option.value)}
            />{' '}
            {option.label}{' '}
          </label>
        ))}
      </div>
      <KeyboardRangePicker
        presets={KEYBOARD_PRESETS}
        selected={keyboardPreset}
        onChange={setKeyboardPreset}
      />
      <PianoKeyboard
        lowNote={keyboardPreset.low}
        highNote={keyboardPreset.high}
        heldNotes={view.engine.heldNotes}
        expectedNotes={notesAt(score, view.engine.nextEventIndex)}
      />
      <AttemptHistory records={attempts} />
      <div>
        <button
          type="button"
          onClick={() => downloadJson(attempts, `progress-${Date.now()}.json`)}
          data-testid="export-progress"
        >
          Download progress
        </button>{' '}
        <label htmlFor="import-progress-input">Import progress</label>{' '}
        <input
          id="import-progress-input"
          type="file"
          accept="application/json"
          data-testid="import-progress-input"
          onChange={handleImportFile}
        />
      </div>
    </div>
  );
}
