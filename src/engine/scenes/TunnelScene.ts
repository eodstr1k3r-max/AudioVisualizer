import * as THREE from 'three';
import { neonEmissiveComp } from './realism';
import { SpeedStreaks } from '../effects/SceneEffects';
import type { Scene3D, EngineContext } from './Scene3D';
import type { AudioData } from '../../core/types';

interface TunnelRing {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  baseRadius: number;
  phase: number;
  baseHue: number;
}

/**
 * „Hyperspace Tunnel" – echter 3D-Fly-Through mit emittierenden, metallisch
 * reflektierenden Ringen. Die Ringe glühen in ihrer Farbe (Bloom-fähig) und
 * reflektieren gleichzeitig die IBL-Umgebung für plastische Tiefe.
 *
 * v5-Erweiterung: echte Warp-Streaks (LineSegments), die mit Bass-Speed an
 * der Kamera vorbeischießen, weiche Doppel-Corona am Energiekern und
 * palettengetönte Sternenfelder.
 */
export class TunnelScene implements Scene3D {
  private rings: TunnelRing[] = [];
  private glow: THREE.Mesh | null = null;
  private glowMaterial: THREE.MeshBasicMaterial | null = null;
  private corona: THREE.Mesh | null = null;
  private coronaMaterial: THREE.MeshBasicMaterial | null = null;
  private stars: THREE.Points | null = null;
  private starGeometry: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;
  private streaks: SpeedStreaks | null = null;
  private scene: THREE.Scene | null = null;
  private totalLen = 210;
  private speed = 30;

  init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    // Klarer Hyperspace – kein Nebel, damit die Tiefe knackig bleibt
    ctx.scene.fog = null;

    const count = 48;
    const gap = this.totalLen / count;

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const hue = 0.58 + t * 0.35;
      const material = new THREE.MeshStandardMaterial({
        roughness: 0.38,
        metalness: 0.65,
        envMapIntensity: 0.9,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      material.color.set(0x0e1016);
      material.emissive.setHSL(hue, 0.95, 0.5);
      material.emissiveIntensity = 1.15 * neonEmissiveComp(material.emissive);

      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 10, 64), material);
      mesh.position.z = 16 - i * gap;
      mesh.scale.setScalar(6 + Math.sin(i * 0.7) * 1.2);
      ctx.scene.add(mesh);
      this.rings.push({ mesh, material, baseRadius: 6 + Math.sin(i * 0.7) * 1.2, phase: i * 0.45, baseHue: hue });
    }

    // Energiekern am Tunnelende
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 32), this.glowMaterial);
    this.glow.position.set(0, 2.5, -40);
    ctx.scene.add(this.glow);

    // v5: weiche äußere Corona um den Kern (zweite, größere Glow-Schale)
    this.coronaMaterial = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.corona = new THREE.Mesh(new THREE.SphereGeometry(5.2, 24, 24), this.coronaMaterial);
    this.corona.position.copy(this.glow.position);
    ctx.scene.add(this.corona);

    // v5: Warp-Streaks – echte Lichtlinien rasen an der Kamera vorbei
    const streakCount = ctx.settings.quality === 'ultra' ? 200 : ctx.settings.quality === 'high' ? 140 : 90;
    this.streaks = new SpeedStreaks(streakCount);
    ctx.scene.add(this.streaks.object);

    // Sternenfeld
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = -Math.random() * this.totalLen;
    }
    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    ctx.scene.add(this.stars);
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    this.speed = (26 + audio.bass * 34 + audio.energy * 14 + audio.kickLevel * 22) * ctx.settings.tunnelSpeed;
    if (!Number.isFinite(this.speed)) this.speed = 30;
    const move = this.speed * dt;

    for (const ring of this.rings) {
      ring.mesh.position.z += move;
      if (ring.mesh.position.z > 18) ring.mesh.position.z -= this.totalLen;

      const pulse = 1 + Math.sin(time * 0.002 + ring.phase) * 0.05 + audio.bass * 0.22 + audio.kickLevel * 0.3 + audio.beatPulse * 0.18;
      ring.mesh.scale.setScalar(ring.baseRadius * pulse);
      const nearness = (18 - ring.mesh.position.z) / this.totalLen;
      ring.material.emissive.setHSL(ring.baseHue + audio.energy * 0.08, 0.95, 0.5 + audio.bass * 0.2);
      ring.material.emissiveIntensity = (0.7 + nearness * 1.4 + audio.energy * 0.5) * neonEmissiveComp(ring.material.emissive);
      ring.material.opacity = 0.55 + nearness * 0.4;
    }

    if (this.glowMaterial) {
      const s = 1 + audio.bass * 0.8 + audio.kickLevel * 0.5 + audio.beatPulse * 0.4;
      this.glow!.scale.setScalar(s);
      this.glowMaterial.color.set(ctx.palette.accent);
      this.glowMaterial.opacity = 0.5 + audio.energy * 0.45 + audio.beatPulse * 0.3;
    }
    if (this.corona && this.coronaMaterial) {
      this.corona.scale.setScalar(1 + audio.bass * 1.1 + audio.kickLevel * 0.7);
      this.coronaMaterial.color.set(ctx.palette.accent2);
      this.coronaMaterial.opacity = 0.12 + audio.energy * 0.22 + audio.beatPulse * 0.14;
    }
    this.streaks?.update(dt, time, audio, ctx.palette);

    if (this.starGeometry) {
      const attr = this.starGeometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 2] += move * 1.6;
        if (arr[i + 2] > 20) arr[i + 2] -= this.totalLen;
      }
      attr.needsUpdate = true;
    }
    // v5: Sterne tönen sich live in die Palette
    if (this.starMaterial) {
      this.starMaterial.color.setStyle(ctx.palette.accent2).lerp(new THREE.Color(0xffffff), 0.55);
      this.starMaterial.opacity = 0.45 + audio.energy * 0.4;
      this.starMaterial.size = 0.7 + audio.kickLevel * 0.5;
    }
  }

  dispose(): void {
    if (!this.scene) return;
    for (const ring of this.rings) {
      this.scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      ring.material.dispose();
    }
    if (this.glow) {
      this.scene.remove(this.glow);
      this.glow.geometry.dispose();
    }
    this.glowMaterial?.dispose();
    if (this.corona) {
      this.scene.remove(this.corona);
      this.corona.geometry.dispose();
    }
    this.coronaMaterial?.dispose();
    if (this.streaks) {
      this.scene.remove(this.streaks.object);
      this.streaks.dispose();
    }
    this.streaks = null;
    if (this.stars) this.scene.remove(this.stars);
    this.starGeometry?.dispose();
    this.starMaterial?.dispose();
    this.rings = [];
    this.glow = null;
    this.corona = null;
    this.coronaMaterial = null;
    this.stars = null;
    this.scene = null;
  }
}
