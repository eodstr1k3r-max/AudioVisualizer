import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import { Fn, uniform, vec3, vec4, mix, positionLocal, smoothstep } from 'three/tsl';
import { fbm3 } from './tslNoise';
import { fbm2 } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/** Deterministischer Seed-RNG (für reproduzierbare Blitz-Verzweigungen pro Schlag). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Abstand Punkt → Liniensegment (für die Adern-Darstellung im Blitz). */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * „Storm" – Gewittersturm auf offener See.
 * Echte PBR-Geometrie: eine reflektierende Wasserfläche mit CPU-Wellendisplacement,
 * beleuchtet von Mond (wirft Schatten der Wellenkämme) und Hemisphäre, dazu
 * Blitzlicht & Regen. Der Wolkenhimmel bleibt prozedural (Atmosphäre).
 */
export class StormScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private skyMesh: THREE.Mesh | null = null;
  private seaMesh: THREE.Mesh | null = null;
  private seaGeometry: THREE.PlaneGeometry | null = null;
  private seaMaterial: THREE.MeshStandardMaterial | null = null;
  private seaBasePos: Float32Array | null = null;

  private hemi: THREE.HemisphereLight | null = null;
  private moon: THREE.DirectionalLight | null = null;
  private lightning: THREE.PointLight | null = null;

  private rain: THREE.Points | null = null;
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainMaterial: THREE.PointsMaterial | null = null;
  private rainCount = 2200;

  private bolt: THREE.Mesh | null = null;
  private boltMaterial: THREE.MeshBasicMaterial | null = null;
  private boltTexture: THREE.DataTexture | null = null;
  private boltData: Uint8Array | null = null;
  private readonly boltWidth = 256;
  private readonly boltHeight = 512;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private uTime = uniform(0);
  private uFlash = uniform(0);

  private nextStrikeIn = 1.2;
  private flashLevel = 0;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const q = ctx.settings.quality;
    const skySeg = q === 'ultra' ? 40 : q === 'high' ? 30 : 20;
    const seaSeg = q === 'ultra' ? 96 : q === 'high' ? 64 : 40;
    const rainCount = q === 'ultra' ? 2200 : q === 'high' ? 1400 : 800;
    const shadowSize = q === 'ultra' ? 2048 : 1024;
    this.rainCount = rainCount;

    this.root = new THREE.Group();
    ctx.scene.add(this.root);
    ctx.scene.fog = new THREE.FogExp2(0x0a0e18, 0.0035);

    /* -------------------------------- Wolkenhimmel -------------------------------- */
    const skyGeo = new THREE.SphereGeometry(150, skySeg, Math.max(14, Math.round(skySeg * 0.7)), 0, Math.PI * 2, 0, Math.PI * 0.6);
    const skyMat = new NodeMaterial();
    skyMat.side = THREE.BackSide;
    skyMat.toneMapped = false;
    skyMat.colorNode = Fn(() => {
      const p: any = positionLocal.mul(0.03);
      const clouds = fbm3(vec3(p.x.add(this.uTime.mul(0.06)), p.y, p.z.add(this.uTime.mul(0.03))), 5);
      const density = smoothstep(0.35, 0.85, clouds);
      const base = mix(vec3(0.02, 0.022, 0.03), vec3(0.06, 0.065, 0.08), density);
      const flashCol = vec3(0.55, 0.6, 0.75).mul(this.uFlash).mul(density.add(0.3));
      return vec4(base.add(flashCol), 1);
    })();
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.frustumCulled = false;
    this.root.add(this.skyMesh);
    this.geometries.push(skyGeo);
    this.materials.push(skyMat);

    /* ------------------------------ PBR-See -------------------------------------- */
    this.seaGeometry = new THREE.PlaneGeometry(260, 260, seaSeg, seaSeg);
    this.seaBasePos = new Float32Array((this.seaGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array);

    this.seaMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1622,
      roughness: 0.16,
      metalness: 0.12,
      envMapIntensity: 1.15
    });
    this.seaMesh = new THREE.Mesh(this.seaGeometry, this.seaMaterial);
    this.seaMesh.rotation.x = -Math.PI / 2;
    this.seaMesh.position.set(0, -6, 0);
    this.seaMesh.castShadow = true;
    this.seaMesh.receiveShadow = true;
    this.seaMesh.frustumCulled = false;
    this.root.add(this.seaMesh);
    this.geometries.push(this.seaGeometry);
    this.materials.push(this.seaMaterial);

    /* ------------------------------ Beleuchtung ---------------------------------- */
    this.hemi = new THREE.HemisphereLight(0x26324a, 0x05070c, 0.6);
    ctx.scene.add(this.hemi);

    // Mondlicht im flachen Winkel → Wellenkämme werfen Schatten in die Täler
    this.moon = new THREE.DirectionalLight(0xbcd0ff, 1.4);
    this.moon.position.set(50, 30, 18);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(shadowSize, shadowSize);
    this.moon.shadow.camera.left = -80;
    this.moon.shadow.camera.right = 80;
    this.moon.shadow.camera.top = 80;
    this.moon.shadow.camera.bottom = -80;
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 200;
    this.moon.shadow.bias = -0.0005;
    this.moon.shadow.normalBias = 0.04;
    ctx.scene.add(this.moon);

    this.lightning = new THREE.PointLight(0xaeb8ff, 0, 220, 1.4);
    this.lightning.position.set(0, 40, -30);
    ctx.scene.add(this.lightning);

    // Blitzader: prozedural verzweigter Blitz als Textur – nur die Adern glühen
    // (statt uniformem Glow), der Rest bleibt transparent/schwarz.
    this.boltData = new Uint8Array(this.boltWidth * this.boltHeight * 4);
    this.boltTexture = new THREE.DataTexture(this.boltData, this.boltWidth, this.boltHeight, THREE.RGBAFormat);
    this.boltTexture.colorSpace = THREE.SRGBColorSpace;
    this.boltMaterial = new THREE.MeshBasicMaterial({
      map: this.boltTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.bolt = new THREE.Mesh(new THREE.PlaneGeometry(26, 52), this.boltMaterial);
    this.bolt.position.set(0, 40, -28);
    this.renderBolt();
    this.root.add(this.bolt);

    /* ----------------------------------- Regen ----------------------------------- */
    const rainPos = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 140;
      rainPos[i * 3 + 1] = Math.random() * 60 - 6;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rainMaterial = new THREE.PointsMaterial({
      color: 0x9fb3d9, size: 0.22, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false
    });
    this.rain = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    const t = time * 0.001;
    this.uTime.value = t;

    // Blitzschlag: zufällig getaktet, zusätzlich vom Kick getriggert
    this.nextStrikeIn -= dt;
    if (this.nextStrikeIn <= 0 || (audio.isKick && Math.random() < 0.18)) {
      this.flashLevel = 1;
      this.nextStrikeIn = 2 + Math.random() * 5 - audio.energy * 2;
      this.renderBolt(); // jeder Schlag bekommt eine eigene, neue Verzweigung
    }
    this.flashLevel = Math.max(0, this.flashLevel - dt * 4.5);
    this.uFlash.value = this.flashLevel;
    if (this.lightning) this.lightning.intensity = this.flashLevel * 16;
    if (this.boltMaterial) this.boltMaterial.opacity = this.flashLevel * 0.95;
    if (this.bolt && ctx.camera) this.bolt.lookAt(ctx.camera.position);

    // Wellen-Displacement (CPU) – Bass/Kick heben die Wellenhöhe an
    if (this.seaGeometry && this.seaBasePos) {
      const posAttr = this.seaGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const waveAmp = 1 + audio.bass * 1.4 + audio.kickLevel * 0.8;
      for (let i = 0; i < arr.length; i += 3) {
        const lx = this.seaBasePos[i];
        const ly = this.seaBasePos[i + 1];
        const h = (fbm2(lx * 0.045 + t * 0.25, ly * 0.045 + t * 0.14, 4) - 0.5) * 3.4 * waveAmp;
        arr[i] = lx;
        arr[i + 1] = ly;
        arr[i + 2] = h;
      }
      posAttr.needsUpdate = true;
      this.seaGeometry.computeVertexNormals();
    }

    // Regen: fallen lassen, unten zurücksetzen
    if (this.rainGeometry) {
      const posAttr = this.rainGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speed = 34 + audio.energy * 30;
      for (let i = 0; i < this.rainCount; i++) {
        arr[i * 3 + 1] -= speed * dt;
        if (arr[i * 3 + 1] < -6) {
          arr[i * 3] = (Math.random() - 0.5) * 140;
          arr[i * 3 + 1] = 54 + Math.random() * 8;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 140;
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  /**
   * Bäckt einen frisch verzweigten Blitz in die DataTexture (Adern hell,
   * Hintergrund transparent/schwarz). Wird pro Schlag neu aufgerufen.
   */
  private renderBolt(): void {
    if (!this.boltData || !this.boltTexture) return;
    const w = this.boltWidth;
    const h = this.boltHeight;
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const seg: number[] = []; // x1,y1,x2,y2 flach
    const jitter = w * 0.16;
    let x = w / 2 + (rng() - 0.5) * w * 0.34;
    let y = h + 4;
    const segLen = h / 13;

    // Hauptader von oben nach unten, mit zufälligen Seitenästen
    while (y > -4) {
      const nx = Math.min(w - 5, Math.max(5, x + (rng() - 0.5) * 2 * jitter));
      const ny = Math.max(-4, y - segLen * (0.6 + rng() * 0.8));
      seg.push(x, y, nx, ny);
      if (rng() < 0.45) {
        const bx = Math.min(w - 5, Math.max(5, nx + (rng() - 0.5) * w * 0.3));
        const by = Math.max(-4, ny - rng() * segLen * 1.6);
        seg.push(nx, ny, bx, by);
      }
      x = nx;
      y = ny;
    }

    const data = this.boltData;
    data.fill(0);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let d = Infinity;
        for (let s = 0; s < seg.length; s += 4) {
          const dd = distToSegment(px, py, seg[s], seg[s + 1], seg[s + 2], seg[s + 3]);
          if (dd < d) d = dd;
        }
        const core = Math.max(0, 1 - d / 3.2);
        const halo = Math.max(0, 1 - d / 9) * 0.35;
        const b = Math.min(1, core + halo);
        if (b < 0.02) continue; // bleibt schwarz/transparent
        const i = (py * w + px) * 4;
        data[i] = Math.round(225 + b * 30);
        data[i + 1] = Math.round(235 + b * 20);
        data[i + 2] = 255;
        data[i + 3] = Math.round(b * 255);
      }
    }
    this.boltTexture.needsUpdate = true;
  }

  dispose(): void {
    if (this.scene && this.root) this.scene.remove(this.root);
    if (this.scene && this.hemi) this.scene.remove(this.hemi);
    if (this.scene && this.moon) this.scene.remove(this.moon);
    if (this.scene && this.lightning) this.scene.remove(this.lightning);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.rainGeometry?.dispose();
    this.rainMaterial?.dispose();
    this.bolt?.geometry.dispose();
    this.boltMaterial?.dispose();
    this.boltTexture?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.skyMesh = null;
    this.seaMesh = null;
    this.seaGeometry = null;
    this.seaMaterial = null;
    this.seaBasePos = null;
    this.hemi = null;
    this.moon = null;
    this.lightning = null;
    this.rain = null;
    this.rainGeometry = null;
    this.rainMaterial = null;
    this.bolt = null;
    this.boltMaterial = null;
    this.boltTexture = null;
    this.boltData = null;
    this.scene = null;
  }
}
