import * as THREE from 'three';
import { ParticleCloud } from '../effects/ParticleCloud';
import { SpectrumRing } from '../effects/SpectrumRing';
import { GlowOrb } from '../effects/GlowOrb';
import { ShaderSkyScene } from '../shaders/ShaderSkyScene';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

export class FusionScene implements Scene3D {
  private cloud: ParticleCloud | null = null;
  private ring: SpectrumRing | null = null;
  private orb: GlowOrb | null = null;
  private sky: ShaderSkyScene | null = null;
  private scene: THREE.Scene | null = null;
  private coreLight: THREE.PointLight | null = null;
  private shell: THREE.Mesh | null = null;
  /** Persistenter Sky-Context (mode:'fusion' fix) – keine Frame-Allokation */
  private skyCtx: EngineContext | null = null;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    this.sky = new ShaderSkyScene();
    this.sky.init(ctx);

    const q = ctx.settings.quality;
    const mult = q === 'ultra' ? 260 : q === 'high' ? 150 : 90;
    this.cloud = new ParticleCloud();
    this.cloud.build({ count: Math.round(ctx.settings.particleCount * mult), radius: 34, height: 7, arms: ctx.settings.particleSymmetry });
    this.cloud.addTo(ctx.scene);

    this.ring = new SpectrumRing();
    this.ring.build(88, 22, 20);
    this.ring.addTo(ctx.scene);

    this.orb = new GlowOrb();
    this.orb.build(2.6);
    this.orb.addTo(ctx.scene);

    // v5: langsam rotierende Wireframe-Icosaeder-Schale um den Orb
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.shell = new THREE.Mesh(new THREE.IcosahedronGeometry(6.5, 1), shellMat);
    this.shell.frustumCulled = false;
    ctx.scene.add(this.shell);

    // Zentrales PointLight – beleuchtet die PBR-Metalltürme des SpectrumRings
    // physikalisch (echte Glanzpunkte/Reflexionen statt reiner IBL-Ambient).
    this.coreLight = new THREE.PointLight(0xffffff, 0, 120, 1.6);
    this.coreLight.position.set(0, 2, 0);
    ctx.scene.add(this.coreLight);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    // In-place aktualisieren statt {...ctx, mode:'fusion'} pro Frame zu spreaden
    if (this.skyCtx) Object.assign(this.skyCtx, ctx);
    else this.skyCtx = { ...ctx, mode: 'fusion' };
    this.skyCtx.mode = 'fusion';
    this.sky?.update(dt, time, audio, this.skyCtx);
    this.cloud?.update(dt, time, audio, ctx.palette, 0.55 + ctx.settings.shaderBlend * 0.3, 0.8, ctx.settings.particleRotation, ctx.interaction.pulse);
    this.ring?.update(dt, audio, ctx.palette, ctx.settings.sensitivity, ctx.settings.spectrumScale, 0.8, ctx.interaction.pulse);
    this.orb?.update(dt, time, audio, ctx.palette, 1, ctx.settings.orbSize, ctx.interaction.pulse);

    // v5: Schale atmet mit dem Bass und wirbelt auf Kicks schneller
    if (this.shell) {
      this.shell.rotation.y += dt * (0.08 + audio.kickLevel * 0.5);
      this.shell.rotation.x += dt * 0.05;
      const s = 1 + audio.bass * 0.22 + audio.beatPulse * 0.12 + ctx.interaction.pulse * 0.15;
      this.shell.scale.setScalar(s);
      const mat = this.shell.material as THREE.MeshBasicMaterial;
      mat.color.set(ctx.palette.accent2);
      mat.opacity = 0.06 + audio.energy * 0.16 + audio.beatPulse * 0.08;
    }

    if (this.coreLight) {
      this.coreLight.color.set(ctx.palette.accent2);
      this.coreLight.intensity = 25 + audio.bass * 60 + audio.kickLevel * 40 + audio.beatPulse * 30;
    }
  }

  setPreset(name: string): void {
    this.sky?.setPreset(name);
  }

  compileCustom(code: string): { success: boolean; error?: string } {
    return this.sky?.compileCustom(code) ?? { success: false, error: 'Shader nicht verfügbar' };
  }

  dispose(): void {
    this.cloud?.dispose();
    this.ring?.dispose();
    this.orb?.dispose();
    this.sky?.dispose();
    if (this.scene && this.shell) {
      this.scene.remove(this.shell);
      this.shell.geometry.dispose();
      (this.shell.material as THREE.Material).dispose();
    }
    if (this.scene && this.coreLight) this.scene.remove(this.coreLight);
    this.coreLight?.dispose();
    this.cloud = null;
    this.ring = null;
    this.orb = null;
    this.sky = null;
    this.coreLight = null;
    this.shell = null;
    this.skyCtx = null;
    this.scene = null;
  }
}
