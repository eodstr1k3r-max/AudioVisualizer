import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import { Fn, vec3, vec4, uv, smoothstep } from 'three/tsl';
import { neonEmissiveComp } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * Bäckt ein Fenster-Gitter als Emissive-Map (DataTexture – kein DOM, testbar):
 * leuchtende Fenster (weiß) auf dunkler Fassade (schwarz). `emissive` färbt die
 * Fenster dann pro Gebäude in der jeweiligen Neonfarbe.
 */
function makeWindowMap(w = 128, h = 256): THREE.DataTexture {
  const cols = 6;
  const rows = 18;
  const lit = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) lit[i] = Math.random() < 0.42 ? 1 : 0;

  const data = new Uint8Array(w * h * 4);
  const cellW = w / cols;
  const cellH = h / rows;
  for (let y = 0; y < h; y++) {
    const r = Math.floor(y / cellH);
    const cy = y % cellH;
    const gapY = cy < 2 || cy > cellH - 2;
    for (let x = 0; x < w; x++) {
      const c = Math.floor(x / cellW);
      const cx = x % cellW;
      const gapX = cx < 2 || cx > cellW - 2;
      const on = lit[r * cols + c] && !gapY && !gapX;
      const bright = on ? Math.round((0.75 + Math.random() * 0.25) * 255) : 0;
      const i = (y * w + x) * 4;
      data[i] = bright;
      data[i + 1] = bright;
      data[i + 2] = bright;
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/**
 * „Cyberpunk" – Neon-Skyline im Regen.
 * Echte PBR-Geometrie: Gebäude als Boxen mit leuchtenden Neon-Fenstern
 * (Emissive-Map + Emissive-Farbe) und ein nasser, spiegelnder Boden, der die
 * Neon-Lichter reflektiert. Regen & Dunst bleiben als Effekte.
 */
export class CyberpunkScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private buildingsGroup: THREE.Group | null = null;
  private groundMesh: THREE.Mesh | null = null;
  private fogPlane: THREE.Mesh | null = null;

  private windowMap: THREE.DataTexture | null = null;
  private buildingMats: THREE.MeshStandardMaterial[] = [];
  private buildingComps: number[] = [];

  private hemi: THREE.HemisphereLight | null = null;
  private neonLight1: THREE.PointLight | null = null;
  private neonLight2: THREE.PointLight | null = null;

  private rain: THREE.Points | null = null;
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainMaterial: THREE.PointsMaterial | null = null;
  private rainCount = 2600;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private readonly neonColors = [0xff2d95, 0x2de1ff, 0x9d4bff, 0x2dff9e, 0xffb62d];

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const q = ctx.settings.quality;
    this.rainCount = q === 'ultra' ? 2600 : q === 'high' ? 1700 : 1000;
    const buildingCount = q === 'ultra' ? 9 : q === 'high' ? 7 : 5;
    this.root = new THREE.Group();
    ctx.scene.add(this.root);
    ctx.scene.fog = new THREE.FogExp2(0x0a0c16, 0.009);

    this.windowMap = makeWindowMap();

    /* ------------------------------ PBR-Gebäudereihen ------------------------------ */
    this.buildingsGroup = new THREE.Group();
    const rows = [-30, -14, 2, 18, 34];
    let idx = 0;
    for (const z of rows) {
      const count = buildingCount;
      for (let i = 0; i < count; i++) {
        const w = 3 + Math.random() * 3.5;
        const d = 3 + Math.random() * 3;
        const h = 8 + Math.random() * 26 + Math.abs(z) * 0.15;
        const x = (i - count / 2) * 7 + (Math.random() - 0.5) * 2;

        const neon = new THREE.Color(this.neonColors[idx % this.neonColors.length]);
        const comp = neonEmissiveComp(neon);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x0a0c14,
          roughness: 0.4,
          metalness: 0.3,
          envMapIntensity: 0.8,
          emissive: neon,
          emissiveMap: this.windowMap,
          emissiveIntensity: 0.5 * comp
        });

        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2 - 6, z);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        this.buildingsGroup.add(mesh);
        this.geometries.push(geo);
        this.materials.push(mat);
        this.buildingMats.push(mat);
        this.buildingComps.push(comp);
        idx++;
      }
    }
    this.root.add(this.buildingsGroup);

    /* ------------------------------ Nasser PBR-Boden ------------------------------ */
    const groundGeo = new THREE.PlaneGeometry(220, 220, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c12,
      roughness: 0.15,
      metalness: 0.3,
      envMapIntensity: 1.2
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.set(0, -6, 0);
    this.groundMesh.frustumCulled = false;
    this.root.add(this.groundMesh);
    this.geometries.push(groundGeo);
    this.materials.push(groundMat);

    /* ----------------------------------- Beleuchtung --------------------------------- */
    this.hemi = new THREE.HemisphereLight(0x1a2a44, 0x05070a, 0.5);
    ctx.scene.add(this.hemi);

    // Neon-Lichter spiegeln sich im nassen Boden
    this.neonLight1 = new THREE.PointLight(0xff2d95, 30, 140, 1.6);
    this.neonLight1.position.set(-25, 12, 5);
    ctx.scene.add(this.neonLight1);
    this.neonLight2 = new THREE.PointLight(0x2de1ff, 30, 140, 1.6);
    this.neonLight2.position.set(25, 12, 20);
    ctx.scene.add(this.neonLight2);

    /* ----------------------------------- Nebel/Dunst --------------------------------- */
    const fogGeo = new THREE.PlaneGeometry(220, 40, 1, 1);
    const fogMat = new NodeMaterial();
    fogMat.transparent = true;
    fogMat.depthWrite = false;
    fogMat.toneMapped = false;
    fogMat.colorNode = Fn(() => {
      const t = uv().y;
      const fade = smoothstep(1.0, 0.0, t);
      return vec4(vec3(0.04, 0.03, 0.06), fade.mul(0.5));
    })();
    this.fogPlane = new THREE.Mesh(fogGeo, fogMat);
    this.fogPlane.position.set(0, 4, -10);
    this.fogPlane.frustumCulled = false;
    this.root.add(this.fogPlane);
    this.geometries.push(fogGeo);
    this.materials.push(fogMat);

    /* -------------------------------------- Regen ------------------------------------ */
    const rainPos = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 120;
      rainPos[i * 3 + 1] = Math.random() * 50 - 6;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rainMaterial = new THREE.PointsMaterial({
      color: 0xaad4ff, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false
    });
    this.rain = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
  }

  update(dt: number, _time: number, audio: AudioData, ctx: EngineContext): void {
    void ctx;

    // Fenster-Emissive: beat-synchrones Pulsieren + leichtes Flackern pro Gebäude
    for (let i = 0; i < this.buildingMats.length; i++) {
      const flicker = 0.85 + Math.random() * 0.3;
      this.buildingMats[i].emissiveIntensity =
        (0.5 + audio.beatPulse * 1.2 + audio.energy * 0.4) * this.buildingComps[i] * flicker;
    }

    if (this.neonLight1) this.neonLight1.intensity = 30 + audio.bass * 90 + audio.kickLevel * 50;
    if (this.neonLight2) this.neonLight2.intensity = 30 + audio.energy * 80 + audio.beatPulse * 60;

    if (this.rainGeometry) {
      const posAttr = this.rainGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speed = 46 + audio.energy * 34;
      for (let i = 0; i < this.rainCount; i++) {
        arr[i * 3 + 1] -= speed * dt;
        if (arr[i * 3 + 1] < -6) {
          arr[i * 3] = (Math.random() - 0.5) * 120;
          arr[i * 3 + 1] = 44 + Math.random() * 8;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 90;
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.scene && this.root) this.scene.remove(this.root);
    if (this.scene && this.hemi) this.scene.remove(this.hemi);
    if (this.scene && this.neonLight1) this.scene.remove(this.neonLight1);
    if (this.scene && this.neonLight2) this.scene.remove(this.neonLight2);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.windowMap?.dispose();
    this.rainGeometry?.dispose();
    this.rainMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.buildingsGroup = null;
    this.groundMesh = null;
    this.fogPlane = null;
    this.windowMap = null;
    this.buildingMats = [];
    this.buildingComps = [];
    this.hemi = null;
    this.neonLight1 = null;
    this.neonLight2 = null;
    this.rain = null;
    this.rainGeometry = null;
    this.rainMaterial = null;
    this.scene = null;
  }
}
