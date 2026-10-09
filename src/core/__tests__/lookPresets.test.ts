import { describe, it, expect } from 'vitest';
import { LOOK_PRESETS } from '../lookPresets';
import type { Settings } from '../types';
import { MODES, PRESET_LIST } from '../types';

/** v5: Jeder Look muss die komplette FX-Ebene mitsetzen (kein halber Zustand). */
const FX_KEYS: (keyof Settings)[] = [
  'fxEnabled', 'fxChromatic', 'fxGrain', 'fxScanlines', 'fxGrade', 'fxIntensity'
];

describe('lookPresets (v5 FX-Verdrahtung)', () => {
  it('enthält mindestens 6 Looks inkl. der beiden v5-Looks', () => {
    expect(LOOK_PRESETS.length).toBeGreaterThanOrEqual(6);
    const ids = LOOK_PRESETS.map((l) => l.id);
    expect(ids).toContain('eventhorizon');
    expect(ids).toContain('neoncity');
  });

  it('setzt in jedem Look alle FX-Felder und eine gültige Intensität', () => {
    for (const look of LOOK_PRESETS) {
      for (const key of FX_KEYS) {
        expect(look.patch, `Look "${look.id}" muss "${key}" setzen`).toHaveProperty(key);
      }
      const intensity = look.patch.fxIntensity as number;
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1.5);
    }
  });

  it('nutzt nur bekannte Modi und Paletten-IDs', () => {
    const validModes = new Set(MODES.map((m) => m.id));
    const validPresets = new Set(PRESET_LIST.map((p) => p.id));
    for (const look of LOOK_PRESETS) {
      if (look.patch.mode) expect(validModes.has(look.patch.mode), `Modus "${look.patch.mode}" unbekannt`).toBe(true);
      if (look.patch.preset) expect(validPresets.has(look.patch.preset), `Preset "${look.patch.preset}" unbekannt`).toBe(true);
    }
  });
});
