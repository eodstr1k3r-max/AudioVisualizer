import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import { Fn, uniform, vec3, vec4, smoothstep, uv } from 'three/tsl';
import { fbm3 } from './tslNoise';
import { fbm2, neonEmissiveComp } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Reef" – bioluminszentes Korallenriff.
 * Echte PBR-Geometrie: reliefierter Sandboden (Vertex-Farben) und leuchtende
 * Korallen (MeshStandardMaterial mit Emissive + Schatten), beleuchtet von
 * Hemisphäre + Sonnenlicht. Das Wasser ist exponentieller Nebel (Unterwasser-
 * Tiefenwirkung) – keine sichtbare Oberfläche, die Kamera ist im Wasser.
 * Lichtstrahlen, Plankton & Fischschwarm bleiben als Effekt-Partikel.
 */
export class ReefScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private ground: THREE.Mesh | null = null;
  private corals: THREE.Mesh[] = [];
  private coralMats: THREE.MeshStandardMaterial[] = [];
  private coralComps: number[] = [];

  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;

  private plankton: THREE.Points | null = null;
  private planktonGeometry: THREE.BufferGeometry | null = null;
  private planktonMaterial: THREE.PointsMaterial | null = null;
  private planktonVel: Float32Array | null = null;
  private planktonCount = 1400;

  private fish: THREE.Points | null = null;
  private fishGeometry: THREE.BufferGeometry | null = null;
  private fishMaterial: THREE.PointsMaterial | null = null;
  private fishPhase: Float32Array | null = null;
  private readonly fishCount = 60;

  private rayGroup: THREE.Group | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private uTime = uniform(0);

  private readonly coralColors = [0x22ffcc, 0xff3ea6, 0x7a4bff, 0x2ea8ff, 0xffcf3e];

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const q = ctx.settings.quality;
    const groundSeg = q === 'ultra' ? 64 : q === 'high' ? 44 : 28;
    const coralCount = q === 'ultra' ? 9 : q === 'high' ? 7 : 5;
    this.planktonCount = q === 'ultra' ? 1400 : q === 'high' ? 900 : 500;
    const shadowSize = q === 'ultra' ? 2048 : 1024;
    this.root = new THREE.Group();
    ctx.scene.add(this.root);

    // Unterwasser: tiefes Teal als Hintergrund + exponentieller Nebel (Wassertiefe)
    ctx.scene.background = new THREE.Color(0x02141c);
    ctx.scene.fog = new THREE.FogExp2(0x04323e, 0.016);

    /* ------------------------------ PBR-Meeresboden ------------------------------ */
    const groundGeo = new THREE.PlaneGeometry(200, 200, groundSeg, groundSeg);
    const gpos = groundGeo.attributes.position as THREE.BufferAttribute;
    const garr = gpos.array as Float32Array;
    const gcolors = new Float32Array(gpos.count * 3);
    const sandBase = new THREE.Color(0x4a4230);
    const sandDark = new THREE.Color(0x2a2a22);
    const tmp = new THREE.Color();
    for (let i = 0; i < gpos.count; i++) {
      const lx = garr[i * 3];
      const ly = garr[i * 3 + 1];
      // Sanfte Relief-Wellen (CPU-Displacement)
      garr[i * 3 + 2] = (fbm2(lx * 0.05, ly * 0.05, 3) - 0.5) * 2.2;
      // Sand-Farbvariation
      const n = fbm2(lx * 0.07 + 3.1, ly * 0.07, 2);
      tmp.copy(sandBase).lerp(sandDark, n);
      gcolors[i * 3] = tmp.r;
      gcolors[i * 3 + 1] = tmp.g;
      gcolors[i * 3 + 2] = tmp.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(gcolors, 3));
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.4
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(0, -14, 0);
    this.ground.receiveShadow = true;
    this.ground.frustumCulled = false;
    this.root.add(this.ground);
    this.geometries.push(groundGeo);
    this.materials.push(groundMat);

    /* --------------------------- PBR-Korallen mit Emissive --------------------------- */
    for (let i = 0; i < coralCount; i++) {
      const seg = 5 + Math.floor(Math.random() * 3);
      const coralGeo = new THREE.ConeGeometry(1.2 + Math.random() * 1.5, 3 + Math.random() * 4, seg, 4, true);
      const glowColor = new THREE.Color(this.coralColors[i % this.coralColors.length]);
      const comp = neonEmissiveComp(glowColor);
      const coralMat = new THREE.MeshStandardMaterial({
        color: 0x0a151c,
        roughness: 0.45,
        metalness: 0.1,
        envMapIntensity: 0.5,
        emissive: glowColor,
        emissiveIntensity: 0.7 * comp
      });

      const coral = new THREE.Mesh(coralGeo, coralMat);
      const angle = (i / coralCount) * Math.PI * 2 + Math.random() * 0.4;
      const r = 8 + Math.random() * 22;
      coral.position.set(Math.cos(angle) * r, -14 + (2 + Math.random() * 2), Math.sin(angle) * r);
      coral.rotation.y = Math.random() * Math.PI * 2;
      coral.castShadow = true;
      coral.receiveShadow = true;
      coral.frustumCulled = false;
      this.root.add(coral);
      this.corals.push(coral);
      this.coralMats.push(coralMat);
      this.coralComps.push(comp);
      this.geometries.push(coralGeo);
      this.materials.push(coralMat);
    }

    /* ---------------------------------- Beleuchtung ---------------------------------- */
    // Tiefes Wasser-Ambient (blau-grün oben, dunkel unten)
    this.hemi = new THREE.HemisphereLight(0x2a6a72, 0x04080a, 0.8);
    ctx.scene.add(this.hemi);

    // Sonnenlicht dringt von oben – wirft Korallen-Schatten auf den Boden
    this.sun = new THREE.DirectionalLight(0x9fd8c8, 1.6);
    this.sun.position.set(20, 46, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.camera.left = -100;
    this.sun.shadow.camera.right = 100;
    this.sun.shadow.camera.top = 100;
    this.sun.shadow.camera.bottom = -100;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    ctx.scene.add(this.sun);

    /* ----------------------------------- Lichtstrahlen ------------------------------- */
    this.rayGroup = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const rayGeo = new THREE.ConeGeometry(3.5, 60, 12, 1, true);
      const rayMat = new NodeMaterial();
      rayMat.transparent = true;
      rayMat.depthWrite = false;
      rayMat.blending = THREE.AdditiveBlending;
      rayMat.toneMapped = false;
      rayMat.colorNode = Fn(() => {
        const t = uv().y;
        const fade = smoothstep(0.0, 0.15, t).mul(smoothstep(1.0, 0.4, t));
        const flicker: any = fbm3(vec3(uv().x.mul(4), this.uTime.mul(0.4), 0)).mul(0.4).add(0.6);
        const alpha: any = fade.mul(flicker).mul(0.1);
        return vec4(vec3(0.5, 0.85, 0.9), alpha);
      })();
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.rotation.x = Math.PI;
      ray.position.set((Math.random() - 0.5) * 60, 46, (Math.random() - 0.5) * 60);
      ray.rotation.z = (Math.random() - 0.5) * 0.3;
      ray.frustumCulled = false;
      this.rayGroup.add(ray);
      this.geometries.push(rayGeo);
      this.materials.push(rayMat);
    }
    this.root.add(this.rayGroup);

    /* -------------------------------- Plankton (Punktwolke) -------------------------- */
    const pPos = new Float32Array(this.planktonCount * 3);
    this.planktonVel = new Float32Array(this.planktonCount * 3);
    for (let i = 0; i < this.planktonCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 100;
      pPos[i * 3 + 1] = -12 + Math.random() * 50;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      this.planktonVel[i * 3] = (Math.random() - 0.5) * 0.4;
      this.planktonVel[i * 3 + 1] = 0.15 + Math.random() * 0.25;
      this.planktonVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    this.planktonGeometry = new THREE.BufferGeometry();
    this.planktonGeometry.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    this.planktonMaterial = new THREE.PointsMaterial({
      color: 0x8affea, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false
    });
    this.plankton = new THREE.Points(this.planktonGeometry, this.planktonMaterial);
    this.plankton.frustumCulled = false;
    this.root.add(this.plankton);

    /* ----------------------------------- Fischschwarm --------------------------------- */
    const fPos = new Float32Array(this.fishCount * 3);
    this.fishPhase = new Float32Array(this.fishCount * 2);
    for (let i = 0; i < this.fishCount; i++) {
      fPos[i * 3] = 0; fPos[i * 3 + 1] = 0; fPos[i * 3 + 2] = 0;
      this.fishPhase[i * 2] = Math.random() * Math.PI * 2;
      this.fishPhase[i * 2 + 1] = 6 + Math.random() * 8;
    }
    this.fishGeometry = new THREE.BufferGeometry();
    this.fishGeometry.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    this.fishMaterial = new THREE.PointsMaterial({
      color: 0xffe08a, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false
    });
    this.fish = new THREE.Points(this.fishGeometry, this.fishMaterial);
    this.fish.frustumCulled = false;
    this.root.add(this.fish);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    void ctx;
    const t = time * 0.001;
    this.uTime.value = t;

    // Korallen-Emissive pulsiert audio-reaktiv (Bass/Kick), phasenversetzt
    for (let i = 0; i < this.coralMats.length; i++) {
      const pulse = audio.bass * 0.8 + audio.kickLevel * 0.8 + Math.sin(t * 2 + i) * 0.05;
      this.coralMats[i].emissiveIntensity = (0.7 + pulse) * this.coralComps[i];
    }

    if (this.rayGroup) this.rayGroup.rotation.y += dt * 0.01;

    if (this.planktonGeometry && this.planktonVel) {
      const posAttr = this.planktonGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speedMul = 1 + audio.energy * 0.6;
      for (let i = 0; i < this.planktonCount; i++) {
        arr[i * 3] += this.planktonVel[i * 3] * dt * speedMul;
        arr[i * 3 + 1] += this.planktonVel[i * 3 + 1] * dt * speedMul;
        arr[i * 3 + 2] += this.planktonVel[i * 3 + 2] * dt * speedMul;
        if (arr[i * 3 + 1] > 40) {
          arr[i * 3 + 1] = -13;
          arr[i * 3] = (Math.random() - 0.5) * 100;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
      }
      posAttr.needsUpdate = true;
    }
    if (this.planktonMaterial) {
      this.planktonMaterial.opacity = 0.55 + audio.bass * 0.35;
    }

    // Fischschwarm: kreisende Lissajous-Bahn, Tempo an Energy gekoppelt
    if (this.fishGeometry && this.fishPhase) {
      const posAttr = this.fishGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speedMul = 0.4 + audio.energy * 0.8;
      for (let i = 0; i < this.fishCount; i++) {
        this.fishPhase[i * 2] += dt * speedMul * 0.5;
        const phase = this.fishPhase[i * 2];
        const r = this.fishPhase[i * 2 + 1];
        arr[i * 3] = Math.cos(phase) * r;
        arr[i * 3 + 1] = 4 + Math.sin(phase * 1.7) * 3;
        arr[i * 3 + 2] = Math.sin(phase) * r * 0.7;
      }
      posAttr.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.scene && this.root) this.scene.remove(this.root);
    if (this.scene && this.hemi) this.scene.remove(this.hemi);
    if (this.scene && this.sun) this.scene.remove(this.sun);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.planktonGeometry?.dispose();
    this.planktonMaterial?.dispose();
    this.fishGeometry?.dispose();
    this.fishMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.ground = null;
    this.corals = [];
    this.coralMats = [];
    this.coralComps = [];
    this.hemi = null;
    this.sun = null;
    this.plankton = null;
    this.planktonGeometry = null;
    this.planktonMaterial = null;
    this.planktonVel = null;
    this.fish = null;
    this.fishGeometry = null;
    this.fishMaterial = null;
    this.fishPhase = null;
    this.rayGroup = null;
    this.scene = null;
  }
}
