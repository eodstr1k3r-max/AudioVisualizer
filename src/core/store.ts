import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mergeSettings } from './settingsIO';
import type { Settings } from './types';

/** Robust localStorage-Zugriff – funktioniert in Browser, SSR und Tests. */
function getLocalStorage(): Storage {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    /* Fallback unten */
  }
  // In-Memory-Fallback (SSR/Tests/private Browsing): Persistenz wird nur für die Session gehalten
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    }
  };
}

export type { Settings };

export const DEFAULT_SHADER_CODE = `vec4 mainImage(vec2 uv, float u_time, float u_bass, float u_mid, float u_treble, float u_energy, float u_kick, vec2 u_resolution) {
    vec2 st = (uv * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);
    float r = length(st);
    vec3 col = vec3(0.01, 0.02, 0.06);
    float wave = sin(r * 12.0 - u_time * 3.0 + u_bass * 6.0);
    col += vec3(0.2, 0.5, 1.0) * (u_bass / (abs(wave) + 0.12));
    col += vec3(0.8, 0.2, 0.6) * u_kick * (1.2 - r);
    col += vec3(0.1, 0.9, 0.8) * u_treble * (0.3 / (abs(st.x) + 0.4));
    return vec4(col, 1.0);
}`;

export interface TrackInfo {
  name: string;
  url: string;
}

export interface UiState {
  playing: boolean;
  micActive: boolean;
  sourceName: string;
  status: string;
  fps: number;
  /** True, solange eine (lazy code-gesplittete) Szene im Hintergrund nachgeladen wird */
  loadingScene: boolean;
  beatActive: boolean;
  beatText: string;
  recording: boolean;
  /** Aufnahme pausiert (Pause/Resume im Recorder). */
  recPaused: boolean;
  /** Aufnahmedauer in Sekunden (live, exkl. Pausen). */
  recSeconds: number;
  /** Geschätzte Dateigröße der laufenden Aufnahme in Bytes (live). */
  recSizeBytes: number;
  midiState: string;
  midiLearnTarget: string | null;
  cleanMode: boolean;
  helpOpen: boolean;
  tracks: TrackInfo[];
  currentTrackIndex: number;
  /** Aktuelle Wiedergabezeit / Dauer (für Fortschrittsbalken) */
  trackTime: number;
  trackDuration: number;
  /// Timestamp des letzten Screenshots – triggert den Kamera-Blitz in der UI
  flashTick: number;
  /** True, wenn der Browser den WebGL/GPU-Kontext zurückgesetzt hat → Overlay mit Reload */
  contextLost: boolean;
}

export const defaultSettings: Settings = {
  mode: 'nebula',
  preset: 'aurora',
  cameraMode: 'auto',
  quality: 'ultra',
  sensitivity: 1.45,
  smoothing: 0.82,
  particleCount: 140,
  kickThreshold: 0.29,
  kickStyle: 'glow',
  kickVisualStrength: 0.45,
  spectrumScale: 'log',
  bassBoost: 3,
  bgOpacity: 0.3,
  bgContrast: 0.55,
  bgFitMode: 'cover',
  bgScale: 1,
  bgPosX: 0,
  bgPosY: 0,
  overlayVideoScale: 0.6,
  overlayKeyThreshold: 222,
  overlayKeySoftness: 22,
  overlayVideoSpeed: 1,
  recordResolution: '1920',
  recordFps: 60,
  recordCodec: 'auto',
  recordQuality: 'medium',
  recordMaxSeconds: 0,
  shaderPreset: 'cybergrid',
  shaderBlend: 0.65,
  shaderCode: DEFAULT_SHADER_CODE,
  bloomEnabled: true,
  // ACES-Grading komprimiert Highlights filmisch – daher etwas mehr Bloom
  // (höhere Stärke), aber Schwelle nicht zu tief, sonst wirkt das Bild milchig.
  bloomStrength: 1.4,
  bloomRadius: 0.55,
  bloomThreshold: 0.72,
  vignette: true,

  /* v5.0 Cinematic-FX-Stack */
  fxEnabled: true,
  fxChromatic: true,
  fxGrain: true,
  fxScanlines: false,
  fxGrade: true,
  fxIntensity: 1,

  /* v3.1 Feature-Set */
  demoMode: false,
  demoBpm: 124,
  showMonitor: true,
  cameraFov: 62,
  cameraDistance: 34,
  cameraHeight: 14,
  autoSpeed: 1,
  orbitSpeed: 1,
  tunnelSpeed: 1,
  terrainAmplitude: 1,
  particleRotation: 1,
  particleSymmetry: 3,
  orbSize: 1,
  autoQuality: true,
  obsMode: false,
  alphaRecording: false,
  customAccent: '#8b5cf6',
  customAccent2: '#22d3ee',
  lookPreset: 'Default',
  autoCycle: false,
  autoCycleSeconds: 15,
  volume: 1,

  /* v3.2 Feature-Set */
  playbackMode: 'all',
  lang: 'de',
  overlayText: '',
  overlaySize: 1,
  overlayPosition: 'bottom',
  overlayColor: '#ffffff',

  /* v4.4 Feature-Set */
  favoriteModes: []
};

const defaultUi: UiState = {
  playing: false,
  micActive: false,
  sourceName: 'Keine Quelle',
  status: 'Ready · Lade Musik oder aktiviere Mikrofon',
  fps: 0,
  loadingScene: false,
  beatActive: false,
  beatText: 'Bereit',
  recording: false,
  recPaused: false,
  recSeconds: 0,
  recSizeBytes: 0,
  midiState: 'Kein MIDI-Controller',
  midiLearnTarget: null,
  cleanMode: false,
  helpOpen: false,
  tracks: [],
  currentTrackIndex: -1,
  trackTime: 0,
  trackDuration: 0,
  flashTick: 0,
  contextLost: false
};

interface AppState {
  settings: Settings;
  ui: UiState;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSettings: (partial: Partial<Settings>) => void;
  setUi: (partial: Partial<UiState>) => void;
  resetSettings: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      ui: defaultUi,
      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),
      setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      setUi: (partial) => set((s) => ({ ui: { ...s.ui, ...partial } })),
      resetSettings: () => set({ settings: defaultSettings })
    }),
    {
      name: 'avp3-settings-v1',
      partialize: (s) => ({ settings: s.settings }),
      storage: createJSONStorage(getLocalStorage),
      // Schema-sicheres Rehydrieren: immer über die Defaults mergen + typ-validieren.
      // Verhindert, dass alte/veraltete localStorage-Stände v3.1-Felder auf undefined
      // setzen (was z. B. den Tunnel-Speed zu NaN machen würde).
      merge: (persisted, current) => {
        const p = persisted as { settings?: unknown } | undefined;
        const settings = mergeSettings(p?.settings, defaultSettings);
        // One-time Migration: Bloom-Defaults wurden ans ACES-Grading angepasst.
        // Greift nur, wenn der Nutzer die alten Defaults nie manuell verändert hat.
        if (settings.bloomStrength === 1.1 && settings.bloomThreshold === 0.82) {
          settings.bloomStrength = 1.4;
          settings.bloomThreshold = 0.72;
        }
        // v4.5: Schwelle 0.6 → 0.72 (weniger milchig) – nur falls noch auf Default.
        if (settings.bloomThreshold === 0.6) {
          settings.bloomThreshold = 0.72;
        }
        return { ...current, settings };
      }
    }
  )
);
