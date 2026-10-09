import * as THREE from 'three';
import { createRenderer } from './RendererFactory';
import type { EngineRenderer } from './types';
import { PostProcessingManager } from './PostProcessing';
import { createEnvironmentMap, type EnvironmentHandle } from './Environment';
import { CameraSystem } from './CameraSystem';
import { SceneManager } from './SceneManager';
import { VideoOverlay } from './VideoOverlay';
import { BackgroundImage } from './BackgroundImage';
import { TextOverlay } from './TextOverlay';
import { Recorder } from './Recorder';
import { audioEngine } from '../audio/AudioEngine';
import { initMidiLazy } from '../audio/midi';
import { t } from '../core/i18n';
import { onFirstInteraction } from '../core/interaction';
import { useStore } from '../core/store';
import { paletteFor } from '../core/colorPresets';
import type { AudioData, CameraMode, VisualMode, Quality } from '../core/types';
import type { EngineContext } from './scenes/Scene3D';

export class Engine {
  renderer: EngineRenderer | null = null;
  isWebGPU = false;
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera | null = null;

  private post: PostProcessingManager | null = null;
  private environment: EnvironmentHandle | null = null;
  private cameraSystem: CameraSystem | null = null;
  private sceneManager: SceneManager | null = null;
  private video: VideoOverlay | null = null;
  private bg: BackgroundImage | null = null;
  private textOverlay: TextOverlay | null = null;
  recorder: Recorder | null = null;

