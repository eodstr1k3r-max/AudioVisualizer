import * as THREE from 'three';
import type { AudioData } from '../../core/types';
import type { PresetPalette } from '../../core/colorPresets';

/**
 * Wiederverwendbare Szenen-Effekte für den v5-Überholungsdurchlauf.
 * Alle Effekte sind DOM-frei (prozedurale DataTextures statt Canvas),
 * qualitätsskalierbar und laufen identisch in WebGPU & WebGL2.
 */

/** Prozeduraler weicher Glow-Sprite (radialer Falloff) – ohne DOM/Canvas. */
export function makeSoftSprite(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half + 0.5) / half;
      const dy = (y - half + 0.5) / half;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const a = Math.pow(1 - d, 2.4);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

interface EffectBase {
  object: THREE.Object3D;
  update(dt: number, time: number, audio: AudioData, palette: PresetPalette): void;
  dispose(): void;
}

/**
 * OrbitSparks – leuchtende Funken auf geneigten Orbitbahnen um ein Zentrum.
 * Wirkt als Tiefenanker um zentrale Objekte (Sphere, Spectrum, Fusion).
 */
export class OrbitSparks implements EffectBase {
  object: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private sprite: THREE.DataTexture;
  private base: Float32Array;
  private count: number;
  private radius: number;

