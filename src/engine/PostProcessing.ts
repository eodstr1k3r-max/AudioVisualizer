import type { Scene, Camera } from 'three';
import { Vector2 } from 'three';
import { RenderPipeline, WebGPURenderer, type UniformNode } from 'three/webgpu';
import {
  pass, uniform, uv, smoothstep, length, sin, dot, vec2, vec4, float,
  fract, saturation
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { EngineRenderer } from './types';

export interface PostParams {
  enabled: boolean;
  bloom: boolean;
  strength: number;
  radius: number;
  threshold: number;
  vignette: boolean;

  /* v5.0 Cinematic-FX-Stack */
  fx: boolean;
  chromatic: boolean;
  grain: boolean;
  scanlines: boolean;
  grade: boolean;
  fxIntensity: number;
}

/**
 * Kombinierter Cinematic-Pass für das WebGL2-Backend (ein Drawcall für alle
 * Screen-Space-Effekte nach dem Bloom): Chromatic Aberration → Color Grade →
 * Film Grain → Scanlines → Vignette. Identisches Aussehen wie die
 * TSL-Kette des WebGPU-Pfads.
 */
const CINEMATIC_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uKick: { value: 0 },
    uEnergy: { value: 0 },
    uChroma: { value: 1 },
    uGrain: { value: 1 },
    uScan: { value: 0 },
    uGrade: { value: 1 },
    uVignette: { value: 1 },
    uIntensity: { value: 1 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uKick, uEnergy;
    uniform float uChroma, uGrain, uScan, uGrade, uVignette, uIntensity;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 c = vUv - 0.5;
      float d = length(c);
      vec3 col;

      /* Chromatic Aberration – radial, pulst auf Kick + Energy */
      if (uChroma > 0.5) {
        float amt = (0.0016 + uKick * 0.0038 + uEnergy * 0.0012) * uIntensity;
        col.r = texture2D(tDiffuse, vUv - c * amt * 2.2).r;
        col.g = base.g;
        col.b = texture2D(tDiffuse, vUv + c * amt * 2.2).b;
      } else {
        col = base.rgb;
      }

      /* Color Grade: Sättigung + sanfter Film-Kontrast */
      if (uGrade > 0.5) {
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, 1.0 + 0.38 * uIntensity);
        col = clamp((col - 0.5) * (1.0 + 0.14 * uIntensity) + 0.5, 0.0, 1.0);
      }

      /* Animiertes Film-Grain */
      if (uGrain > 0.5) {
        vec2 gp = vUv * 731.7 + uTime * 37.0;
        float n = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        col += n * 0.055 * uIntensity * (1.0 + uKick * 0.6);
      }

      /* CRT-Scanlines */
      if (uScan > 0.5) {
        float line = 0.5 + 0.5 * sin(vUv.y * 1100.0);
        col *= 1.0 - 0.24 * uIntensity * line;
      }

      /* Vignette (identisch zur bisherigen Formel: r = |vUv*2-1|) */
      if (uVignette > 0.5) {
        float vig = 1.0 - 0.5 * smoothstep(0.4, 1.4, d * 2.0);
        col *= vig;
      }

      gl_FragColor = vec4(col, base.a);
    }
  `
};

export class PostProcessingManager {
  private renderer: EngineRenderer;
  private isWebGPU: boolean;
  private scene: Scene;
  private camera: Camera;
  private params: PostParams = {
    enabled: true, bloom: true, strength: 1.4, radius: 0.55, threshold: 0.72,
    vignette: true, fx: true, chromatic: true, grain: true, scanlines: false,
    grade: true, fxIntensity: 1
  };

  private pipeline: RenderPipeline | null = null;
  private composer: EffectComposer | null = null;
  private unrealBloom: UnrealBloomPass | null = null;
  private cinematicPass: ShaderPass | null = null;

  // Live-Uniforms (WebGPU-Pfad)
  private uStrength: UniformNode<'float', number> | null = null;
  private uRadius: UniformNode<'float', number> | null = null;
  private uThreshold: UniformNode<'float', number> | null = null;
  private uCaStrength: UniformNode<'float', number> | null = null;
  private uGrainAmt: UniformNode<'float', number> | null = null;
  private uScanAmt: UniformNode<'float', number> | null = null;
  private uGradeOn: UniformNode<'float', number> | null = null;
  private uTime: UniformNode<'float', number> | null = null;
  private uKick: UniformNode<'float', number> | null = null;
  private uFxIntensity: UniformNode<'float', number> | null = null;

  constructor(renderer: EngineRenderer, isWebGPU: boolean, scene: Scene, camera: Camera) {
    this.renderer = renderer;
    this.isWebGPU = isWebGPU;
    this.scene = scene;
    this.camera = camera;
  }

  setParams(params: Partial<PostParams>): void {
    const prev = this.params;
    const next = { ...prev, ...params };
    const structuralChanged =
      next.enabled !== prev.enabled || next.bloom !== prev.bloom ||
      next.vignette !== prev.vignette || next.fx !== prev.fx ||
      next.chromatic !== prev.chromatic || next.grain !== prev.grain ||
      next.scanlines !== prev.scanlines || next.grade !== prev.grade;
    this.params = next;

    if (structuralChanged) {
      this.rebuild();
    } else if (this.pipeline) {
      if (this.uStrength) this.uStrength.value = next.strength;
      if (this.uRadius) this.uRadius.value = next.radius;
      if (this.uThreshold) this.uThreshold.value = next.threshold;
      if (this.uFxIntensity) this.uFxIntensity.value = next.fx ? next.fxIntensity : 0;
    } else if (this.unrealBloom) {
      this.unrealBloom.strength = next.strength;
      this.unrealBloom.radius = next.radius;
      this.unrealBloom.threshold = next.threshold;
      if (this.cinematicPass) {
        this.cinematicPass.uniforms.uIntensity.value = next.fx ? next.fxIntensity : 0;
      }
    }
  }

  /**
   * Audio-Reaktivität pro Frame: Zeit, Kick-Level und Energy treiben Grain-
   * Animation und Chromatic-Aberration-Pulse an (beide Backends).
   */
  updateAudio(timeSec: number, kick: number, energy: number): void {
    const p = this.params;
    const fxOn = p.fx && p.enabled;
    const caBase = fxOn && p.chromatic ? 0.55 + energy * 0.5 : 0;
    const caKick = fxOn && p.chromatic ? kick * 1.9 : 0;

    if (this.pipeline) {
      if (this.uTime) this.uTime.value = timeSec % 3600;
      if (this.uKick) this.uKick.value = kick;
      if (this.uCaStrength) this.uCaStrength.value = (caBase + caKick) * (p.fxIntensity || 0);
      if (this.uGrainAmt) this.uGrainAmt.value = fxOn && p.grain ? 1 : 0;
      if (this.uScanAmt) this.uScanAmt.value = fxOn && p.scanlines ? 1 : 0;
      if (this.uGradeOn) this.uGradeOn.value = fxOn && p.grade ? 1 : 0;
    } else if (this.cinematicPass) {
      const u = this.cinematicPass.uniforms;
      u.uTime.value = timeSec % 3600;
      u.uKick.value = kick;
      u.uEnergy.value = energy;
      u.uChroma.value = fxOn && p.chromatic ? 1 : 0;
      u.uGrain.value = fxOn && p.grain ? 1 : 0;
      u.uScan.value = fxOn && p.scanlines ? 1 : 0;
      u.uGrade.value = fxOn && p.grade ? 1 : 0;
      u.uVignette.value = p.vignette ? 1 : 0;
      u.uIntensity.value = fxOn ? p.fxIntensity : 0;
    }
  }

  private rebuild(): void {
    this.disposePipeline();
    if (!this.params.enabled) return;

    if (this.isWebGPU) {
      this.buildWebGPU();
    } else {
      this.buildWebGL();
    }
  }

  private buildWebGPU(): void {
    const pipeline = new RenderPipeline(this.renderer as unknown as WebGPURenderer);
    const scenePass = pass(this.scene, this.camera);
    const color = scenePass.getTextureNode('output');
    const p = this.params;

    let node: ReturnType<typeof color.add> = color;

    // 1) Chromatic Aberration auf der Szene (vor dem Bloom, damit Fringe realistisch wirken)
    if (p.fx && p.chromatic) {
      this.uCaStrength = uniform(1.2) as UniformNode<'float', number>;
      node = chromaticAberration(node, this.uCaStrength) as unknown as typeof node;
    }

    // 2) Bloom
    if (p.bloom) {
      this.uStrength = uniform(p.strength) as UniformNode<'float', number>;
      this.uRadius = uniform(p.radius) as UniformNode<'float', number>;
      this.uThreshold = uniform(p.threshold) as UniformNode<'float', number>;
      node = node.add(bloom(color, this.uStrength, this.uRadius, this.uThreshold));
    }

    if (p.fx) {
      this.uFxIntensity = uniform(p.fxIntensity) as UniformNode<'float', number>;
      this.uTime = uniform(0) as UniformNode<'float', number>;
      this.uKick = uniform(0) as UniformNode<'float', number>;
      this.uGrainAmt = uniform(p.grain ? 1 : 0) as UniformNode<'float', number>;
      this.uScanAmt = uniform(p.scanlines ? 1 : 0) as UniformNode<'float', number>;
      this.uGradeOn = uniform(p.grade ? 1 : 0) as UniformNode<'float', number>;

      let col = node.rgb;

      // 3) Color Grade: Sättigung + Film-Kontrast
      if (p.grade) {
        const sat = saturation(col, this.uFxIntensity.mul(0.38).add(1));
        const contrasted = sat.sub(0.5).mul(this.uFxIntensity.mul(0.14).add(1)).add(0.5);
        col = contrasted;
      }

      // 4) Animiertes Film-Grain (hash-basiert, zeitanimiert)
      if (p.grain) {
        const seed = uv().mul(731.7).add(this.uTime.mul(37.0));
        const n = fract(sin(dot(seed, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
        col = col.add(n.mul(this.uGrainAmt).mul(0.055).mul(this.uKick.mul(0.6).add(1)).mul(this.uFxIntensity));
      }

      // 5) CRT-Scanlines
      if (p.scanlines) {
        const line = sin(uv().y.mul(1100)).mul(0.5).add(0.5);
        col = col.mul(float(1).sub(line.mul(0.24).mul(this.uScanAmt).mul(this.uFxIntensity)));
      }

      node = vec4(col, 1);
    }

    // 6) Vignette (immer als letzter Schritt, identisch zur WebGL-Formel)
    if (p.vignette) {
      const v = uv().mul(2).sub(1);
      const vig = smoothstep(0.4, 1.4, length(v)).mul(0.5).oneMinus();
      node = node.mul(vig);
    }

    pipeline.outputNode = node;
    this.pipeline = pipeline;
  }

  private buildWebGL(): void {
    const w = this.renderer.domElement.width || 1920;
    const h = this.renderer.domElement.height || 1080;
    const composer = new EffectComposer(this.renderer as never);
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.params.bloom) {
      this.unrealBloom = new UnrealBloomPass(new Vector2(w, h), this.params.strength, this.params.radius, this.params.threshold);
      composer.addPass(this.unrealBloom);
    }

    // Kombinierter Cinematic-Pass (CA + Grade + Grain + Scanlines + Vignette)
    this.cinematicPass = new ShaderPass(CINEMATIC_SHADER);
    composer.addPass(this.cinematicPass);

    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  render(): void {
    if (this.pipeline) {
      this.pipeline.render();
    } else if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h);
    this.unrealBloom?.setSize(w, h);
  }

  private disposePipeline(): void {
    this.pipeline?.dispose();
    this.pipeline = null;
    this.composer?.dispose();
    this.composer = null;
    this.unrealBloom = null;
    this.cinematicPass = null;
    this.uStrength = null;
    this.uRadius = null;
    this.uThreshold = null;
    this.uCaStrength = null;
    this.uGrainAmt = null;
    this.uScanAmt = null;
    this.uGradeOn = null;
    this.uTime = null;
    this.uKick = null;
    this.uFxIntensity = null;
  }

  dispose(): void {
    this.disposePipeline();
  }
}
