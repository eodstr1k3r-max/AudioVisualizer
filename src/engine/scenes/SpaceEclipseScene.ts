import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, dot, normalize, pow, abs, mix,
  positionLocal, positionWorld, normalWorld, cameraPosition,
  smoothstep
} from 'three/tsl';
import { fbm3, generateStarSphere } from './tslNoise';
import { fbm3 as fbm3js, smoothstep as smoothstepJs } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Eclipse from Space" – Sonnenfinsternis aus der All-Perspektive.
 *
 * Erde im Zentrum (wie bei SolarSystemScene um den Ursprung), Mond umkreist
 * sie auf einer Bahn, deren Ebene die Sonnenrichtung enthält – dadurch
 * entsteht einmal pro Umlauf automatisch eine echte Sonne-Mond-Erde-
 * Ausrichtung (keine Sonderfall-Logik nötig, rein geometrisch).
 *
 * PBR: Erde & Mond sind jetzt echte `MeshPhysicalMaterial`-/`MeshStandardMaterial`-
 * Körper mit prozeduralen Texturen. Die Sonne ist ein `DirectionalLight` mit
 * Schattenwurf – der Mond wirft so einen echten Kernschatten auf die Erde
 * (statt des früheren Shader-Fake-Flecks).
 */

const EARTH_R = 7;
const MOON_R = 1.9;
const MOON_ORBIT_R = 15;
const SUN_R = 4.2;
const SUN_DIST = 130;
const ORBIT_BASE_SECONDS = 26;

