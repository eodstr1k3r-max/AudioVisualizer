import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  OrbitSparks, RisingEmbers, SprayBurst, SpeedStreaks,
  LightPillars, BokehDust, MeteorShower
} from '../effects/SceneEffects';
import { AtmosphereFX } from '../effects/AtmosphereFX';
import type { AudioData } from '../../core/types';
import { paletteFor } from '../../core/colorPresets';

function mockAudio(over: Partial<AudioData> = {}): AudioData {
  return {
    energy: 0.5, subBass: 0.3, bass: 0.4, mid: 0.5, treble: 0.4, presence: 0.5,
    isKick: false, kickLevel: 0.3, freqData: null, waveData: null, loudness: 0.5,
    spectralFlux: 0.2, bpm: 120, beatPhase: 0.5, beatPulse: 0.4, onBeat: false,
    ...over
  };
}

const palette = paletteFor('aurora');

describe('SceneEffects (v5 Szenen-Effekte)', () => {
  it('OrbitSparks: build/update/dispose ohne Fehler, Positionen werden animiert', () => {
    const fx = new OrbitSparks(40, 24);
    const attr = fx.object.geometry.attributes.position as THREE.BufferAttribute;
    const before = Float32Array.from(attr.array as Float32Array);
    expect(() => fx.update(0.016, 1000, mockAudio(), palette)).not.toThrow();
    const after = attr.array as Float32Array;
    expect(Array.from(after)).not.toEqual(Array.from(before));
    fx.dispose();
  });

  it('RisingEmbers: Partikel steigen mit Bass auf', () => {
    const fx = new RisingEmbers(50);
    const attr = fx.object.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    arr[1] = 10; // y des ersten Partikels
    fx.update(0.1, 1000, mockAudio({ bass: 0.8 }), palette);
    expect(arr[1]).toBeGreaterThan(10);
    fx.dispose();
  });

  it('SprayBurst: Kick startet Spritzer, Gravitation zieht sie zurück', () => {
    const fx = new SprayBurst(40);
    const attr = fx.object.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    // Erster Frame mit Kick-Flanke → Batch wird gespawnt
    fx.update(0.016, 1000, mockAudio({ isKick: true, kickLevel: 0.8 }), palette);
    const spawned = Array.from(arr).filter((y) => y > -40 && Math.abs(y) < 45).length;
    expect(spawned).toBeGreaterThan(0);
    // Viele Frames weiter → alle Partikel wieder geparkt (Gravitation + Lebenszeit)
    for (let i = 0; i < 200; i++) fx.update(0.05, 1000 + i * 50, mockAudio(), palette);
    const ys = Array.from(arr).filter((_, i) => i % 3 === 1);
    expect(ys.every((y) => y === -50), 'alle Spritzer müssen zurückgeparkt sein').toBe(true);
    fx.dispose();
  });

  it('SpeedStreaks: Linien bewegen sich vorwärts und recyclen', () => {
    const fx = new SpeedStreaks(30);
    const attr = fx.object.geometry.attributes.position as THREE.BufferAttribute;
    const zBefore = (attr.array as Float32Array)[2];
    fx.update(0.05, 1000, mockAudio({ bass: 0.6 }), palette);
    const zAfter = (attr.array as Float32Array)[2];
    expect(zAfter).toBeGreaterThan(zBefore);
    fx.dispose();
  });

  it('LightPillars: Opazität pulsiert und folgt der Palette', () => {
    const fx = new LightPillars(6, 40, 20);
    fx.update(0.016, 5000, mockAudio({ mid: 0.9 }), palette);
    const anyVisible = fx.materials.some((m) => m.opacity > 0);
    expect(anyVisible).toBe(true);
    fx.dispose();
  });

  it('BokehDust: hängt an der Kamera und driftet audio-reaktiv', () => {
    const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
    const fx = new BokehDust(cam, 25);
    expect(fx.object.parent).toBe(cam);
    const attr = fx.object.geometry.attributes.position as THREE.BufferAttribute;
    const before = Float32Array.from(attr.array as Float32Array);
    fx.update(0.016, 1000, mockAudio({ kickLevel: 0.7 }), palette);
    expect(Array.from(attr.array as Float32Array)).not.toEqual(Array.from(before));
    fx.dispose();
    expect(fx.object.parent).toBeNull();
  });

  it('MeteorShower: Meteore erscheinen periodisch und klingen ab', () => {
    const fx = new MeteorShower(3);
    let sawVisible = false;
    for (let i = 0; i < 3000; i++) {
      fx.update(0.03, 1000 + i * 33, mockAudio({ energy: 0.9 }), palette);
      if (fx.meteors.some((m) => m.mat.opacity > 0.1)) { sawVisible = true; break; }
    }
    expect(sawVisible).toBe(true);
    fx.dispose();
  });
});

describe('AtmosphereFX (globales Tiefen-Layer)', () => {
  it('init/update/dispose ohne Fehler; Schockwelle startet bei Kick-Flanke', () => {
    const scene = new THREE.Scene();
    const fx = new AtmosphereFX();
    fx.init(scene, 'high');
    expect(scene.children.some((c) => c.name === 'atmosphere-fx')).toBe(true);

    fx.update(0.016, mockAudio({ isKick: true, kickLevel: 0.9 }), palette);
    expect(fx.activeShockwaves, 'Kick muss eine Schockwelle starten').toBeGreaterThan(0);

    // Ausklingen lassen
    for (let i = 0; i < 120; i++) fx.update(0.016, mockAudio(), palette);
    expect(fx.activeShockwaves).toBe(0);

    fx.dispose();
    expect(scene.children.some((c) => c.name === 'atmosphere-fx')).toBe(false);
  });

  it('qualitätsskaliert: ultra erzeugt mehr Staubpartikel als medium', () => {
    const mkCount = (q: 'ultra' | 'medium'): number => {
      const scene = new THREE.Scene();
      const fx = new AtmosphereFX();
      fx.init(scene, q);
      const n = fx.dustParticleCount;
      fx.dispose();
      return n;
    };
    expect(mkCount('ultra')).toBeGreaterThan(mkCount('medium'));
  });
});
