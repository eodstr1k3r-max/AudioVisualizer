import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, mix,
  positionLocal, positionWorld, normalWorld, cameraPosition,
  normalize, dot, pow, abs
} from 'three/tsl';
import { fbm3, generateStarSphere } from './tslNoise';
import { fbm3 as fbm3js, smoothstep as smoothstepJs } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Comet" – Kometenkern mit Koma und zwei Schweifen (bläulicher Ionenschweif,
 * gelblicher Staubschweif).
 *
 * PBR: Der Kometenkern ist jetzt ein echter `MeshStandardMaterial`-Fels mit
 * prozeduraler Kratertextur, beleuchtet von einem Sonnen-DirectionalLight
 * (Sonne liegt in +x-Richtung, die Schweife zeigen in -x). Koma & Schweife
 * bleiben leuchtend/additiv – sie sind Gas/Staub, keine beleuchteten Körper.
 */

/** Bäckt eine dunkle, kraterige Kometenkern-Textur (DataTexture – kein DOM). */
function makeNucleusTexture(w = 128, h = 64): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  const light = new THREE.Color(0x3a3632);
  const dark = new THREE.Color(0x1c1a18);
  const crater = new THREE.Color(0x0e0d0b);
  const ice = new THREE.Color(0x3a4a52);
  const col = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const pz = (y / (h - 1) - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const theta = (x / w) * Math.PI * 2;
      const px = Math.cos(theta);
      const py = Math.sin(theta);
      const n = fbm3js(px * 5, py * 5, pz * 5, 4);
      const cr = fbm3js(px * 10, py * 10, pz * 10, 3);
      const icy = fbm3js(px * 3 + 7, py * 3 + 7, pz * 3 + 7, 3);
      col.copy(dark).lerp(light, n);
      col.lerp(crater, smoothstepJs(0.62, 0.78, cr) * 0.6);
      col.lerp(ice, smoothstepJs(0.62, 0.8, icy) * 0.4);
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

export class CometScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private nucleusMesh: THREE.Mesh | null = null;
  private nucleusMaterial: THREE.MeshStandardMaterial | null = null;
  private nucleusTexture: THREE.DataTexture | null = null;
  private comaMesh: THREE.Mesh | null = null;

  private sunLight: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;

  private ionTail: THREE.Points | null = null;
  private ionGeometry: THREE.BufferGeometry | null = null;
  private ionMaterial: THREE.PointsMaterial | null = null;
  private ionSeed: Float32Array | null = null;
  private ionCount = 1600;

  private dustTail: THREE.Points | null = null;
  private dustGeometry: THREE.BufferGeometry | null = null;
  private dustMaterial: THREE.PointsMaterial | null = null;
  private dustSeed: Float32Array | null = null;
  private dustCount = 1400;

  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private uTime = uniform(0);
  private uComaTime = uniform(0);
  private uPulse = uniform(0);

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    // Vakuum – kein Nebel, damit Komet & Sterne klar bleiben
    ctx.scene.fog = null;
    const q = ctx.settings.quality;
    const nucleusDetail = q === 'ultra' ? 3 : q === 'high' ? 2 : 1;
    const comaSeg = q === 'ultra' ? 40 : q === 'high' ? 28 : 18;
    this.ionCount = q === 'ultra' ? 1600 : q === 'high' ? 1000 : 550;
    this.dustCount = q === 'ultra' ? 1400 : q === 'high' ? 900 : 500;
    const starCount = q === 'ultra' ? 2200 : q === 'high' ? 1400 : 800;
    this.root = new THREE.Group();
    ctx.scene.add(this.root);

    /* ------------------------------ Sonnenlicht (+x) ------------------------------ */
    // Sonne liegt in +x – die Schweife zeigen in -x (vom Sonnenwind weg).
    this.sunLight = new THREE.DirectionalLight(0xfff0d8, 2.2);
    this.sunLight.position.set(80, 12, 0);
    this.sunLight.target.position.set(0, 0, 0);
    ctx.scene.add(this.sunLight);
    ctx.scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0x1a2740, 0x030406, 0.25);
    ctx.scene.add(this.hemi);

    /* --------------------------- Kometenkern (PBR-Fels) --------------------------- */
    this.nucleusTexture = makeNucleusTexture();
    const nucleusGeo = new THREE.IcosahedronGeometry(2.2, nucleusDetail);
    // Unregelmäßige, „kartoffelförmige" Kern-Geometrie
    const posAttr = nucleusGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const n = v.clone().normalize();
      const bump = 0.75 + 0.35 * (Math.sin(n.x * 4.2) * Math.cos(n.y * 3.1) * Math.sin(n.z * 3.7) * 0.5 + 0.5);
      v.multiplyScalar(bump);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    nucleusGeo.computeVertexNormals();

    this.nucleusMaterial = new THREE.MeshStandardMaterial({
      map: this.nucleusTexture,
      roughness: 0.9,
      metalness: 0.02,
      // Ausgasender Jet-Glow (bläulich) – audio-reaktiv gepulst
      emissive: 0x2a4a6a,
      emissiveIntensity: 0
    });
    this.nucleusMesh = new THREE.Mesh(nucleusGeo, this.nucleusMaterial);
    this.nucleusMesh.frustumCulled = false;
    this.nucleusMesh.castShadow = true;
    this.nucleusMesh.receiveShadow = true;
    this.root.add(this.nucleusMesh);
    this.geometries.push(nucleusGeo);
    this.materials.push(this.nucleusMaterial);

    /* ------------------------------ Koma (Glühwolke) ------------------------------ */
    const comaGeo = new THREE.SphereGeometry(5.5, comaSeg, comaSeg);
    const comaMat = new NodeMaterial();
    comaMat.transparent = true;
    comaMat.depthWrite = false;
    comaMat.blending = THREE.AdditiveBlending;
    comaMat.toneMapped = false;
    comaMat.colorNode = Fn(() => {
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const fres = pow(float(1).sub(ndv), 2.0);
      const churn = fbm3(positionLocal.mul(0.6).add(vec3(this.uComaTime.mul(0.2), 0, 0)), 3).mul(0.3).add(0.8);
      const col = mix(vec3(0.6, 0.75, 1.0), vec3(0.9, 0.95, 1.0), fres).mul(churn).mul(float(1.1).add(this.uPulse.mul(1.2)));
      return vec4(col, fres.mul(0.55));
    })();
    this.comaMesh = new THREE.Mesh(comaGeo, comaMat);
    this.comaMesh.frustumCulled = false;
    this.root.add(this.comaMesh);
    this.geometries.push(comaGeo);
    this.materials.push(comaMat);

    /* ------------------------------- Ionenschweif (blau, gerade) ------------------- */
    const ionPos = new Float32Array(this.ionCount * 3);
    this.ionSeed = new Float32Array(this.ionCount * 2);
    for (let i = 0; i < this.ionCount; i++) {
      this.ionSeed[i * 2] = Math.random();
      this.ionSeed[i * 2 + 1] = Math.random() * Math.PI * 2;
    }
    this.ionGeometry = new THREE.BufferGeometry();
    this.ionGeometry.setAttribute('position', new THREE.BufferAttribute(ionPos, 3));
    this.ionMaterial = new THREE.PointsMaterial({
      color: 0x6fb8ff, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false
    });
    this.ionTail = new THREE.Points(this.ionGeometry, this.ionMaterial);
    this.ionTail.frustumCulled = false;
    this.root.add(this.ionTail);

    /* ------------------------------- Staubschweif (gelb, gebogen) ------------------- */
    const dustPos = new Float32Array(this.dustCount * 3);
    this.dustSeed = new Float32Array(this.dustCount * 2);
    for (let i = 0; i < this.dustCount; i++) {
      this.dustSeed[i * 2] = Math.random();
      this.dustSeed[i * 2 + 1] = Math.random() * Math.PI * 2;
    }
    this.dustGeometry = new THREE.BufferGeometry();
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustMaterial = new THREE.PointsMaterial({
      color: 0xffdf9e, size: 0.3, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false
    });
    this.dustTail = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.dustTail.frustumCulled = false;
    this.root.add(this.dustTail);

    /* ---------------------------------- Sternenfeld ---------------------------------- */
    const starPositions = generateStarSphere(starCount, 200, 260);
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.05, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.root.add(this.stars);

    this.layoutTails(0, 1);
  }

  /** Positioniert die Schweifpartikel neu (Ionenschweif gerade, Staubschweif leicht gebogen); tailLength wächst mit Audio-Energie. */
  private layoutTails(t: number, tailLength: number): void {
    if (this.ionGeometry && this.ionSeed) {
      const arr = (this.ionGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < this.ionCount; i++) {
        const s = this.ionSeed[i * 2];
        const spin = this.ionSeed[i * 2 + 1];
        const dist = 4 + s * 42 * tailLength;
        const spread = (1 - Math.exp(-s * 3)) * 1.6;
        arr[i * 3] = -dist;
        arr[i * 3 + 1] = Math.sin(spin + t * 0.5) * spread;
        arr[i * 3 + 2] = Math.cos(spin + t * 0.5) * spread;
      }
      (this.ionGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    if (this.dustGeometry && this.dustSeed) {
      const arr = (this.dustGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < this.dustCount; i++) {
        const s = this.dustSeed[i * 2];
        const spin = this.dustSeed[i * 2 + 1];
        const dist = 4 + s * 34 * tailLength;
        const curve = s * s * 9; // Krümmung nimmt mit Distanz zu (Staub bleibt hinter der Bahnkurve zurück)
        const spread = (1 - Math.exp(-s * 2.5)) * 2.4;
        arr[i * 3] = -dist * 0.92;
        arr[i * 3 + 1] = curve + Math.sin(spin) * spread * 0.4;
        arr[i * 3 + 2] = Math.cos(spin) * spread;
      }
      (this.dustGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    void ctx;
    const t = time * 0.001;
    this.uTime.value = t;
    this.uComaTime.value = t;
    this.uPulse.value = audio.bass * 0.6 + audio.kickLevel * 0.7;

    if (this.nucleusMesh) this.nucleusMesh.rotation.y += dt * 0.12;
    if (this.nucleusMaterial) {
      this.nucleusMaterial.emissiveIntensity = (audio.bass * 0.5 + audio.kickLevel * 0.6) * 1.4;
    }
    if (this.sunLight) {
      this.sunLight.intensity = 2.2 + audio.bass * 0.8 + audio.kickLevel * 0.5;
    }
    if (this.comaMesh) {
      const s = 1 + audio.bass * 0.08 + audio.kickLevel * 0.08;
      this.comaMesh.scale.setScalar(s);
    }

    const tailLength = 0.7 + audio.energy * 0.6 + audio.bass * 0.2;
    this.layoutTails(t, tailLength);

    if (this.stars) this.stars.rotation.y += dt * 0.0008;
  }

  dispose(): void {
    if (this.scene) {
      if (this.root) this.scene.remove(this.root);
      if (this.sunLight) {
        this.scene.remove(this.sunLight);
        this.scene.remove(this.sunLight.target);
      }
      if (this.hemi) this.scene.remove(this.hemi);
    }
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.nucleusTexture?.dispose();
    this.sunLight?.dispose();
    this.hemi?.dispose();
    this.ionGeometry?.dispose();
    this.ionMaterial?.dispose();
    this.dustGeometry?.dispose();
    this.dustMaterial?.dispose();
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.nucleusMesh = null;
    this.nucleusMaterial = null;
    this.nucleusTexture = null;
    this.comaMesh = null;
    this.sunLight = null;
    this.hemi = null;
    this.ionTail = null;
    this.ionGeometry = null;
    this.ionMaterial = null;
    this.ionSeed = null;
    this.dustTail = null;
    this.dustGeometry = null;
    this.dustMaterial = null;
    this.dustSeed = null;
    this.stars = null;
    this.starGeometry = null;
    this.starMaterial = null;
    this.scene = null;
  }
}
