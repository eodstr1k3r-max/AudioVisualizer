import * as THREE from 'three';
import { createSkyDome, createGroundPlane, neonEmissiveComp } from './realism';
import { SprayBurst, LightPillars } from '../effects/SceneEffects';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

interface Ripple {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  active: boolean;
}

/**
 * „Audio Ripples" – Licht-Wellen auf einem spiegelnden, dunklen Wasser-/Bodenfläche.
 * Jeder Kick erzeugt einen expandierenden Lichtring, Bass-Energie ein stetiges Rauschen.
 *
 * v5-Erweiterung: Kick-Spritzer springen aus dem Zentrum (mit Gravitation)
 * und ein Kranz pulsierender Lichtsäulen steht am Horizont.
 */
export class RippleScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private floor: THREE.Mesh | null = null;
  private sky: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private centerLight: THREE.PointLight | null = null;
  private ripples: Ripple[] = [];
  private glow: THREE.Mesh | null = null;
  private glowMat: THREE.MeshBasicMaterial | null = null;
  private glowGeo: THREE.SphereGeometry | null = null;
  private group: THREE.Group | null = null;
  private spray: SprayBurst | null = null;
  private pillars: LightPillars | null = null;
  private tmpAccent = new THREE.Color();
  private tmpAccent2 = new THREE.Color();

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    this.group = new THREE.Group();
    ctx.scene.add(this.group);

    this.sky = createSkyDome(0x04060e, 0x0e1830, 0x02040a, 300, 40);
    ctx.scene.add(this.sky);

    // Spiegelnder Boden als „Wasserfläche" – reflektiert Himmel & Licht
    this.floor = createGroundPlane(140, 0x080b14, 0.3, 0.7, -0.2);
    this.group.add(this.floor);

    this.hemi = new THREE.HemisphereLight(0x2c3350, 0x07090f, 0.7);
    ctx.scene.add(this.hemi);
    this.centerLight = new THREE.PointLight(ctx.palette.accent, 60, 60, 1.8);
    this.centerLight.position.set(0, 8, 0);
    ctx.scene.add(this.centerLight);

    // Ripple-Pool (14 Ringe, additive Blending, flach auf dem Boden)
    const geo = new THREE.RingGeometry(0.94, 1, 56);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 14; i++) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 0.1;
      mesh.visible = false;
      this.group.add(mesh);
      this.ripples.push({ mesh, material, age: 0, life: 2.2, active: false });
    }

    this.glowGeo = new THREE.SphereGeometry(1, 32, 32);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: ctx.palette.accent,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    this.glow.position.y = 0.6;
    this.group.add(this.glow);

    // v5: Kick-Spritzer aus dem Zentrum
    this.spray = new SprayBurst(ctx.settings.quality === 'ultra' ? 160 : ctx.settings.quality === 'high' ? 110 : 70);
    this.group.add(this.spray.object);

    // v5: Lichtsäulen-Kranz am Horizont (außerhalb der rotierenden Gruppe)
    this.pillars = new LightPillars(ctx.settings.quality === 'ultra' ? 12 : 8, 55, 30);
    ctx.scene.add(this.pillars.object);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    if (!this.group) return;

    if (audio.isKick) this.spawn(1);
    if (audio.bass > 0.35 && Math.random() < (audio.bass - 0.35) * 0.6) this.spawn(1.6);

    this.tmpAccent.set(ctx.palette.accent);
    this.tmpAccent2.set(ctx.palette.accent2);
    const speed = 12 + audio.bass * 6 + ctx.settings.tunnelSpeed * 2;

    for (const r of this.ripples) {
      if (!r.active) continue;
      r.age += dt;
      const p = r.age / r.life;
      if (p >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const radius = 0.8 + p * speed * (0.7 + audio.energy);
      r.mesh.scale.setScalar(radius);
      r.material.opacity = Math.max(0, 1 - p) * 0.55 * (0.5 + audio.energy * 0.8) + audio.kickLevel * 0.15;
      r.material.color.copy(this.tmpAccent).lerp(this.tmpAccent2, p);
      r.material.color.multiplyScalar(neonEmissiveComp(r.material.color));
      r.mesh.visible = true;
    }

    if (this.glow && this.glowMat) {
      const s = 1 + audio.bass * 1.6 + audio.kickLevel * 1.3 + ctx.interaction.pulse * 0.9;
      this.glow.scale.setScalar(s);
      this.glow.position.y = 0.6 + Math.sin(time * 1.4) * 0.15 + audio.kickLevel * 0.5;
      this.glowMat.color.copy(this.tmpAccent).lerp(this.tmpAccent2, audio.energy * 0.55);
      this.glowMat.color.multiplyScalar(neonEmissiveComp(this.glowMat.color));
      this.glowMat.opacity = 0.7 + audio.bass * 0.3;
    }

    if (this.centerLight) {
      this.centerLight.color.set(ctx.palette.accent);
      this.centerLight.intensity = (40 + audio.bass * 90 + audio.kickLevel * 40) * neonEmissiveComp(this.centerLight.color);
    }

    this.group.rotation.y += dt * 0.06 * (0.4 + audio.energy);

    // v5: Spritzer + Lichtsäulen
    this.spray?.update(dt, time, audio, ctx.palette);
    if (this.pillars) {
      // Säulen bleiben weltfest stehen, während die Ripples rotieren
      const groupRot = -this.group.rotation.y;
      this.pillars.update(dt, time, audio, ctx.palette);
      this.pillars.object.rotation.y = groupRot;
    }
  }

  private spawn(speedMul: number): void {
    const r = this.ripples.find((x) => !x.active);
    if (!r) return;
    r.active = true;
    r.age = 0;
    r.life = 2.6 / speedMul;
    r.mesh.scale.setScalar(0.8);
    r.mesh.visible = true;
  }

  dispose(): void {
    if (this.scene && this.group) this.scene.remove(this.group);
    if (this.scene && this.sky) this.scene.remove(this.sky);
    if (this.scene && this.hemi) this.scene.remove(this.hemi);
    if (this.scene && this.centerLight) this.scene.remove(this.centerLight);
    if (this.pillars && this.scene) this.scene.remove(this.pillars.object);
    this.spray?.dispose();
    this.pillars?.dispose();
    this.ripples[0]?.mesh.geometry.dispose();
    for (const r of this.ripples) r.material.dispose();
    this.ripples = [];
    this.glowGeo?.dispose();
    this.glowMat?.dispose();
    (this.floor?.material as THREE.Material | undefined)?.dispose();
    this.floor?.geometry.dispose();
    this.sky?.geometry.dispose();
    (this.sky?.material as THREE.Material | undefined)?.dispose();
    this.floor = null;
    this.sky = null;
    this.hemi = null;
    this.centerLight = null;
    this.glow = null;
    this.glowMat = null;
    this.glowGeo = null;
    this.group = null;
    this.spray = null;
    this.pillars = null;
    this.scene = null;
  }
}
