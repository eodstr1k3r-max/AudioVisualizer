import { describe, it, expect } from 'vitest';
import { colorPresets, paletteFor } from '../colorPresets';
import { MODES, PRESET_LIST, CAMERA_MODES, QUALITY_OPTIONS, KICK_STYLES } from '../types';

describe('colorPresets', () => {
  it('exposes all color presets with palette metadata', () => {
    const ids = Object.keys(colorPresets);
    expect(ids.length).toBeGreaterThanOrEqual(6);
    for (const id of ids) {
      const p = colorPresets[id as keyof typeof colorPresets];
      expect(p.name).toBeTruthy();
      expect(p.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.accent2).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.spread).toHaveLength(3);
    }
  });

  it('falls back to aurora for unknown presets', () => {
    expect(paletteFor('does-not-exist' as never)).toBe(colorPresets.aurora);
  });

  it('returns the matching palette for valid presets', () => {
    expect(paletteFor('sunset')).toBe(colorPresets.sunset);
  });
});

describe('catalog consistency (types.ts)', () => {
  it('MODES covers all 19 3D modes with unique ids', () => {
    const ids = MODES.map((m) => m.id);
    expect(new Set(ids).size).toBe(19);
    expect(ids).toContain('nebula');
    expect(ids).toContain('fusion');
    expect(ids).toContain('ripples');
    expect(ids).toContain('solarsystem');
    expect(ids).toContain('eclipse');
    expect(ids).toContain('spaceeclipse');
    expect(ids).toContain('blackhole');
    expect(ids).toContain('comet');
    expect(ids).toContain('aurora');
    expect(ids).toContain('volcano');
    expect(ids).toContain('storm');
    expect(ids).toContain('reef');
    expect(ids).toContain('crystalcave');
    expect(ids).toContain('cyberpunk');
  });

  it('PRESET_LIST covers every color preset', () => {
    for (const id of Object.keys(colorPresets)) {
      expect(PRESET_LIST.some((p) => p.id === id)).toBe(true);
    }
  });

  it('CAMERA_MODES covers all three camera modes', () => {
    expect(CAMERA_MODES.map((c) => c.id)).toEqual(['auto', 'orbit', 'firstperson']);
  });

  it('QUALITY_OPTIONS and KICK_STYLES are non-empty', () => {
    expect(QUALITY_OPTIONS.length).toBeGreaterThanOrEqual(2);
    expect(KICK_STYLES.length).toBeGreaterThanOrEqual(5);
  });
});
