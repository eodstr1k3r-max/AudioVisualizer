import type * as THREE from 'three';

/** Backend-agnostische Renderer-Schnittstelle (WebGPURenderer ODER WebGLRenderer) */
export interface EngineRenderer {
  domElement: HTMLCanvasElement;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(value: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  outputColorSpace: string;
  toneMapping: number;
  captureStream?(fps?: number): MediaStream;
  setAnimationLoop?(callback: ((time: number) => void) | null): void;
  setRenderTarget?: (target: unknown | null) => void;
  dispose?(): void;
}
