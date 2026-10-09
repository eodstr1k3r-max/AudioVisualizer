import * as THREE from 'three';
import { ParticleCloud } from '../effects/ParticleCloud';
import { MeteorShower } from '../effects/SceneEffects';
import { fbm3, smoothstep } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/** Bäckt eine kleine kraterige Gesteins-Textur für die Planetesimale (DataTexture – kein DOM). */
function makeRockTexture(w = 64, h = 32): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  const light = new THREE.Color(0x8a7f74);
  const dark = new THREE.Color(0x4a4238);
  const crater = new THREE.Color(0x241f1a);
  const col = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const pz = (y / (h - 1) - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const theta = (x / w) * Math.PI * 2;
      const px = Math.cos(theta);
      const py = Math.sin(theta);
      const n = fbm3(px * 5, py * 5, pz * 5, 4);
      const cr = fbm3(px * 9, py * 9, pz * 9, 3);
      col.copy(dark).lerp(light, n);
      col.lerp(crater, smoothstep(0.62, 0.78, cr) * 0.5);
      const i = (y * w + x) * 4;
      data[i] = Math.round(Math.min(1, col.r) * 255);
      data[i + 1] = Math.round(Math.min(1, col.g) * 255);
      data[i + 2] = Math.round(Math.min(1, col.b) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * „Nebula" – Gaswolke (ParticleCloud) mit Sternenfeld.
 *
 * PBR-Aufwertung: ein leuchtender Protostern im Zentrum (emissiv + PointLight)
 * beleuchtet einen Schwarm kleiner PBR-Planetesimale (Gestein, echte
 * `MeshStandardMaterial`-Körper). Das Gas selbst bleibt ein Partikeleffekt.
 */
export class NebulaScene implements Scene3D {
  private cloud: ParticleCloud | null = null;
  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;
  private meteors: MeteorShower | null = null;

  private protoStar: THREE.Mesh | null = null;
  private starLight: THREE.PointLight | null = null;
  private planetesimals: THREE.Mesh[] = [];
  private planetesimalGroup: THREE.Group | null = null;
  private rockTexture: THREE.DataTexture | null = null;
  private rockGeometry: THREE.SphereGeometry | null = null;
  private rockMaterial: THREE.MeshStandardMaterial | null = null;

  private scene: THREE.Scene | null = null;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    // Vakuum – kein exponentieller Nebel, damit entfernte Sterne/Partikel knackig bleiben
    ctx.scene.fog = null;
    const q = ctx.settings.quality;
    const multiplier = q === 'ultra' ? 900 : q === 'high' ? 480 : 300;
    const count = Math.round(ctx.settings.particleCount * multiplier);

    this.cloud = new ParticleCloud();
    this.cloud.build({ count, radius: 46, height: 10, arms: ctx.settings.particleSymmetry });
    this.cloud.addTo(ctx.scene);

    /* --------------------- PBR: Protostern + Planetesimale --------------------- */
    // Leuchtender Kern (emissiv – ist die Lichtquelle, kein beleuchteter Körper)
    const starGeo = new THREE.SphereGeometry(2.2, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfff2e0, toneMapped: false });
    this.protoStar = new THREE.Mesh(starGeo, starMat);
    this.protoStar.frustumCulled = false;
    ctx.scene.add(this.protoStar);

    // PointLight beleuchtet die umgebenden Planetesimale physikalisch
    this.starLight = new THREE.PointLight(0xffe8c0, 40, 0, 1.6);
    this.starLight.position.set(0, 0, 0);
    ctx.scene.add(this.starLight);

    // Schwarm kleiner Gesteinskörper, vom Protostern beleuchtet
    this.rockTexture = makeRockTexture();
    this.rockGeometry = new THREE.SphereGeometry(1, 16, 16);
    this.rockMaterial = new THREE.MeshStandardMaterial({
      map: this.rockTexture,
      roughness: 0.9,
      metalness: 0.05,
      envMapIntensity: 0.6
    });
    this.planetesimalGroup = new THREE.Group();
    const planetesimalCount = q === 'ultra' ? 12 : q === 'high' ? 8 : 5;
    for (let i = 0; i < planetesimalCount; i++) {
      const mesh = new THREE.Mesh(this.rockGeometry, this.rockMaterial);
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 30;
      const y = (Math.random() - 0.5) * 8;
      mesh.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      mesh.scale.setScalar(0.4 + Math.random() * 0.9);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      mesh.frustumCulled = false;
      this.planetesimalGroup.add(mesh);
      this.planetesimals.push(mesh);
    }
    ctx.scene.add(this.planetesimalGroup);

    /* ------------------------------ Sternenfeld ------------------------------ */
    const starCount = 1600;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 90 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    ctx.scene.add(this.stars);

    // v5: Sternschnuppen ziehen periodisch über den Himmel
    this.meteors = new MeteorShower(q === 'ultra' ? 5 : q === 'high' ? 4 : 3);
    ctx.scene.add(this.meteors.object);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    const q = ctx.settings.quality;
    this.cloud?.update(dt, time, audio, ctx.palette, 0.9, q === 'ultra' ? 1 : q === 'high' ? 0.85 : 0.7, ctx.settings.particleRotation, ctx.interaction.pulse);

    if (this.starLight) {
      this.starLight.intensity = 40 + audio.bass * 30 + audio.kickLevel * 25;
    }
    if (this.protoStar) {
      const s = 1 + audio.bass * 0.08 + audio.kickLevel * 0.06;
      this.protoStar.scale.setScalar(s);
    }
    if (this.planetesimalGroup) {
      this.planetesimalGroup.rotation.y += dt * 0.02 * (0.5 + audio.energy);
    }
    if (this.stars) {
      this.stars.rotation.y += dt * 0.004;
      if (this.starMaterial) this.starMaterial.opacity = 0.4 + audio.energy * 0.3;
    }
    this.meteors?.update(dt, time, audio, ctx.palette);
  }

  dispose(): void {
    if (this.scene) {
      if (this.stars) this.scene.remove(this.stars);
      if (this.protoStar) this.scene.remove(this.protoStar);
      if (this.starLight) this.scene.remove(this.starLight);
      if (this.planetesimalGroup) this.scene.remove(this.planetesimalGroup);
      if (this.meteors) this.scene.remove(this.meteors.object);
    }
    this.cloud?.dispose();
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();
    this.rockTexture?.dispose();
    this.rockGeometry?.dispose();
    this.rockMaterial?.dispose();
    this.starLight?.dispose();
    this.meteors?.dispose();

    this.stars = null;
    this.cloud = null;
    this.protoStar = null;
    this.starLight = null;
    this.planetesimalGroup = null;
    this.planetesimals = [];
    this.rockTexture = null;
    this.rockGeometry = null;
    this.rockMaterial = null;
    this.meteors = null;
    this.scene = null;
  }
}
