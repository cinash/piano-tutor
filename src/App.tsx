import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

import './App.css';
import {
  DEFAULT_DEMO_SPEED,
  DEFAULT_KEYBOARD_PRESET,
  DEMO_SPEED_PRESETS,
  KEYBOARD_PRESETS,
  type DemoSpeedPreset,
  type KeyboardPreset,
} from './config';
import type { ActiveSource } from './devices/DevicePicker';
import { DevicePicker } from './devices/DevicePicker';
import { forgetLastPiano, loadLastPiano, saveLastPiano } from './devices/lastPianoStore';
import { downloadJson } from './downloadJson';
import type { Loop } from './engine/types';
import { KeyboardRangePicker } from './keyboard/KeyboardRangePicker';
import { PianoKeyboard } from './keyboard/PianoKeyboard';
import { handPositions, nextHandPositions } from './keyboard/handPosition';
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
import { DEMO_BPM, DemoPlayer, buildDemoSchedule, type DemoStep } from './practice/demo';
import { formatPosition } from './practice/positionReadout';
import { toPracticeStateSnapshot } from './practice/practiceState';
import {
  advancePracticeView,
  createInitialPracticeViewState,
  notesAt,
  restartPractice,
  setPracticeLoop,
  stopClock,
  type AttemptStats,
  type PracticeViewState,
} from './practice/practiceView';
import { loadQueueFolded, saveQueueFolded } from './practice/queueFoldStore';
import { Metronome } from './practice/metronome';
import {
  clockPosition,
  expireDueEvents,
  msPerBeatAt,
  nextClockTime,
  TIMED_WINDOW,
} from './practice/timedPlay';
import { AttemptHistory } from './progress/AttemptHistory';
import {
  isAttemptRecordArray,
  loadAttempts,
  saveAttempts,
} from './progress/attemptStore';
import { mergeAttempts } from './progress/mergeAttempts';
import type { AttemptRecord, TimedRecord } from './progress/types';
import { StaffView } from './score/StaffView';
import { loadPiece, savePiece } from './score/pieceStore';
import { timeSignatureAt } from './score/measureStartTime';
import { PIECES, allPieces, type Piece } from './score/pieces';
import {
  COMPUTER_KEYBOARD_HIGH,
  COMPUTER_KEYBOARD_LOW,
  hasPitchOutside,
  timedPlayable,
} from './score/pieceRules';
import { checkUpload, loadUploads, newUpload, saveUploads } from './score/uploads';
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

type PracticeMode = 'wait' | 'timed';

// Radios rather than a <select>, for the reason HAND_OPTIONS gives: "Timed" would
// answer to T, which is G4.
const MODE_OPTIONS: readonly { value: PracticeMode; label: string }[] = [
  { value: 'wait', label: 'Wait' },
  { value: 'timed', label: 'Timed' },
];

