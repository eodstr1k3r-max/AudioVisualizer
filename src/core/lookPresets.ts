import type { Settings } from './types';
import { useStore } from '../core/store';
import { t } from './i18n';

export interface LookPreset {
  id: string;
  name: string;
  icon: string;
  /** Partielle Settings, die dieser Look setzt */
  patch: Partial<Settings>;
}

export const LOOK_PRESETS: LookPreset[] = [
  {
    id: 'default',
    name: 'Default',
    icon: '🌌',
    patch: {
      mode: 'nebula',
      preset: 'aurora',
      cameraMode: 'auto',
      particleCount: 140,
      bloomEnabled: true,
      bloomStrength: 1.4,
      cameraFov: 62,
      cameraDistance: 34,
      cameraHeight: 14,
      fxEnabled: true,
      fxIntensity: 1,
      fxChromatic: true,
      fxGrain: true,
      fxScanlines: false,
      fxGrade: true
    }
  },
  {
    id: 'cosmic',
    name: 'Cosmic Deep',
    icon: '🌠',
    patch: {
      mode: 'fusion',
      preset: 'neon',
      cameraMode: 'auto',
      particleCount: 200,
      bloomEnabled: true,
      bloomStrength: 1.6,
      bloomRadius: 0.7,
      bloomThreshold: 0.7,
      cameraFov: 58,
      cameraDistance: 42,
      cameraHeight: 18,
      shaderPreset: 'infinitegalaxies',
      shaderBlend: 0.55,
      fxEnabled: true,
      fxChromatic: true,
      fxGrain: true,
      fxScanlines: false,
      fxGrade: true,
      fxIntensity: 1.1
    }
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    icon: '🌇',
    patch: {
      mode: 'shader',
      preset: 'sunset',
      cameraMode: 'auto',
      bloomEnabled: true,
      bloomStrength: 1.4,
      vignette: true,
      shaderPreset: 'retrowave',
      shaderBlend: 0.7,
      fxEnabled: true,
      fxChromatic: true,
      fxGrain: true,
      fxScanlines: true,
      fxGrade: true,
      fxIntensity: 1.15
    }
  },
  {
    id: 'tunnel',
    name: 'Hyperspace',
    icon: '🌀',
    patch: {
      mode: 'tunnel',
      preset: 'cyberpunk',
      cameraMode: 'auto',
      tunnelSpeed: 1.4,
      bloomEnabled: true,
      bloomStrength: 1.3,
      cameraFov: 72,
      fxEnabled: true,
      fxChromatic: true,
      fxGrain: false,
      fxScanlines: false,
      fxGrade: true,
      fxIntensity: 1.25
    }
  },
  {
    id: 'energy',
    name: 'Energy Grid',
    icon: '⚡',
    patch: {
      mode: 'shader',
      preset: 'toxic',
      cameraMode: 'orbit',
      bloomEnabled: true,
      bloomStrength: 1.8,
      bloomThreshold: 0.6,
      shaderPreset: 'energygrid',
      shaderBlend: 0.8,
      fxEnabled: true,
      fxChromatic: true,
      fxGrain: true,
      fxScanlines: true,
      fxGrade: true,
      fxIntensity: 1.2
    }
  },
  {
    id: 'cold',
    name: 'Ice Planet',
    icon: '❄️',
    patch: {
      mode: 'terrain',
      preset: 'ice',
      cameraMode: 'orbit',
      terrainAmplitude: 1.4,
      bloomEnabled: true,
      bloomStrength: 0.9,
      cameraDistance: 40,
      cameraHeight: 12,
      fxEnabled: true,
      fxChromatic: false,
      fxGrain: true,
      fxScanlines: false,
      fxGrade: true,
      fxIntensity: 0.7
    }
  },
  {
    id: 'eventhorizon',
    name: 'Event Horizon',
    icon: '🕳️',
    patch: {
      mode: 'blackhole',
      preset: 'fire',
      cameraMode: 'orbit',
      bloomEnabled: true,
      bloomStrength: 1.7,
      bloomRadius: 0.65,
      bloomThreshold: 0.68,
      cameraFov: 56,
      fxEnabled: true,
      fxChromatic: true,
      fxGrain: true,
      fxScanlines: false,
      fxGrade: true,
      fxIntensity: 1.2
    }
  },
  {
    id: 'neoncity',
    name: 'Neon City',
    icon: '🌆',
    patch: {
      mode: 'cyberpunk',
      preset: 'cyberpunk',
      cameraMode: 'auto',
      bloomEnabled: true,
      bloomStrength: 1.5,
      bloomThreshold: 0.7,
      fxEnabled: true,
      fxChromatic: true,
      fxGrain: true,
      fxScanlines: true,
      fxGrade: true,
      fxIntensity: 1.1
    }
  }
];

/** Einen Look anwenden (patch in Settings übernehmen). */
export function applyLookPreset(id: string): void {
  const preset = LOOK_PRESETS.find((p) => p.id === id);
  if (!preset) return;
  const { settings, setSetting } = useStore.getState();
  for (const [key, value] of Object.entries(preset.patch)) {
    if (settings[key as keyof Settings] !== value) {
      setSetting(key as keyof Settings, value as never);
    }
  }
  useStore.getState().setUi({ status: t('status.lookApplied').replace('{name}', preset.name) });
}
