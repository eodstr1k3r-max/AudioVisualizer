import * as THREE from 'three';
import { SpectrumRing } from '../effects/SpectrumRing';
import { GlowOrb } from '../effects/GlowOrb';
import { OrbitSparks } from '../effects/SceneEffects';
import { createSkyDome, createGroundPlane } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Spectrum Towers" – fotorealistische Spektrum-Skyline:
 * reflektierende PBR-Metalltürme vor einem dunklen Studiodom und
 * spiegelndem Boden, beleuchtet von einem palettenfarbenen Zentrum-Licht.
 *
 * v5-Erweiterung: gegenläufig rotierender Innenring, pulsierender
 * Glow-Orb im Zentrum und ein Kran aus Orbit-Funken für echte Tiefe.
 */
export class SpectrumScene implements Scene3D {
  private ring: SpectrumRing | null = null;
  private innerRing: SpectrumRing | null = null;
  private orb: GlowOrb | null = null;
  private sparks: OrbitSparks | null = null;
  private floor: THREE.Mesh | null = null;
  private sky: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private centerLight: THREE.PointLight | null = null;
  private scene: THREE.Scene | null = null;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;

    this.sky = createSkyDome(0x05070f, 0x101a30, 0x02040a, 300, 40);
    ctx.scene.add(this.sky);

    // Äußerer Haupt-Ring
    this.ring = new SpectrumRing();
    this.ring.build(132, 20, 28);
    this.ring.addTo(ctx.scene);

    // v5: Gegenläufiger Innenring (halbe Dichte, niedriger)
    this.innerRing = new SpectrumRing();
    this.innerRing.build(72, 11, 15);
    this.innerRing.addTo(ctx.scene);

    // v5: Pulsierender Zentral-Orb zwischen den Ringen
    this.orb = new GlowOrb();
    this.orb.build(2.2);
    this.orb.addTo(ctx.scene);

    // v5: Orbit-Funken-Kran über den Türmen
    this.sparks = new OrbitSparks(ctx.settings.quality === 'ultra' ? 90 : ctx.settings.quality === 'high' ? 60 : 40, 27, 0.5);
    ctx.scene.add(this.sparks.object);

    // Spiegelnder, leicht rauer Studio-Boden
    this.floor = createGroundPlane(140, 0x0a0d16, 0.55, 0.5, -1);
    ctx.scene.add(this.floor);

    this.hemi = new THREE.HemisphereLight(0x39405e, 0x0a0c14, 0.9);
    ctx.scene.add(this.hemi);

    // Zentrum-Licht setzt Glanzpunkte auf die Metalltürme
    this.centerLight = new THREE.PointLight(ctx.palette.accent, 90, 90, 1.8);
    this.centerLight.position.set(0, 16, 0);
    ctx.scene.add(this.centerLight);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    const click = ctx.interaction.pulse;
    this.ring?.update(dt, audio, ctx.palette, ctx.settings.sensitivity, ctx.settings.spectrumScale, 1, click);
    // Innenring: niedrigere Türme + gegenläufige Drehung
    if (this.innerRing?.mesh) {
      this.innerRing.update(dt, audio, ctx.palette, ctx.settings.sensitivity, ctx.settings.spectrumScale, 0.6, click);
      this.innerRing.mesh.rotation.y -= dt * 0.22 * (0.6 + audio.energy);
      this.innerRing.mesh.rotation.z = Math.sin(time * 0.0004) * 0.05; // leicht geneigte Ebene
    }
    this.orb?.update(dt, time, audio, ctx.palette, 0.8, ctx.settings.orbSize, click);
    this.sparks?.update(dt, time, audio, ctx.palette);
    if (this.centerLight) {
      this.centerLight.intensity = 70 + audio.bass * 130 + audio.kickLevel * 50;
      this.centerLight.color.set(ctx.palette.accent2);
    }
  }

  dispose(): void {
    if (!this.scene) return;
    if (this.floor) this.scene.remove(this.floor);
    if (this.sky) this.scene.remove(this.sky);
    if (this.hemi) this.scene.remove(this.hemi);
    if (this.centerLight) this.scene.remove(this.centerLight);
    if (this.sparks) this.scene.remove(this.sparks.object);
    this.ring?.dispose();
    this.innerRing?.dispose();
    this.orb?.dispose();
    this.sparks?.dispose();
    this.sky?.geometry.dispose();
    (this.sky?.material as THREE.Material | undefined)?.dispose();
    (this.floor?.material as THREE.Material | undefined)?.dispose();
    this.floor?.geometry.dispose();
    this.ring = null;
    this.innerRing = null;
    this.orb = null;
    this.sparks = null;
    this.floor = null;
    this.sky = null;
    this.hemi = null;
    this.centerLight = null;
    this.scene = null;
  }
}
