import * as THREE from 'three';
import { neonEmissiveComp } from '../scenes/realism';
import type { AudioData } from '../../core/types';
import type { PresetPalette } from '../../core/colorPresets';

export class SpectrumRing {
  mesh: THREE.InstancedMesh | null = null;

  private geometry: THREE.BoxGeometry | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  private scene: THREE.Scene | null = null;
  private bars = 128;
  private radius = 20;
  private maxHeight = 26;

  private tmpPos = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpScale = new THREE.Vector3();
  private tmpMat = new THREE.Matrix4();
  private baseColor = new THREE.Color();
  private white = new THREE.Color(0xffffff);
  private accent = new THREE.Color();
  private accent2 = new THREE.Color();

  build(bars = 128, radius = 20, maxHeight = 26): void {
    this.bars = bars;
    this.radius = radius;
    this.maxHeight = maxHeight;

    this.geometry = new THREE.BoxGeometry(1.1, 1, 1.1);
    // PBR-Metall: reflektiert die IBL-Umgebung und wirkt dadurch plastisch statt flach.
    // Die Instanzfarben tönen die Reflexionen, der Audio-Puls steuert die Höhe.
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.32,
      metalness: 0.55,
      envMapIntensity: 1.15
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, bars);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bars * 3), 3);

    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2;
      this.tmpPos.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this.tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      this.tmpScale.set(1, 1, 1);
      this.tmpMat.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.mesh.setMatrixAt(i, this.tmpMat);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  addTo(scene: THREE.Scene): void {
    if (this.mesh) {
      scene.add(this.mesh);
      this.scene = scene;
    }
  }

  update(dt: number, audio: AudioData, palette: PresetPalette, sensitivity: number, scale: 'linear' | 'log', heightMul = 1, click = 0): void {
    if (!this.mesh || !this.geometry) return;
    const freq = audio.freqData;
    const bins = freq ? Math.floor(freq.length * 0.82) : 64;

    this.accent.set(palette.accent);
    this.accent2.set(palette.accent2);

    // Emissive in der Glanzfarbe (accent2) – luminanz-kompensiert, damit warme
    // Paletten (rot/orange) genauso stark blühen wie cyan/grün. Instancing teilt
    // sich EIN Material → ein gemeinsamer Emissiv-Farbton (passend zum Zentrum-Licht).
    if (this.material) {
      this.material.emissive.copy(this.accent2);
      this.material.emissiveIntensity = (0.7 + audio.energy * 0.8 + audio.kickLevel * 0.6) * neonEmissiveComp(this.accent2);
    }

    for (let i = 0; i < this.bars; i++) {
      let idx: number;
      if (scale === 'log') {
        idx = Math.floor(Math.pow(i / this.bars, 2.1) * bins);
      } else {
        idx = Math.floor((i / this.bars) * bins);
      }
      const raw = freq && freq[idx] !== undefined ? freq[idx] / 255 : 0.02;
      const value = Math.min(1, raw * sensitivity);
      const h = (0.6 + Math.pow(value, 1.35) * this.maxHeight + audio.kickLevel * 2.5 + audio.beatPulse * 1.6 + click * 2.6) * heightMul;

      const angle = (i / this.bars) * Math.PI * 2;
      this.tmpPos.set(Math.cos(angle) * this.radius, h / 2, Math.sin(angle) * this.radius);
      this.tmpScale.set(1, h, 1);
      this.tmpQuat.identity();
      this.tmpMat.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.mesh.setMatrixAt(i, this.tmpMat);

      this.baseColor.copy(this.accent).lerp(this.accent2, i / this.bars);
      this.baseColor.lerp(this.white, value * 0.75);
      this.mesh.setColorAt(i, this.baseColor);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.rotation.y += dt * 0.05 * (0.5 + audio.energy);
  }

  dispose(): void {
    if (this.mesh && this.scene) this.scene.remove(this.mesh);
    this.geometry?.dispose();
    this.material?.dispose();
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.scene = null;
  }
}
