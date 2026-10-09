import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, sin, mix, dot, normalize, pow, abs,
  positionLocal, positionWorld, normalWorld, cameraPosition,
  smoothstep, saturate, length
} from 'three/tsl';
import { fbm3 as fbm3tsl, generateStarSphere } from './tslNoise';
import { fbm3, smoothstep as smoothstepJs } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/* ============================================================================
 * Himmelskörper-Daten – Reihenfolge, relative Abstände/Größen/Umlaufzeiten
 * orientieren sich an den echten Verhältnissen (komprimiert für die Szene).
 * ========================================================================== */

type SurfaceStyle = 'rocky' | 'gas' | 'ice';

interface PlanetDef {
  id: string;
  radius: number;
  orbitRadius: number;
  periodYears: number;
  rotHours: number;
  tilt: number;
  color: number;
  accent: number;
  style: SurfaceStyle;
  bandFreq: number;
  noiseFreq: number;
  atmosphere?: number;
  rings?: { inner: number; outer: number; color: number };
  moon?: boolean;
}

const PLANETS: PlanetDef[] = [
  { id: 'mercury', radius: 0.42, orbitRadius: 15, periodYears: 0.241, rotHours: 1408, tilt: 0.01, color: 0x9c9086, accent: 0x5c5349, style: 'rocky', bandFreq: 0, noiseFreq: 5.5 },
  { id: 'venus', radius: 0.82, orbitRadius: 20, periodYears: 0.615, rotHours: -5832, tilt: 3.096, color: 0xe0c08a, accent: 0xb98f52, style: 'gas', bandFreq: 2.4, noiseFreq: 2.2, atmosphere: 0xf0d9a8 },
  { id: 'earth', radius: 0.9, orbitRadius: 26, periodYears: 1, rotHours: 24, tilt: 0.409, color: 0x1c4f86, accent: 0x2f7a3a, style: 'rocky', bandFreq: 0, noiseFreq: 3.4, atmosphere: 0x5fa8e0, moon: true },
  { id: 'mars', radius: 0.5, orbitRadius: 32, periodYears: 1.881, rotHours: 24.6, tilt: 0.44, color: 0xb1502f, accent: 0x6f3018, style: 'rocky', bandFreq: 0, noiseFreq: 4.2 },
  { id: 'jupiter', radius: 3.2, orbitRadius: 62, periodYears: 11.86, rotHours: 9.9, tilt: 0.055, color: 0xd9bb95, accent: 0x9a6a44, style: 'gas', bandFreq: 9, noiseFreq: 3 },
  { id: 'saturn', radius: 2.7, orbitRadius: 84, periodYears: 29.46, rotHours: 10.7, tilt: 0.466, color: 0xe8d4a4, accent: 0xc2a262, style: 'gas', bandFreq: 7, noiseFreq: 2.6, rings: { inner: 3.5, outer: 5.9, color: 0xcdb98a } },
  { id: 'uranus', radius: 1.7, orbitRadius: 104, periodYears: 84.0, rotHours: -17.2, tilt: 1.706, color: 0x9fd9de, accent: 0x74b3ba, style: 'ice', bandFreq: 3, noiseFreq: 3.6, rings: { inner: 2.1, outer: 2.9, color: 0x7fa6ab } },
  { id: 'neptune', radius: 1.65, orbitRadius: 122, periodYears: 164.8, rotHours: 16.1, tilt: 0.494, color: 0x3457c9, accent: 0x24398c, style: 'ice', bandFreq: 4, noiseFreq: 3.6, atmosphere: 0x5b7bdc }
];

const ORBIT_BASE_SECONDS = 9;
const SPIN_BASE_SECONDS = 2.4;

interface PlanetInstance {
  def: PlanetDef;
  pivot: THREE.Group;
  tiltGroup: THREE.Group;
  mesh: THREE.Mesh;
  ring?: THREE.Mesh;
  atmosphere?: THREE.Mesh;
  moon?: THREE.Mesh;
  moonAngle: number;
  material: THREE.MeshPhysicalMaterial;
  orbitAngle: number;
  orbitSpeed: number;
  spinSpeed: number;
}

/* ============================================================================
 * Prozedurale Planeten-Texturen (DataTexture – kein DOM, daher testbar).
 * Nahtlos am Längengrad dank cos/sin-Wrap um die Kugel.
 * ========================================================================== */

