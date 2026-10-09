import * as THREE from 'three';
import type { Settings } from '../core/types';

/**
 * Logo-/Text-Overlay als THREE-Sprite an der Kamera.
 * Da es Teil der 3D-Szene ist, erscheint es auch in Aufnahmen & OBS (im Gegensatz
 * zu reinen DOM-Overlays, die von captureStream nicht erfasst werden).
 */
export class TextOverlay {
  private sprite: THREE.Sprite | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private lastKey = '';

  constructor(private camera: THREE.PerspectiveCamera) {}

  update(settings: Settings): void {
    const text = settings.overlayText.trim();
    // Größe/Jede-Frame-Anpassung: FOV & Aspect ändern sich laufend (Kick-Punch,
    // Resize) → das Sprite skaliert mit dem Viewport statt fixer Einheiten.
    this.sizeSprite();

    const key = `${text}|${settings.overlaySize}|${settings.overlayPosition}|${settings.overlayColor}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.remove();

    if (!text) return;

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `900 ${Math.round(170 * settings.overlaySize)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = settings.overlayColor;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    this.sprite = new THREE.Sprite(material);
    this.sprite.renderOrder = 999;
    this.sprite.position.set(0, settings.overlayPosition === 'top' ? 4.8 : -4.8, -12);
    this.camera.add(this.sprite);
    this.sizeSprite();
  }

  /** Sprite auf max. 80 % der Viewport-Breite skalieren (FOV-/Aspect-abhängig). */
  private sizeSprite(): void {
    if (!this.sprite || !this.camera) return;
    const dist = Math.abs(this.sprite.position.z);
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const w = h * this.camera.aspect;
    const targetW = Math.min(w * 0.8, 20);
    this.sprite.scale.set(targetW, targetW * (256 / 2048), 1);
  }

  dispose(): void {
    this.remove();
  }

  private remove(): void {
    if (this.sprite) {
      this.camera.remove(this.sprite);
      this.sprite.material.dispose();
      this.sprite = null;
    }
    this.texture?.dispose();
    this.texture = null;
  }
}
