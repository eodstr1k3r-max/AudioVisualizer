import * as THREE from 'three';
import { PMREMGenerator as WebGPUPMREMGenerator } from 'three/webgpu';
import type { EngineRenderer } from './types';

/**
 * Prozedurale, bildbasierte Beleuchtungsumgebung (IBL) für fotorealistisches PBR.
 *
 * Statt einer hellen Studio-Box wird eine düstere Dämmerungs-/Nachthimmel-Sky
 * (Indigo-Zenit → warmes Horizontglühen → dunkler Boden) mit einigen weichen
 * Lichtflächen erzeugt. Das liefert subtile, stimmige Reflexionen und Ambient
 * für `MeshStandardMaterial`/`MeshPhysicalMaterial`, ohne die nächtliche
 * Ästhetik des Visualizers zu zerstören.
 */
export interface EnvironmentHandle {
  /** PMREM-konvolvierte Umgebungstextur – direkt `scene.environment` zuweisbar. */
  texture: THREE.Texture;
  dispose(): void;
}

/** Zeichnet eine 2:1-Equirectangular-Sky auf ein Canvas und gibt die Textur zurück. */
function createSkyEquirect(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Vertikaler Himmelsverlauf: Zenit (Indigo) → Horizont (Warm) → Boden (dunkel)
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a0f2a');
  sky.addColorStop(0.42, '#14244f');
  sky.addColorStop(0.5, '#3a4a6b');
  sky.addColorStop(0.54, '#8a5a4a');
  sky.addColorStop(0.62, '#2a2030');
  sky.addColorStop(1, '#0a0a12');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Weiche horizontale Lichtflächen → interessante, gestreckte Reflexionen auf PBR-Metall
  const panels: Array<[number, number, number, string]> = [
    // x (0..1), Breite (0..1), Höhe in px, Farbe
    [0.22, 0.18, 26, '#cfe6ff'],
    [0.68, 0.14, 20, '#ffd9b0'],
    [0.45, 0.3, 12, '#b8c8ff']
  ];
  for (const [x, wd, hh, color] of panels) {
    const gx = ctx.createLinearGradient(0, h / 2 - hh, 0, h / 2 + hh);
    gx.addColorStop(0, 'rgba(0,0,0,0)');
    gx.addColorStop(0.5, color);
    gx.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = gx;
    ctx.fillRect(x * w - (wd * w) / 2, h / 2 - hh, wd * w, hh * 2);
    ctx.restore();
  }

  // Dezentes Sternenflimmern im oberen Himmelsdrittel
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 220; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h * 0.4;
    ctx.globalAlpha = 0.1 + Math.random() * 0.5;
    const s = Math.random() < 0.9 ? 1 : 1.8;
    ctx.fillRect(sx, sy, s, s);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** Baut die PMREM-Umgebung. Liefert `null`, falls IBL nicht verfügbar ist (kein harter Fehler). */
export function createEnvironmentMap(renderer: EngineRenderer, isWebGPU: boolean): EnvironmentHandle | null {
  try {
    const equirect = createSkyEquirect();
    const pmrem = isWebGPU
      ? new WebGPUPMREMGenerator(renderer as never)
      : new THREE.PMREMGenerator(renderer as never);
    const renderTarget = pmrem.fromEquirectangular(equirect);
    equirect.dispose();
    pmrem.dispose();

    return {
      texture: renderTarget.texture,
      dispose: () => renderTarget.dispose()
    };
  } catch (e) {
    console.warn('[Engine] IBL-Umgebung nicht erzeugbar – Fallback ohne Environment-Reflexionen:', e);
    return null;
  }
}
