import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, sin, cos, dot, normalize, pow, abs, mix,
  positionLocal, normalLocal, positionWorld, normalWorld, cameraPosition
} from 'three/tsl';
import type { AudioData } from '../../core/types';
import type { PresetPalette } from '../../core/colorPresets';

export class GlowOrb {
  mesh: THREE.Mesh | null = null;

  private geometry: THREE.SphereGeometry | null = null;
  private material: NodeMaterial | null = null;
  private scene: THREE.Scene | null = null;

  private uTime = uniform(0);
  private uBass = uniform(0);
  private uMid = uniform(0);
  private uTreble = uniform(0);
  private uEnergy = uniform(0);
  private uKick = uniform(0);
  private uAccent = uniform(new THREE.Color(0x8b5cf6));
  private uAccent2 = uniform(new THREE.Color(0x22d3ee));

  build(radius = 3): void {
    this.geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new NodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.blending = THREE.AdditiveBlending;
    material.toneMapped = false;

    material.positionNode = Fn(() => {
      const wave = sin(positionLocal.x.mul(4.0).add(this.uTime.mul(2.2))).mul(this.uBass)
        .add(cos(positionLocal.y.mul(5.0).sub(this.uTime.mul(1.8))).mul(this.uMid))
        .add(sin(positionLocal.z.mul(6.0).add(this.uTime.mul(2.6))).mul(this.uTreble));
      const disp = wave.mul(0.12).add(this.uKick.mul(0.3));
      return positionLocal.add(normalLocal.mul(disp));
    })();

    material.colorNode = Fn(() => {
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const fres = pow(float(1.0).sub(ndv), 2.6);
      const base = mix(this.uAccent, this.uAccent2, abs(normalWorld.y).mul(0.4));
      const glow = vec3(1.0, 0.98, 1.0).mul(fres.mul(2.2).add(this.uEnergy.mul(1.4)).add(this.uKick.mul(1.6)));
      return vec4(base.mul(0.5).add(glow), float(0.95));
    })();

    this.material = material;
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  addTo(scene: THREE.Scene): void {
    if (this.mesh) {
      scene.add(this.mesh);
      this.scene = scene;
    }
  }

  update(_dt: number, time: number, audio: AudioData, palette: PresetPalette, heightMul = 1, sizeMul = 1, click = 0): void {
    if (!this.mesh || !this.material) return;
    this.uTime.value = time * 0.001;
    this.uBass.value = audio.bass;
    this.uMid.value = audio.mid;
    this.uTreble.value = audio.treble;
    this.uEnergy.value = audio.energy;
    this.uKick.value = audio.kickLevel;
    this.uAccent.value.set(palette.accent);
    this.uAccent2.value.set(palette.accent2);

    const s = (1 + audio.bass * 0.55 + audio.kickLevel * 0.4 + audio.beatPulse * 0.22 + click * 0.3) * heightMul * sizeMul;
    this.mesh.scale.set(s, s, s);
    this.mesh.rotation.y += _dt * 0.1;
    this.mesh.rotation.x += _dt * 0.06;
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
