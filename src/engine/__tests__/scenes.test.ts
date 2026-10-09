import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SceneManager } from '../SceneManager';
import { useStore } from '../../core/store';
import { paletteFor } from '../../core/colorPresets';
import type { AudioData, VisualMode } from '../../core/types';
import type { EngineContext } from '../scenes/Scene3D';

/** Minimal-DOM: GridFloor braucht document.createElement('canvas') + 2D-Context. */
function installFakeDocument(): void {
  const ctx2d = {
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {}
  };
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ctx2d
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: () => fakeCanvas
  };
}

const modes: VisualMode[] = [
  'nebula', 'spectrum', 'tunnel', 'terrain', 'sphere', 'ripples', 'shader', 'fusion',
  'solarsystem', 'eclipse', 'spaceeclipse', 'blackhole', 'comet',
  'aurora', 'volcano', 'storm', 'reef', 'crystalcave', 'cyberpunk'
];

/** Wartet, bis eine ggf. per dynamic import() nachgeladene Szene fertig gewechselt hat. */
async function waitForLoad(sm: SceneManager): Promise<void> {
  for (let i = 0; i < 50 && sm.isLoadingMode; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

function mockAudio(): AudioData {
  return {
    energy: 0.5, subBass: 0.3, bass: 0.4, mid: 0.5, treble: 0.4, presence: 0.5,
    isKick: true, kickLevel: 0.6, freqData: new Uint8Array(128).fill(100),
    waveData: new Uint8Array(256), loudness: 0.5, spectralFlux: 0.3,
    bpm: 128, beatPhase: 0.25, beatPulse: 0.5, onBeat: true
  };
}

function buildCtx(settings = useStore.getState().settings): EngineContext {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  return {
    scene,
    camera,
    renderer: { domElement: { width: 1920, height: 1080 } } as unknown as EngineContext['renderer'],
    isWebGPU: false,
    settings,
    palette: paletteFor(settings.preset, settings),
    imageTexture: null,
    mode: settings.mode,
    interaction: { pulse: 0 }
  };
}

describe('SceneManager – alle 19 Modi', () => {
  beforeEach(() => {
    installFakeDocument();
    vi.restoreAllMocks();
  });

  it('initialisiert den Boot-Modus (nebula) wirklich – nicht nur early-return', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sm = new SceneManager(buildCtx);
    sm.setMode('nebula'); // Standard-current ist 'nebula' → darf NICHT übersprungen werden
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('wechselt durch alle 19 Modi ohne Fehler (setMode → update → rebuild)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sm = new SceneManager(buildCtx);
    const audio = mockAudio();

    for (const mode of modes) {
      expect(() => sm.setMode(mode), `setMode(${mode}) darf nicht werfen`).not.toThrow();
      await waitForLoad(sm); // lazy (code-gesplittete) Szenen erst fertig nachladen lassen
      expect(() => sm.update(0.016, 1000, audio, buildCtx()), `update(${mode}) darf nicht werfen`).not.toThrow();
    }

    // Rebuild der aktuellen Szene (Partikel-/Qualitätswechsel-Pfad)
    expect(() => sm.rebuild(), 'rebuild darf nicht werfen').not.toThrow();
    expect(() => sm.update(0.016, 1100, audio, buildCtx())).not.toThrow();
    expect(errSpy, 'kein console.error während aller Szenen-Operationen').not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('liefert einen Shader-Controller in shader/fusion, sonst null', () => {
    const sm = new SceneManager(buildCtx);
    sm.setMode('shader');
    expect(sm.getShaderController()).not.toBeNull();
    sm.setMode('nebula');
    expect(sm.getShaderController()).toBeNull();
    sm.setMode('fusion');
    expect(sm.getShaderController()).not.toBeNull();
  });

  it('ruft getCtx() bei JEDEM setMode/rebuild frisch auf (kein Boot-Snapshot)', () => {
    let calls = 0;
    const ctx = buildCtx();
    const sm = new SceneManager(() => {
      calls++;
      return ctx;
    });
    sm.setMode('nebula'); // Boot-Init
    sm.setMode('tunnel'); // Modus-Wechsel → zweiter frischer Aufruf
    sm.rebuild();         // Rebuild → dritter frischer Aufruf
    expect(calls).toBe(3);
  });

  it('setMode mit gleichem Modus initialisiert beim Boot, aber nicht doppelt danach', () => {
    let calls = 0;
    const ctx = buildCtx();
    const sm = new SceneManager(() => {
      calls++;
      return ctx;
    });
    sm.setMode('nebula'); // Boot: initialisiert trotz current='nebula'
    expect(calls).toBe(1);
    sm.setMode('nebula'); // gleicher Modus + initialisiert → kein Rebuild
    expect(calls).toBe(1);
    sm.rebuild(); // expliziter Rebuild → frischer Aufruf
    expect(calls).toBe(2);
  });
});
