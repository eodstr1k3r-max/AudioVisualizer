import { MODES, PRESET_LIST, CAMERA_MODES, QUALITY_OPTIONS, KICK_STYLES } from './types';
import type { Settings } from './types';

/** Enum-Felder, deren Wert gegen die gültige Liste validiert wird. */
const ENUM_SETS: Partial<Record<keyof Settings, ReadonlySet<string>>> = {
  mode: new Set(MODES.map((m) => m.id)),
  preset: new Set(PRESET_LIST.map((p) => p.id)),
  cameraMode: new Set(CAMERA_MODES.map((c) => c.id)),
  quality: new Set(QUALITY_OPTIONS.map((q) => q.id)),
  kickStyle: new Set(KICK_STYLES.map((k) => k.id)),
  recordCodec: new Set(['auto', 'vp9', 'av1', 'h264']),
  recordQuality: new Set(['low', 'medium', 'high']),
  spectrumScale: new Set(['linear', 'log']),
  bgFitMode: new Set(['cover', 'contain'])
};

/** Numerische Werte aus der URL auf sinnvolle Grenzen klemmen. */
const NUMBER_CLAMPS: Partial<Record<keyof Settings, [number, number]>> = {
  demoBpm: [60, 220],
  cameraFov: [20, 120],
  particleCount: [40, 300]
};

/** String-Defaults, die in Share-URLs weggelassen werden (kurze Links). */
const STRING_DEFAULTS: Partial<Record<keyof Settings, string>> = {
  quality: 'ultra',
  shaderPreset: 'cybergrid',
  lookPreset: 'Default'
};

/** Numerische Defaults, die in Share-URLs weggelassen werden (kurze Links). */
const NUMBER_DEFAULTS: Partial<Record<keyof Settings, number>> = {
  demoBpm: 124,
  fxIntensity: 1
};

/**
 * Zulässige Bereiche für kritische Zahlen-Settings – werden beim Rehydrieren
 * (mergeSettings) geklemmt, damit kaputte localStorage-Stände (z. B. durch Bugs
 * oder Hand-Edits) nie Extremwerte in die Engine bringen können.
 */
const NUMBER_RANGES: Partial<Record<keyof Settings, [number, number]>> = {
  fxIntensity: [0, 1.5],
  bloomStrength: [0, 3],
  bloomRadius: [0, 1],
  bloomThreshold: [0, 1],
  sensitivity: [0, 10],
  kickThreshold: [0, 1],
  smoothing: [0, 0.99],
  volume: [0, 1],
  bgOpacity: [0, 1],
  autoCycleSeconds: [5, 60]
};

/** Settings → JSON-String (für Export & Teilen). */
export function serializeSettings(s: Settings): string {
  return JSON.stringify(s, null, 2);
}

/**
 * JSON-String → validierte Settings.
 * Unbekannte Felder und Typ-Mismatches werden still ignoriert (robust gegen
 * alte/kaputte Dateien) – fehlende Felder kommen aus den Defaults.
 * Wirft bei ungültigem JSON/Format.
 */
export function parseSettings(json: string, defaults: Settings): Settings {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Ungültiges JSON – Datei konnte nicht gelesen werden.');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Ungültiges Format – erwartet wird ein Einstellungs-Objekt.');
  }

  const out = { ...defaults };
  const defs = defaults as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const def = defs[key];
    if (def === undefined) continue; // unbekanntes Feld ignorieren
    if (typeof value !== typeof def) continue; // Typ-Mismatch ignorieren
    (out as unknown as Record<string, unknown>)[key] = value;
  }
  return out;
}

/**
 * Merged persistierte Settings über die Defaults – schema-sicher.
 * Fehlende Keys (z. B. aus alten Versionen), Typ-Mismatches und unbekannte
 * Felder werden verworfen, sodass NIE undefined/NaN in den State gelangt.
 */
