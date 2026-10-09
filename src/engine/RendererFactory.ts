import { WebGPURenderer } from 'three/webgpu';
import { WebGLRenderer, ACESFilmicToneMapping, SRGBColorSpace, type WebGLRendererParameters } from 'three';
import type { EngineRenderer } from './types';

interface PipelineRenderer {
  toneMapping: number;
  toneMappingExposure: number;
  outputColorSpace: string;
  shadowMap: { enabled: boolean };
}

/**
 * Fotorealistische Render-Features: ACES-Filmic-Tonemapping + sRGB-Ausgabe
 * sowie Schattenwurf (wird nur für Lichter mit `castShadow=true` aktiv – die
 * übrigen Szenen bleiben dadurch ohne Zusatzkosten).
 */
function applyRenderFeatures(renderer: PipelineRenderer): void {
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
}

export interface RendererHandle {
  renderer: EngineRenderer;
  isWebGPU: boolean;
}

export async function createRenderer(): Promise<RendererHandle> {
  const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  if (supportsWebGPU) {
    try {
      // alpha:true erlaubt Alpha-Kanal-Aufnahmen; Clear wird im Normalbetrieb opak gesetzt
      const renderer = new WebGPURenderer({ antialias: true, alpha: true });
      await renderer.init();
      renderer.setClearColor(0x02040a, 1);
      applyRenderFeatures(renderer);
      console.info('[Engine] WebGPU-Renderer aktiv');
      return { renderer: renderer as unknown as EngineRenderer, isWebGPU: true };
    } catch (e) {
      console.warn('[Engine] WebGPU nicht verfügbar, Fallback auf WebGL2:', e);
    }
  } else {
    console.info('[Engine] WebGPU nicht unterstützt → WebGL2');
  }

  const params: WebGLRendererParameters = {
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  };
  const renderer = new WebGLRenderer(params);
  renderer.setClearColor(0x02040a, 1);
  applyRenderFeatures(renderer);
  renderer.debug.checkShaderErrors = true;
  console.info('[Engine] WebGL2-Renderer aktiv');
  return { renderer: renderer as unknown as EngineRenderer, isWebGPU: false };
}
