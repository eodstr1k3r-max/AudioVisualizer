import type { ColorPreset, Settings } from './types';

export interface PresetPalette {
  name: string;
  baseHue: number;
  accent: string;
  accent2: string;
  sat: number;
  light: number;
  spread: [number, number, number];
}

export const colorPresets: Record<ColorPreset, PresetPalette> = {
  aurora: { name: 'Aurora', baseHue: 220, accent: '#8b5cf6', accent2: '#22d3ee', sat: 1, light: 0, spread: [0, 65, 140] },
  sunset: { name: 'Sunset', baseHue: 10, accent: '#f97316', accent2: '#ec4899', sat: 1, light: 4, spread: [0, 35, 85] },
  neon: { name: 'Neon', baseHue: 290, accent: '#a855f7', accent2: '#10b981', sat: 1.15, light: 2, spread: [0, 100, 180] },
  ice: { name: 'Ice', baseHue: 190, accent: '#38bdf8', accent2: '#a5f3fc', sat: 0.95, light: 6, spread: [0, 35, 70] },
  mono: { name: 'Mono', baseHue: 210, accent: '#94a3b8', accent2: '#e2e8f0', sat: 0.18, light: 10, spread: [0, 8, 16] },
  cyberpunk: { name: 'Cyberpunk', baseHue: 50, accent: '#eab308', accent2: '#ef4444', sat: 1.3, light: 5, spread: [0, 40, 110] },
  fire: { name: 'Fire', baseHue: 18, accent: '#ff3d00', accent2: '#ffb300', sat: 1.25, light: 2, spread: [0, 20, 60] },
  ocean: { name: 'Ocean', baseHue: 205, accent: '#0284c7', accent2: '#5eead4', sat: 1.1, light: 0, spread: [0, 30, 80] },
  gold: { name: 'Gold', baseHue: 42, accent: '#d4af37', accent2: '#f5f0dc', sat: 1.2, light: 8, spread: [0, 25, 55] },
  toxic: { name: 'Toxic', baseHue: 120, accent: '#39ff14', accent2: '#00ff88', sat: 1.35, light: 0, spread: [0, 60, 130] },
  custom: { name: 'Eigene Farbe', baseHue: 0, accent: '#8b5cf6', accent2: '#22d3ee', sat: 1, light: 0, spread: [0, 65, 140] }
};

/** Liefert die Palette inkl. Custom-Farben aus den Settings. */
export function paletteFor(preset: ColorPreset, settings?: Pick<Settings, 'customAccent' | 'customAccent2'>): PresetPalette {
  const base = colorPresets[preset] || colorPresets.aurora;
  if (preset === 'custom' && settings) {
    return { ...base, accent: settings.customAccent, accent2: settings.customAccent2 };
  }
  return base;
}
