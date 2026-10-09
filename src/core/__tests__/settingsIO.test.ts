import { describe, it, expect } from 'vitest';
import {
  serializeSettings, parseSettings, extractShareParams, buildShareUrl, mergeSettings
} from '../settingsIO';
import { defaultSettings } from '../store';
import type { Settings } from '../types';

describe('settingsIO · serialize/parse', () => {
  it('serialize → parse ist ein verlustfreier Roundtrip', () => {
    const json = serializeSettings(defaultSettings);
    const parsed = parseSettings(json, defaultSettings);
    expect(parsed).toEqual(defaultSettings);
  });

  it('ignoriert unbekannte Felder (alte/kaputte Dateien)', () => {
    const parsed = parseSettings(JSON.stringify({ mode: 'sphere', gibberish: 123 }), defaultSettings);
    expect(parsed.mode).toBe('sphere');
    expect('gibberish' in parsed).toBe(false);
  });

  it('ignoriert Typ-Mismatches und übernimmt fehlende Felder aus den Defaults', () => {
    const parsed = parseSettings(
      JSON.stringify({ demoBpm: 'not-a-number', bassBoost: 9, quality: 42 }),
      defaultSettings
    );
    expect(parsed.bassBoost).toBe(9);
    expect(parsed.demoBpm).toBe(defaultSettings.demoBpm); // Mismatch → Default
    expect(parsed.quality).toBe(defaultSettings.quality);
  });

  it('wirft bei ungültigem JSON', () => {
    expect(() => parseSettings('{kaputt', defaultSettings)).toThrow();
    expect(() => parseSettings('[1,2,3]', defaultSettings)).toThrow();
    expect(() => parseSettings('null', defaultSettings)).toThrow();
  });
});

describe('settingsIO · extractShareParams', () => {
  it('extrahiert Zahlen, Booleans und Strings mit passendem Typ', () => {
    const params = new URLSearchParams('mode=sphere&demoMode=1&demoBpm=140&obsMode=1&shaderPreset=retrowave');
    const out = extractShareParams(params, defaultSettings);
    expect(out.mode).toBe('sphere');
    expect(out.demoMode).toBe(true);
    expect(out.demoBpm).toBe(140);
    expect(out.obsMode).toBe(true);
    expect(out.shaderPreset).toBe('retrowave');
  });

  it('ignoriert leere und ungültige Werte (Enum-Validierung)', () => {
    const params = new URLSearchParams('demoBpm=&quality=abc&mode=banana&obsMode=');
    const out = extractShareParams(params, defaultSettings);
    expect(Object.keys(out)).toHaveLength(0);
  });

  it('akzeptiert gültige Enum-Werte, lehnt unbekannte ab', () => {
    const out = extractShareParams(new URLSearchParams('mode=sphere&quality=medium&mode=kaputt'), defaultSettings);
    expect(out.mode).toBe('sphere');
    expect(out.quality).toBe('medium');
  });

  it('akzeptiert true/on/1 als Boolean', () => {
    expect(extractShareParams(new URLSearchParams('obsMode=true'), defaultSettings).obsMode).toBe(true);
    expect(extractShareParams(new URLSearchParams('obsMode=on'), defaultSettings).obsMode).toBe(true);
    expect(extractShareParams(new URLSearchParams('obsMode=0'), defaultSettings).obsMode).toBe(false);
  });

  it('klemmt demoBpm und ignoriert ungültige Enums wie kickStyle', () => {
    const out = extractShareParams(new URLSearchParams('demoBpm=9999&kickStyle=garbage'), defaultSettings);
    expect(out.demoBpm).toBe(220);
    expect('kickStyle' in out).toBe(false);
    const low = extractShareParams(new URLSearchParams('demoBpm=10'), defaultSettings);
    expect(low.demoBpm).toBe(60);
  });
});

