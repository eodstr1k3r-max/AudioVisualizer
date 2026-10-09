import * as THREE from 'three';
import { useStore, type Settings } from '../core/store';
import type { VisualMode } from '../core/types';
import { t } from '../core/i18n';

const DARK = new THREE.Color(0x04060d);
const MAX_CANVAS = 2048;

export class BackgroundImage {
  private image: HTMLImageElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture | null = null;
  private lastKey = '';

  constructor(private scene: THREE.Scene) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  setImage(file: File): void {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      this.image = img;
      this.lastKey = '';
      useStore.getState().setUi({ sourceName: `BG: ${file.name}` });
    };
    img.src = url;
  }

  /** Bild aus einer URL laden (CORS-fähige Quellen). */
  setImageUrl(url: string): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.image = img;
      this.lastKey = '';
      const name = url.split('/').pop()?.split('?')[0]?.slice(0, 24) || 'URL';
      useStore.getState().setUi({ sourceName: `BG: ${name}` });
    };
    img.onerror = () => {
      useStore.getState().setUi({ status: t('status.bgLoadFailed') });
    };
    img.src = url;
  }

  clear(): void {
    this.image = null;
    this.texture?.dispose();
    this.texture = null;
    this.scene.background = DARK;
  }

  /** Liefert die Textur für u_image in Shadern */
  getTexture(): THREE.Texture | null {
    return this.texture;
  }

  update(_time: number, settings: Settings, mode: VisualMode): void {
    if (!this.image) {
      this.scene.background = DARK;
      return;
    }

    const w = Math.min(this.image.naturalWidth, MAX_CANVAS);
    const h = Math.min(this.image.naturalHeight, MAX_CANVAS);

    const key = `${w}x${h}|${settings.bgOpacity}|${settings.bgContrast}|${settings.bgFitMode}|${settings.bgScale}|${settings.bgPosX}|${settings.bgPosY}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.redraw(w, h, settings);
    }

    if (mode === 'shader' || mode === 'fusion') {
      // Shader übernehmen das Bild selbst (u_image)
      this.scene.background = DARK;
    } else if (settings.bgOpacity > 0.02) {
      this.scene.background = this.texture;
    } else {
      this.scene.background = DARK;
    }
  }

  private redraw(w: number, h: number, settings: Settings): void {
    if (!this.image) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = '#030510';
    this.ctx.fillRect(0, 0, w, h);

    const imgRatio = this.image.naturalWidth / this.image.naturalHeight;
    const canvasRatio = w / h;
    const fit = settings.bgFitMode;
    let dw: number;
    let dh: number;

    if (fit === 'contain') {
      if (imgRatio > canvasRatio) {
        dw = w;
        dh = dw / imgRatio;
      } else {
        dh = h;
        dw = dh * imgRatio;
      }
    } else {
      if (imgRatio > canvasRatio) {
        dh = h;
        dw = dh * imgRatio;
      } else {
        dw = w;
        dh = dw / imgRatio;
      }
    }
    dw *= settings.bgScale;
    dh *= settings.bgScale;
    const dx = (w - dw) / 2 + settings.bgPosX * w * 0.5;
    const dy = (h - dh) / 2 + settings.bgPosY * h * 0.5;

    this.ctx.save();
    this.ctx.globalAlpha = settings.bgOpacity;
    this.ctx.filter = `contrast(${settings.bgContrast * 100}%) saturate(120%) blur(${Math.max(0, (1 - settings.bgContrast) * 4)}px)`;
    this.ctx.drawImage(this.image, dx, dy, dw, dh);
    this.ctx.restore();

    if (!this.texture) {
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
    } else {
      this.texture.image = this.canvas;
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture?.dispose();
  }
}