export function mergeSettings(persisted: unknown, defaults: Settings): Settings {
  const out = { ...defaults };
  if (typeof persisted !== 'object' || persisted === null || Array.isArray(persisted)) return out;
  const defs = defaults as unknown as Record<string, unknown>;
  const validModes = ENUM_SETS.mode;
  for (const [key, value] of Object.entries(persisted as Record<string, unknown>)) {
    const def = defs[key];
    if (def === undefined) continue; // unbekanntes Feld ignorieren
    if (key === 'favoriteModes') {
      // Array-Sonderfall: nur bekannte Modus-IDs übernehmen, Duplikate/Ungültiges verwerfen
      if (!Array.isArray(value)) continue;
      const cleaned = [...new Set(value.filter((v): v is string => typeof v === 'string' && (!validModes || validModes.has(v))))];
      (out as unknown as Record<string, unknown>)[key] = cleaned;
      continue;
    }
    if (typeof value !== typeof def) continue; // Typ-Mismatch ignorieren (null/undefined/NaN-Dateien)
    if (typeof value === 'string') {
      const enumSet = ENUM_SETS[key as keyof Settings];
      if (enumSet && !enumSet.has(value)) continue; // ungültiger Enum-Wert ignorieren
    }
    let finalValue: unknown = value;
    if (typeof value === 'number') {
      const range = NUMBER_RANGES[key as keyof Settings];
      if (range) finalValue = Math.max(range[0], Math.min(range[1], value)); // Extremwerte klemmen
    }
    (out as unknown as Record<string, unknown>)[key] = finalValue;
  }
  return out;
}

/**
 * Validiert Deep-Link-Parameter gegen die Settings-Typen.
 * Liefert nur Felder, deren Typ zum Default passt (Zahlen/Booleans/Strings).
 */
export function extractShareParams(params: URLSearchParams, defaults: Settings): Partial<Settings> {
  const out: Partial<Settings> = {};
  const defs = defaults as unknown as Record<string, unknown>;
  for (const [key, def] of Object.entries(defs)) {
    const raw = params.get(key);
    if (raw === null || raw === '') continue;
    if (typeof def === 'number') {
      const n = Number(raw);
      if (!Number.isNaN(n)) {
        const clamp = NUMBER_CLAMPS[key as keyof Settings];
        (out as unknown as Record<string, unknown>)[key] = clamp ? Math.max(clamp[0], Math.min(clamp[1], n)) : n;
      }
    } else if (typeof def === 'boolean') {
      (out as unknown as Record<string, unknown>)[key] = raw === '1' || raw === 'true' || raw === 'on';
    } else if (typeof def === 'string') {
      const enumSet = ENUM_SETS[key as keyof Settings];
      if (enumSet && !enumSet.has(raw)) continue; // ungültiger Enum-Wert ignorieren
      (out as unknown as Record<string, unknown>)[key] = raw;
    }
    // Arrays/Objekte können nicht über Query-Parameter kommen – überspringen
  }
  return out;
}

/**
 * Baut aus den aktuellen Settings eine teilbare URL.
 * Nur nicht-default Werte landen in den Query-Parametern (kurze Links).
 */
export function buildShareUrl(s: Settings, base: string): string {
  const params = new URLSearchParams();
  const always: (keyof Settings)[] = ['mode', 'preset', 'cameraMode'];
  const ifSet: (keyof Settings)[] = [
    'quality', 'shaderPreset', 'lookPreset', 'demoMode', 'demoBpm', 'obsMode', 'autoCycle',
    // v5: Cinematic-FX-Zustand wandert mit in geteilte Links
    'fxIntensity'
  ];

  for (const key of always) params.set(key, String(s[key]));

  for (const key of ifSet) {
    const v = s[key];
    if (typeof v === 'boolean') {
      if (v) params.set(key, '1');
    } else if (typeof v === 'number') {
      const def = NUMBER_DEFAULTS[key];
      if (def === undefined || v !== def) params.set(key, String(v));
    } else if (typeof v === 'string') {
      if (v && v !== STRING_DEFAULTS[key]) params.set(key, v);
    }
  }

  // fxEnabled hat Default TRUE → nur der Aus-Zustand wird verlinkt (fxEnabled=0)
  if (!s.fxEnabled) params.set('fxEnabled', '0');

  const qs = params.toString();
  const url = base.split('?')[0];
  return qs ? `${url}?${qs}` : url;
}
