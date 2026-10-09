import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SceneManager } from '../SceneManager';
import { useStore } from '../../core/store';
import { paletteFor } from '../../core/colorPresets';
import type { AudioData, VisualMode } from '../../core/types';
import type { EngineContext } from '../scenes/Scene3D';

function installFakeDocument(): void {
  const ctx2d = {
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}
  };
  const fakeCanvas = { width: 0, height: 0, getContext: () => ctx2d };
  (globalThis as Record<string, unknown>).document = { createElement: () => fakeCanvas };
}

const modes: VisualMode[] = [
  'nebula', 'spectrum', 'tunnel', 'terrain', 'sphere', 'ripples', 'shader', 'fusion',
  'solarsystem', 'eclipse', 'spaceeclipse', 'blackhole', 'comet',
  'aurora', 'volcano', 'storm', 'reef', 'crystalcave', 'cyberpunk'
];

async function waitForLoad(sm: SceneManager): Promise<void> {
  for (let i = 0; i < 50 && sm.isLoadingMode; i++) await new Promise((r) => setTimeout(r, 5));
}

function mockAudio(): AudioData {
  return {
    energy: 0.5, subBass: 0.3, bass: 0.4, mid: 0.5, treble: 0.4, presence: 0.5,
    isKick: true, kickLevel: 0.6, freqData: new Uint8Array(128).fill(100),
    waveData: new Uint8Array(256), loudness: 0.5, spectralFlux: 0.3,
    bpm: 128, beatPhase: 0.25, beatPulse: 0.5, onBeat: true
  };
}

function buildCtx(quality: 'ultra' | 'high' | 'medium'): EngineContext {
  const settings = { ...useStore.getState().settings, quality };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  return {
    scene, camera,
    renderer: { domElement: { width: 1920, height: 1080 } } as unknown as EngineContext['renderer'],
    isWebGPU: false, settings, palette: paletteFor(settings.preset, settings),
    imageTexture: null, mode: settings.mode, interaction: { pulse: 0 }
  };
}

describe('Quality-Skalierung (medium & high)', () => {
  beforeEach(() => { installFakeDocument(); vi.restoreAllMocks(); });

  for (const q of ['medium', 'high'] as const) {
    it(`alle 19 Modi funktionieren bei quality="${q}"`, async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const sm = new SceneManager(() => buildCtx(q));
      const audio = mockAudio();
      for (const mode of modes) {
        expect(() => sm.setMode(mode), `setMode(${mode}, ${q})`).not.toThrow();
        await waitForLoad(sm);
        expect(() => sm.update(0.016, 1000, audio, buildCtx(q)), `update(${mode}, ${q})`).not.toThrow();
      }
      expect(errSpy, `kein console.error bei quality=${q}`).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  }
});