/** Bäckt eine Erdtextur (Ozeane/Kontinente/Vegetation/Polkappen) – nahtlos am Längengrad. */
function makeEarthTexture(w = 256, h = 128): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  const ocean = new THREE.Color(0x0d3f6e);
  const sand = new THREE.Color(0xb9a06a);
  const grass = new THREE.Color(0x2f6b34);
  const forest = new THREE.Color(0x1c4a24);
  const ice = new THREE.Color(0xe9f3f7);
  const col = new THREE.Color();
  const tmp = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const latAbs = Math.abs((y / (h - 1)) * 2 - 1);
    for (let x = 0; x < w; x++) {
      const theta = (x / w) * Math.PI * 2;
      const px = Math.cos(theta);
      const py = Math.sin(theta);
      const pz = (y / (h - 1)) * 2 - 1;
      const land = fbm3js(px * 2.6, py * 2.6, pz * 2.6, 4);
      const veg = fbm3js(px * 6, py * 6, pz * 6, 3);
      tmp.copy(grass).lerp(forest, smoothstepJs(0.45, 0.75, veg));
      tmp.lerp(sand, smoothstepJs(0.48, 0.62, land) * 0.55);
      col.copy(ocean).lerp(tmp, smoothstepJs(0.52, 0.62, land));
      col.lerp(ice, smoothstepJs(0.78, 0.9, latAbs));
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

/** Bäckt eine graue Kratertextur für den Mond. */
function makeMoonTexture(w = 128, h = 64): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  const light = new THREE.Color(0xb8b2a6);
  const dark = new THREE.Color(0x6b655c);
  const crater = new THREE.Color(0x3a352e);
  const col = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const pz = (y / (h - 1) - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const theta = (x / w) * Math.PI * 2;
      const px = Math.cos(theta);
      const py = Math.sin(theta);
      const n = fbm3js(px * 5, py * 5, pz * 5, 4);
      const cr = fbm3js(px * 11, py * 11, pz * 11, 3);
      col.copy(light).lerp(dark, n);
      col.lerp(crater, smoothstepJs(0.62, 0.78, cr) * 0.5);
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

export class SpaceEclipseScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private earthMesh: THREE.Mesh | null = null;
  private earthAtmosphere: THREE.Mesh | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private sunMesh: THREE.Mesh | null = null;
  private sunCorona: THREE.Mesh | null = null;

  private sunLight: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;

  private earthTexture: THREE.DataTexture | null = null;
  private moonTexture: THREE.DataTexture | null = null;

  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private sunDir = new THREE.Vector3();
  private orbitU = new THREE.Vector3();
  private orbitV = new THREE.Vector3();
  private moonAngle = Math.random() * Math.PI * 2;

  private uSunPos = uniform(new THREE.Vector3());

  private uSunTime = uniform(0);
  private uSunBass = uniform(0);
  private uSunKick = uniform(0);
  private uCoronaTime = uniform(0);
  private uCoronaPulse = uniform(0);

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    // Vakuum – kein Nebel; dezente HDRI-Füllung für die Nachtseiten
    ctx.scene.fog = null;
    ctx.scene.environmentIntensity = 0.3;
    const q = ctx.settings.quality;
    const sphereSeg = q === 'ultra' ? 64 : q === 'high' ? 48 : 32;
    const smallSeg = q === 'ultra' ? 40 : q === 'high' ? 32 : 22;
    const shadowSize = q === 'ultra' ? 2048 : q === 'high' ? 1024 : 512;

    this.root = new THREE.Group();
    ctx.scene.add(this.root);

    // Feste Sonnenrichtung; Mond-Orbitebene enthält diese Richtung, damit die
    // Ausrichtung einmal pro Umlauf exakt zur Sonne zeigt (Eklipse-Position).
    this.sunDir.set(1, 0.22, -0.35).normalize();
    const upHint = new THREE.Vector3(0, 1, 0);
    this.orbitU.copy(this.sunDir);
    this.orbitV.crossVectors(this.sunDir, upHint).normalize();
    if (this.orbitV.lengthSq() < 0.001) this.orbitV.set(0, 0, 1);

    /* ----------------------- Sonnenlicht (echte Schattenquelle) ---------------------- */
    const sunWorld = new THREE.Vector3().copy(this.sunDir).multiplyScalar(SUN_DIST);
    this.sunLight = new THREE.DirectionalLight(0xfff2de, 2.6);
    this.sunLight.position.copy(sunWorld);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 22;
    this.sunLight.shadow.camera.bottom = -22;
    this.sunLight.shadow.camera.near = SUN_DIST - 30;
    this.sunLight.shadow.camera.far = SUN_DIST + 30;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    ctx.scene.add(this.sunLight);
    ctx.scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0x16233f, 0x030406, 0.25);
    ctx.scene.add(this.hemi);

    /* ------------------------------ Erde (PBR + Textur) ------------------------------ */
    this.earthTexture = makeEarthTexture();
    const earthGeo = new THREE.SphereGeometry(EARTH_R, sphereSeg, sphereSeg);
    const earthMat = new THREE.MeshPhysicalMaterial({
      map: this.earthTexture,
      roughness: 0.9,
      metalness: 0.02,
      envMapIntensity: 0.6
    });
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthMesh.frustumCulled = false;
    this.earthMesh.receiveShadow = true;
    this.root.add(this.earthMesh);
    this.geometries.push(earthGeo);
    this.materials.push(earthMat);

    // Atmosphären-Rim (additive Rückseiten-Shell)
    const atmoGeo = new THREE.SphereGeometry(EARTH_R * 1.06, sphereSeg, sphereSeg);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x5fa8e0,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.earthAtmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    this.earthAtmosphere.frustumCulled = false;
    this.root.add(this.earthAtmosphere);
    this.geometries.push(atmoGeo);
    this.materials.push(atmoMat);

    /* ------------------------------ Mond (PBR + Textur) ------------------------------ */
    this.moonTexture = makeMoonTexture();
    const moonGeo = new THREE.SphereGeometry(MOON_R, smallSeg, smallSeg);
    const moonMat = new THREE.MeshStandardMaterial({
      map: this.moonTexture,
      roughness: 0.95,
      metalness: 0.02
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.frustumCulled = false;
    this.moonMesh.castShadow = true;
    this.moonMesh.receiveShadow = true;
    this.root.add(this.moonMesh);
    this.geometries.push(moonGeo);
    this.materials.push(moonMat);

    /* ------------------------------- Sonne (emissiv) --------------------------------- */
    const sunGeo = new THREE.SphereGeometry(SUN_R, sphereSeg, sphereSeg);
    const sunMat = new NodeMaterial();
    sunMat.toneMapped = false;
    sunMat.colorNode = Fn(() => {
      const local = positionLocal.mul(1.8);
      const turbulence = fbm3(local.add(vec3(this.uSunTime.mul(0.35), this.uSunTime.mul(0.22), 0)), 5);
      const core = mix(vec3(0.95, 0.35, 0.05), vec3(1.0, 0.85, 0.4), smoothstep(0.3, 0.75, turbulence));
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const limb = pow(ndv, 0.4);
      const brightness = float(1.2).add(this.uSunBass.mul(0.5)).add(this.uSunKick.mul(0.6));
      return vec4(core.mul(limb).mul(brightness), 1);
    })();
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.frustumCulled = false;
    this.root.add(this.sunMesh);
    this.geometries.push(sunGeo);
    this.materials.push(sunMat);

    const coronaGeo = new THREE.SphereGeometry(SUN_R * 1.5, smallSeg, smallSeg);
    const coronaMat = new NodeMaterial();
    coronaMat.transparent = true;
    coronaMat.depthWrite = false;
    coronaMat.blending = THREE.AdditiveBlending;
    coronaMat.toneMapped = false;
    coronaMat.colorNode = Fn(() => {
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const fres = pow(float(1).sub(ndv), 2.4);
      const flicker = fbm3(positionLocal.mul(2.2).add(vec3(this.uCoronaTime.mul(0.4), 0, 0)), 3).mul(0.3).add(0.85);
      const glow = vec3(1.0, 0.65, 0.25).mul(fres).mul(flicker).mul(float(1.3).add(this.uCoronaPulse.mul(1.5)));
      return vec4(glow, fres.mul(0.85));
    })();
    this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    this.sunCorona.frustumCulled = false;
    this.root.add(this.sunCorona);
    this.geometries.push(coronaGeo);
    this.materials.push(coronaMat);

    /* -------------------------------- Sternenfeld ------------------------------ */
    const starCount = q === 'ultra' ? 2200 : q === 'high' ? 1400 : 800;
    const starPositions = generateStarSphere(starCount, 250, 260);
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
    const speedMul = 1 + audio.energy * 0.2 + audio.bass * 0.1;

    this.moonAngle += (dt * (2 * Math.PI)) / ORBIT_BASE_SECONDS * speedMul;

    const moonWorld = new THREE.Vector3()
      .addScaledVector(this.orbitU, Math.cos(this.moonAngle) * MOON_ORBIT_R)
      .addScaledVector(this.orbitV, Math.sin(this.moonAngle) * MOON_ORBIT_R);

    const sunWorld = new THREE.Vector3().copy(this.sunDir).multiplyScalar(SUN_DIST);

    if (this.moonMesh) {
      this.moonMesh.position.copy(moonWorld);
      this.moonMesh.rotation.y += dt * 0.06;
    }
    if (this.sunMesh) {
      this.sunMesh.position.copy(sunWorld);
      const s = 1 + audio.bass * 0.05 + audio.kickLevel * 0.05 + audio.beatPulse * 0.02;
      this.sunMesh.scale.setScalar(s);
      this.sunMesh.rotation.y += dt * 0.02;
    }
    if (this.sunCorona) {
      this.sunCorona.position.copy(sunWorld);
      const s = 1 + audio.bass * 0.1 + audio.kickLevel * 0.12 + ctx.interaction.pulse * 0.15;
      this.sunCorona.scale.setScalar(s);
    }
    if (this.earthMesh) {
      this.earthMesh.rotation.y += dt * 0.05 * (1 + audio.mid * 0.2);
    }
    if (this.sunLight) {
      this.sunLight.intensity = 2.6 + audio.bass * 1.2 + audio.kickLevel * 0.8;
    }

    this.uSunPos.value.copy(sunWorld);

    this.uSunTime.value = t;
    this.uSunBass.value = audio.bass;
    this.uSunKick.value = audio.kickLevel;
    this.uCoronaTime.value = t;
    this.uCoronaPulse.value = audio.kickLevel * 0.7 + audio.bass * 0.4 + ctx.interaction.pulse * 0.5;

    if (this.stars) {
      this.stars.rotation.y += dt * 0.0012;
      if (this.starMaterial) this.starMaterial.opacity = 0.55 + audio.energy * 0.25;
    }
  }

  dispose(): void {
    if (this.scene) {
      if (this.root) this.scene.remove(this.root);
      if (this.stars) this.scene.remove(this.stars);
      if (this.sunLight) {
        this.scene.remove(this.sunLight);
        this.scene.remove(this.sunLight.target);
      }
      if (this.hemi) this.scene.remove(this.hemi);
    }
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.earthTexture?.dispose();
    this.moonTexture?.dispose();
    this.sunLight?.dispose();
    this.hemi?.dispose();
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.earthMesh = null;
    this.earthAtmosphere = null;
    this.moonMesh = null;
    this.sunMesh = null;
    this.sunCorona = null;
    this.sunLight = null;
    this.hemi = null;
    this.earthTexture = null;
    this.moonTexture = null;
    this.stars = null;
    this.starGeometry = null;
    this.starMaterial = null;
    this.scene = null;
  }
}