  constructor(count: number, radius: number, spread = 0.35) {
    this.count = count;
    this.radius = radius;
    const pos = new Float32Array(count * 3);
    this.base = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      // Winkel + Höhen-Spread → flacher Orbit-Torus mit Streuung
      this.base[i * 2] = Math.random() * Math.PI * 2;
      this.base[i * 2 + 1] = (Math.random() - 0.5) * spread;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sprite = makeSoftSprite();
    this.material = new THREE.PointsMaterial({
      size: 0.7,
      map: this.sprite,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.object = new THREE.Points(this.geometry, this.material);
    this.object.frustumCulled = false;
  }

  update(dt: number, _time: number, audio: AudioData, palette: PresetPalette): void {
    const arr = (this.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const spin = dt * (0.25 + audio.energy * 0.8);
    const r = this.radius;
    for (let i = 0; i < this.count; i++) {
      const ang = this.base[i * 2] + spin * (1 + (i % 5) * 0.08);
      const yOff = this.base[i * 2 + 1] * r;
      arr[i * 3] = Math.cos(ang) * r;
      arr[i * 3 + 1] = yOff + Math.sin(ang * 2 + i) * 0.4 + audio.kickLevel * 1.2;
      arr[i * 3 + 2] = Math.sin(ang) * r;
    }
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.material.color.setStyle(palette.accent2);
    this.material.opacity = 0.5 + audio.energy * 0.4 + audio.kickLevel * 0.25;
    this.object.rotation.x = 0.42; // geneigte Orbit-Ebene
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.sprite.dispose();
  }
}

/**
 * RisingEmbers – aufsteigende Glut-/Lichtpartikel über einer Bodenfläche.
 * Bass gibt Auftrieb, Kick katapultiert eine Welle nach oben.
 */
export class RisingEmbers implements EffectBase {
  object: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private sprite: THREE.DataTexture;
  private ys: Float32Array;
  private seeds: Float32Array;
  private count: number;

  constructor(count: number, extent = 55) {
    this.count = count;
    const pos = new Float32Array(count * 3);
    this.ys = new Float32Array(count);
    this.seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * extent * 2;
      this.ys[i] = Math.random() * 30;
      pos[i * 3 + 1] = this.ys[i];
      pos[i * 3 + 2] = (Math.random() - 0.5) * extent * 2;
      this.seeds[i] = Math.random();
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sprite = makeSoftSprite(32);
    this.material = new THREE.PointsMaterial({
      size: 0.65,
      map: this.sprite,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.object = new THREE.Points(this.geometry, this.material);
    this.object.frustumCulled = false;
  }

  update(dt: number, time: number, audio: AudioData, palette: PresetPalette): void {
    const attr = this.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const lift = dt * (1.2 + audio.bass * 4.5);
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      arr[ix + 1] += lift * (0.6 + this.seeds[i]);
      if (arr[ix + 1] > 34) arr[ix + 1] = 0;
      arr[ix] += Math.sin(time * 0.001 + this.seeds[i] * 9) * dt * 0.6;
    }
    attr.needsUpdate = true;
    this.material.color.setStyle(palette.accent);
    this.material.opacity = 0.35 + audio.energy * 0.45 + audio.kickLevel * 0.3;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.sprite.dispose();
  }
}

/**
 * SprayBurst – Kick-getriggerte Spritzer, die vom Zentrum hochschießen und
 * mit Gravitation zurückfallen (Wasser/Glutfunken über Ripple-Zentrum).
 */
export class SprayBurst implements EffectBase {
  object: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private sprite: THREE.DataTexture;
  private velY: Float32Array;
  private life: Float32Array;
  private count: number;
  private cursor = 0;
  private wasKick = false;

  constructor(count = 140) {
    this.count = count;
    const pos = new Float32Array(count * 3);
    this.velY = new Float32Array(count);
    this.life = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] = -50; // geparkt unter der Szene
      this.life[i] = 0;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sprite = makeSoftSprite(32);
    this.material = new THREE.PointsMaterial({
      size: 0.55,
      map: this.sprite,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.object = new THREE.Points(this.geometry, this.material);
    this.object.frustumCulled = false;
  }

  update(dt: number, _time: number, audio: AudioData, palette: PresetPalette): void {
    const attr = this.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    if (audio.isKick && !this.wasKick) {
      const batch = Math.floor(this.count * 0.28);
      for (let b = 0; b < batch; b++) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.count;
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.random() * 2.4;
        arr[i * 3] = Math.cos(ang) * rr;
        arr[i * 3 + 1] = 0.6;
        arr[i * 3 + 2] = Math.sin(ang) * rr;
        this.velY[i] = 7 + Math.random() * 9 * (0.6 + audio.kickLevel);
        this.life[i] = 1.4 + Math.random() * 0.8;
      }
    }
    this.wasKick = audio.isKick;

    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.velY[i] -= dt * 14; // Gravitation
      arr[i * 3 + 1] += this.velY[i] * dt;
      if (this.life[i] <= 0 || arr[i * 3 + 1] < -0.4) {
        this.life[i] = 0;
        arr[i * 3 + 1] = -50;
      }
    }
    attr.needsUpdate = true;
    this.material.color.setStyle(palette.accent2);
    this.material.opacity = 0.55 + audio.kickLevel * 0.4;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.sprite.dispose();
  }
}

/**
 * SpeedStreaks – Warp-Linien, die am Betrachter vorbeischießen
 * (echte Streaks via LineSegments statt nur punktförmiger Sterne).
 */
export class SpeedStreaks implements EffectBase {
  object: THREE.LineSegments;
  private geometry: THREE.BufferGeometry;
  private material: THREE.LineBasicMaterial;
  private length = 210;

  constructor(count = 160) {
    const pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 46;
      const y = (Math.random() - 0.5) * 30;
      const z = -Math.random() * this.length;
      const len = 2 + Math.random() * 5;
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x;
      pos[i * 6 + 4] = y;
      pos[i * 6 + 5] = z - len;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.material = new THREE.LineBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.object = new THREE.LineSegments(this.geometry, this.material);
    this.object.frustumCulled = false;
  }

  update(dt: number, _time: number, audio: AudioData, palette: PresetPalette): void {
    const attr = this.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const move = (60 + audio.bass * 90 + audio.kickLevel * 70) * dt;
    for (let i = 0; i < arr.length; i += 6) {
      arr[i + 2] += move * 1.9;
      arr[i + 5] += move * 1.9;
      if (arr[i + 2] > 18) {
        const x = (Math.random() - 0.5) * 46;
        const y = (Math.random() - 0.5) * 30;
        const len = 2 + Math.random() * 5;
        arr[i] = x; arr[i + 1] = y; arr[i + 2] = -this.length;
        arr[i + 3] = x; arr[i + 4] = y; arr[i + 5] = -this.length - len;
      }
    }
    attr.needsUpdate = true;
    this.material.color.setStyle(palette.accent2);
    this.material.opacity = 0.16 + audio.energy * 0.3 + audio.kickLevel * 0.25;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * LightPillars – Ring von vertikalen Lichtsäulen im Hintergrund,
 * pulsiert band-abhängig (Mid/Treble) und färbt sich in die Palette.
 */
export class LightPillars implements EffectBase {
  object: THREE.Group;
  materials: THREE.MeshBasicMaterial[] = [];
  private geometry: THREE.BoxGeometry | null = null;
  private count = 0;

  constructor(count = 10, radius = 52, height = 26) {
    this.count = count;
    this.object = new THREE.Group();
    this.geometry = new THREE.BoxGeometry(1.6, height, 1.6);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(this.geometry, mat);
      const a = (i / count) * Math.PI * 2;
      mesh.position.set(Math.cos(a) * radius, height / 2 - 4, Math.sin(a) * radius);
      this.object.add(mesh);
      this.materials.push(mat);
    }
  }

  update(_dt: number, time: number, audio: AudioData, palette: PresetPalette): void {
    for (let i = 0; i < this.count; i++) {
      const phase = time * 0.0012 + i * 1.7;
      const band = i % 3 === 0 ? audio.treble : i % 3 === 1 ? audio.mid : audio.bass;
      const pulse = Math.max(0, Math.sin(phase)) * (0.25 + band * 1.3);
      this.materials[i].opacity = Math.min(0.4, pulse * 0.32 + audio.kickLevel * 0.1);
      this.materials[i].color.setStyle(i % 2 === 0 ? palette.accent : palette.accent2);
    }
  }

  dispose(): void {
    this.geometry?.dispose();
    for (const m of this.materials) m.dispose();
    this.materials = [];
  }
}

/**
 * BokehDust – großflächige, weiche Lichtblasen mit starker Tiefenstaffelung.
 * Wird an der Kamera befestigt → auch im Vollbild-Shader-Modus echte Parallaxe.
 */
export class BokehDust implements EffectBase {
  object: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private sprite: THREE.DataTexture;
  private base: Float32Array;
  private count: number;

  constructor(camera: THREE.PerspectiveCamera, count = 90) {
    this.count = count;
    const pos = new Float32Array(count * 3);
    this.base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Vor dem Shader-Quad (z=-8), gestaffelte Tiefe → Parallaxe
      const x = (Math.random() - 0.5) * 26;
      const y = (Math.random() - 0.5) * 15;
      const z = -Math.random() * 6.5;
      this.base[i * 3] = x;
      this.base[i * 3 + 1] = y;
      this.base[i * 3 + 2] = z;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sprite = makeSoftSprite(64);
    this.material = new THREE.PointsMaterial({
      size: 0.85,
      map: this.sprite,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    this.object = new THREE.Points(this.geometry, this.material);
    this.object.frustumCulled = false;
    camera.add(this.object);
  }

  update(_dt: number, time: number, audio: AudioData, palette: PresetPalette): void {
    const attr = this.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = time * 0.001;
    for (let i = 0; i < this.count; i++) {
      const s = this.base[i * 3];
      arr[i * 3] = s + Math.sin(t * 0.22 + i * 1.31) * 1.1;
      arr[i * 3 + 1] = this.base[i * 3 + 1] + Math.sin(t * 0.17 + i * 0.77) * 0.8 + audio.kickLevel * 0.4;
    }
    attr.needsUpdate = true;
    this.material.color.setStyle(palette.accent2);
    this.material.opacity = 0.14 + audio.energy * 0.22 + audio.beatPulse * 0.1;
  }

  dispose(): void {
    this.object.parent?.remove(this.object);
    this.geometry.dispose();
    this.material.dispose();
    this.sprite.dispose();
  }
}

/** Meteore – periodische Sternschnuppen quer durch den Himmel (Nebula & Space). */
export class MeteorShower implements EffectBase {
  object: THREE.Group;
  meteors: { line: THREE.Line; mat: THREE.LineBasicMaterial; age: number; cd: number }[] = [];
  private geoms: THREE.BufferGeometry[] = [];

  constructor(count = 4) {
    this.object = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.object.add(line);
      this.geoms.push(geo);
      this.meteors.push({ line, mat, age: 0, cd: 2 + Math.random() * 8 });
    }
  }

  update(dt: number, _time: number, audio: AudioData, palette: PresetPalette): void {
    for (const m of this.meteors) {
      if (m.cd > 0) {
        m.cd -= dt * (0.5 + audio.energy);
        m.mat.opacity *= 0.92;
        continue;
      }
      m.age += dt;
      const dur = 1.1;
      if (m.age >= dur) {
        m.age = 0;
        m.cd = 3 + Math.random() * 9;
        m.mat.opacity = 0;
        continue;
      }
      const p = m.age / dur;
      const start = new THREE.Vector3(-120 + p * 240, 55 - p * 26, -40 + ((m.line.id % 7) - 3) * 22);
      const tail = start.clone().add(new THREE.Vector3(-14, 5.5, 0));
      const attr = m.line.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      arr[0] = start.x; arr[1] = start.y; arr[2] = start.z;
      arr[3] = tail.x; arr[4] = tail.y; arr[5] = tail.z;
      attr.needsUpdate = true;
      m.mat.opacity = Math.sin(p * Math.PI) * 0.85;
      m.mat.color.setStyle(palette.accent2);
    }
  }

  dispose(): void {
    for (const g of this.geoms) g.dispose();
    for (const m of this.meteors) m.mat.dispose();
    this.geoms = [];
    this.meteors = [];
  }
}
