import * as THREE from 'three';
import { createSkyDome } from './realism';
import { RisingEmbers } from '../effects/SceneEffects';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Terrain 2.0" – fotorealistische, audio-verdrängte Landschaft:
 * natürliche Höhenfärbung (Erde → Gras → Fels → Schnee), warme Sonne,
 * Dämmerungs-Himmelskuppel und ein palettenfarbener Audio-Glow auf den Kämmen.
 *
 * v5-Erweiterung: aufsteigende Glut-Funken über den Kämmen und ein
 * leuchtender Mond mit Halo am Nachthimmel.
 */
export class TerrainScene implements Scene3D {
  private geometry: THREE.PlaneGeometry | null = null;
  private solid: THREE.Mesh | null = null;
  private sky: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private pointLight: THREE.PointLight | null = null;
  private embers: RisingEmbers | null = null;
  private moon: THREE.Mesh | null = null;
  private moonHalo: THREE.Mesh | null = null;
  private scene: THREE.Scene | null = null;

  private colorAttr: THREE.BufferAttribute | null = null;
  private posAttr: THREE.BufferAttribute | null = null;

  private tmpColor = new THREE.Color();
  private accent = new THREE.Color();

  // Natürliche Höhenpalette
  private earthLow = new THREE.Color(0x1c120a);
  private earthHigh = new THREE.Color(0x3d2c16);
  private grass = new THREE.Color(0x3f5a2e);
  private rock = new THREE.Color(0x6b7078);
  private snow = new THREE.Color(0xe8eef4);

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const q = ctx.settings.quality;
    const seg = q === 'ultra' ? 140 : q === 'high' ? 110 : 80;

    // Natürliche Dämmerungs-Himmelskuppel
    this.sky = createSkyDome(0x0a1230, 0x6d5a68, 0x0a0c14, 300, 40);
    ctx.scene.add(this.sky);

    // Dämmerungsnebel für Tiefenwirkung
    ctx.scene.fog = new THREE.FogExp2(0x141628, 0.0042);

    this.geometry = new THREE.PlaneGeometry(110, 110, seg, seg);
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    this.posAttr = pos;

