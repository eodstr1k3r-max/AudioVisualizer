import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, sin, atan, dot, normalize, pow, abs, mix,
  positionLocal, normalLocal, positionWorld, normalWorld, cameraPosition,
  smoothstep, uv
} from 'three/tsl';
import { fbm3, generateStarSphere, buildRidgeSilhouette } from './tslNoise';
import { fbm3 as fbm3js, smoothstep as smoothstepJs } from './realism';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/** Bäckt eine Krater-Gesteins-Textur für den Mond (DataTexture – kein DOM, testbar). */
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

/**
 * „Total Eclipse" – totale Sonnenfinsternis aus Erdsicht.
 *
 * Die komplette Himmels-Szene (Sonne, Mond, Korona, Horizont) hängt an der
 * Kamera (wie ShaderSkyScene/TextOverlay es bereits tun) – so blickt man
 * unabhängig vom Kamera-Modus (Auto-Flight/Orbit/First-Person) immer
 * „durchs Fernrohr" direkt auf das Ereignis. Der Sternenhimmel bleibt in
 * Weltkoordinaten (extrem weit entfernt, Parallaxe vernachlässigbar).
 *
 * PBR: Mond & Horizont-Hügel sind jetzt echte `MeshStandardMaterial`-Körper,
 * beleuchtet von einem Sonnen-PointLight (am Sonnenursprung) + kühlem
 * Hemisphären-Fülllicht. Sonne/Korona/Horizontglühen bleiben leuchtend.
 */