function generatePlanetTexture(def: PlanetDef, w = 256, h = 128): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  const base = new THREE.Color(def.color);
  const accent = new THREE.Color(def.accent);
  const freq = def.noiseFreq;

  const ocean = new THREE.Color(0x0d3f6e);
  const sand = new THREE.Color(0xb9a06a);
  const grass = new THREE.Color(0x2f6b34);
  const forest = new THREE.Color(0x1c4a24);
  const iceCap = new THREE.Color(0xe9f3f7);
  const craterDark = new THREE.Color(0x1a120c);
  const white = new THREE.Color(0xffffff);
  const col = new THREE.Color();
  const tmp = new THREE.Color();

  for (let y = 0; y < h; y++) {
    const lat = y / (h - 1);
    const pz = (lat - 0.5) * 2; // -1 Nord .. 1 Süd
    const latAbs = Math.abs(pz);

    for (let x = 0; x < w; x++) {
      const theta = (x / w) * Math.PI * 2;
      const px = Math.cos(theta);
      const py = Math.sin(theta);
      const n = fbm3(px * freq, py * freq, pz * freq, 4);

      if (def.id === 'earth') {
        // Ozeane + Kontinente + Vegetation + Polkappen
        const land = fbm3(px * 2.6, py * 2.6, pz * 2.6, 4);
        const landT = smoothstepJs(0.52, 0.62, land);
        const veg = fbm3(px * 6, py * 6, pz * 6, 3);
        tmp.copy(grass).lerp(forest, smoothstepJs(0.45, 0.75, veg));
        tmp.lerp(sand, smoothstepJs(0.48, 0.62, land) * 0.55);
        col.copy(ocean).lerp(tmp, landT);
        col.lerp(iceCap, smoothstepJs(0.78, 0.9, latAbs));
      } else if (def.style === 'rocky') {
        col.copy(base).lerp(accent, smoothstepJs(0.3, 0.68, n));
        const cr = fbm3(px * freq * 3.2, py * freq * 3.2, pz * freq * 3.2, 3);
        col.lerp(craterDark, smoothstepJs(0.6, 0.8, cr) * 0.4);
        if (def.id === 'mars') col.lerp(iceCap, smoothstepJs(0.8, 0.92, latAbs));
      } else if (def.style === 'gas') {
        const band = Math.sin(lat * Math.PI * def.bandFreq + n * 1.9);
        col.copy(base).lerp(accent, smoothstepJs(-0.15, 0.15, band));
        col.lerp(white, smoothstepJs(0.6, 0.85, n) * 0.22);
      } else {
        const band = Math.sin(lat * Math.PI * def.bandFreq + n * 1.3);
        col.copy(base).lerp(accent, smoothstepJs(-0.25, 0.25, band));
        col.lerp(white, smoothstepJs(0.6, 0.9, n) * 0.25);
      }

      const i = (y * w + x) * 4;
      data[i] = Math.round(Math.min(1, col.r) * 255);
      data[i + 1] = Math.round(Math.min(1, col.g) * 255);
      data[i + 2] = Math.round(Math.min(1, col.b) * 255);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function generateMoonTexture(w = 128, h = 64): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  const light = new THREE.Color(0xb8b2a6);
  const dark = new THREE.Color(0x6b655c);
  const craterDark = new THREE.Color(0x3a352e);
  const col = new THREE.Color();

  for (let y = 0; y < h; y++) {
    const pz = (y / (h - 1) - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const theta = (x / w) * Math.PI * 2;
      const px = Math.cos(theta);
      const py = Math.sin(theta);
      const n = fbm3(px * 5, py * 5, pz * 5, 4);
      const cr = fbm3(px * 11, py * 11, pz * 11, 3);
      col.copy(light).lerp(dark, n);
      col.lerp(craterDark, smoothstepJs(0.62, 0.78, cr) * 0.5);

      const i = (y * w + x) * 4;
      data[i] = Math.round(Math.min(1, col.r) * 255);
      data[i + 1] = Math.round(Math.min(1, col.g) * 255);
      data[i + 2] = Math.round(Math.min(1, col.b) * 255);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** PBR-Material pro Oberflächentyp (Gestein rau, Gas sanft, Eis glänzend). */
function buildPhysicalMaterial(def: PlanetDef, texture: THREE.DataTexture): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ map: texture, envMapIntensity: 0.8 });
  if (def.style === 'rocky') {
    m.roughness = 0.92;
    m.metalness = 0.02;
  } else if (def.style === 'gas') {
    m.roughness = 0.55;
    m.metalness = 0.0;
    m.clearcoat = 0.2;
    m.clearcoatRoughness = 0.4;
  } else {
    m.roughness = 0.32;
    m.metalness = 0.0;
    m.clearcoat = 0.8;
    m.clearcoatRoughness = 0.2;
  }
  return m;
}

function buildRingMaterial(color: number): { material: NodeMaterial } {
  const c = new THREE.Color(color);
  const material = new NodeMaterial();
  material.transparent = true;
  material.side = THREE.DoubleSide;
  material.depthWrite = false;
  material.toneMapped = false;

  material.colorNode = Fn(() => {
    const lightDir = normalize(positionWorld.negate());
    const ndl = saturate(abs(dot(normalWorld, lightDir)).mul(0.85).add(0.15));
    const r = length(positionLocal.xy);
    const bands = fbm3tsl(vec3(r.mul(9), r.mul(2), float(0)));
    const gaps = smoothstep(0.15, 0.85, sin(r.mul(26).add(bands.mul(3))).mul(0.5).add(0.5));
    const alpha = gaps.mul(0.75).add(0.15);
    return vec4(vec3(c.r, c.g, c.b).mul(ndl).mul(1.15), alpha);
  })();

  return { material };
}

export class SolarSystemScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private sunMesh: THREE.Mesh | null = null;
  private sunCorona: THREE.Mesh | null = null;
  private sunLight: THREE.PointLight | null = null;
  private uSunTime = uniform(0);
  private uSunBass = uniform(0);
  private uSunKick = uniform(0);
  private uSunEnergy = uniform(0);
  private uCoronaTime = uniform(0);
  private uCoronaPulse = uniform(0);

  private planets: PlanetInstance[] = [];
  private orbitLines: THREE.Line[] = [];

  private asteroidBelt: THREE.Points | null = null;
  private asteroidGeometry: THREE.BufferGeometry | null = null;
  private asteroidMaterial: THREE.PointsMaterial | null = null;

  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    // Vakuum – kein Nebel; dezente HDRI-Füllung für die Nachtseiten der Planeten
    ctx.scene.fog = null;
    ctx.scene.environmentIntensity = 0.3;

    const q = ctx.settings.quality;
    const sphereSeg = q === 'ultra' ? 64 : q === 'high' ? 48 : 32;
    const smallSeg = q === 'ultra' ? 40 : q === 'high' ? 32 : 22;

    this.root = new THREE.Group();
    ctx.scene.add(this.root);

    /* ------------------------------- Sonne (Quelle) ------------------------------- */
    // Echtes Punktlicht im Zentrum – beleuchtet alle PBR-Planeten physikalisch.
    this.sunLight = new THREE.PointLight(0xfff1dc, 50, 0, 1);
    this.sunLight.position.set(0, 0, 0);
    ctx.scene.add(this.sunLight);

    const sunGeo = new THREE.SphereGeometry(6, sphereSeg, sphereSeg);
    const sunMat = new NodeMaterial();
    sunMat.toneMapped = false;
    sunMat.colorNode = Fn(() => {
      const local = positionLocal.mul(1.6);
      const turbulence = fbm3tsl(local.add(vec3(this.uSunTime.mul(0.35), this.uSunTime.mul(0.22), 0)), 5);
      const granulation = fbm3tsl(local.mul(3).add(vec3(0, this.uSunTime.mul(-0.5), 0)), 3);
      const core = mix(vec3(0.95, 0.35, 0.05), vec3(1.0, 0.82, 0.35), smoothstep(0.3, 0.75, turbulence));
      const hot = mix(core, vec3(1.0, 0.98, 0.85), smoothstep(0.55, 0.95, granulation).mul(0.6));
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const limb = pow(ndv, 0.4);
      const brightness = float(1.1).add(this.uSunBass.mul(0.5)).add(this.uSunKick.mul(0.6));
      return vec4(hot.mul(limb).mul(brightness), 1);
    })();
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.frustumCulled = false;
    this.root.add(this.sunMesh);
    this.geometries.push(sunGeo);
    this.materials.push(sunMat);

    const coronaGeo = new THREE.SphereGeometry(7.4, Math.round(sphereSeg * 0.75), Math.round(sphereSeg * 0.75));
    const coronaMat = new NodeMaterial();
    coronaMat.transparent = true;
    coronaMat.depthWrite = false;
    coronaMat.blending = THREE.AdditiveBlending;
    coronaMat.toneMapped = false;
    coronaMat.colorNode = Fn(() => {
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const fres = pow(float(1).sub(ndv), 2.4);
      const flicker = fbm3tsl(positionLocal.mul(2.2).add(vec3(this.uCoronaTime.mul(0.4), 0, 0)), 3).mul(0.3).add(0.85);
      const glow = vec3(1.0, 0.65, 0.25).mul(fres).mul(flicker).mul(float(1.4).add(this.uCoronaPulse.mul(1.6)));
      return vec4(glow, fres.mul(0.9));
    })();
    this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    this.sunCorona.frustumCulled = false;
    this.sunCorona.renderOrder = 2;
    this.root.add(this.sunCorona);
    this.geometries.push(coronaGeo);
    this.materials.push(coronaMat);

    /* ------------------------------- Planeten ------------------------------------ */
    for (const def of PLANETS) {
      const pivot = new THREE.Group();
      const orbitAngle = Math.random() * Math.PI * 2;
      pivot.rotation.y = orbitAngle;

      const tiltGroup = new THREE.Group();
      tiltGroup.position.set(def.orbitRadius, 0, 0);
      tiltGroup.rotation.z = def.tilt;
      pivot.add(tiltGroup);

      const seg = def.radius > 1.5 ? sphereSeg : smallSeg;
      const geo = new THREE.SphereGeometry(def.radius, seg, seg);
      const texture = generatePlanetTexture(def);
      this.textures.push(texture);
      const material = buildPhysicalMaterial(def, texture);
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      tiltGroup.add(mesh);
      this.geometries.push(geo);
      this.materials.push(material);

      // Atmosphären-Shell (Rückseiten-Glow um den Planeten)
      let atmosphere: THREE.Mesh | undefined;
      if (def.atmosphere !== undefined) {
        const atmoGeo = new THREE.SphereGeometry(def.radius * 1.07, seg, seg);
        const atmoMat = new THREE.MeshBasicMaterial({
          color: def.atmosphere,
          transparent: true,
          opacity: 0.16,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
        atmosphere.frustumCulled = false;
        tiltGroup.add(atmosphere);
        this.geometries.push(atmoGeo);
        this.materials.push(atmoMat);
      }

      let ring: THREE.Mesh | undefined;
      if (def.rings) {
        const ringGeo = new THREE.RingGeometry(def.rings.inner, def.rings.outer, 96, 1);
        const { material: ringMat } = buildRingMaterial(def.rings.color);
        ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.frustumCulled = false;
        tiltGroup.add(ring);
        this.geometries.push(ringGeo);
        this.materials.push(ringMat);
      }

      let moon: THREE.Mesh | undefined;
      if (def.moon) {
        const moonGeo = new THREE.SphereGeometry(def.radius * 0.27, 24, 24);
        const moonTex = generateMoonTexture();
        this.textures.push(moonTex);
        const moonMat = new THREE.MeshStandardMaterial({ map: moonTex, roughness: 0.95, metalness: 0.02 });
        moon = new THREE.Mesh(moonGeo, moonMat);
        moon.frustumCulled = false;
        tiltGroup.add(moon);
        this.geometries.push(moonGeo);
        this.materials.push(moonMat);
      }

      this.root.add(pivot);

      const orbitSpeed = (2 * Math.PI) / (Math.pow(def.periodYears, 0.62) * ORBIT_BASE_SECONDS);
      const spinSign = def.rotHours < 0 ? -1 : 1;
      const spinSpeed = spinSign * ((2 * Math.PI) / (Math.pow(Math.abs(def.rotHours), 0.5) * SPIN_BASE_SECONDS));

      this.planets.push({
        def, pivot, tiltGroup, mesh, ring, atmosphere, moon, moonAngle: Math.random() * Math.PI * 2,
        material, orbitAngle, orbitSpeed, spinSpeed
      });

      const orbitPts: THREE.Vector3[] = [];
      const segs = 128;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        orbitPts.push(new THREE.Vector3(Math.cos(a) * def.orbitRadius, 0, Math.sin(a) * def.orbitRadius));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
      const orbitMat = new THREE.LineBasicMaterial({ color: 0x4a5a7a, transparent: true, opacity: 0.22 });
      const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
      this.root.add(orbitLine);
      this.orbitLines.push(orbitLine);
      this.geometries.push(orbitGeo);
      this.materials.push(orbitMat);
    }

    /* ------------------------------ Asteroidengürtel ------------------------------ */
    const beltCount = q === 'ultra' ? 2200 : q === 'high' ? 1400 : 800;
    const beltPositions = new Float32Array(beltCount * 3);
    for (let i = 0; i < beltCount; i++) {
      const r = 38 + Math.random() * 16;
      const a = Math.random() * Math.PI * 2;
      const h = (Math.random() - 0.5) * 1.4;
      beltPositions[i * 3] = Math.cos(a) * r;
      beltPositions[i * 3 + 1] = h;
      beltPositions[i * 3 + 2] = Math.sin(a) * r;
    }
    this.asteroidGeometry = new THREE.BufferGeometry();
    this.asteroidGeometry.setAttribute('position', new THREE.BufferAttribute(beltPositions, 3));
    this.asteroidMaterial = new THREE.PointsMaterial({
      color: 0x9c8f7a, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false
    });
    this.asteroidBelt = new THREE.Points(this.asteroidGeometry, this.asteroidMaterial);
    this.asteroidBelt.frustumCulled = false;
    this.root.add(this.asteroidBelt);

    const starCount = 2200;
    const starPositions = generateStarSphere(starCount, 220, 260);
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.05, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    ctx.scene.add(this.stars);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    const t = time * 0.001;
    const speedMul = 1 + audio.energy * 0.15;

    this.uSunTime.value = t;
    this.uSunBass.value = audio.bass;
    this.uSunKick.value = audio.kickLevel;
    this.uSunEnergy.value = audio.energy;
    this.uCoronaTime.value = t;
    this.uCoronaPulse.value = audio.kickLevel * 0.7 + audio.bass * 0.4 + ctx.interaction.pulse * 0.5;

    if (this.sunLight) {
      this.sunLight.intensity = 50 + audio.bass * 30 + audio.kickLevel * 25;
    }
    if (this.sunMesh) {
      const s = 1 + audio.bass * 0.06 + audio.kickLevel * 0.05 + audio.beatPulse * 0.03;
      this.sunMesh.scale.setScalar(s);
      this.sunMesh.rotation.y += dt * 0.02;
    }
    if (this.sunCorona) {
      const s = 1 + audio.bass * 0.1 + audio.kickLevel * 0.12 + ctx.interaction.pulse * 0.15;
      this.sunCorona.scale.setScalar(s);
    }

    for (const p of this.planets) {
      p.orbitAngle += p.orbitSpeed * dt * speedMul;
      p.pivot.rotation.y = p.orbitAngle;
      p.mesh.rotation.y += p.spinSpeed * dt * (1 + audio.mid * 0.25);

      if (p.moon) {
        p.moonAngle += dt * 1.4;
        const md = p.def.radius * 2.4;
        p.moon.position.set(Math.cos(p.moonAngle) * md, 0, Math.sin(p.moonAngle) * md);
      }
    }

    if (this.asteroidBelt) {
      this.asteroidBelt.rotation.y += dt * 0.02 * speedMul;
    }
    if (this.stars) {
      this.stars.rotation.y += dt * 0.0015;
      if (this.starMaterial) this.starMaterial.opacity = 0.55 + audio.energy * 0.25;
    }
  }

  dispose(): void {
    if (this.scene) {
      if (this.root) this.scene.remove(this.root);
      if (this.stars) this.scene.remove(this.stars);
      if (this.sunLight) this.scene.remove(this.sunLight);
    }
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();
    this.asteroidGeometry?.dispose();
    this.asteroidMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.textures = [];
    this.planets = [];
    this.orbitLines = [];
    this.root = null;
    this.sunMesh = null;
    this.sunCorona = null;
    this.sunLight = null;
    this.asteroidBelt = null;
    this.asteroidGeometry = null;
    this.asteroidMaterial = null;
    this.stars = null;
    this.starGeometry = null;
    this.starMaterial = null;
    this.scene = null;
  }
}
