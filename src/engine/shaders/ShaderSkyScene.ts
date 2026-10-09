import * as THREE from 'three';
import { NodeMaterial, type TextureNode } from 'three/webgpu';
import { uniform, texture } from 'three/tsl';
import { shaderPresets, buildCustomGlsl, CUSTOM_GLSL_HEADER, type PresetBuilder, type ShaderUniforms } from './presets';
import { BokehDust } from '../effects/SceneEffects';
import type { Scene3D, EngineContext } from '../scenes/Scene3D';
import type { AudioData } from '../../core/types';

/**
 * Shader-Skybox: Vollbild-Quad an der Kamera mit TSL-Presets.
 * v5: Eine kamera-feste Bokeh-Staubschicht VOR dem Quad sorgt dafür, dass
 * selbst der flächige Shader-Modus echte Parallaxe/Tiefe hat.
 */
export class ShaderSkyScene implements Scene3D {
  private camera: THREE.PerspectiveCamera | null = null;
  private quad: THREE.Mesh | null = null;
  private material: NodeMaterial | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private bokeh: BokehDust | null = null;

  private uTime = uniform(0);
  private uBass = uniform(0);
  private uMid = uniform(0);
  private uTreble = uniform(0);
  private uEnergy = uniform(0);
  private uKick = uniform(0);
  private uBeat = uniform(0);
  private uClick = uniform(0);
  private uResolution = uniform(new THREE.Vector2(1920, 1080));
  private uMouse = uniform(new THREE.Vector2(0, 0));
  private uOpacity = uniform(1);
  private uHasImage = uniform(0);
  private uImage: TextureNode = texture(new THREE.Texture());
  private dummyTexture = new THREE.Texture();

  private currentPreset = 'cybergrid';
  private error: string | null = null;

  get lastError(): string | null {
    return this.error;
  }

  init(ctx: EngineContext): void {
    this.camera = ctx.camera;
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.currentPreset = ctx.settings.shaderPreset;
    const preset = shaderPresets[this.currentPreset] ?? shaderPresets.cybergrid;
    this.buildMaterial(preset.build);

    // Benutzerdefinierter GLSL-Code wird beim Eintreten in die Shader-Modi kompiliert
    if (this.currentPreset === 'custom' && ctx.settings.shaderCode.trim()) {
      this.compileCustom(ctx.settings.shaderCode);
    }

    this.quad = new THREE.Mesh(this.geometry, this.material!);
    this.quad.renderOrder = -2;
    this.quad.frustumCulled = false;
    this.quad.position.set(0, 0, -8);
    this.camera.add(this.quad);
    this.sizeQuad();

    // v5: Bokeh-Tiefenschicht vor dem Quad (kamera-fest → immer sichtbar)
    if (!this.bokeh) {
      const count = ctx.settings.quality === 'ultra' ? 110 : ctx.settings.quality === 'high' ? 80 : 50;
      this.bokeh = new BokehDust(this.camera, count);
    }
  }

  /**
   * Quad auf Vollbildgröße skalieren: Der 2×2-Quad auf z=-8 würde sonst nur ~20 %
   * des Viewports abdecken. Größe wird aus FOV + Aspect des Kameras berechnet
   * (FOV ändert sich durch Zoom/Kick-Punch, Aspect durch Resize).
   */
  private sizeQuad(): void {
    if (!this.quad || !this.camera) return;
    const dist = Math.max(0.1, Math.abs(this.quad.position.z));
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const w = h * this.camera.aspect;
    this.quad.scale.set(Math.max(w, 0.01), Math.max(h, 0.01), 1);
  }

  /** Wechselt auf einen benannten Preset */
  setPreset(name: string): void {
    if (!this.camera) return;
    this.currentPreset = name;
    const preset = shaderPresets[name];
    if (!preset) return;
    this.error = null;
    this.buildMaterial(preset.build);
  }

  /** Kompiliert benutzerdefinierten GLSL-Code */
  compileCustom(code: string): { success: boolean; error?: string } {
    try {
      if (!code.trim()) throw new Error('Shader-Code ist leer');
      if (!code.includes('mainImage')) {
        throw new Error(`Es muss eine Funktion "${CUSTOM_GLSL_HEADER}" definiert sein.`);
      }
      const builder = buildCustomGlsl(code);
      this.error = null;
      this.buildMaterial(builder);
      return { success: true };
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return { success: false, error: this.error };
    }
  }

  private buildMaterial(builder: PresetBuilder): void {
    if (!this.geometry) return;
    this.material?.dispose();

    const material = new NodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = false;
    material.blending = THREE.NormalBlending;
    material.toneMapped = true;

    const uniforms: ShaderUniforms = {
      resolution: this.uResolution,
      time: this.uTime,
      bass: this.uBass,
      mid: this.uMid,
      treble: this.uTreble,
      energy: this.uEnergy,
      kick: this.uKick,
      beat: this.uBeat,
      click: this.uClick,
      image: this.uImage,
      hasImage: this.uHasImage,
      opacity: this.uOpacity
    };

    material.fragmentNode = builder(uniforms);
    material.needsUpdate = true;
    this.material = material;

    if (this.quad) this.quad.material = material;
  }

  update(_dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    if (!this.quad || !this.material) return;

    this.sizeQuad(); // FOV-/Aspect-Änderungen (Zoom, Resize, Kick-Punch) nachziehen

    this.uTime.value = time * 0.001;
    this.uBass.value = audio.bass;
    this.uMid.value = audio.mid;
    this.uTreble.value = audio.treble;
    this.uEnergy.value = audio.energy;
    this.uKick.value = audio.kickLevel;
    this.uBeat.value = audio.beatPulse;
    this.uClick.value = ctx.interaction.pulse;

    const w = ctx.renderer.domElement.width || 1920;
    const h = ctx.renderer.domElement.height || 1080;
    this.uResolution.value.set(w, h);
    this.uOpacity.value = ctx.mode === 'shader' ? 1 : ctx.settings.shaderBlend;

    const hasImage = ctx.imageTexture !== null;
    this.uHasImage.value = hasImage ? 1 : 0;
    this.uImage.value = ctx.imageTexture ?? this.dummyTexture;

    this.bokeh?.update(_dt, time, audio, ctx.palette);
  }

  setMouse(x: number, y: number): void {
    this.uMouse.value.set(x, y);
  }

  dispose(): void {
    if (this.quad && this.camera) this.camera.remove(this.quad);
    this.bokeh?.dispose();
    this.geometry?.dispose();
    this.material?.dispose();
    this.quad = null;
    this.geometry = null;
    this.material = null;
    this.camera = null;
    this.bokeh = null;
  }
}
