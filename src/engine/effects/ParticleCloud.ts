import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, sin, cos, atan, length, smoothstep, mix,
  instancedBufferAttribute, positionLocal, uv
} from 'three/tsl';
import { neonEmissiveComp } from '../scenes/realism';
import type { AudioData } from '../../core/types';
import type { PresetPalette } from '../../core/colorPresets';

export interface ParticleCloudOptions {
  count: number;
  radius: number;
  height: number;
  arms: number;
}

export class ParticleCloud {
  mesh: THREE.InstancedMesh | null = null;

  private geometry: THREE.PlaneGeometry | null = null;
  private material: NodeMaterial | null = null;
  private scene: THREE.Scene | null = null;

  private basePos: THREE.InstancedBufferAttribute | null = null;
  private seedAttr: THREE.InstancedBufferAttribute | null = null;
  private sizeAttr: THREE.InstancedBufferAttribute | null = null;
  private mixAttr: THREE.InstancedBufferAttribute | null = null;

  private uTime = uniform(0);
  private uBass = uniform(0);
  private uEnergy = uniform(0);
  private uKick = uniform(0);
  private uBeat = uniform(0);
  private uClick = uniform(0);
  private uAccent = uniform(new THREE.Color(0x8b5cf6));
  private uAccent2 = uniform(new THREE.Color(0x22d3ee));
  private uAccentComp = uniform(1);
  private uAccent2Comp = uniform(1);
  private uOpacity = uniform(0.9);
  private uSize = uniform(1);

  build(options: ParticleCloudOptions): void {
    const { count, radius, height, arms } = options;

    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const mixes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 0.55) * radius;
      const arm = Math.floor(Math.random() * arms);
      const ang = (arm / arms) * Math.PI * 2 + r * 0.16 + (Math.random() - 0.5) * 0.9;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * (height * 0.5 + r * 0.14);
      pos[i * 3 + 2] = Math.sin(ang) * r;
      seeds[i] = Math.random();
      sizes[i] = 0.5 + Math.random() * 1.8;
      mixes[i] = Math.random();
    }

    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.basePos = new THREE.InstancedBufferAttribute(pos, 3);
    this.seedAttr = new THREE.InstancedBufferAttribute(seeds, 1);
    this.sizeAttr = new THREE.InstancedBufferAttribute(sizes, 1);
    this.mixAttr = new THREE.InstancedBufferAttribute(mixes, 1);
    this.geometry.setAttribute('aBasePos', this.basePos);
    this.geometry.setAttribute('aSeed', this.seedAttr);
    this.geometry.setAttribute('aSize', this.sizeAttr);
    this.geometry.setAttribute('aMix', this.mixAttr);

    const material = new NodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.blending = THREE.AdditiveBlending;

    // InstancedBufferAttributes werden vom WebGPU-Backend automatisch pro
    // Instanz geladen (stepMode=Instance) - kein manuelles .element(instanceIndex)!
    const base = instancedBufferAttribute<'vec3'>(this.basePos!, 'vec3');
    const seed = instancedBufferAttribute<'float'>(this.seedAttr!, 'float');
    const size = instancedBufferAttribute<'float'>(this.sizeAttr!, 'float');
    const mixVal = instancedBufferAttribute<'float'>(this.mixAttr!, 'float');

    material.positionNode = Fn(() => {
      const radiusNode = length(base.xz);
      const ang0 = atan(base.z, base.x);
      const swirl = this.uTime.mul(0.14).add(this.uEnergy.mul(0.4)).add(seed.mul(0.25));
      const ang = ang0.add(swirl).add(radiusNode.mul(0.02));

      const pull = this.uBass.mul(2.2).mul(sin(this.uTime.mul(2.2).add(seed.mul(9.0))));
      const r2 = radiusNode.sub(pull);

      const x = cos(ang).mul(r2);
      const z = sin(ang).mul(r2);
      const y = base.y
        .add(sin(this.uTime.mul(1.5).add(seed.mul(12.0))).mul(0.4))
        .add(this.uKick.mul(1.8).mul(seed.sub(0.5)))
        .add(this.uClick.mul(1.4).mul(seed.sub(0.5)));

      const s = size.mul(this.uSize).mul(float(1).add(this.uKick.mul(0.6).mul(seed)).add(this.uBeat.mul(0.35).mul(seed)).add(this.uClick.mul(0.9).mul(seed)));
      return vec3(x, y, z).add(positionLocal.mul(s));
    })();

    material.colorNode = Fn(() => {
      const c = mix(this.uAccent, this.uAccent2, mixVal);
      const bright = float(0.7).add(this.uEnergy.mul(0.5)).add(this.uKick.mul(0.5)).add(seed.mul(0.25));
      // Luminanz-Kompensation pro Partikel: warme Farbtöne (rot/orange) blühen
      // schwächer als cyan/grün – interpoliere den Faktor passend zum Mix.
      const comp = mix(this.uAccentComp, this.uAccent2Comp, mixVal);
      // UV-basierter radialer Falloff (positionLocal ist im Fragment nicht indizierbar)
      const d = length(uv().mul(2).sub(1));
      const alpha = smoothstep(0.25, 1.1, d).oneMinus().mul(this.uOpacity);
      return vec4(c.mul(bright).mul(comp), alpha);
    })();

    this.material = material;
    this.mesh = new THREE.InstancedMesh(this.geometry, material, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  addTo(scene: THREE.Scene): void {
    if (this.mesh) {
      scene.add(this.mesh);
      this.scene = scene;
    }
  }

  update(dt: number, time: number, audio: AudioData, palette: PresetPalette, opacity = 0.9, sizeScale = 1, rotSpeed = 1, click = 0): void {
    if (!this.mesh || !this.material) return;
    this.uTime.value = time * 0.001;
    this.uBass.value = audio.bass;
    this.uEnergy.value = audio.energy;
    this.uKick.value = audio.kickLevel;
    this.uBeat.value = audio.beatPulse;
    this.uClick.value = click;
    this.uAccent.value.set(palette.accent);
    this.uAccent2.value.set(palette.accent2);
    this.uAccentComp.value = neonEmissiveComp(this.uAccent.value);
    this.uAccent2Comp.value = neonEmissiveComp(this.uAccent2.value);
    this.uOpacity.value = opacity;
    this.uSize.value = sizeScale;
    this.mesh.rotation.y += dt * 0.02 * (0.5 + audio.energy) * rotSpeed;
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
