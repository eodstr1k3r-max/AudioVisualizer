import { useStore } from './store';
import type { CameraMode } from './types';

/** Ein gespeicherter Kamera-Preset (Kombination aus Kameraeinstellungen). */
export interface CameraPreset {
  cameraFov: number;
  cameraDistance: number;
  cameraHeight: number;
  autoSpeed: number;
  orbitSpeed: number;
  cameraMode: CameraMode;
}

const STORAGE = 'avp3-camera-presets';

/** Aktuelle Kameraeinstellungen als Preset einfangen. */
export function captureCameraPreset(): CameraPreset {
  const s = useStore.getState().settings;
  return {
    cameraFov: s.cameraFov,
    cameraDistance: s.cameraDistance,
    cameraHeight: s.cameraHeight,
    autoSpeed: s.autoSpeed,
    orbitSpeed: s.orbitSpeed,
    cameraMode: s.cameraMode
  };
}

export function loadCameraPresets(): (CameraPreset | null)[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if (Array.isArray(raw) && raw.length === 3) return raw as (CameraPreset | null)[];
  } catch {
    /* ignorieren */
  }
  return [null, null, null];
}

export function saveCameraPreset(slot: number, preset: CameraPreset): void {
  const presets = loadCameraPresets();
  presets[slot] = preset;
  localStorage.setItem(STORAGE, JSON.stringify(presets));
}

export function clearCameraPreset(slot: number): void {
  const presets = loadCameraPresets();
  presets[slot] = null;
  localStorage.setItem(STORAGE, JSON.stringify(presets));
}

/** Wendet einen gespeicherten Preset an. Liefert false, wenn der Slot leer ist. */
export function applyCameraPreset(slot: number): boolean {
  const preset = loadCameraPresets()[slot];
  if (!preset) return false;
  const { setSetting } = useStore.getState();
  setSetting('cameraFov', preset.cameraFov);
  setSetting('cameraDistance', preset.cameraDistance);
  setSetting('cameraHeight', preset.cameraHeight);
  setSetting('autoSpeed', preset.autoSpeed);
  setSetting('orbitSpeed', preset.orbitSpeed);
  setSetting('cameraMode', preset.cameraMode);
  return true;
}
