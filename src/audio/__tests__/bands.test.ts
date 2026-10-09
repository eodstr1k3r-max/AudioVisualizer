import { describe, it, expect } from 'vitest';
import {
  averageRange, computeBands, computeLoudness, computeSpectralFlux,
  detectKick, lerp, shapeKick, BAND_RANGES
} from '../bands';

describe('averageRange', () => {
  it('returns 0..1 normalized averages', () => {
    const data = new Uint8Array([0, 255, 128]);
    expect(averageRange(data, 0, 3)).toBeCloseTo((0 + 255 + 128) / 3 / 255, 5);
  });

  it('clamps out-of-bounds ranges', () => {
    const data = new Uint8Array([10, 20]);
    expect(averageRange(data, -5, 99)).toBeCloseTo(15 / 255, 5);
    expect(averageRange(data, 5, 10)).toBe(0);
  });
});

describe('computeBands', () => {
  it('detects a strong bass signal', () => {
    const freq = new Uint8Array(256);
    // Nur die Bins 4..16 (Bass) sind heiß
    for (let i = 0; i < 256; i++) freq[i] = i >= 4 && i < 16 ? 255 : 0;
    const b = computeBands(freq);
    expect(b.bass).toBeCloseTo(1, 2);
    expect(b.subBass).toBe(0);
    expect(b.treble).toBe(0);
    expect(b.energy).toBeGreaterThan(0);
  });

  it('computes presence only from high bins', () => {
    const freq = new Uint8Array(256);
    for (let i = 160; i < 255; i++) freq[i] = 255;
    const b = computeBands(freq);
    expect(b.presence).toBeCloseTo(1, 2);
    expect(b.bass).toBe(0);
    expect(b.treble).toBe(0);
  });
});

describe('computeLoudness', () => {
  it('returns ~0 for silence (128 = Stille)', () => {
    const wave = new Uint8Array(1024).fill(128);
    expect(computeLoudness(wave)).toBeCloseTo(0, 5);
  });

  it('returns >0 for a loud waveform', () => {
    const wave = new Uint8Array(1024);
    for (let i = 0; i < wave.length; i++) wave[i] = i % 2 === 0 ? 0 : 255;
    expect(computeLoudness(wave)).toBeGreaterThan(0.5);
  });
});

describe('computeSpectralFlux', () => {
  it('is 0 for identical frames', () => {
    const a = new Uint8Array([10, 20, 30]);
    expect(computeSpectralFlux(a, new Uint8Array([10, 20, 30]))).toBe(0);
  });

  it('rises when the spectrum jumps up', () => {
    const prev = new Uint8Array(256).fill(0);
    const curr = new Uint8Array(256).fill(200);
    expect(computeSpectralFlux(curr, prev)).toBeGreaterThan(0);
  });

  it('ignores downward movement (nur positive Differenzen)', () => {
    const prev = new Uint8Array([100, 100]);
    const curr = new Uint8Array([10, 10]);
    expect(computeSpectralFlux(curr, prev)).toBe(0);
  });
});

describe('detectKick', () => {
  const threshold = 0.29;

  it('detects a kick with strong bass and rise', () => {
    const r = detectKick(0.9, 0.3, threshold, 1000, -10000, 0, 0);
    expect(r.isKick).toBe(true);
    expect(r.pulse).toBe(1);
    expect(r.strength).toBeGreaterThan(0);
  });

  it('does not fire below threshold', () => {
    const r = detectKick(0.1, 0.1, threshold, 1000, -10000, 0, 0);
    expect(r.isKick).toBe(false);
  });

  it('enforces a debounce window (130ms)', () => {
    const r = detectKick(0.9, 0.3, threshold, 1000, 999, 0.5, 0.5);
    expect(r.isKick).toBe(false);
  });

  it('decays the pulse over time', () => {
    const r = detectKick(0.1, 0.1, threshold, 1000, -10000, 1, 1);
    expect(r.pulse).toBeCloseTo(0.88, 5);
  });
});

describe('lerp', () => {
  it('interpolates correctly', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});

describe('BAND_RANGES', () => {
  it('are ordered ascending and within 0..255', () => {
    for (const [start, end] of Object.values(BAND_RANGES)) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(255);
      expect(end).toBeGreaterThan(start);
    }
  });
});

describe('shapeKick · Kick-Visual-Stile', () => {
  it('off liefert immer 0', () => {
    expect(shapeKick(1, 'off')).toBe(0);
    expect(shapeKick(0.5, 'off')).toBe(0);
  });

  it('flash ist hart an/aus', () => {
    expect(shapeKick(1, 'flash')).toBe(1);
    expect(shapeKick(0.5, 'flash')).toBe(1);
    expect(shapeKick(0.34, 'flash')).toBe(0);
    expect(shapeKick(0, 'flash')).toBe(0);
  });

  it('ripple ist eine Welle mit Punch-Start (0.3 direkt auf dem Hit)', () => {
    expect(shapeKick(0, 'ripple')).toBeCloseTo(0, 5);
    expect(shapeKick(0.5, 'ripple')).toBeCloseTo(1, 5);
    expect(shapeKick(1, 'ripple')).toBeCloseTo(0.3, 5); // initialer Punch statt 0
  });

  it('pulse fällt schneller ab als glow', () => {
    // Bei pulse (^1.7) ist der Wert bei 0.5 deutlich kleiner als bei glow (^0.85)
    expect(shapeKick(0.5, 'pulse')).toBeLessThan(shapeKick(0.5, 'glow'));
    // Beide starten bei 1
    expect(shapeKick(1, 'pulse')).toBe(1);
    expect(shapeKick(1, 'glow')).toBe(1);
    // glow bleibt bei kleinen Pulsen länger sichtbar (^0.85 > x)
    expect(shapeKick(0.2, 'glow')).toBeGreaterThan(0.2);
  });

  it('bleibt im Bereich 0..1', () => {
    for (const style of ['glow', 'pulse', 'flash', 'ripple', 'off'] as const) {
      for (let p = 0; p <= 1; p += 0.1) {
        const v = shapeKick(p, style);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('liefert bei unbekanntem Stil nie undefined/NaN (Fallback → glow)', () => {
    const v = shapeKick(0.4, 'unknown-style' as never);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });
});
