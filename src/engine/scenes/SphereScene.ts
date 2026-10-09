import * as THREE from 'three';
import { createSkyDome, neonEmissiveComp } from './realism';
import { OrbitSparks } from '../effects/SceneEffects';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Audio Sphere 2.0" – fotorealistische, klarlackierte PBR-Sphäre.
 * Audio-Bänder deformieren die Oberfläche (Vertex-Wellen), die IBL-Umgebung
 * liefert spiegelnde Reflexionen, Bloom fängt die emittierenden Spitzen.
 *
 * v5-Erweiterung: zwei gegenläufig rotierende Orbitalringe und ein
 * Kran aus leuchtenden Satelliten-Funken auf geneigter Umlaufbahn.
 */
export class SphereScene implements Scene3D {
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.SphereGeometry | null = null;
  private material: THREE.MeshPhysicalMaterial | null = null;
  private sky: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private rimLight: THREE.PointLight | null = null;
  private orbitA: THREE.Mesh | null = null;
  private orbitB: THREE.Mesh | null = null;
  private sparks: OrbitSparks | null = null;
  private scene: THREE.Scene | null = null;

  private basePos: Float32Array | null = null;
  private baseNormal: Float32Array | null = null;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;

    this.sky = createSkyDome(0x060912, 0x141f3a, 0x02040a, 300, 40);
    ctx.scene.add(this.sky);

    const q = ctx.settings.quality;
    const seg = q === 'ultra' ? 96 : q === 'high' ? 72 : 48;
    this.geometry = new THREE.SphereGeometry(12, seg, seg);
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const nor = this.geometry.attributes.normal as THREE.BufferAttribute;
    this.basePos = new Float32Array(pos.array as Float32Array);
    this.baseNormal = new Float32Array(nor.array as Float32Array);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x0c0f18,
      roughness: 0.18,
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.35,
      emissive: new THREE.Color(ctx.palette.accent),
      emissiveIntensity: 0.35
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    ctx.scene.add(this.mesh);

    this.hemi = new THREE.HemisphereLight(0x39405e, 0x0a0c14, 0.8);
    ctx.scene.add(this.hemi);

    // Kanten-/Gegenlicht für plastische Tiefe
    this.rimLight = new THREE.PointLight(ctx.palette.accent2, 80, 90, 1.8);
    this.rimLight.position.set(0, 6, -30);
    ctx.scene.add(this.rimLight);

    // v5: Zwei geneigte Orbitalringe um die Sphäre
    const mkOrbit = (radius: number, tube: number): THREE.Mesh => {
      const mat = new THREE.MeshBasicMaterial({
        color: ctx.palette.accent2,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 128), mat);
      m.rotation.x = Math.PI * 0.42;
      m.rotation.y = 0.3;
      return m;
    };
    this.orbitA = mkOrbit(17.5, 0.075);
    this.orbitB = mkOrbit(21, 0.05);
    this.orbitB.rotation.x = -Math.PI * 0.34;
    ctx.scene.add(this.orbitA);
    ctx.scene.add(this.orbitB);

    // v5: Satelliten-Funken auf weiter Umlaufbahn
    const sparkCount = q === 'ultra' ? 110 : q === 'high' ? 75 : 45;
    this.sparks = new OrbitSparks(sparkCount, 24, 0.65);
    ctx.scene.add(this.sparks.object);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    if (!this.geometry || !this.basePos || !this.baseNormal || !this.material) return;
    const t = time * 0.001;
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const bass = audio.bass;
    const mid = audio.mid;
    const treble = audio.treble;
    const kick = audio.kickLevel;
    const click = ctx.interaction.pulse;

    for (let i = 0; i < this.basePos.length; i += 3) {
      const x = this.basePos[i];
      const y = this.basePos[i + 1];
      const z = this.basePos[i + 2];
      const wave =
        Math.sin(x * 4 + t * 2.2) * bass +
        Math.cos(y * 5 - t * 1.8) * mid +
        Math.sin(z * 6 + t * 2.6) * treble;
      const disp = wave * 1.4 + kick * 2.2 + click * 1.6;
      arr[i] = x + this.baseNormal[i] * disp;
      arr[i + 1] = y + this.baseNormal[i + 1] * disp;
      arr[i + 2] = z + this.baseNormal[i + 2] * disp;
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();

    const s = 1 + audio.bass * 0.25 + audio.kickLevel * 0.2 + audio.beatPulse * 0.12;
    this.mesh!.scale.setScalar(s);
    this.mesh!.rotation.y += dt * 0.05;
    this.material.emissive.set(ctx.palette.accent);
    this.material.emissiveIntensity =
      (0.3 + audio.energy * 0.8 + audio.kickLevel * 0.7) * neonEmissiveComp(this.material.emissive);
    if (this.rimLight) {
      this.rimLight.color.set(ctx.palette.accent2);
      this.rimLight.intensity = (60 + audio.bass * 110) * neonEmissiveComp(this.rimLight.color);
    }

    // v5: Orbitalringe gegenläufig + Kick-Puls; Funken kreisen mit
    const orbScale = 1 + audio.kickLevel * 0.12 + audio.beatPulse * 0.06;
    if (this.orbitA) {
      this.orbitA.rotation.z += dt * 0.3;
      this.orbitA.scale.setScalar(orbScale);
      (this.orbitA.material as THREE.MeshBasicMaterial).color.set(ctx.palette.accent);
      (this.orbitA.material as THREE.MeshBasicMaterial).opacity = 0.22 + audio.energy * 0.25;
    }
    if (this.orbitB) {
      this.orbitB.rotation.z -= dt * 0.22;
      this.orbitB.scale.setScalar(orbScale);
      (this.orbitB.material as THREE.MeshBasicMaterial).color.set(ctx.palette.accent2);
      (this.orbitB.material as THREE.MeshBasicMaterial).opacity = 0.18 + audio.mid * 0.28;
    }
    this.sparks?.update(dt, time, audio, ctx.palette);
  }

  dispose(): void {
    if (!this.scene) return;
    if (this.mesh) this.scene.remove(this.mesh);
    if (this.sky) this.scene.remove(this.sky);
    if (this.hemi) this.scene.remove(this.hemi);
    if (this.rimLight) this.scene.remove(this.rimLight);
    for (const orbit of [this.orbitA, this.orbitB]) {
      if (orbit) {
        this.scene.remove(orbit);
        orbit.geometry.dispose();
        (orbit.material as THREE.Material).dispose();
      }
    }
    if (this.sparks) {
      this.scene.remove(this.sparks.object);
      this.sparks.dispose();
    }
    this.geometry?.dispose();
    this.material?.dispose();
    this.sky?.geometry.dispose();
    (this.sky?.material as THREE.Material | undefined)?.dispose();
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.sky = null;
    this.hemi = null;
    this.rimLight = null;
    this.orbitA = null;
    this.orbitB = null;
    this.sparks = null;
    this.basePos = null;
    this.baseNormal = null;
    this.scene = null;
  }
}