/** A timed attempt as its record keeps it: how it was played, and its counters. */
function timedRecord(
  attempt: AttemptStats,
  speed: number,
  metronome: boolean,
): TimedRecord {
  return {
    speed,
    bpm: DEMO_BPM * speed,
    window: TIMED_WINDOW,
    metronome,
    missedNoteCount: attempt.missedNoteCount,
    offTimeNoteCount: attempt.offTimeNoteCount,
    hitNoteCount: attempt.hitNoteCount,
    hitOffsetBeats: attempt.hitOffsetBeats,
    hitAbsOffsetBeats: attempt.hitAbsOffsetBeats,
  };
}

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
  // Read before the piece, so a remembered upload is found. A new one goes through
  // saveUploads as it is added, not from an effect, so no render offers it half-known.
  const [uploads, setUploads] = useState(loadUploads);
  // Remembered across a reload, unlike hands, range and speed — see DECISIONS.md.
  const [piece, setPiece] = useState<Piece>(loadPiece);
  // A display choice, and deliberately not engine state: practice must be identical
  // folded and unfolded — see DECISIONS.md.
  const [queueFolded, setQueueFolded] = useState(loadQueueFolded);
  // What the demo is sounding and where in the piece it has reached, and null when no
  // demo is running.
  const [demoStep, setDemoStep] = useState<DemoStep | null>(null);
  // Not remembered across a reload. Listen reads it when pressed, so a change while the
  // demo plays is heard from the next one; in Timed it is also the tempo practice runs
  // at, and a change restarts the attempt — see DECISIONS.md.
  const [demoSpeed, setDemoSpeed] = useState<DemoSpeedPreset>(DEFAULT_DEMO_SPEED);
  // Not view state, so none of the paths that reset practice has to be told of it; not
  // remembered across a reload, so the app never opens onto a clock nobody chose.
  const [mode, setMode] = useState<PracticeMode>('wait');
  const [metronomeOn, setMetronomeOn] = useState(true);
  // One for the app's lifetime; its AudioContext is made on the first click that needs it.
  const [metronome] = useState(() => new Metronome());
  // performance.now() as of the timed clock's last timer, so rendering stays pure while the
  // cursor follows the clock.
  const [timerFiredAt, setTimerFiredAt] = useState(0);

  // The piece as the selected hand plays it. A plain const: nothing depends on the
  // score's identity across renders, and filtering 44 events costs nothing.
  const score = filterScoreByHand(piece.score, hands);
  // Judged on the whole piece, so hiding one hand's fast notes cannot offer Timed.
  const waitOnly = !timedPlayable(piece.score);
  // Only for an upload, the one kind of piece with a title of its own: the bundled pieces are
  // all in range, as pieces.test.ts checks.
  const outsideComputerKeyboard =
    piece.title !== undefined &&
    hasPitchOutside(piece.score, COMPUTER_KEYBOARD_LOW, COMPUTER_KEYBOARD_HIGH);
  const outsideOnScreenKeyboard = hasPitchOutside(
    piece.score,
    DEFAULT_KEYBOARD_PRESET.low,
    DEFAULT_KEYBOARD_PRESET.high,
  );

  // Where the demo has reached while one plays, so the cursor follows it; where the music
  // is while a timed clock runs, since the engine may be a note ahead of it; the note the
  // engine is waiting for otherwise. The filtered score, which nextEventIndex indexes.
  const staffTarget =
    demoStep?.startTime ??
    (view.timedClock
      ? clockPosition(score, view.timedClock, view.engine.loop, timerFiredAt)
      : score.events[view.engine.nextEventIndex]?.startTime);

  // Where the hands sit: practice's place, or while the demo plays, the first event at
  // or after its place, so a silence shows where the next note is. The demo plays the
  // whole piece, so it has no loop to wrap at; after its last note there is no event,
  // and -1 finds no position, as past the end does.
  const positionIndex = demoStep
    ? score.events.findIndex((event) => event.startTime >= demoStep.startTime)
    : view.engine.nextEventIndex;
  const positionLoop = demoStep ? undefined : view.engine.loop;

  const openAttemptRef = useRef<number | null>(null);
  const sourceRef = useRef<MidiSource | null>(null);
  const connectedDeviceIdRef = useRef<string | null>(null);
  const recordedEventsRef = useRef<MidiEvent[]>([]);
  const isRecordingRef = useRef(false);
  const demoRef = useRef<DemoPlayer | null>(null);
  // handleEvent is registered once, at attach() time, so it can't close over the score
  // of the render that changed the hand — it reads the current one through this ref.
  const scoreRef = useRef(score);
  // Refs for the same reason: a closure would see the mode and speed of attach() time,
  // and the radios only appear after connecting. The metronome is one object throughout,
  // so its grid is read from it directly.
  const modeRef = useRef(mode);
  const demoSpeedRef = useRef(demoSpeed);

  function handleEvent(event: MidiEvent) {
    // Listening is not practising: without this, a child playing along with the demo
    // would have every note recorded as an attempt, and most of them wrong. Like
    // isRecordingRef, a ref because handleEvent is registered once, at attach() time.
    if (demoRef.current) return;
    if (isRecordingRef.current) recordedEventsRef.current.push(event);
    const timing =
      modeRef.current === 'timed'
        ? { msPerBeat: msPerBeatAt(demoSpeedRef.current.speed), grid: metronome.grid }
        : null;
    setView((prev) =>
      advancePracticeView(prev, scoreRef.current, event, event.time, timing),
    );
  }

  function handleLoopChange(loop: Loop | undefined) {
    setView((prev) => setPracticeLoop(prev, loop));
  }

  function handleRestart() {
    setView(restartPractice);
  }

  // Stable: disconnect() and the unmount cleanup below both depend on it.
  const stopDemo = useCallback(() => {
    demoRef.current?.stop();
    demoRef.current = null;
    setDemoStep(null);
  }, []);

  function handleHandsChange(next: HandSelection) {
    setHands(next);
    stopDemo();
    // nextEventIndex indexes the event list, and the other hand's is a different list,
    // so the same number would be a different note — start the attempt again.
    setView(restartPractice);
  }

  function handlePieceChange(id: string) {
    const next = allPieces().find((candidate) => candidate.id === id);
    if (!next) return;
    setPiece(next);
    // Not put back on leaving the piece: the mode stays Wait until the child chooses Timed.
    if (!timedPlayable(next.score)) setMode('wait');
    stopDemo();
    // A fresh start rather than restartPractice, which keeps the loop: a loop is bars of
    // the old piece, which the new one may not have.
    setView(createInitialPracticeViewState());
  }

  // A focused select jumps to the option starting with the letter typed, and the computer
  // keyboard plays letters as notes, so a pick followed by a B would change the piece.
  // The key still reaches the window, where the note is played — see DECISIONS.md. Not
  // with a modifier held: Ctrl+F reports its key as "f", and find must still work.
  function cancelTypeAhead(event: KeyboardEvent<HTMLSelectElement>) {
    const shortcut = event.ctrlKey || event.metaKey || event.altKey;
    if (event.key.length === 1 && !shortcut) event.preventDefault();
  }

  // Each timed attempt has one mode, one speed and one metronome setting, so a change
  // starts it again. Both controls are clicks, where a browser lets audio start.
  function handleModeChange(next: PracticeMode) {
    metronome.wake();
    setMode(next);
    setView(restartPractice);
  }

  function handleMetronomeChange(event: ChangeEvent<HTMLInputElement>) {
    metronome.wake();
    setMetronomeOn(event.target.checked);
    setView(restartPractice);
  }

  function handleListen() {
    if (demoRef.current) {
      stopDemo();
      return;
    }
    // Practice ignores notes while the demo plays, so a running clock would miss every
    // event under it. After Stop, the next right note starts a new one.
    setView(stopClock);
    // The filtered score, so "Left hand" plus Listen demonstrates the left hand alone.
    // A null is the schedule running out, and ends the demo the same way Stop does.
    const player = new DemoPlayer(
      buildDemoSchedule(score, DEMO_BPM * demoSpeed.speed),
      // The selected input's name is the output's name too, on this instrument.
      active.kind === 'webmidi' ? active.deviceName : null,
      (step) => (step ? setDemoStep(step) : stopDemo()),
    );
    // Both set before start() has finished looking for the port, so a second click
    // stops this demo rather than starting another and the button reads "Stop" at once.
    demoRef.current = player;
    // Nothing sounding yet, at the start of the piece where the demo is about to begin.
    setDemoStep({ atMs: 0, startTime: 0, pitches: new Set() });
    void player.start();
  }

  function handleDemoSpeedChange(event: ChangeEvent<HTMLSelectElement>) {
    const preset = DEMO_SPEED_PRESETS.find(
      (candidate) => candidate.label === event.target.value,
    );
    if (!preset) return;
    setDemoSpeed(preset);
    if (mode === 'timed') setView(restartPractice);
  }

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    modeRef.current = mode;
    demoSpeedRef.current = demoSpeed;
  }, [mode, demoSpeed]);

  // Clicking exactly while it is wanted, so it comes back after a reconnect or a Stop,
  // and on a new grid when the speed changes.
  const isConnected = active.kind !== 'none';
  const clicking = mode === 'timed' && metronomeOn && isConnected && demoStep === null;
  const msPerBeat = msPerBeatAt(demoSpeed.speed);
  useEffect(() => {
    if (!clicking) return;
    metronome.start(msPerBeat);
    return () => metronome.stop();
  }, [metronome, clicking, msPerBeat]);

  // While a clock runs, each bar's first beat is accented: counted from where the piece's
  // first bar would have begun on this clock, which a whole-bar loop's passes keep in step.
  const { timedClock } = view;
  const firstBarStartTime = timedClock
    ? timedClock.startedAt - timedClock.startTime * timedClock.msPerBeat
    : null;
  const beatsPerBar = timeSignatureAt(score, 1).beats;
  useEffect(() => {
    metronome.accentFrom(
      firstBarStartTime === null ? null : { firstBarStartTime, beatsPerBar },
    );
  }, [metronome, firstBarStartTime, beatsPerBar]);

  // A timed event nobody played is missed when its window closes, found by a timer rather
  // than by the next note, which also moves the cursor on as each event falls due.
  // performance.now(), the timeline MidiEvent.time is on. Rounded up, since fake timers
  // truncate a fractional delay; every firing sets a new `timerFiredAt`, which runs this
  // again.
  useEffect(() => {
    // Never before the last firing: a coarse performance.now() can read short of the time
    // it fired for, and would then wake for that same time again, set nothing new, and
    // leave the clock stalled.
    const wake = nextClockTime(
      view,
      scoreRef.current,
      Math.max(performance.now(), timerFiredAt),
    );
    if (wake === null) return;
    const timer = setTimeout(
      () => {
        const firedAt = Math.max(performance.now(), wake);
        setTimerFiredAt(firedAt);
        setView((prev) => expireDueEvents(prev, scoreRef.current, firedAt));
      },
      Math.ceil(wake - performance.now()),
    );
    return () => clearTimeout(timer);
  }, [view, timerFiredAt]);

  // A demo left running past unmount would leave the instrument sounding.
  useEffect(() => stopDemo, [stopDemo]);

  useEffect(() => {
    if (import.meta.env.DEV) window.__practiceState = toPracticeStateSnapshot(view);
  }, [view]);

  // The wall clock lives here, not in the clock-free reducer; the open record is written
  // through on every change rather than at an end of attempt — see DECISIONS.md.
  useEffect(() => {
    const { notesPlayed, wrongNoteCount, reachedEnd } = view.attempt;
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
      reachedEnd,
      loop: view.engine.loop,
      piece: piece.id,
      hands,
      // Mode and speed through refs: as dependencies, a wait-mode speed change would
      // re-run this and move the open record's endedAt. A timed attempt restarts on either,
      // so the refs hold what it was played with. The metronome setting cannot change in
      // Wait, so it is an ordinary dependency.
      timed:
        modeRef.current === 'timed'
          ? timedRecord(view.attempt, demoSpeedRef.current.speed, metronomeOn)
          : undefined,
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
  }, [view, piece.id, hands, metronomeOn]);

  useEffect(() => saveAttempts(attempts), [attempts]);

  useEffect(() => saveQueueFolded(queueFolded), [queueFolded]);

  useEffect(() => savePiece(piece), [piece]);

  function attach(
    source: MidiSource,
    nextStatus: ActiveSource,
    deviceId: string | null = null,
  ) {
    stopDemo();
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
    stopDemo();
    sourceRef.current?.stop();
    sourceRef.current = null;
    connectedDeviceIdRef.current = null;
    setView(createInitialPracticeViewState());
    setActive({ kind: 'none' });
  }, [stopDemo]);

  function connectWebMidi(deviceId: string) {
    const device = webMidiInputs.find((input) => input.id === deviceId);
    if (device) saveLastPiano(device.name);
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

  // A refusal, or a full store, changes nothing but the alert line.
  async function uploadPiece(file: File) {
    const checked = checkUpload(new Uint8Array(await file.arrayBuffer()), file.name, {
      bundledTitles: PIECES.map((candidate) => candidate.score.title),
      storedTitles: uploads.map((upload) => upload.title),
      storedBytes: uploads.reduce(
        (sum, upload) => sum + new TextEncoder().encode(upload.xml).length,
        0,
      ),
    });
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    const upload = newUpload(checked, uploads);
    const next = [...uploads, upload];
    try {
      saveUploads(next);
    } catch {
      setError('Could not save this piece; browser storage is full.');
      return;
    }
    setUploads(next);
    handlePieceChange(upload.id);
    setError(null);
  }

  // Cleared after each pick, as Import progress is: Chrome fires no change for the same file
  // picked again.
  function handleUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadPiece(file);
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
          // Nothing attached means a page load or an unplug, since Disconnect forgets
          // the piano. The ref, not React state, because the list has not re-rendered.
          if (sourceRef.current !== null) return;
          const remembered = loadLastPiano();
          const piano = connected.find((input) => input.name === remembered);
          if (piano) {
            attach(
              new WebMidiSource(piano.id),
              { kind: 'webmidi', deviceName: piano.name },
              piano.id,
            );
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
    // Not attach: the first render's is safe to keep, since it touches only refs, state
    // setters and the stable stopDemo, and handleEvent reads through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="toolbar">
        <h1>piano-tutor</h1>
        <DevicePicker
          active={active}
          webMidiSupported={webMidiSupported}
          webMidiInputs={webMidiInputs}
          onConnectWebMidi={connectWebMidi}
          onConnectVirtual={connectVirtual}
          onLoadReplayFile={(file) => void loadReplayFile(file)}
          onDisconnect={() => {
            // Here rather than in disconnect(), which an unplug calls too: replugging
            // reconnects only because the unplug leaves the piano remembered.
            forgetLastPiano();
            disconnect();
          }}
        />
      </div>
      {/* Always shown, for the piece select: a piece is chosen before connecting too. */}
      <div className="toolbar">
        {isConnected && (
          <>
            <button type="button" onClick={handleRestart} data-testid="restart-practice">
              Restart
            </button>
            <button type="button" onClick={handleListen} data-testid="listen-to-piece">
              {demoStep ? 'Stop' : 'Listen'}
            </button>
            {/* On this row, not its own: anything below that moves breaks the element
                snapshots. */}
            <label htmlFor="demo-speed-select">Speed</label>
            {/* Type-ahead cancelled too: a change restarts a timed attempt, and 5 and 7
                are note keys that would jump it to 50% or 75%. */}
            <select
              id="demo-speed-select"
              data-testid="demo-speed-select"
              value={demoSpeed.label}
              onChange={handleDemoSpeedChange}
              onKeyDown={cancelTypeAhead}
            >
              {DEMO_SPEED_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.label}>
                  {preset.label}
                </option>
              ))}
            </select>
            <span>
              Mode{' '}
              {MODE_OPTIONS.map((option) => (
                <label key={option.value} htmlFor={`mode-${option.value}`}>
                  <input
                    id={`mode-${option.value}`}
                    type="radio"
                    name="mode"
                    data-testid={`mode-${option.value}`}
                    checked={mode === option.value}
                    disabled={option.value === 'timed' && waitOnly}
                    onChange={() => handleModeChange(option.value)}
                  />{' '}
                  {option.label}{' '}
                </label>
              ))}
            </span>
            <label htmlFor="metronome-checkbox">
              <input
                id="metronome-checkbox"
                type="checkbox"
                data-testid="metronome-checkbox"
                checked={metronomeOn}
                disabled={mode === 'wait'}
                onChange={handleMetronomeChange}
              />{' '}
              Metronome
            </label>
          </>
        )}
        <label htmlFor="piece-select">Piece</label>
        <select
          id="piece-select"
          data-testid="piece-select"
          value={piece.id}
          onChange={(event) => handlePieceChange(event.target.value)}
          onKeyDown={cancelTypeAhead}
        >
          {PIECES.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.score.title}
            </option>
          ))}
          {uploads.length > 0 && (
            <optgroup label="Yours">
              {uploads.map((upload) => (
                <option key={upload.id} value={upload.id}>
                  {timedPlayable(upload.score)
                    ? upload.title
                    : `${upload.title} (Wait mode only)`}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {import.meta.env.DEV && isConnected && (
          <button type="button" onClick={toggleRecording} data-testid="toggle-recording">
            {isRecording ? 'Stop recording & download' : 'Start recording'}
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {/* Lines of their own below the toolbar rows, so neither row's width changes. */}
      {waitOnly && (
        <p data-testid="wait-only-note">
          Timed mode cannot keep time through this piece yet; it plays in Wait mode.
        </p>
      )}
      {outsideComputerKeyboard && (
        <p data-testid="range-warning">
          Some notes are outside the computer keyboard&apos;s range (C3–G5); the piano
          plays them.
          {outsideOnScreenKeyboard && (
            <>
              <br />
              Some notes are also outside the on-screen keyboard&apos;s default range
              (C2–B5).
            </>
          )}
        </p>
      )}
      {/* Keyed, so a new piece is a fresh mount with one score in the pane and no
          cursor left pointing at the old one. */}
      <StaffView key={piece.id} xml={piece.xml} targetStartTime={staffTarget} />
      <LoopPicker
        measureCount={score.measureCount}
        loop={view.engine.loop}
        onChange={handleLoopChange}
      />
      {!queueFolded && (
        <FallingNotes
          events={score.events}
          status={view.engine.status}
          nextEventIndex={view.engine.nextEventIndex}
          satisfiedNoteIds={view.engine.satisfiedNoteIds}
          hasWrongNote={view.wrongNotes.size > 0}
        />
      )}
      {/* Below the queue: anything above it shifts the queue by a sub-pixel and its
          committed screenshots fail on an edge sliver. */}
      <label htmlFor="fold-queue-checkbox">
        <input
          id="fold-queue-checkbox"
          type="checkbox"
          data-testid="fold-queue-checkbox"
          checked={queueFolded}
          onChange={(event) => setQueueFolded(event.target.checked)}
        />{' '}
        Hide the finger queue
      </label>
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
      {/* While the demo runs the keyboard shows what is sounding and where the hands
          sit, but not the keys the engine waits for: those would be a second
          instruction at the same time. */}
      <PianoKeyboard
        lowNote={keyboardPreset.low}
        highNote={keyboardPreset.high}
        heldNotes={demoStep?.pitches ?? view.engine.heldNotes}
        expectedNotes={demoStep ? [] : notesAt(score, view.engine.nextEventIndex)}
        handPositions={handPositions(score, positionIndex, positionLoop)}
        nextHandPositions={nextHandPositions(score, positionIndex, positionLoop)}
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
        />{' '}
        <label htmlFor="upload-piece-input">Add a piece (MusicXML)</label>{' '}
        <input
          id="upload-piece-input"
          type="file"
          accept=".musicxml,.xml,.mxl"
          data-testid="upload-piece-input"
          onChange={handleUploadFile}
        />
      </div>
    </div>
  );
}