  private container: HTMLElement | null = null;
  private lastTime = 0;
  private lastMode: VisualMode | null = null;
  private lastCamMode: CameraMode | null = null;
  private lastPostKey = '';
  private fpsTimer = 0;
  private fpsFrames = 0;
  private fpsAccum = 0;
  private lastBeat = false;
  private lastBeatText = '';
  private lastBpm = 0;
  private disposed = false;
  private running = false;
  private lowFpsStreak = 0;
  private lastQuality: Quality | null = null;
  private lastObsMode = false;
  private interactionPulse = 0;
  private lastShaderPreset = '';
  private lastParticleCount = -1;
  private lastParticleSymmetry = -1;
  // Perf: Caches gegen per-Frame-Allokationen
  private paletteCacheKey = '';
  private paletteCache: ReturnType<typeof paletteFor> | null = null;
  private lastPostNums = '';
  private ctxCache: EngineContext | null = null;

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const { renderer, isWebGPU } = await createRenderer();
    this.renderer = renderer;
    this.isWebGPU = isWebGPU;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.008);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
    this.camera.position.set(0, 14, 34);
    // Kamera zur Szene hinzufügen: Shader-Quad & Logo-Overlay hängen an der Kamera
    // und werden vom Renderer NUR gerendert, wenn die Kamera Teil der Szene ist.
    this.scene.add(this.camera);

    // Fotorealistische IBL-Umgebung: subtile Reflexionen + Ambient für PBR-Materialien.
    // Bei Fehlern (z. B. alter GPU) wird ohne Environment weiter gerendert.
    this.environment = createEnvironmentMap(renderer, isWebGPU);
    if (this.environment) {
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = 0.5;
    }

    // Debug-Hook (nur mit ?debug=1 in der URL) – für Diagnose & Inspektion
    if (window.location.search.includes('debug')) {
      (window as unknown as Record<string, unknown>).__avp = { engine: this, scene: this.scene, renderer, THREE, audioEngine };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const dom = renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    dom.style.touchAction = 'none';
    container.appendChild(dom);
    container.addEventListener('pointerdown', this.onPointerDown);
    // GPU-Treiberreset / Kontextverlust: saubere Meldung statt schwarzem Canvas
    dom.addEventListener('webglcontextlost', this.onContextLost);

    this.post = new PostProcessingManager(renderer, isWebGPU, this.scene, this.camera);
    this.cameraSystem = new CameraSystem(this.camera, dom);
    this.video = new VideoOverlay(this.scene, this.camera);
    this.bg = new BackgroundImage(this.scene);
    this.textOverlay = new TextOverlay(this.camera);

    const ctx = this.buildContext();
    // getCtx-Factory: JEDER Szenen-Aufbau (Boot, Modus-Wechsel, Rebuild) bekommt die
    // AKTUELLEN Settings/Palette statt eines veralteten Boot-Snapshots.
    this.sceneManager = new SceneManager(() => this.buildContext());
    this.sceneManager.setMode(ctx.settings.mode);
    this.lastMode = ctx.settings.mode;
    this.lastCamMode = ctx.settings.cameraMode;
    this.lastQuality = ctx.settings.quality;
    this.lastObsMode = ctx.settings.obsMode;
    this.lastShaderPreset = ctx.settings.shaderPreset;
    this.lastParticleCount = ctx.settings.particleCount;
    this.lastParticleSymmetry = ctx.settings.particleSymmetry;
    this.cameraSystem.setMode(ctx.settings.cameraMode, ctx.settings.mode);

    this.recorder = new Recorder(this);
    this.applyPostParams();

    window.addEventListener('resize', this.onResize);
    initMidiLazy(); // MIDI-Zugriff erst bei erster Nutzerinteraktion (kein Boot-Prompt)
    audioEngine.applyVolume(useStore.getState().settings.volume); // gespeicherte Lautstärke anwenden

    // Demo-Synth beim Boot: Analyser früh initialisieren, damit der Beat nach der
    // ersten Geste sofort losgeht (Deep-Link oder gespeichertes demoMode=1).
    if (useStore.getState().settings.demoMode) {
      const el = this.audioElement();
      if (el) void audioEngine.ensureReady(el);
      useStore.getState().setUi({ status: t('status.demoBoot') });
    }
    // Audio-Unlock: AudioContext (resume) erst nach der ersten Nutzergeste
    // (Autoplay-Policy) – startet den Demo-Synth hörbar und die Analyse.
    onFirstInteraction(() => {
      const el = this.audioElement();
      if (el) void audioEngine.ensureReady(el);
    });

    this.lastTime = performance.now();
    this.running = true;
    const loop = (time: number): void => {
      if (!this.running || this.disposed) return;
      this.frame(time);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    console.info('[Engine] Rendering gestartet');
  }

  private frame(time: number): void {
    if (!this.sceneManager || !this.cameraSystem || !this.post || !this.video || !this.bg) return;
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.interactionPulse = Math.max(0, this.interactionPulse - dt * 2.4);
    const { settings, setUi } = useStore.getState();

    // FPS-Messung (throttled)
    this.fpsFrames++;
    this.fpsAccum += dt;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      const fps = Math.round(this.fpsFrames / Math.max(0.001, this.fpsAccum));
      setUi({ fps, loadingScene: this.sceneManager?.isLoadingMode ?? false });
      this.fpsTimer = 0;
      this.fpsFrames = 0;
      this.fpsAccum = 0;

      // Auto-Quality: bei anhaltend niedrigen FPS herunter-, bei stabil hohen schrittweise hochstufen
      if (settings.autoQuality) {
        const { setSetting } = useStore.getState();
        if (fps < 40 && settings.quality === 'ultra') {
          this.lowFpsStreak++;
          if (this.lowFpsStreak >= 3) {
            setSetting('quality', 'high');
            this.lowFpsStreak = 0;
          }
        } else if (fps < 50 && settings.quality === 'high') {
          this.lowFpsStreak++;
          if (this.lowFpsStreak >= 3) {
            setSetting('quality', 'medium');
            this.lowFpsStreak = 0;
          }
        } else if (fps >= 58 && settings.quality === 'medium') {
          // Nur eine Stufe nach oben (medium → high → ultra) – kein Direktsprung,
          // sonst droht Oszillation medium↔ultra auf Grenzsystemen
          this.lowFpsStreak++;
          if (this.lowFpsStreak >= 15) {
            setSetting('quality', 'high');
            this.lowFpsStreak = 0;
          }
        } else if (fps >= 58 && settings.quality === 'high') {
          this.lowFpsStreak++;
          if (this.lowFpsStreak >= 15) {
            setSetting('quality', 'ultra');
            this.lowFpsStreak = 0;
          }
        } else {
          this.lowFpsStreak = Math.max(0, this.lowFpsStreak - 1);
        }
      } else {
        this.lowFpsStreak = 0;
      }
    }

    // OBS-Modus: Qualität/Ansicht automatisch fixieren (16:9-Kamera)
    this.handleObsMode(settings.obsMode);

    // Mode-/Kamera-/Quality-Wechsel erkennen
    if (settings.mode !== this.lastMode) {
      this.lastMode = settings.mode;
      this.sceneManager.setMode(settings.mode);
      // Die neue Szene liest beim init ALLE Settings – Watch-Werte direkt nachziehen,
      // damit die Watches unten nicht im selben Frame doppelt feuern (Look-Preset-Klicks).
      this.lastShaderPreset = settings.shaderPreset;
      this.lastParticleCount = settings.particleCount;
      this.lastParticleSymmetry = settings.particleSymmetry;
    }
    if (settings.quality !== this.lastQuality) {
      this.lastQuality = settings.quality;
      // Qualität beeinflusst init-only Parameter (Partikelzahl) → aktuellen Modus neu bauen.
      // setMode() würde bei unverändertem Modus early-returnen und NICHTS tun.
      this.sceneManager.rebuild();
      this.lastShaderPreset = settings.shaderPreset;
      this.lastParticleCount = settings.particleCount;
      this.lastParticleSymmetry = settings.particleSymmetry;
    }
    if (settings.cameraMode !== this.lastCamMode) {
      this.lastCamMode = settings.cameraMode;
      this.cameraSystem.setMode(settings.cameraMode, settings.mode);
    }

    // Shader-Preset-Änderungen weitergeben (Look-Presets, Deep-Links, Shader-Import) –
    // der Shader-Dropdown ruft zwar applyShader() auf, aber direkte setSetting()-Änderungen
    // (z. B. Look-Preset „Cosmic"/„Synthwave") müssen hier nachgezogen werden.
    if (settings.shaderPreset !== this.lastShaderPreset) {
      this.lastShaderPreset = settings.shaderPreset;
      const ctrl = this.sceneManager.getShaderController();
      if (ctrl) {
        if (settings.shaderPreset === 'custom') ctrl.compileCustom(settings.shaderCode);
        else ctrl.setPreset(settings.shaderPreset);
      }
    }

    // Init-only Settings (Partikel-Anzahl/-Symmetrie) erzwingen einen Szenen-Neubau,
    // damit Look-Presets wie „Default"/„Cosmic Deep" sofort sichtbar wirken.
    // Defensive Rundung: Float-Drift (z. B. durch zukünftige Mapping-Pfade) würde sonst
    // zu einem Rebuild in jedem Frame führen.
    if (
      Math.round(settings.particleCount) !== this.lastParticleCount ||
      Math.round(settings.particleSymmetry) !== this.lastParticleSymmetry
    ) {
      this.lastParticleCount = Math.round(settings.particleCount);
      this.lastParticleSymmetry = Math.round(settings.particleSymmetry);
      this.sceneManager.rebuild();
    }

    const audio = audioEngine.analyze(time);
    const ctx = this.buildContext();
    this.sceneManager.update(dt, time, audio, ctx);
    this.cameraSystem.update(dt, audio, settings.mode);
    this.video.update(dt, time);
    this.bg.update(time, settings, settings.mode);
    this.textOverlay?.update(settings);

    this.applyPostParams();
    // Audio-reaktive PostFX: Zeit/Kick/Energy treiben Grain & Chromatic Aberration an
    this.post?.updateAudio(time / 1000, audio.kickLevel, audio.energy);
    this.post.render();

    // Beat-UI nur bei Änderung aktualisieren
    const beatText = audio.isKick
      ? t('status.kick')
      : audio.bass > settings.kickThreshold * 0.82
        ? t('status.beatActive')
        : t('status.beatReady');
    if (audio.isKick !== this.lastBeat || beatText !== this.lastBeatText || audio.bpm !== this.lastBpm) {
      this.lastBeat = audio.isKick;
      this.lastBeatText = beatText;
      this.lastBpm = audio.bpm;
      setUi({ beatActive: audio.isKick, beatText: audio.bpm ? `${beatText} · ${audio.bpm} BPM` : beatText });
    }
  }

  /** OBS-Modus: automatische 16:9-Kamera-Ansicht + Qualität ultra. */
  private handleObsMode(obs: boolean): void {
    // Während einer Aufnahme NIEMALS die Canvas-Größe ändern – das würde den
    // Capture-Stream korrumpieren. OBS-Ansicht wird nach dem Stop wiederhergestellt.
    if (useStore.getState().ui.recording) return;
    if (obs === this.lastObsMode) {
      if (obs && this.camera && Math.abs(this.camera.aspect - 16 / 9) > 0.02) {
        this.setObsAspect();
      }
      return;
    }
    this.lastObsMode = obs;
    if (obs) {
      useStore.getState().setSetting('cameraMode', 'auto');
      useStore.getState().setSetting('quality', 'ultra');
      if (this.container) this.container.style.display = 'flex';
      this.setObsAspect();
    } else {
      if (this.container) this.container.style.display = '';
      this.onResize();
    }
  }

  private setObsAspect(): void {
    if (!this.renderer || !this.camera) return;
    // Echter 16:9-Letterbox: Renderer auf die 16:9-Box verkleinern und zentrieren
    const w = window.innerWidth;
    const h = window.innerHeight;
    let vw = w;
    let vh = Math.round(w * (9 / 16));
    if (vh > h) {
      vh = h;
      vw = Math.round(h * (16 / 9));
    }
    this.renderer.setSize(vw, vh);
    this.post?.setSize(vw, vh);
    this.camera.aspect = vw / vh;
    this.camera.updateProjectionMatrix();
    const dom = this.renderer.domElement;
    dom.style.width = `${vw}px`;
    dom.style.height = `${vh}px`;
    dom.style.margin = 'auto';
  }

  private applyPostParams(): void {
    const s = useStore.getState().settings;
    const key = [
      s.bloomEnabled, s.vignette, s.fxEnabled, s.fxChromatic,
      s.fxGrain, s.fxScanlines, s.fxGrade, s.alphaRecording
    ].join('|');
    if (key !== this.lastPostKey) {
      this.lastPostKey = key;
      this.post?.setParams({
        enabled: true,
        bloom: s.bloomEnabled,
        vignette: s.vignette,
        // Alpha-Aufnahmen: FX-Layer aus, damit der transparente Hintergrund sauber bleibt
        fx: s.fxEnabled && !s.alphaRecording,
        chromatic: s.fxChromatic,
        grain: s.fxGrain,
        scanlines: s.fxScanlines,
        grade: s.fxGrade
      });
      this.lastPostNums = ''; // Struktur-Neubau → Nummern sicherheitshalber neu setzen
    }
    // Numerische Params nur bei Änderung pushen (setParams allokiert sonst jeden Frame)
    const numsKey = `${s.bloomStrength}|${s.bloomRadius}|${s.bloomThreshold}|${s.fxIntensity}|${s.alphaRecording}`;
    if (numsKey !== this.lastPostNums) {
      this.lastPostNums = numsKey;
      this.post?.setParams({
        strength: s.bloomStrength,
        radius: s.bloomRadius,
        threshold: s.bloomThreshold,
        fxIntensity: s.fxIntensity
      });
    }
  }

  private buildContext(): EngineContext {
    const { settings } = useStore.getState();
    // Palette cachen: paletteFor gibt bei 'custom' jedes Mal ein neues Objekt –
    // das würde sonst in jedem Frame allokiert.
    const palKey = `${settings.preset}|${settings.customAccent}|${settings.customAccent2}`;
    if (palKey !== this.paletteCacheKey || !this.paletteCache) {
      this.paletteCacheKey = palKey;
      this.paletteCache = paletteFor(settings.preset, settings);
    }
    // Context-Objekt wiederverwenden (in-place aktualisieren statt neu alloziieren).
    // Szenen dürfen Referenzen auf scene/camera/renderer halten, aber NIEMALS auf das
    // ctx-Objekt selbst über Frames hinweg – der SceneManager kopiert es pro Update.
    if (!this.ctxCache) {
      this.ctxCache = {
        scene: this.scene!,
        camera: this.camera!,
        renderer: this.renderer!,
        isWebGPU: this.isWebGPU,
        settings,
        palette: this.paletteCache,
        imageTexture: null,
        mode: settings.mode,
        interaction: { pulse: 0 }
      };
    }
    const ctx = this.ctxCache;
    ctx.settings = settings;
    ctx.palette = this.paletteCache;
    ctx.imageTexture = this.bg?.getTexture() ?? null;
    ctx.mode = settings.mode;
    ctx.interaction.pulse = this.interactionPulse;
    return ctx;
  }

  /* --------------------------- UI-Anbindung --------------------------- */

  async playPause(): Promise<void> {
    const el = this.audioElement();
    if (!el) return;
    await audioEngine.ensureReady(el);
    const { setUi } = useStore.getState();
    if (el.paused) {
      await el.play().catch(() => {});
      setUi({ playing: true, status: t('status.playing') });
    } else {
      el.pause();
      setUi({ playing: false, status: t('status.paused') });
    }
  }

  async toggleMicrophone(): Promise<void> {
    const el = this.audioElement();
    if (!el) return;
    const active = await audioEngine.toggleMicrophone(el);
    useStore.getState().setUi({
      micActive: active,
      status: active ? t('status.micOn') : t('status.micOff')
    });
  }

  setBackgroundImage(file: File): void {
    this.bg?.setImage(file);
  }

  setBackgroundImageUrl(url: string): void {
    this.bg?.setImageUrl(url);
  }

  clearBackground(): void {
    this.bg?.clear();
  }

  setOverlayVideo(file: File): void {
    this.video?.setSource(file);
  }

  clearOverlayVideo(): void {
    this.video?.clear();
  }

  /** Preset wechseln oder Custom-GLSL kompilieren (abhängig vom aktuellen Modus) */
  applyShader(name: string, code?: string): { success: boolean; error?: string } {
    const ctrl = this.sceneManager?.getShaderController();
    if (name === 'custom') {
      const src = code ?? useStore.getState().settings.shaderCode;
      if (!ctrl) return { success: true };
      return ctrl.compileCustom(src);
    }
    ctrl?.setPreset(name);
    return { success: true };
  }

  setRecording(active: boolean, resolution = 1920): void {
    if (!this.renderer) return;
    if (active) {
      const h = Math.round(resolution * (9 / 16));
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(resolution, h);
      if (this.camera) {
        this.camera.aspect = 16 / 9;
        this.camera.updateProjectionMatrix();
      }
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.onResize();
    }
  }

  private onPointerDown = (): void => {
    this.interactionPulse = 1;
  };

  /** GPU-Kontext ging verloren (Treiberreset/Überlastung) → Overlay mit Reload-Angebot. */
  private onContextLost = (e: Event): void => {
    e.preventDefault(); // verhindert die Browser-Default-Behandlung (Canvas bleibt schwarz)
    console.error('[Engine] WebGL/GPU-Kontext verloren – Browser/Treiber hat zurückgesetzt.');
    useStore.getState().setUi({ contextLost: true });
  };

  audioElement(): HTMLAudioElement | null {
    return document.getElementById('audio') as HTMLAudioElement | null;
  }

  private onResize = (): void => {
    if (!this.renderer || !this.container) return;
    if (useStore.getState().ui.recording) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (useStore.getState().settings.obsMode) {
      this.setObsAspect();
      return;
    }
    this.renderer.setSize(w, h);
    this.post?.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  };

  /** Szenen-Neubau nach Quality-Wechsel (Partikelzahl etc.) */
  refreshScene(): void {
    // rebuild() statt setMode(): setMode würde bei unverändertem Modus early-returnen.
    this.sceneManager?.rebuild();
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    window.removeEventListener('resize', this.onResize);
    this.container?.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer?.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    // Nur die aktive Szene disposed – setMode('nebula') würde den Modus wechseln
    // und eine neue Szene aufbauen, die dann nie wieder abgeräumt würde.
    this.sceneManager?.dispose();
    this.post?.dispose();
    this.environment?.dispose();
    this.environment = null;
    this.cameraSystem?.dispose();
    this.bg?.dispose();
    this.video?.dispose();
    this.textOverlay?.dispose();
    this.renderer?.domElement.remove();
  }
}

export const engine = new Engine();

export type { AudioData };
