import * as THREE from 'three';
import { createSkyDome, createGroundPlane, fbm2, neonEmissiveComp } from './realism';
import { generateStarSphere } from './tslNoise';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Volcano" – fotorealistischer Vulkanausbruch bei Nacht.
 * Echte PBR-Geometrie: Basaltkegel mit Glutadern (Vertex-Farben), emittierender
 * Krater, Aschewolke, Funkenregen. Mondlicht wirft echte Schatten des Kegels
 * auf den Boden, Lavalicht beleuchtet Krater und Wolke.
 */
export class VolcanoScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private cone: THREE.Mesh | null = null;
  private plume: THREE.Mesh | null = null;
  private ground: THREE.Mesh | null = null;
  private sky: THREE.Mesh | null = null;

  private hemi: THREE.HemisphereLight | null = null;
  private moon: THREE.DirectionalLight | null = null;
  private lavaLight: THREE.PointLight | null = null;

  private embers: THREE.Points | null = null;
  private emberGeometry: THREE.BufferGeometry | null = null;
  private emberMaterial: THREE.PointsMaterial | null = null;
  private emberVel: Float32Array | null = null;
  private emberLife: Float32Array | null = null;

  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private emberCount = 900;
  private coneMaterial: THREE.MeshStandardMaterial | null = null;
  private plumeMaterial: THREE.MeshStandardMaterial | null = null;
  private lavaEmissiveMap: THREE.DataTexture | null = null;
  private lavaComp = 1;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const q = ctx.settings.quality;
    const coneSeg = q === 'ultra' ? 64 : q === 'high' ? 44 : 28;
    const emberCount = q === 'ultra' ? 900 : q === 'high' ? 600 : 350;
    const starCount = q === 'ultra' ? 1500 : q === 'high' ? 1000 : 600;
    const shadowSize = q === 'ultra' ? 2048 : 1024;
    this.emberCount = emberCount;

    this.root = new THREE.Group();
    ctx.scene.add(this.root);

    // Nacht-Atmosphäre: dunkler Himmel + leichter Dunst
    ctx.scene.fog = new THREE.FogExp2(0x0c0a14, 0.0035);
    this.sky = createSkyDome(0x04060d, 0x12121a, 0x02040a, 300, 40);
    ctx.scene.add(this.sky);

    /* -------------------------------- Boden -------------------------------------- */
    this.ground = createGroundPlane(320, 0x140e0a, 0.95, 0.05, -12);
    this.ground.receiveShadow = true;
    this.root.add(this.ground);
    this.geometries.push(this.ground.geometry);
    this.materials.push(this.ground.material as THREE.Material);

    /* ----------------------------- Basaltkegel ----------------------------------- */
    const coneGeo = new THREE.ConeGeometry(16, 20, coneSeg, 24, true);
    this.paintLavaVeins(coneGeo);

    // Emissive-Map: nur Glutadern & Krater emittieren (Basalt bleibt schwarz) –
    // dadurch lässt sich die Emissiv-Intensität über die Bloom-Schwelle heben,
    // ohne den ganzen Kegel aufglühen zu lassen.
    this.lavaEmissiveMap = this.makeLavaEmissiveMap();
    // Orange hat geringe Luminanz → ohne Kompensation blüht Lava schwächer als
    // cyan/grün. neonEmissiveComp normalisiert auf Grün-Niveau (≈1.6× für Orange).
    this.lavaComp = neonEmissiveComp(new THREE.Color(0xff5a00));
    this.coneMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveMap: this.lavaEmissiveMap,
      emissiveIntensity: 0.5
    });
    this.cone = new THREE.Mesh(coneGeo, this.coneMaterial);
    this.cone.position.set(0, -2, 0);
    this.cone.castShadow = true;
    this.cone.receiveShadow = true;
    this.root.add(this.cone);
    this.geometries.push(coneGeo);
    this.materials.push(this.coneMaterial);

    /* ------------------------------ Aschewolke ----------------------------------- */
    const plumeGeo = new THREE.SphereGeometry(13, 28, 18);
    this.plumeMaterial = new THREE.MeshStandardMaterial({
      color: 0x241d1a,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });
    this.plume = new THREE.Mesh(plumeGeo, this.plumeMaterial);
    this.plume.position.set(0, 12, 0);
    this.root.add(this.plume);
    this.geometries.push(plumeGeo);
    this.materials.push(this.plumeMaterial);

    /* ------------------------------ Beleuchtung ---------------------------------- */
    // Natürliche Nacht-Ambient (Himmel/Boden)
    this.hemi = new THREE.HemisphereLight(0x2a3450, 0x0a0806, 0.5);
    ctx.scene.add(this.hemi);

    // Kalter Mond wirft den Kegel-Schatten auf den Boden
    this.moon = new THREE.DirectionalLight(0x9db4ff, 1.7);
    this.moon.position.set(40, 60, 24);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(shadowSize, shadowSize);
    this.moon.shadow.camera.left = -60;
    this.moon.shadow.camera.right = 60;
    this.moon.shadow.camera.top = 60;
    this.moon.shadow.camera.bottom = -60;
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 200;
    this.moon.shadow.bias = -0.0004;
    this.moon.shadow.normalBias = 0.02;
    ctx.scene.add(this.moon);

    // Glühende Lava im Krater – audio-reaktiv
    this.lavaLight = new THREE.PointLight(0xff5a00, 0, 90, 1.8);
    this.lavaLight.position.set(0, 4, 0);
    ctx.scene.add(this.lavaLight);

    /* ------------------------------- Funkenregen ---------------------------------- */
    const positions = new Float32Array(this.emberCount * 3);
    this.emberVel = new Float32Array(this.emberCount * 3);
    this.emberLife = new Float32Array(this.emberCount);
    for (let i = 0; i < this.emberCount; i++) this.resetEmber(i, positions, true);
    this.emberGeometry = new THREE.BufferGeometry();
    this.emberGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.emberMaterial = new THREE.PointsMaterial({
      color: 0xffaa44, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false
    });
    this.embers = new THREE.Points(this.emberGeometry, this.emberMaterial);
    this.embers.frustumCulled = false;
    this.root.add(this.embers);

    /* ------------------------------- Sternenfeld ----------------------------------- */
    const starPositions = generateStarSphere(starCount, 160, 200);
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.0, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.root.add(this.stars);
  }

  /** Malt Krater & fließende Glutadern als Vertex-Farben auf den Kegel. */
  private paintLavaVeins(coneGeo: THREE.ConeGeometry): void {
    const pos = coneGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const rock = new THREE.Color(0x1a1411);
    const lava = new THREE.Color(0xff5a00);
    const glow = new THREE.Color(0xffd27a);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const t = (y + 10) / 20; // 0 = Basis, 1 = Krater
      const veins = fbm2(x * 0.45 + 3.7, z * 0.45 + 1.2, 4);
      const vein = Math.max(0, 1 - Math.abs(veins - 0.56) / 0.09);
      const craterGlow = Math.max(0, (t - 0.8) / 0.2);

      tmp.copy(rock);
      tmp.lerp(lava, Math.min(1, craterGlow + vein * 0.85 * t));
      tmp.lerp(glow, craterGlow * 0.55);

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    coneGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  /**
   * Bäckt das Glutader-Muster als Emissive-Map (DataTexture – kein DOM, testbar).
   * Nutzt exakt dieselbe fbm2-Formel wie paintLavaVeins, damit Adern & Krater
   * in Vertex-Farben und Emissive deckungsgleich glühen. Basalt → schwarz.
   */
  private makeLavaEmissiveMap(w = 256, h = 128): THREE.DataTexture {
    const data = new Uint8Array(w * h * 4);
    const lava = new THREE.Color(0xff5a00);
    const glow = new THREE.Color(0xffd27a);
    const tmp = new THREE.Color();
    const R = 16; // Radius unten (ConeGeometry)

    for (let y = 0; y < h; y++) {
      const v = y / (h - 1); // UV-v: 1 = Basis, 0 = Spitze (three.js ConeGeometry)
      const t = 1 - v; // 0 Basis, 1 Krater
      const r = R * v; // Radius in dieser Höhe (schrumpft zur Spitze)
      for (let x = 0; x < w; x++) {
        const u = x / w; // UV-u: 0..1 um den Umfang
        const angle = u * Math.PI * 2;
        const px = Math.cos(angle) * r;
        const pz = Math.sin(angle) * r;
        const veins = fbm2(px * 0.45 + 3.7, pz * 0.45 + 1.2, 4);
        const vein = Math.max(0, 1 - Math.abs(veins - 0.56) / 0.09);
        const craterGlow = Math.max(0, (t - 0.8) / 0.2);

        tmp.copy(lava).multiplyScalar(Math.min(1, craterGlow + vein * 0.85 * t));
        const gk = craterGlow * 0.55;
        tmp.r += glow.r * gk;
        tmp.g += glow.g * gk;
        tmp.b += glow.b * gk;

        const i = (y * w + x) * 4;
        data[i] = Math.round(Math.min(1, tmp.r) * 255);
        data[i + 1] = Math.round(Math.min(1, tmp.g) * 255);
        data[i + 2] = Math.round(Math.min(1, tmp.b) * 255);
        data[i + 3] = 255;
      }
    }

    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; // nahtloser Längengrad-Wrap
    tex.needsUpdate = true;
    return tex;
  }

  private resetEmber(i: number, positions: Float32Array, initial: boolean): void {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 1.5;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = initial ? Math.random() * 20 - 2 : 8;
    positions[i * 3 + 2] = Math.sin(angle) * r;

    const speed = 6 + Math.random() * 10;
    const spread = 3 + Math.random() * 4;
    this.emberVel![i * 3] = Math.cos(angle) * spread;
    this.emberVel![i * 3 + 1] = speed;
    this.emberVel![i * 3 + 2] = Math.sin(angle) * spread;
    this.emberLife![i] = 0;
  }

  update(dt: number, _time: number, audio: AudioData, _ctx: EngineContext): void {
    void _ctx;
    const glow = audio.bass * 0.8 + audio.kickLevel * 1.2;

    // Emissiv-Spitze ~3 × Luminanz-Kompensation: nur die Glutadern/Krater (via
    // Emissive-Map) blühen über die Bloom-Schwelle (0.72) – Orange blüht jetzt
    // genauso stark wie cyan/grün, der dunkle Basalt bleibt dunkel.
    if (this.coneMaterial) this.coneMaterial.emissiveIntensity = (0.6 + glow * 1.2) * this.lavaComp;
    if (this.lavaLight) {
      this.lavaLight.intensity = 25 + audio.bass * 130 + audio.kickLevel * 90;
      // Glut bleibt natürlich warm (Orange → Gelb bei starkem Ausbruch)
      this.lavaLight.color.setHSL(0.06 - Math.min(0.04, glow * 0.03), 1, 0.5);
    }

    if (this.plume) {
      const s = 1 + audio.bass * 0.08 + audio.kickLevel * 0.1;
      this.plume.scale.setScalar(s);
      this.plume.rotation.y += dt * 0.03;
      if (this.plumeMaterial) this.plumeMaterial.opacity = 0.38 + audio.bass * 0.1;
    }

    // Funken: Ballistik, Reset bei Boden-/Lebensdauer-Ende
    if (this.emberGeometry && this.emberVel && this.emberLife) {
      const posAttr = this.emberGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const gravity = 9;
      const burst = 1 + audio.bass * 1.5 + audio.kickLevel * 2;
      for (let i = 0; i < this.emberCount; i++) {
        this.emberLife[i] += dt;
        arr[i * 3] += this.emberVel[i * 3] * dt * burst;
        arr[i * 3 + 1] += this.emberVel[i * 3 + 1] * dt * burst;
        arr[i * 3 + 2] += this.emberVel[i * 3 + 2] * dt * burst;
        this.emberVel[i * 3 + 1] -= gravity * dt;
        if (arr[i * 3 + 1] < -2 || this.emberLife[i] > 5) {
          this.resetEmber(i, arr, false);
        }
      }
      posAttr.needsUpdate = true;
    }

    if (this.stars) this.stars.rotation.y += dt * 0.001;
  }

  dispose(): void {
    if (this.scene && this.root) this.scene.remove(this.root);
    if (this.scene && this.sky) this.scene.remove(this.sky);
    if (this.scene && this.hemi) this.scene.remove(this.hemi);
    if (this.scene && this.moon) this.scene.remove(this.moon);
    if (this.scene && this.lavaLight) this.scene.remove(this.lavaLight);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.sky?.geometry.dispose();
    (this.sky?.material as THREE.Material | undefined)?.dispose();
    this.emberGeometry?.dispose();
    this.emberMaterial?.dispose();
    this.lavaEmissiveMap?.dispose();
    this.lavaEmissiveMap = null;
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.cone = null;
    this.coneMaterial = null;
    this.plume = null;
    this.plumeMaterial = null;
    this.ground = null;
    this.sky = null;
    this.hemi = null;
    this.moon = null;
    this.lavaLight = null;
    this.embers = null;
    this.emberGeometry = null;
    this.emberMaterial = null;
    this.emberVel = null;
    this.emberLife = null;
    this.stars = null;
    this.starGeometry = null;
    this.starMaterial = null;
    this.scene = null;
  }
}
