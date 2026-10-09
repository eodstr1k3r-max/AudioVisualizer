import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, sin, mix,
  positionLocal, smoothstep
} from 'three/tsl';
import { fbm3, generateStarSphere, buildRidgeSilhouette } from './tslNoise';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

/**
 * „Aurora" – Nordlicht über einem stillen Bergsee.
 * Echte PBR-Geometrie: Bergkette (Vertex-Farben: Fels → Schnee, wirft Schatten)
 * und reflektierender See, beleuchtet von Mond + Hemisphäre + Aurora-Glow.
 * Die Nordlicht-Bänder bleiben prozedural (additiv) – Aurora ist Atmosphäre,
 * keine beleuchtete Geometrie.
 */
export class AuroraScene implements Scene3D {
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;

  private auroraMesh: THREE.Mesh | null = null;
  private mountains: THREE.Mesh | null = null;
  private lakeMesh: THREE.Mesh | null = null;

  private hemi: THREE.HemisphereLight | null = null;
  private moon: THREE.DirectionalLight | null = null;
  private auroraGlow: THREE.PointLight | null = null;

  private moonDisc: THREE.Mesh | null = null;
  private moonHalo: THREE.Mesh | null = null;

  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private uTime = uniform(0);
  private uBass = uniform(0);
  private uEnergy = uniform(0);
  private uTreble = uniform(0);
  private uKick = uniform(0);

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const q = ctx.settings.quality;
    const skySeg = q === 'ultra' ? 48 : q === 'high' ? 36 : 24;
    const mtnSeg = q === 'ultra' ? 48 : q === 'high' ? 36 : 24;
    const starCount = q === 'ultra' ? 1800 : q === 'high' ? 1200 : 700;
    const shadowSize = q === 'ultra' ? 2048 : 1024;
    this.root = new THREE.Group();
    ctx.scene.add(this.root);
    ctx.scene.fog = new THREE.FogExp2(0x02040a, 0.002);

    /* ----------------------------- Himmel + Nordlicht ----------------------------- */
    const skyGeo = new THREE.SphereGeometry(140, skySeg, Math.max(16, skySeg >> 1), 0, Math.PI * 2, 0, Math.PI * 0.62);
    const skyMat = new NodeMaterial();
    skyMat.side = THREE.BackSide;
    skyMat.transparent = true;
    skyMat.toneMapped = false;
    skyMat.colorNode = Fn(() => {
      const p: any = positionLocal.mul(0.045);
      const lat = positionLocal.y.div(140).clamp(0, 1);

      const skyBase = mix(vec3(0.02, 0.03, 0.07), vec3(0.005, 0.006, 0.015), lat);

      const band1 = fbm3(vec3(p.x.mul(2.2), lat.mul(3).add(this.uTime.mul(0.12)), p.z.mul(2.2)), 4);
      const band2 = fbm3(vec3(p.x.mul(3.4).add(5), lat.mul(4.4).sub(this.uTime.mul(0.09)), p.z.mul(3.4)), 4);
      const wave = sin(p.x.mul(4).add(this.uTime.mul(0.6)).add(band1.mul(3)));
      const curtain = smoothstep(0.15, 0.85, band1).mul(smoothstep(0.0, 0.5, wave.mul(0.5).add(0.5)));
      const curtain2 = smoothstep(0.25, 0.9, band2);

      const heightMask = smoothstep(0.02, 0.22, lat).mul(smoothstep(0.95, 0.55, lat));
      const intensity = float(0.5).add(this.uBass.mul(1.2)).add(this.uKick.mul(0.8));

      const greenCol = vec3(0.15, 1.0, 0.55);
      const violetCol = vec3(0.55, 0.25, 1.0);
      const auroraCol = mix(greenCol, violetCol, smoothstep(0.3, 0.8, band2).mul(0.7).add(this.uTreble.mul(0.3)));

      const auroraGlow = auroraCol.mul(curtain).mul(curtain2.add(0.4)).mul(heightMask).mul(intensity);
      return vec4(skyBase.add(auroraGlow), 1);
    })();
    this.auroraMesh = new THREE.Mesh(skyGeo, skyMat);
    this.auroraMesh.frustumCulled = false;
    this.root.add(this.auroraMesh);
    this.geometries.push(skyGeo);
    this.materials.push(skyMat);

