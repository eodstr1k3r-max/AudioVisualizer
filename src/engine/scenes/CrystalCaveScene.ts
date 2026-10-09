import * as THREE from 'three';
import { fbm3, neonEmissiveComp } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Crystal Cave" – unterirdische Höhle mit glühenden Kristallclustern.
 * Echte PBR-Geometrie: Felswände (Vertex-Farben), reflektierender Höhlensee und
 * Kristalle als MeshPhysicalMaterial (Klarlack + Emissive + Schattenwurf),
 * beleuchtet von Hemisphäre, einem Lichtschacht von oben und einem
 * audio-reaktiven Kristall-Glow. Treibende Lichtstäubchen bleiben als Partikel.
 */
export class CrystalCaveScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private cavernMesh: THREE.Mesh | null = null;
  private poolMesh: THREE.Mesh | null = null;
  private crystals: THREE.Mesh[] = [];
  private crystalMats: THREE.MeshPhysicalMaterial[] = [];
  private crystalComps: number[] = [];

  private hemi: THREE.HemisphereLight | null = null;
  private shaft: THREE.DirectionalLight | null = null;
  private glow: THREE.PointLight | null = null;

  private dust: THREE.Points | null = null;
  private dustGeometry: THREE.BufferGeometry | null = null;
  private dustMaterial: THREE.PointsMaterial | null = null;
  private dustVel: Float32Array | null = null;
  private dustCount = 900;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private readonly crystalColors = [0x6fd9ff, 0xb26fff, 0x6fffb8, 0xff6fd9, 0xffd76f];

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const q = ctx.settings.quality;
    const cavernSeg = q === 'ultra' ? 40 : q === 'high' ? 30 : 20;
    const poolSeg = q === 'ultra' ? 64 : q === 'high' ? 44 : 28;
    const crystalCount = q === 'ultra' ? 14 : q === 'high' ? 10 : 7;
    this.dustCount = q === 'ultra' ? 900 : q === 'high' ? 600 : 350;
    const shadowSize = q === 'ultra' ? 2048 : 1024;
    this.root = new THREE.Group();
    ctx.scene.add(this.root);
    ctx.scene.fog = new THREE.FogExp2(0x05060a, 0.02);

    /* ------------------------------ PBR-Felswände ------------------------------ */
    const cavernGeo = new THREE.SphereGeometry(60, cavernSeg, Math.max(14, Math.round(cavernSeg * 0.7)));
    const cpos = cavernGeo.attributes.position as THREE.BufferAttribute;
    const ccolors = new Float32Array(cpos.count * 3);
    const rockA = new THREE.Color(0x0c0d14);
    const rockB = new THREE.Color(0x1a1a24);
    const tmp = new THREE.Color();
    for (let i = 0; i < cpos.count; i++) {
      const n = fbm3(cpos.getX(i) * 0.06, cpos.getY(i) * 0.06, cpos.getZ(i) * 0.06, 3);
      tmp.copy(rockA).lerp(rockB, n);
      ccolors[i * 3] = tmp.r;
      ccolors[i * 3 + 1] = tmp.g;
      ccolors[i * 3 + 2] = tmp.b;
    }
    cavernGeo.setAttribute('color', new THREE.BufferAttribute(ccolors, 3));
    const cavernMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.3,
      side: THREE.BackSide
    });
    this.cavernMesh = new THREE.Mesh(cavernGeo, cavernMat);
    this.cavernMesh.frustumCulled = false;
    this.root.add(this.cavernMesh);
    this.geometries.push(cavernGeo);
    this.materials.push(cavernMat);

    /* ------------------------------ PBR-Höhlensee ------------------------------ */
    const poolGeo = new THREE.CircleGeometry(28, poolSeg);
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x060a12,
      roughness: 0.12,
      metalness: 0.15,
      envMapIntensity: 1.2
    });
    this.poolMesh = new THREE.Mesh(poolGeo, poolMat);
    this.poolMesh.rotation.x = -Math.PI / 2;
    this.poolMesh.position.set(0, -16, 0);
    this.poolMesh.receiveShadow = true;
    this.poolMesh.frustumCulled = false;
    this.root.add(this.poolMesh);
    this.geometries.push(poolGeo);
    this.materials.push(poolMat);

    /* ------------------------- PBR-Kristallcluster (Emissive) ------------------------- */
    for (let i = 0; i < crystalCount; i++) {
      const clusterGeo = new THREE.OctahedronGeometry(1.4 + Math.random() * 2.4, 0);
      const glowColor = new THREE.Color(this.crystalColors[i % this.crystalColors.length]);
      const comp = neonEmissiveComp(glowColor);
      const clusterMat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a18,
        roughness: 0.12,
        metalness: 0.0,
        transparent: true,
        opacity: 0.85,
        envMapIntensity: 1.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15,
        emissive: glowColor,
        emissiveIntensity: 0.8 * comp
      });

      const cluster = new THREE.Mesh(clusterGeo, clusterMat);
      const angle = (i / crystalCount) * Math.PI * 2 + Math.random() * 0.5;
      const r = 8 + Math.random() * 32;
      const onGround = Math.random() > 0.35;
      cluster.position.set(
        Math.cos(angle) * r,
        onGround ? -15 + Math.random() * 3 : 5 + Math.random() * 20,
        Math.sin(angle) * r
      );
      cluster.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      cluster.scale.setScalar(0.8 + Math.random() * 0.8);
      cluster.castShadow = true;
      cluster.receiveShadow = true;
      cluster.frustumCulled = false;
      this.root.add(cluster);
      this.crystals.push(cluster);
      this.crystalMats.push(clusterMat);
      this.crystalComps.push(comp);
      this.geometries.push(clusterGeo);
      this.materials.push(clusterMat);
    }

    /* --------------------------------- Beleuchtung --------------------------------- */
    this.hemi = new THREE.HemisphereLight(0x1a2030, 0x050608, 0.5);
    ctx.scene.add(this.hemi);

    // Lichtschacht von oben wirft Kristall-Schatten auf See & Boden
    this.shaft = new THREE.DirectionalLight(0x9fc8ff, 0.8);
    this.shaft.position.set(0, 45, 0);
    this.shaft.castShadow = true;
    this.shaft.shadow.mapSize.set(shadowSize, shadowSize);
    this.shaft.shadow.camera.left = -60;
    this.shaft.shadow.camera.right = 60;
    this.shaft.shadow.camera.top = 60;
    this.shaft.shadow.camera.bottom = -60;
    this.shaft.shadow.camera.near = 1;
    this.shaft.shadow.camera.far = 140;
    this.shaft.shadow.bias = -0.0004;
    this.shaft.shadow.normalBias = 0.03;
    ctx.scene.add(this.shaft);

    // Kristall-Glow: füllt die Höhle audio-reaktiv mit violettem Licht
    this.glow = new THREE.PointLight(0x8a6fff, 25, 100, 1.6);
    this.glow.position.set(0, 4, 0);
    ctx.scene.add(this.glow);

    /* ---------------------------- Treibende Lichtstäubchen --------------------------- */
    const dPos = new Float32Array(this.dustCount * 3);
    this.dustVel = new Float32Array(this.dustCount * 3);
    for (let i = 0; i < this.dustCount; i++) {
      dPos[i * 3] = (Math.random() - 0.5) * 70;
      dPos[i * 3 + 1] = -15 + Math.random() * 45;
      dPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      this.dustVel[i * 3] = (Math.random() - 0.5) * 0.3;
      this.dustVel[i * 3 + 1] = 0.08 + Math.random() * 0.14;
      this.dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    this.dustGeometry = new THREE.BufferGeometry();
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    this.dustMaterial = new THREE.PointsMaterial({
      color: 0xcfa8ff, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false
    });
    this.dust = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.dust.frustumCulled = false;
    this.root.add(this.dust);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    void ctx;
    const t = time * 0.001;

    // Kristall-Emissive pulsiert audio-reaktiv, phasenversetzt
    for (let i = 0; i < this.crystalMats.length; i++) {
      const pulse = audio.bass * 0.6 + audio.kickLevel * 0.5 + Math.sin(t * 2 + i) * 0.05;
      this.crystalMats[i].emissiveIntensity = (0.8 + pulse) * this.crystalComps[i];
    }
    for (const c of this.crystals) c.rotation.y += dt * 0.05;

    if (this.glow) this.glow.intensity = 25 + audio.bass * 70 + audio.energy * 30;

    if (this.dustGeometry && this.dustVel) {
      const posAttr = this.dustGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speedMul = 1 + audio.energy * 0.5;
      for (let i = 0; i < this.dustCount; i++) {
        arr[i * 3] += this.dustVel[i * 3] * dt * speedMul;
        arr[i * 3 + 1] += this.dustVel[i * 3 + 1] * dt * speedMul;
        arr[i * 3 + 2] += this.dustVel[i * 3 + 2] * dt * speedMul;
        if (arr[i * 3 + 1] > 32) {
          arr[i * 3 + 1] = -15;
          arr[i * 3] = (Math.random() - 0.5) * 70;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 70;
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.scene && this.root) this.scene.remove(this.root);
    if (this.scene && this.hemi) this.scene.remove(this.hemi);
    if (this.scene && this.shaft) this.scene.remove(this.shaft);
    if (this.scene && this.glow) this.scene.remove(this.glow);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.dustGeometry?.dispose();
    this.dustMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.cavernMesh = null;
    this.poolMesh = null;
    this.crystals = [];
    this.crystalMats = [];
    this.crystalComps = [];
    this.hemi = null;
    this.shaft = null;
    this.glow = null;
    this.dust = null;
    this.dustGeometry = null;
    this.dustMaterial = null;
    this.dustVel = null;
    this.scene = null;
  }
}