    const count = pos.count;
    const colors = new Float32Array(count * 3);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    this.solid = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.04,
        envMapIntensity: 0.5
      })
    );
    this.solid.rotation.x = -Math.PI / 2;
    this.solid.position.y = -3;
    ctx.scene.add(this.solid);

    // Natürliche Beleuchtung: Hemisphäre (Himmel/Boden) + warme „Sonne"
    this.hemi = new THREE.HemisphereLight(0x5a6f9a, 0x2a2016, 0.9);
    ctx.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
    this.sun.position.set(42, 55, 18);
    ctx.scene.add(this.sun);

    // Audio-Glow: palettenfarbenes Punktlicht über der Landschaft
    this.pointLight = new THREE.PointLight(ctx.palette.accent, 60, 120, 1.7);
    this.pointLight.position.set(0, 24, 0);
    ctx.scene.add(this.pointLight);

    // v5: Glut-Funken steigen audio-reaktiv über den Kämmen auf
    const emberCount = q === 'ultra' ? 260 : q === 'high' ? 180 : 110;
    this.embers = new RisingEmbers(emberCount, 50);
    ctx.scene.add(this.embers.object);

    // v5: Mond mit weichem Halo am Himmel
    this.moon = new THREE.Mesh(
      new THREE.CircleGeometry(9, 40),
      new THREE.MeshBasicMaterial({ color: 0xf4f1e0, toneMapped: false, fog: false })
    );
    this.moon.position.set(-95, 78, -150);
    this.moon.lookAt(0, 0, 0);
    ctx.scene.add(this.moon);

    this.moonHalo = new THREE.Mesh(
      new THREE.CircleGeometry(17, 40),
      new THREE.MeshBasicMaterial({
        color: 0xdde6ff,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      })
    );
    this.moonHalo.position.set(-97, 79, -152);
    this.moonHalo.lookAt(0, 0, 0);
    ctx.scene.add(this.moonHalo);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    if (!this.geometry || !this.posAttr || !this.colorAttr) return;
    const freq = audio.freqData;
    const pos = this.posAttr.array as Float32Array;
    const colors = this.colorAttr.array as Float32Array;
    const seg = 110;
    const half = 55;

    this.accent.set(ctx.palette.accent);

    const amp = ctx.settings.terrainAmplitude;
    const glow = Math.min(1, audio.energy * 1.2 + audio.kickLevel * 0.6);

    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2];
      const freqIdx = Math.floor(Math.abs(x + half) / seg * 128);
      const val = freq ? freq[freqIdx] / 255 : 0.02;
      const h = (Math.pow(val, 1.2) * audio.bass * 22 + audio.kickLevel * 3 + audio.beatPulse * 1.4) * amp;
      pos[i + 1] = h + Math.sin(x * 0.35 + z * 0.2) * 0.6;

      const h01 = Math.min(1, h / 13);
      this.tmpColor.set(0x000000);
      if (h01 < 0.32) {
        this.tmpColor.copy(this.earthLow).lerp(this.earthHigh, h01 / 0.32);
      } else if (h01 < 0.6) {
        this.tmpColor.copy(this.earthHigh).lerp(this.grass, (h01 - 0.32) / 0.28);
      } else if (h01 < 0.82) {
        this.tmpColor.copy(this.grass).lerp(this.rock, (h01 - 0.6) / 0.22);
      } else {
        this.tmpColor.copy(this.rock).lerp(this.snow, (h01 - 0.82) / 0.18);
      }
      // Audio-Glow färbt die Kämme dezent in die Akzentfarbe
      if (h01 > 0.5) {
        this.tmpColor.lerp(this.accent, (h01 - 0.5) * 0.55 * glow);
      }

      colors[i] = this.tmpColor.r;
      colors[i + 1] = this.tmpColor.g;
      colors[i + 2] = this.tmpColor.b;
    }
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;

    if (this.solid) this.solid.rotation.z = Math.sin(performance.now() * 0.0004) * 0.04;
    if (this.pointLight) {
      this.pointLight.intensity = 40 + audio.bass * 110 + audio.kickLevel * 40;
      this.pointLight.color.set(ctx.palette.accent2);
    }
    this.embers?.update(dt, time, audio, ctx.palette);
    if (this.moonHalo && (this.moonHalo.material as THREE.MeshBasicMaterial).transparent) {
      const haloMat = this.moonHalo.material as THREE.MeshBasicMaterial;
      haloMat.opacity = 0.09 + audio.treble * 0.12 + audio.beatPulse * 0.05;
      const s = 1 + audio.bass * 0.08;
      this.moonHalo.scale.setScalar(s);
    }
    if (this.moon) {
      // Mond schwebt dezent mit dem Beat auf/ab
      this.moon.position.y = 78 + Math.sin(audio.beatPhase * Math.PI) * audio.beatPulse * 1.6;
    }
  }

  dispose(): void {
    if (!this.scene) return;
    if (this.solid) this.scene.remove(this.solid);
    if (this.sky) this.scene.remove(this.sky);
    if (this.hemi) this.scene.remove(this.hemi);
    if (this.sun) this.scene.remove(this.sun);
    if (this.pointLight) this.scene.remove(this.pointLight);
    if (this.embers) {
      this.scene.remove(this.embers.object);
      this.embers.dispose();
    }
    if (this.moon) {
      this.scene.remove(this.moon);
      this.moon.geometry.dispose();
      (this.moon.material as THREE.Material).dispose();
    }
    if (this.moonHalo) {
      this.scene.remove(this.moonHalo);
      this.moonHalo.geometry.dispose();
      (this.moonHalo.material as THREE.Material).dispose();
    }
    this.geometry?.dispose();
    this.sky?.geometry.dispose();
    (this.sky?.material as THREE.Material | undefined)?.dispose();
    (this.solid?.material as THREE.Material | undefined)?.dispose();
    this.geometry = null;
    this.solid = null;
    this.sky = null;
    this.hemi = null;
    this.sun = null;
    this.pointLight = null;
    this.embers = null;
    this.moon = null;
    this.moonHalo = null;
    this.scene = null;
  }
}
