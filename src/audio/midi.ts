import { useStore, type Settings } from '../core/store';
import { t } from '../core/i18n';
import { onFirstInteraction } from '../core/interaction';

/** Festes CC-Mapping + für MIDI-Learn registrierbare Parameter */
export const MIDI_PARAMS: Record<string, { min: number; max: number; label: string }> = {
  sensitivity: { min: 0.5, max: 3.0, label: 'Sensitivität' },
  kickThreshold: { min: 0.1, max: 0.8, label: 'Kick-Schwelle' },
  bgOpacity: { min: 0, max: 1, label: 'BG-Deckkraft' },
  bloomStrength: { min: 0, max: 3, label: 'Bloom-Stärke' },
  shaderBlend: { min: 0, max: 1, label: 'Shader-Blend' },
  overlayVideoScale: { min: 0.2, max: 1.4, label: 'Video-Größe' },
  autoSpeed: { min: 0.2, max: 4, label: 'Flug-Speed' },
  cameraDistance: { min: 16, max: 90, label: 'Kamera-Distanz' },
  cameraHeight: { min: 4, max: 50, label: 'Kamera-Höhe' },
  cameraFov: { min: 35, max: 110, label: 'Kamera-FOV' },
  tunnelSpeed: { min: 0.25, max: 3, label: 'Tunnel-Speed' },
  terrainAmplitude: { min: 0.2, max: 2.5, label: 'Terrain-Amplitude' },
  particleRotation: { min: 0.1, max: 4, label: 'Partikel-Rotation' },
  demoBpm: { min: 70, max: 180, label: 'Demo-BPM' }
};

const FIXED_MAP: Record<number, { key: keyof Settings; min: number; max: number }> = {
  1: { key: 'sensitivity', min: 0.5, max: 3.0 },
  2: { key: 'kickThreshold', min: 0.1, max: 0.8 },
  3: { key: 'bgOpacity', min: 0, max: 1 },
  4: { key: 'bloomStrength', min: 0, max: 3 },
  5: { key: 'shaderBlend', min: 0, max: 1 }
};

const LEARN_STORAGE = 'avp3-midi-learn';

function loadLearned(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(LEARN_STORAGE) || '{}');
  } catch {
    return {};
  }
}

function saveLearned(map: Record<number, string>): void {
  localStorage.setItem(LEARN_STORAGE, JSON.stringify(map));
}

/**
 * MIDI-Zugriff erst bei der ersten Nutzerinteraktion anfordern.
 * – entfernt die Boot-Warnung („Web MIDI will ask a permission…")
 * – der Permission-Prompt passiert auf einer Nutzergeste (bessere Browser-Kompatibilität)
 */
export function initMidiLazy(): void {
  let connected = false;
  const connect = (): void => {
    if (connected) return;
    connected = true;
    document.removeEventListener('visibilitychange', onVisibility);
    connectMidi();
  };
  const onVisibility = (): void => {
    if (!document.hidden) connect(); // Kiosk/OBS: auch beim Tab-Wechsel verbinden
  };
  onFirstInteraction(connect);
  document.addEventListener('visibilitychange', onVisibility);
}

/** Fordert den MIDI-Zugriff an und verdrahtet alle Inputs. */
export function connectMidi(): void {
  const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
  if (!nav.requestMIDIAccess) return;

  nav.requestMIDIAccess().then(
    (access) => {
      const connect = (input: MIDIInput) => {
        input.onmidimessage = handleMidiMessage;
      };
      access.inputs.forEach(connect);
      access.onstatechange = (e) => {
        const port = e.port;
        if (port && port.type === 'input' && port.state === 'connected') {
          connect(port as MIDIInput);
        }
      };
      useStore.getState().setUi({ midiState: t('status.midiConnected') });
    },
    () => {
      useStore.getState().setUi({ midiState: t('status.midiUnavailable') });
    }
  );
}

function handleMidiMessage(event: MIDIMessageEvent): void {
  const data = event.data as Uint8Array;
  const status = data[0];
  const command = status >> 4;
  if (command !== 11) return; // nur CC

  const cc = data[1];
  const value = data[2] / 127;
  const store = useStore.getState();

  // MIDI-Learn: nächste CC-Nachricht dem gewählten Parameter zuweisen
  if (store.ui.midiLearnTarget) {
    const key = store.ui.midiLearnTarget as keyof Settings;
    const learned = loadLearned();
    learned[cc] = key;
    saveLearned(learned);
    store.setUi({ midiLearnTarget: null });
    const range = MIDI_PARAMS[key];
    store.setUi({ midiState: `MIDI-Learn: CC#${cc} → ${range?.label ?? key}` });
    applyMapping(key, cc, value);
    return;
  }

  const learned = loadLearned();
  const target = learned[cc] ?? FIXED_MAP[cc]?.key;
  if (target) {
    applyMapping(target, cc, value);
    store.setUi({ midiState: `MIDI CC#${cc}: ${Math.round(value * 127)}` });
  }
}

function applyMapping(target: string, cc: number, value: number): void {
  const key = target as keyof Settings;
  const fixed = FIXED_MAP[cc];
  const range = MIDI_PARAMS[key] ?? (fixed ? { min: fixed.min, max: fixed.max } : { min: 0, max: 1 });
  const mapped = range.min + value * (range.max - range.min);

  const store = useStore.getState();
  const settings = store.settings;
  if (key in settings && typeof settings[key] === 'number') {
    store.setSetting(key, mapped as never);
  }
}
