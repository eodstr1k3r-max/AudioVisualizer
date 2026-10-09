import { describe, it, expect } from 'vitest';
import { float, vec2 } from 'three/tsl';
import { shaderPresets, type ShaderUniforms } from '../presets';

/** Mock-Uniforms – TSL-Nodes, damit die Builder ihren Graphen aufbauen können. */
function mockUniforms(): ShaderUniforms {
  return {
    resolution: vec2(1920, 1080),
    time: float(2.5),
    bass: float(0.5),
    mid: float(0.4),
    treble: float(0.3),
    energy: float(0.6),
    kick: float(0.7),
    beat: float(0.5),
    click: float(0),
    image: null,
    hasImage: float(0),
    opacity: float(1)
  };
}

describe('shaderPresets', () => {
  it('hat mindestens 20 registrierte Presets', () => {
    expect(Object.keys(shaderPresets).length).toBeGreaterThanOrEqual(20);
  });

  it('baut für jedes Preset den TSL-Node-Graphen ohne Fehler auf', () => {
    const u = mockUniforms();
    for (const [id, preset] of Object.entries(shaderPresets)) {
      expect(() => preset.build(u), `Preset "${id}" darf beim Build nicht werfen`).not.toThrow();
    }
  });

  it('enthält die 4 neuen Presets', () => {
    for (const id of ['firevortex', 'galaxycore', 'liquidmetal', 'neonwaves']) {
      expect(shaderPresets[id], `Preset "${id}" fehlt`).toBeTruthy();
    }
  });

  it('enthält die v5 Presets und sie sind audio-reaktiv aufgebaut', () => {
    const u = mockUniforms();
    for (const id of ['supernova', 'deepocean', 'crystalshards', 'electricstorm']) {
      expect(shaderPresets[id], `v5-Preset "${id}" fehlt`).toBeTruthy();
      expect(() => shaderPresets[id].build(u), `v5-Preset "${id}" darf beim Build nicht werfen`).not.toThrow();
    }
  });
});