export class EclipseScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private rig: THREE.Group | null = null;

  private sunMesh: THREE.Mesh | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private coronaMesh: THREE.Mesh | null = null;
  private horizonGlow: THREE.Mesh | null = null;

  private sunLight: THREE.PointLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private moonTexture: THREE.DataTexture | null = null;

  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private readonly sunR = 6;
  private readonly moonR = 6.35;
  private readonly amplitude = 15;
  private cyclePhase = Math.PI * 0.5; // Start: Totalität, damit man sofort etwas sieht

  private uSunTime = uniform(0);
  private uSunBass = uniform(0);
  private uSunKick = uniform(0);
  private uDiamondAngle = uniform(0);
  private uDiamondStrength = uniform(0);

  private uCoronaTime = uniform(0);
  private uCoronaPulse = uniform(0);
  private uOverlap = uniform(0);

  private uMoonTime = uniform(0);

  private uGlowOverlap = uniform(0);
  private uGlowTime = uniform(0);

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    // Vakuum – Sterne/Horizont dürfen nicht vom globalen Nebel ausgebleicht werden
    ctx.scene.fog = null;
    this.camera = ctx.camera;
    const q = ctx.settings.quality;
    const sphereSeg = q === 'ultra' ? 64 : q === 'high' ? 48 : 36;

    const rig = new THREE.Group();
    ctx.camera.add(rig);
    this.rig = rig;

    /* --------------------------------- Sonne --------------------------------- */
    const sunGeo = new THREE.SphereGeometry(this.sunR, sphereSeg, sphereSeg);
    const sunMat = new NodeMaterial();
    sunMat.toneMapped = false;
    sunMat.colorNode = Fn(() => {
      const local = positionLocal.mul(1.7);
      const turbulence = fbm3(local.add(vec3(this.uSunTime.mul(0.35), this.uSunTime.mul(0.22), 0)), 5);
      const granulation = fbm3(local.mul(3).add(vec3(0, this.uSunTime.mul(-0.5), 0)), 3);
      const core = mix(vec3(0.95, 0.35, 0.05), vec3(1.0, 0.82, 0.35), smoothstep(0.3, 0.75, turbulence));
      const hot = mix(core, vec3(1.0, 0.98, 0.85), smoothstep(0.55, 0.95, granulation).mul(0.6));

      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const limb = pow(ndv, 0.4);

      // Diamantring: heller Blitz am Sonnenrand, exakt gegenüber der Mond-Annäherungsrichtung
      const rimAngle = atan(normalLocal.y, normalLocal.x);
      const angleDiff = abs(sin(rimAngle.sub(this.uDiamondAngle).mul(0.5)));
      const angleMatch = pow(float(1).sub(angleDiff), 24);
      const rimness = pow(float(1).sub(ndv), 2.0);
      const diamond = angleMatch.mul(rimness).mul(this.uDiamondStrength).mul(6);

      const brightness = float(1.1).add(this.uSunBass.mul(0.5)).add(this.uSunKick.mul(0.6));
      const col = hot.mul(limb).mul(brightness).add(vec3(1.0, 0.97, 0.9).mul(diamond));
      return vec4(col, 1);
    })();
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.frustumCulled = false;
    rig.add(this.sunMesh);
    this.geometries.push(sunGeo);
    this.materials.push(sunMat);

    // Sonnen-PointLight am Sonnenursprung – beleuchtet Mond & Hügel physikalisch.
    this.sunLight = new THREE.PointLight(0xffe8c8, 60, 0, 1);
    this.sunLight.position.set(0, 0, 0);
    rig.add(this.sunLight);

    // Kühles Fülllicht, damit die Schattenseiten von Mond/Hügeln nicht schwarz werden.
    this.hemi = new THREE.HemisphereLight(0x2a3a5a, 0x08070c, 0.35);
    rig.add(this.hemi);

    /* --------------------------- Korona + Protuberanzen ------------------------ */
    const coronaGeo = new THREE.SphereGeometry(this.sunR * 2.6, Math.round(sphereSeg * 0.9), Math.round(sphereSeg * 0.9));
    const coronaMat = new NodeMaterial();
    coronaMat.transparent = true;
    coronaMat.depthWrite = false;
    coronaMat.blending = THREE.AdditiveBlending;
    coronaMat.toneMapped = false;
    coronaMat.colorNode = Fn(() => {
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = abs(dot(normalWorld, viewDir));
      const fres = pow(float(1).sub(ndv), 1.6);

      const angle = atan(normalLocal.y, normalLocal.x);
      // Corona-Streamer: strahlenförmige Streifen rund um die Sonne
      const streaks = pow(abs(sin(angle.mul(14).add(fbm3(vec3(angle.mul(3), this.uCoronaTime.mul(0.25), 0)).mul(4)))), 2.5);
      // Protuberanzen: einige rötliche Gasfontänen an festen Winkeln, leicht flackernd
      const flareA = pow(abs(sin(angle.mul(1).sub(0.6))), 40);
      const flareB = pow(abs(sin(angle.mul(1).sub(2.4))), 50);
      const flareC = pow(abs(sin(angle.mul(1).add(1.7))), 45);
      const flareFlicker = fbm3(vec3(angle.mul(2), this.uCoronaTime.mul(1.4), 0)).mul(0.5).add(0.7);
      const flares = flareA.add(flareB).add(flareC).mul(flareFlicker);

      const coronaCol = vec3(1.0, 0.72, 0.35).mul(streaks).mul(0.9);
      const flareCol = vec3(1.0, 0.28, 0.12).mul(flares).mul(1.6);

      const visible = this.uOverlap.mul(0.92).add(0.08);
      const glow = coronaCol.add(flareCol).mul(fres).mul(visible).mul(float(1.1).add(this.uCoronaPulse.mul(1.5)));
      return vec4(glow, fres.mul(visible).mul(0.95));
    })();
    this.coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    this.coronaMesh.frustumCulled = false;
    this.coronaMesh.renderOrder = 1;
    rig.add(this.coronaMesh);
    this.geometries.push(coronaGeo);
    this.materials.push(coronaMat);

    /* ------------------------- Mond (PBR-Kratergestein) ----------------------- */
    this.moonTexture = makeMoonTexture();
    const moonGeo = new THREE.SphereGeometry(this.moonR, sphereSeg, sphereSeg);
    const moonMat = new THREE.MeshStandardMaterial({
      map: this.moonTexture,
      roughness: 0.95,
      metalness: 0.02
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.frustumCulled = false;
    this.moonMesh.renderOrder = 3;
    rig.add(this.moonMesh);
    this.geometries.push(moonGeo);
    this.materials.push(moonMat);

    /* ------------------------------ Horizontglühen ----------------------------- */
    const glowGeo = new THREE.PlaneGeometry(160, 46, 1, 1);
    const glowMat = new NodeMaterial();
    glowMat.transparent = true;
    glowMat.depthWrite = false;
    glowMat.blending = THREE.AdditiveBlending;
    glowMat.side = THREE.DoubleSide;
    glowMat.toneMapped = false;
    glowMat.colorNode = Fn(() => {
      const v = uv().y;
      const vertical = smoothstep(1.0, 0.0, v);
      const flicker: any = fbm3(vec3(uv().x.mul(3), this.uGlowTime.mul(0.15), 0)).mul(0.2).add(0.9);
      const mixT: any = vertical.mul(flicker);
      const warm = mix(vec3(0.05, 0.03, 0.08), vec3(1.0, 0.45, 0.18), mixT);
      const alpha = vertical.mul(this.uGlowOverlap).mul(0.85);
      return vec4(warm, alpha);
    })();
    this.horizonGlow = new THREE.Mesh(glowGeo, glowMat);
    this.horizonGlow.position.set(0, -14, -34);
    this.horizonGlow.frustumCulled = false;
    rig.add(this.horizonGlow);
    this.geometries.push(glowGeo);
    this.materials.push(glowMat);

    /* --------------------- Horizont-/Hügel-Silhouette (PBR) ------------------- */
    const hillGeo = buildRidgeSilhouette({ segments: 40, width: 150, baseY: -3, minHeight: 0.5, maxHeight: 7, jaggedness: 2.2 });
    // Vertex-Farben: dunkles Gestein, oben (Kamm) etwas heller/wärmer für den Sonnen-Rim.
    const posAttr = hillGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);
    const low = new THREE.Color(0x0a0b10);
    const high = new THREE.Color(0x2a2320);
    const tmp = new THREE.Color();
    const minY = -3;
    const maxY = 4;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const t = Math.min(1, Math.max(0, (y - minY) / (maxY - minY)));
      tmp.copy(low).lerp(high, t);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    hillGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const hillMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05 });
    const hillMesh = new THREE.Mesh(hillGeo, hillMat);
    hillMesh.position.set(0, -14, -30);
    hillMesh.frustumCulled = false;
    hillMesh.renderOrder = 4;
    rig.add(hillMesh);
    this.geometries.push(hillGeo);
    this.materials.push(hillMat);

    /* -------------------------------- Sternenfeld ------------------------------ */
    const starCount = q === 'ultra' ? 2400 : q === 'high' ? 1600 : 1000;
    const starPositions = generateStarSphere(starCount, 200, 260);
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    ctx.scene.add(this.stars);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    const t = time * 0.001;

    const cycleSpeed = 0.16 * (1 + audio.energy * 0.4 + audio.bass * 0.25);
    this.cyclePhase += dt * cycleSpeed;
    const offsetX = this.amplitude * Math.cos(this.cyclePhase);
    const offsetY = this.amplitude * 0.16 * Math.sin(this.cyclePhase * 1.7);

    const closeness = Math.hypot(offsetX, offsetY);
    const overlap = Math.max(0, Math.min(1, 1 - closeness / (this.sunR + this.moonR * 0.92)));

    const totalityGap = this.moonR - this.sunR;
    const edgeWidth = 0.65;
    const edgeDelta = (closeness - totalityGap) / edgeWidth;
    const diamondStrength = closeness < this.sunR + this.moonR ? Math.exp(-edgeDelta * edgeDelta) : 0;
    const diamondAngle = Math.atan2(-offsetY, -offsetX);

    if (this.sunMesh) {
      const s = 1 + audio.bass * 0.04 + audio.kickLevel * 0.04 + audio.beatPulse * 0.02;
      this.sunMesh.scale.setScalar(s);
    }
    if (this.sunLight) {
      this.sunLight.intensity = 60 + audio.bass * 30 + audio.kickLevel * 25;
    }
    if (this.moonMesh) {
      this.moonMesh.position.set(offsetX, offsetY, 9);
      this.moonMesh.rotation.y += dt * 0.02;
    }
    if (this.coronaMesh) {
      const s = 1 + audio.bass * 0.08 + audio.kickLevel * 0.1 + ctx.interaction.pulse * 0.12;
      this.coronaMesh.scale.setScalar(s);
    }

    this.uSunTime.value = t;
    this.uSunBass.value = audio.bass;
    this.uSunKick.value = audio.kickLevel;
    this.uDiamondAngle.value = diamondAngle;
    this.uDiamondStrength.value = diamondStrength;

    this.uCoronaTime.value = t;
    this.uCoronaPulse.value = audio.kickLevel * 0.7 + audio.bass * 0.4 + ctx.interaction.pulse * 0.4;
    this.uOverlap.value = overlap;

    this.uMoonTime.value = t;
    this.uGlowOverlap.value = overlap;
    this.uGlowTime.value = t;

    if (this.starMaterial) {
      this.starMaterial.opacity = Math.max(0, overlap * 0.85 - 0.05) + audio.energy * 0.05;
    }
    if (this.stars) {
      this.stars.rotation.y += dt * 0.0015;
    }

    // Himmel dunkelt während der Totalität sichtbar ab (nur wenn kein eigenes Hintergrundbild aktiv ist)
    if (this.scene && this.scene.background instanceof THREE.Color) {
      const day = new THREE.Color(0x0a1830);
      const night = new THREE.Color(0x010103);
      this.scene.background.copy(day).lerp(night, overlap);
    }
  }

  dispose(): void {
    if (this.camera && this.rig) this.camera.remove(this.rig);
    if (this.scene && this.stars) this.scene.remove(this.stars);
    if (this.scene && this.scene.background instanceof THREE.Color) {
      this.scene.background.set(0x02040a);
    }

    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.moonTexture?.dispose();
    this.sunLight?.dispose();
    this.hemi?.dispose();
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.rig = null;
    this.sunMesh = null;
    this.moonMesh = null;
    this.coronaMesh = null;
    this.horizonGlow = null;
    this.sunLight = null;
    this.hemi = null;
    this.moonTexture = null;
    this.stars = null;
    this.starGeometry = null;
    this.starMaterial = null;
    this.camera = null;
    this.scene = null;
  }
}
