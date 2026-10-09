import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, sin, atan, mix, pow,
  positionLocal,
  smoothstep, length
} from 'three/tsl';
import { fbm3, generateStarSphere } from './tslNoise';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/** „Black Hole" – Ereignishorizont, heiße Akkretionsscheibe (Doppler-Beaming), Photonenring, verzerrter Sternenhimmel. */
export class BlackHoleScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private horizonMesh: THREE.Mesh | null = null;
  private photonRing: THREE.Mesh | null = null;
  private diskMesh: THREE.Mesh | null = null;
  private lensRing: THREE.Mesh | null = null;

  private diskLight: THREE.PointLight | null = null;
  private debrisGroup: THREE.Group | null = null;
  private debris: THREE.InstancedMesh | null = null;

  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private uTime = uniform(0);
  private uDiskTime = uniform(0);
  private uBass = uniform(0);
  private uKick = uniform(0);
  private uEnergy = uniform(0);

  private diskAngle = 0;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    // Vakuum – kein Nebel, damit Akkretionsscheibe & Sterne klar bleiben
    ctx.scene.fog = null;
    const q = ctx.settings.quality;
    const sphereSeg = q === 'ultra' ? 48 : q === 'high' ? 36 : 24;
    const ringSeg = q === 'ultra' ? 96 : q === 'high' ? 64 : 40;
    const diskSeg = q === 'ultra' ? 160 : q === 'high' ? 100 : 60;
    const starCount = q === 'ultra' ? 2600 : q === 'high' ? 1700 : 1000;
    this.root = new THREE.Group();
    ctx.scene.add(this.root);

    /* ------------------------------- Ereignishorizont ------------------------------- */
    const horizonGeo = new THREE.SphereGeometry(4, sphereSeg, sphereSeg);
    const horizonMat = new NodeMaterial();
    horizonMat.toneMapped = false;
    horizonMat.colorNode = Fn(() => vec4(vec3(0, 0, 0), 1))();
    this.horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    this.horizonMesh.frustumCulled = false;
    this.root.add(this.horizonMesh);
    this.geometries.push(horizonGeo);
    this.materials.push(horizonMat);

    /* --------------------------------- Photonenring ---------------------------------- */
    const photonGeo = new THREE.RingGeometry(4.02, 4.5, ringSeg, 1);
    const photonMat = new NodeMaterial();
    photonMat.transparent = true;
    photonMat.depthWrite = false;
    photonMat.side = THREE.DoubleSide;
    photonMat.blending = THREE.AdditiveBlending;
    photonMat.toneMapped = false;
    photonMat.colorNode = Fn(() => {
      const r = length(positionLocal.xy);
      const t = smoothstep(4.02, 4.5, r);
      const glow = smoothstep(1.0, 0.0, t).mul(2.2);
      const col = vec3(1.0, 0.95, 0.85).mul(glow).mul(float(1).add(this.uKick.mul(1.2)));
      return vec4(col, glow.clamp(0, 1));
    })();
    this.photonRing = new THREE.Mesh(photonGeo, photonMat);
    this.photonRing.frustumCulled = false;
    this.root.add(this.photonRing);
    this.geometries.push(photonGeo);
    this.materials.push(photonMat);

    /* ------------------------------- Akkretionsscheibe -------------------------------- */
    const diskGeo = new THREE.RingGeometry(4.6, 15, diskSeg, 1);
    const diskMat = new NodeMaterial();
    diskMat.transparent = true;
    diskMat.depthWrite = false;
    diskMat.side = THREE.DoubleSide;
    diskMat.blending = THREE.AdditiveBlending;
    diskMat.toneMapped = false;
    diskMat.colorNode = Fn(() => {
      const r = length(positionLocal.xy);
      const angle = atan(positionLocal.y, positionLocal.x);
      const rNorm = r.sub(4.6).div(15 - 4.6).clamp(0, 1);

      // Spiralige Turbulenz, gegen die Rotationsrichtung verschoben (Materie-Strömung)
      const flow = fbm3(vec3(angle.mul(2.5).sub(this.uDiskTime.mul(1.4)).add(r.mul(0.4)), r.mul(0.5), 0), 4);
      const density = smoothstep(0.25, 0.75, flow);

      // Temperatur-Gradient: innen weiß-blau-heiß, außen orange-rot-kühler
      const hot = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.15), rNorm);
      const cool = mix(hot, vec3(0.6, 0.15, 0.05), pow(rNorm, 2));

      // Doppler-Beaming: die dem Betrachter „entgegenkommende" Seite der Scheibe leuchtet heller
      const approaching = sin(angle).mul(0.5).add(0.5);
      const beaming = mix(0.35, 1.6, approaching);

      const edgeFade = smoothstep(0.0, 0.08, rNorm).mul(smoothstep(1.0, 0.75, rNorm));
      const brightness = float(1).add(this.uBass.mul(1.4)).add(this.uKick.mul(1.0));
      const col = cool.mul(density.add(0.25)).mul(beaming).mul(brightness);
      return vec4(col, edgeFade.mul(density.add(0.3)).clamp(0, 1));
    })();
    this.diskMesh = new THREE.Mesh(diskGeo, diskMat);
    this.diskMesh.rotation.x = Math.PI / 2.15; // leichte Neigung für perspektivischen Blick
    this.diskMesh.frustumCulled = false;
    this.root.add(this.diskMesh);
    this.geometries.push(diskGeo);
    this.materials.push(diskMat);

    // Gravitationslinsen-Andeutung: verzerrtes zweites, schwaches Scheibenbild "hinter" dem Horizont
    const lensGeo = new THREE.RingGeometry(4.55, 7.5, ringSeg, 1);
    const lensMat = new NodeMaterial();
    lensMat.transparent = true;
    lensMat.depthWrite = false;
    lensMat.side = THREE.DoubleSide;
    lensMat.blending = THREE.AdditiveBlending;
    lensMat.toneMapped = false;
    lensMat.colorNode = Fn(() => {
      const r = length(positionLocal.xy);
      const rNorm = r.sub(4.55).div(7.5 - 4.55).clamp(0, 1);
      const band = smoothstep(0.0, 0.3, rNorm).mul(smoothstep(1.0, 0.5, rNorm));
      const col = vec3(1.0, 0.85, 0.6).mul(band).mul(0.5);
      return vec4(col, band.mul(0.35));
    })();
    this.lensRing = new THREE.Mesh(lensGeo, lensMat);
    this.lensRing.rotation.x = Math.PI / 2;
    this.lensRing.frustumCulled = false;
    this.root.add(this.lensRing);
    this.geometries.push(lensGeo);
    this.materials.push(lensMat);

    /* ------------------- PBR-Trümmerring (Asteroiden um das Loch) ------------------- */
    // Die heiße Akkretionsscheibe emittiert warmes Licht – beleuchtet den
    // Trümmerring physikalisch (echte PBR-Beleuchtung statt Unlit).
    this.diskLight = new THREE.PointLight(0xffa040, 60, 0, 1.5);
    this.diskLight.position.set(0, 0, 0);
    this.root.add(this.diskLight);

    const debrisCount = q === 'ultra' ? 320 : q === 'high' ? 200 : 110;
    this.debrisGroup = new THREE.Group();
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockPos = rockGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rockPos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(rockPos, i);
      v.multiplyScalar(0.6 + Math.random() * 0.7);
      rockPos.setXYZ(i, v.x, v.y, v.z);
    }
    rockGeo.computeVertexNormals();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 0.92, metalness: 0.05 });
    this.debris = new THREE.InstancedMesh(rockGeo, rockMat, debrisCount);
    this.debris.frustumCulled = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < debrisCount; i++) {
      const r = 18 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2;
      const h = (Math.random() - 0.5) * 2.4;
      dummy.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.scale.setScalar(0.25 + Math.random() * 0.7);
      dummy.updateMatrix();
      this.debris.setMatrixAt(i, dummy.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    this.debrisGroup.add(this.debris);
    this.debrisGroup.rotation.x = Math.PI / 2.4;
    this.root.add(this.debrisGroup);
    this.geometries.push(rockGeo);
    this.materials.push(rockMat);

    /* -------------------------------- Sternenfeld (gelinst) --------------------------- */
    const starPositions = generateStarSphere(starCount, 180, 280);
    // Sterne nahe der Sichtlinie zum Loch leicht nach außen verschieben (grobe Linsen-Andeutung)
    for (let i = 0; i < starCount; i++) {
      const x = starPositions[i * 3], y = starPositions[i * 3 + 1], z = starPositions[i * 3 + 2];
      const rXY = Math.hypot(x, y);
      if (rXY < 40 && z < 0) {
        const push = 1 + (40 - rXY) / 40 * 0.6;
        starPositions[i * 3] *= push;
        starPositions[i * 3 + 1] *= push;
      }
    }
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.root.add(this.stars);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    void ctx;
    const t = time * 0.001;
    this.uTime.value = t;
    this.uBass.value = audio.bass;
    this.uKick.value = audio.kickLevel;
    this.uEnergy.value = audio.energy;

    const spinSpeed = 0.5 + audio.energy * 0.6;
    this.diskAngle += dt * spinSpeed;
    this.uDiskTime.value = this.diskAngle;

    if (this.horizonMesh) {
      const s = 1 + audio.bass * 0.03 + audio.kickLevel * 0.02;
      this.horizonMesh.scale.setScalar(s);
    }
    if (this.diskLight) {
      this.diskLight.intensity = 60 + audio.bass * 40 + audio.kickLevel * 30;
    }
    if (this.debrisGroup) {
      this.debrisGroup.rotation.y += dt * 0.05 * (0.5 + audio.energy);
    }
    if (this.stars) this.stars.rotation.y += dt * 0.001;
  }

  dispose(): void {
    if (this.scene && this.root) this.scene.remove(this.root);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();

    this.debris?.dispose();
    this.diskLight?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.horizonMesh = null;
    this.photonRing = null;
    this.diskMesh = null;
    this.lensRing = null;
    this.diskLight = null;
    this.debrisGroup = null;
    this.debris = null;
    this.stars = null;
    this.starGeometry = null;
    this.starMaterial = null;
    this.scene = null;
  }
}
