import type { ChangeEvent } from 'react';

import type { MidiInputDescriptor } from '../midi/WebMidiSource';

export type ActiveSource =
  | { kind: 'none' }
  | { kind: 'virtual' }
  | { kind: 'webmidi'; deviceName: string }
  | { kind: 'replay'; fileName: string };

export interface DevicePickerProps {
  active: ActiveSource;
  webMidiSupported: boolean;
  webMidiInputs: MidiInputDescriptor[];
  onConnectWebMidi: (deviceId: string) => void;
  onConnectVirtual: () => void;
  onLoadReplayFile: (file: File) => void;
  onDisconnect: () => void;
}

export function DevicePicker({
  active,
  webMidiSupported,
  webMidiInputs,
  onConnectWebMidi,
  onConnectVirtual,
  onLoadReplayFile,
  onDisconnect,
}: DevicePickerProps) {
  function handleWebMidiSelect(event: ChangeEvent<HTMLSelectElement>) {
    if (event.target.value) onConnectWebMidi(event.target.value);
  }

  function handleReplayFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onLoadReplayFile(file);
    event.target.value = '';
  }

  // A fragment, so each of these is an item of the toolbar row App puts it in.
  return (
    <>
      <p data-testid="source-status">{describeActiveSource(active)}</p>

      {active.kind !== 'none' && (
        <button type="button" onClick={onDisconnect} data-testid="disconnect-button">
          Disconnect
        </button>
      )}

      <div>
        <label htmlFor="webmidi-device-select">Piano</label>{' '}
        {webMidiSupported ? (
          <select
            id="webmidi-device-select"
            data-testid="webmidi-device-select"
            onChange={handleWebMidiSelect}
            value=""
          >
            <option value="" disabled>
              {webMidiInputs.length === 0 ? 'No MIDI devices found' : 'Select a device…'}
            </option>
            {webMidiInputs.map((input) => (
              <option key={input.id} value={input.id}>
                {input.name}
              </option>
            ))}
          </select>
        ) : (
          <span>Web MIDI is not supported in this browser.</span>
        )}
      </div>

      <button type="button" onClick={onConnectVirtual} data-testid="use-virtual-keyboard">
        Use computer keyboard
      </button>

      {import.meta.env.DEV && (
        <div>
          <label htmlFor="replay-file-input">Replay a recorded fixture (dev only)</label>{' '}
          <input
            id="replay-file-input"
            type="file"
            accept="application/json"
            data-testid="replay-file-input"
            onChange={handleReplayFile}
          />
        </div>
      )}
    </>
  );
}

function describeActiveSource(active: ActiveSource): string {
  switch (active.kind) {
    case 'none':
      return 'Not connected';
    case 'virtual':
      return 'Connected: computer keyboard';
    case 'webmidi':
      return `Connected: ${active.deviceName}`;
    case 'replay':
      return `Replaying: ${active.fileName}`;
  }
}
