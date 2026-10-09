import type * as THREE from 'three';
import type { EngineRenderer } from '../types';
import type { AudioData, Settings, VisualMode } from '../../core/types';
import type { PresetPalette } from '../../core/colorPresets';

export interface EngineInteraction {
  /** 1.0 direkt nach einem Klick auf die Viewport, zerfällt danach (0..1) */
  pulse: number;
}

export interface EngineContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: EngineRenderer;
  isWebGPU: boolean;
  settings: Settings;
  palette: PresetPalette;
  imageTexture: THREE.Texture | null;
  mode: VisualMode;
  /** Klick-/Maus-Impuls (für interaktive Effekte in den Szenen) */
  interaction: EngineInteraction;
}

export interface Scene3D {
  init(ctx: EngineContext): void;
  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void;
  dispose(): void;
}