    /* ------------------------------- PBR-Bergkette -------------------------------- */
    const mtnGeo = buildRidgeSilhouette({ segments: mtnSeg, width: 220, baseY: -12, minHeight: 3, maxHeight: 16, jaggedness: 3.4 });
    // Vertex-Farben: dunkler Fels unten → bläulicher Schnee oberhalb der Schneegrenze
    const mtnPos = mtnGeo.attributes.position as THREE.BufferAttribute;
    const mtnColors = new Float32Array(mtnPos.count * 3);
    const rock = new THREE.Color(0x171722);
    const snow = new THREE.Color(0x8b9bb4);
    const tmp = new THREE.Color();
    for (let i = 0; i < mtnPos.count; i++) {
      const y = mtnPos.getY(i);
      const t = Math.min(1, Math.max(0, (y + 1) / 3)); // Schnee ab y>-1, voll bei y>=2
      tmp.copy(rock).lerp(snow, t);
      mtnColors[i * 3] = tmp.r;
      mtnColors[i * 3 + 1] = tmp.g;
      mtnColors[i * 3 + 2] = tmp.b;
    }
    mtnGeo.setAttribute('color', new THREE.BufferAttribute(mtnColors, 3));
    const mtnMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
      metalness: 0.05,
      envMapIntensity: 0.6
    });
    this.mountains = new THREE.Mesh(mtnGeo, mtnMat);
    this.mountains.position.set(0, 0, -70);
    this.mountains.castShadow = true;
    this.mountains.receiveShadow = true;
    this.mountains.frustumCulled = false;
    this.root.add(this.mountains);
    this.geometries.push(mtnGeo);
    this.materials.push(mtnMat);

    /* ------------------------------- PBR-See (spiegelnd) --------------------------- */
    const lakeGeo = new THREE.PlaneGeometry(240, 140, 1, 1);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x060b13,
      roughness: 0.14,
      metalness: 0.12,
      envMapIntensity: 1.1
    });
    this.lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    this.lakeMesh.rotation.x = -Math.PI / 2;
    this.lakeMesh.position.set(0, -12, 0);
    this.lakeMesh.receiveShadow = true;
    this.lakeMesh.frustumCulled = false;
    this.root.add(this.lakeMesh);
    this.geometries.push(lakeGeo);
    this.materials.push(lakeMat);

    /* --------------------------------- Beleuchtung ---------------------------------- */
    // Kühle Nacht-Ambient mit leicht grünem Nordlicht-Schimmer
    this.hemi = new THREE.HemisphereLight(0x2c4a3a, 0x04070a, 0.55);
    ctx.scene.add(this.hemi);

    // Mond wirft den Schatten der Bergkette auf den See
    this.moon = new THREE.DirectionalLight(0xaec8ff, 1.2);
    this.moon.position.set(30, 40, 20);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(shadowSize, shadowSize);
    this.moon.shadow.camera.left = -120;
    this.moon.shadow.camera.right = 120;
    this.moon.shadow.camera.top = 120;
    this.moon.shadow.camera.bottom = -120;
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 200;
    this.moon.shadow.bias = -0.0004;
    this.moon.shadow.normalBias = 0.03;
    ctx.scene.add(this.moon);

    // Aurora-Glow: spiegelt das Nordlicht audio-reaktiv auf den See
    this.auroraGlow = new THREE.PointLight(0x66ffb2, 0, 220, 1.6);
    this.auroraGlow.position.set(0, 26, -40);
    ctx.scene.add(this.auroraGlow);

    /* -------------------------------- Sternenfeld ---------------------------------- */
    const starPositions = generateStarSphere(starCount, 145, 200);
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.0, sizeAttenuation: true, transparent: true, opacity: 0.65, depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.root.add(this.stars);

    /* ------------------------ v5: Sichtbarer Mond + Halo --------------------------- */
    // Der Mondlicht-Richtung (30, 40, 20) nachempfunden, weit draußen am Himmel
    const moonDir = new THREE.Vector3(30, 40, 20).normalize();
    const discGeo = new THREE.CircleGeometry(7, 40);
    const discMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, toneMapped: false, fog: false });
    this.moonDisc = new THREE.Mesh(discGeo, discMat);
    this.moonDisc.position.copy(moonDir).multiplyScalar(128);
    this.moonDisc.lookAt(0, 0, 0);
    this.root.add(this.moonDisc);
    this.geometries.push(discGeo);
    this.materials.push(discMat);

    const haloGeo = new THREE.CircleGeometry(13, 40);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xaec8ff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    this.moonHalo = new THREE.Mesh(haloGeo, haloMat);
    this.moonHalo.position.copy(moonDir).multiplyScalar(129);
    this.moonHalo.lookAt(0, 0, 0);
    this.root.add(this.moonHalo);
    this.geometries.push(haloGeo);
    this.materials.push(haloMat);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    void ctx;
    const t = time * 0.001;
    this.uTime.value = t;
    this.uBass.value = audio.bass;
    this.uEnergy.value = audio.energy;
    this.uTreble.value = audio.treble;
    this.uKick.value = audio.kickLevel;

    if (this.auroraGlow) {
      this.auroraGlow.intensity = 30 + audio.bass * 80 + audio.energy * 40;
      // Grün → Violett mit den Höhen (Treble)
      this.auroraGlow.color.setHSL(0.38 - Math.min(0.3, audio.treble * 0.5), 0.8, 0.6);
    }
    if (this.stars) this.stars.rotation.y += dt * 0.001;

    // v5: Mond-Halo flimmert dezent mit den Höhen (Treble) und dem Beat
    if (this.moonHalo) {
      const haloMat = this.moonHalo.material as THREE.MeshBasicMaterial;
      haloMat.opacity = 0.09 + audio.treble * 0.1 + audio.beatPulse * 0.05;
      this.moonHalo.scale.setScalar(1 + audio.bass * 0.07);
    }
  }

  dispose(): void {
    if (this.scene && this.root) this.scene.remove(this.root);
    if (this.scene && this.hemi) this.scene.remove(this.hemi);
    if (this.scene && this.moon) this.scene.remove(this.moon);
    if (this.scene && this.auroraGlow) this.scene.remove(this.auroraGlow);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();

    this.geometries = [];
    this.materials = [];
    this.root = null;
    this.auroraMesh = null;
    this.mountains = null;
    this.lakeMesh = null;
    this.hemi = null;
    this.moon = null;
    this.auroraGlow = null;
    this.moonDisc = null;
    this.moonHalo = null;
    this.stars = null;
    this.starGeometry = null;
    this.starMaterial = null;
    this.scene = null;
  }
}