describe('settingsIO · mergeSettings (Rehydration-Fix)', () => {
  it('füllt fehlende Keys aus alten Schemas mit Defaults (kein undefined!)', () => {
    // Simuliert einen localStorage-Stand aus v3.0: nur 33 Keys, v3.1-Felder fehlen
    const oldSchema = {
      mode: 'tunnel', preset: 'aurora', cameraMode: 'auto', quality: 'ultra',
      sensitivity: 1.45, smoothing: 0.82, particleCount: 140
    };
    const out = mergeSettings(oldSchema, defaultSettings);
    expect(out.tunnelSpeed).toBe(1); // Default statt undefined → kein NaN
    expect(out.cameraFov).toBe(62);
    expect(out.demoBpm).toBe(124);
    expect(out.autoCycle).toBe(false);
    expect(out.mode).toBe('tunnel'); // vorhandene Werte bleiben erhalten
  });

  it('verwirft Typ-Mismatches (null/NaN-Dateien) und unbekannte Felder', () => {
    const corrupt = { tunnelSpeed: null, demoBpm: 'schnell', mode: 'banana', gibberish: 1 };
    const out = mergeSettings(corrupt, defaultSettings);
    expect(out.tunnelSpeed).toBe(1);
    expect(out.demoBpm).toBe(124);
    expect(out.mode).toBe('nebula'); // ungültiger Enum-Wert → Default
    expect('gibberish' in out).toBe(false);
  });

  it('ist ein No-op bei Nicht-Objekten', () => {
    expect(mergeSettings(null, defaultSettings)).toEqual(defaultSettings);
    expect(mergeSettings('[1]', defaultSettings)).toEqual(defaultSettings);
    expect(mergeSettings(undefined, defaultSettings)).toEqual(defaultSettings);
  });

  it('favoriteModes: übernimmt nur gültige Modus-IDs, verwirft Duplikate/Ungültiges', () => {
    const persisted = { favoriteModes: ['nebula', 'nebula', 'blackhole', 'nicht-existent', 42, null] };
    const out = mergeSettings(persisted, defaultSettings);
    expect(out.favoriteModes).toEqual(['nebula', 'blackhole']);
  });

  it('favoriteModes: Nicht-Array-Werte werden verworfen (Default bleibt leeres Array)', () => {
    const out = mergeSettings({ favoriteModes: 'nebula' }, defaultSettings);
    expect(out.favoriteModes).toEqual([]);
  });

  it('v5: kritische Zahlenwerte werden beim Rehydrieren auf gültige Bereiche geklemmt', () => {
    const corrupt = {
      fxIntensity: 999,
      bloomStrength: -5,
      sensitivity: 42,
      volume: 7.5,
      autoCycleSeconds: 3600,
      kickThreshold: 99
    };
    const out = mergeSettings(corrupt, defaultSettings);
    expect(out.fxIntensity).toBe(1.5);        // max
    expect(out.bloomStrength).toBe(0);        // min
    expect(out.sensitivity).toBe(10);         // max
    expect(out.volume).toBe(1);               // max
    expect(out.autoCycleSeconds).toBe(60);    // max (5–60 s)
    expect(out.kickThreshold).toBe(1);        // max
  });

  it('v5: Werte innerhalb des Bereichs bleiben unverändert', () => {
    const ok = { fxIntensity: 0.8, bloomStrength: 1.4, autoCycleSeconds: 30 };
    const out = mergeSettings(ok, defaultSettings);
    expect(out.fxIntensity).toBe(0.8);
    expect(out.bloomStrength).toBe(1.4);
    expect(out.autoCycleSeconds).toBe(30);
  });
});

describe('settingsIO · buildShareUrl', () => {
  it('enthält Modus/Palette/Kamera immer', () => {
    const url = buildShareUrl(defaultSettings, 'http://localhost:4173/');
    expect(url).toContain('mode=nebula');
    expect(url).toContain('preset=aurora');
    expect(url).toContain('cameraMode=auto');
  });

  it('lässt Defaults weg, ergänzt Abweichungen', () => {
    const s: Settings = { ...defaultSettings, mode: 'shader', shaderPreset: 'retrowave', demoMode: true, demoBpm: 140 };
    const url = buildShareUrl(s, 'http://localhost:4173/?irrelevant=1');
    expect(url.startsWith('http://localhost:4173/')).toBe(true);
    expect(url).toContain('mode=shader');
    expect(url).toContain('shaderPreset=retrowave');
    expect(url).toContain('demoMode=1');
    expect(url).toContain('demoBpm=140');
    expect(url).not.toContain('quality'); // Default ultra → weggelassen
    expect(url).not.toContain('irrelevant');
  });

  it('v5: FX-Zustand wandert mit, Defaults bleiben draußen', () => {
    // Default-FX (an, Intensität 1) → keine FX-Parameter im Link
    const plain = buildShareUrl(defaultSettings, 'http://x/');
    expect(plain).not.toContain('fxEnabled');
    expect(plain).not.toContain('fxIntensity');

    // Abweichender FX-Zustand → wird verlinkt
    const custom: Settings = { ...defaultSettings, fxEnabled: false, fxIntensity: 1.3 };
    const url = buildShareUrl(custom, 'http://x/');
    expect(url).toContain('fxEnabled=0');
    expect(url).toContain('fxIntensity=1.3');
  });

  it('demoBpm-Default (124) bleibt draußen', () => {
    const url = buildShareUrl(defaultSettings, 'http://x/');
    expect(url).not.toContain('demoBpm');
  });
});
