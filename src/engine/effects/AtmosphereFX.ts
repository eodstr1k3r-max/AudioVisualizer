import * as THREE from 'three';
import type { AudioData } from '../../core/types';
import type { PresetPalette } from '../../core/colorPresets';

/**
 * AtmosphereFX – globales 3D-Tiefe-Layer, das der SceneManager um JEDE Szene legt.
 *
 * - DepthDust: hunderte schwebende Staubpartikel im kompletten Szenenvolumen
 *   (echte 3D-Verteilung mit Parallaxe), additiv, palettengefärbt, reagiert auf
 *   Energy/Kick mit Wirbel und Auftrieb.
 * - KickShockwaves: expandierende Schockwellen-Ringe am Szenenboden bei jedem
 *   Kick – verankert den Beat räumlich in der Szene.
 *
 * Das Layer ist bewusst billig gehalten (2 Drawcalls), damit es in allen
 * 19 Modi ohne spürbaren FPS-Kosten laufen kann.
 */
export class AtmosphereFX {
  private scene: THREE.Scene | null = null;
  private group: THREE.Group | null = null;

  private dust: THREE.Points | null = null;
  private dustGeometry: THREE.BufferGeometry | null = null;
  private dustMaterial: THREE.PointsMaterial | null = null;
  private dustBase: Float32Array | null = null;
  private dustCount = 0;

  private rings: { mesh: THREE.Mesh; age: number; life: number }[] = [];
  private ringGeometry: THREE.RingGeometry | null = null;
  private ringMaterials: THREE.MeshBasicMaterial[] = [];

  private wasKick = false;

  init(scene: THREE.Scene, quality: 'ultra' | 'high' | 'medium'): void {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'atmosphere-fx';

    /* ------------------------------ Depth Dust ----------------------------- */
    // Weite 3D-Streuung (Kugelvolumen) → echte Tiefenstaffelung & Parallaxe
    const count = quality === 'ultra' ? 900 : quality === 'high' ? 600 : 380;
    this.dustCount = count;
    const positions = new Float32Array(count * 3);
    this.dustBase = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 14 + Math.pow(Math.random(), 0.7) * 66;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = Math.abs(r * Math.cos(phi)) * 0.45 + Math.random() * 6;
      const z = r * Math.sin(phi) * Math.sin(theta);
      this.dustBase[i * 3] = x;
      this.dustBase[i * 3 + 1] = y;
      this.dustBase[i * 3 + 2] = z;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    this.dustGeometry = new THREE.BufferGeometry();
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustMaterial = new THREE.PointsMaterial({
      color: 0x9db8ff,
      size: 0.55,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.dust = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);

    /* --------------------------- Kick-Schockwellen -------------------------- */
    this.ringGeometry = new THREE.RingGeometry(0.94, 1, 72);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(this.ringGeometry, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -1.9;
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.ringMaterials.push(mat);
      this.rings.push({ mesh, age: 0, life: 0 });
      this.group.add(mesh);
    }

    scene.add(this.group);
  }

  /** Anzahl aktuell sichtbarer Schockwellen (0..4) – auch für Tests. */
  get activeShockwaves(): number {
    return this.rings.filter((r) => r.life > 0).length;
  }

  /** Anzahl Staubpartikel – auch für Qualitätsskalierungs-Tests. */
  get dustParticleCount(): number {
    return this.dustCount;
  }

  update(dt: number, audio: AudioData, palette: PresetPalette): void {
    if (!this.group) return;

    /* Dust: langsamer Auftrieb + Energy-Wirbel + Kick-Schub */
    if (this.dust && this.dustBase && this.dustGeometry) {
      const pos = this.dustGeometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const swirl = dt * (0.05 + audio.energy * 0.22);
      const lift = dt * (0.4 + audio.bass * 2.2);
      const kickPush = audio.kickLevel * 0.35;
      for (let i = 0; i < this.dustCount; i++) {
        const ix = i * 3;
        let x = arr[ix];
        let y = arr[ix + 1];
        let z = arr[ix + 2];
        // Rotation um Y (Wirbel)
        const c = Math.cos(swirl);
        const s = Math.sin(swirl);
        const nx = x * c - z * s;
        const nz = x * s + z * c;
        x = nx;
        z = nz;
        // Auftrieb + Kick-Schub nach oben
        y += lift + kickPush * ((i % 7) / 7);
        // sanftes Ring-Recycling unten → endloser Strom
        if (y > 60) y -= 66;
        arr[ix] = x;
        arr[ix + 1] = y;
        arr[ix + 2] = z;
      }
      pos.needsUpdate = true;

      if (this.dustMaterial) {
        this.dustMaterial.color.setStyle(palette.accent2);
        this.dustMaterial.opacity = 0.28 + audio.energy * 0.3 + audio.kickLevel * 0.18;
        this.dustMaterial.size = 0.5 + audio.kickLevel * 0.35;
      }
    }

    /* Kick-Schockwellen: steigende Flanke startet einen Ring */
    if (audio.isKick && !this.wasKick) {
      const slot = this.rings.find((r) => r.life <= 0);
      if (slot) {
        slot.age = 0;
        slot.life = 0.85;
        slot.mesh.visible = true;
        slot.mesh.scale.setScalar(1);
      }
    }
    this.wasKick = audio.isKick;

    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.life = 0;
        ring.mesh.visible = false;
        continue;
      }
      const ease = 1 - Math.pow(1 - t, 3);
      ring.mesh.scale.setScalar(1 + ease * 42);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55;
      (ring.mesh.material as THREE.MeshBasicMaterial).color.setStyle(palette.accent);
    }
  }

  dispose(): void {
    if (this.scene && this.group) this.scene.remove(this.group);
    this.dustGeometry?.dispose();
    this.dustMaterial?.dispose();
    this.ringGeometry?.dispose();
    for (const m of this.ringMaterials) m.dispose();
    this.ringMaterials = [];
    this.rings = [];
    this.dust = null;
    this.dustGeometry = null;
    this.dustMaterial = null;
    this.dustBase = null;
    this.group = null;
    this.scene = null;
  }
}
