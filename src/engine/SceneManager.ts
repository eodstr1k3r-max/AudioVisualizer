import * as THREE from 'three';
import type { AudioData, VisualMode } from '../core/types';
import type { EngineContext, Scene3D } from './scenes/Scene3D';
import { NebulaScene } from './scenes/NebulaScene';
import { SpectrumScene } from './scenes/SpectrumScene';
import { TunnelScene } from './scenes/TunnelScene';
import { TerrainScene } from './scenes/TerrainScene';
import { SphereScene } from './scenes/SphereScene';
import { RippleScene } from './scenes/RippleScene';
import { ShaderSkyScene } from './shaders/ShaderSkyScene';
import { FusionScene } from './scenes/FusionScene';
import { AtmosphereFX } from './effects/AtmosphereFX';

export interface ShaderController {
  setPreset(name: string): void;
  compileCustom(code: string): { success: boolean; error?: string };
}

/**
 * Die ursprünglichen 8 Szenen sind klein und werden eager (statisch) importiert –
 * sie waren schon immer Teil des Hauptbundles. Alle später hinzugekommenen,
 * deutlich größeren Weltraum-/Natur-Szenen werden per dynamic import() erst beim
 * ersten Aufruf nachgeladen (Code-Splitting) und danach für die Session gecached.
 * Das hält das initiale Bundle klein, ohne die Umschalt-Logik zu verkomplizieren:
 * Bis eine lazy Szene geladen ist, bleibt einfach die vorherige Szene sichtbar.
 */
const lazyFactories: Partial<Record<VisualMode, () => Promise<Scene3D>>> = {
  solarsystem: async () => new (await import('./scenes/SolarSystemScene')).SolarSystemScene(),
  eclipse: async () => new (await import('./scenes/EclipseScene')).EclipseScene(),
  spaceeclipse: async () => new (await import('./scenes/SpaceEclipseScene')).SpaceEclipseScene(),
  aurora: async () => new (await import('./scenes/AuroraScene')).AuroraScene(),
  volcano: async () => new (await import('./scenes/VolcanoScene')).VolcanoScene(),
  storm: async () => new (await import('./scenes/StormScene')).StormScene(),
  reef: async () => new (await import('./scenes/ReefScene')).ReefScene(),
  blackhole: async () => new (await import('./scenes/BlackHoleScene')).BlackHoleScene(),
  comet: async () => new (await import('./scenes/CometScene')).CometScene(),
  cyberpunk: async () => new (await import('./scenes/CyberpunkScene')).CyberpunkScene(),
  crystalcave: async () => new (await import('./scenes/CrystalCaveScene')).CrystalCaveScene()
};

export class SceneManager {
  private scenes: Partial<Record<VisualMode, Scene3D>>;
  private current: VisualMode = 'nebula';
  /** Wurde die aktuelle Szene bereits initialisiert? (Boot-Modus darf nicht übersprungen werden) */
  private initialized = false;
  /** Modus, dessen Lazy-Chunk gerade nachgeladen wird (verhindert veraltete Switches nach schnellem Weiterklicken) */
  private pendingLoad: VisualMode | null = null;
  /** Globales Tiefen-Layer (Staub + Kick-Schockwellen), liegt über JEDER Szene */
  private atmosphere: AtmosphereFX | null = null;
  /** Wiederverwendeter Frame-Context (keine Allokation pro Frame) */
  private frameCtx: EngineContext | null = null;

  constructor(private getCtx: () => EngineContext) {
    this.scenes = {
      nebula: new NebulaScene(),
      spectrum: new SpectrumScene(),
      tunnel: new TunnelScene(),
      terrain: new TerrainScene(),
      sphere: new SphereScene(),
      ripples: new RippleScene(),
      shader: new ShaderSkyScene(),
      fusion: new FusionScene()
    };
  }

  get currentMode(): VisualMode {
    return this.current;
  }

  /** True, solange eine lazy Szene im Hintergrund nachgeladen wird (z. B. für einen dezenten Lade-Hinweis in der UI). */
  get isLoadingMode(): boolean {
    return this.pendingLoad !== null;
  }

  setMode(mode: VisualMode): void {
    // Gleicher Modus + bereits initialisiert → kein Neuaufbau nötig.
    if (mode === this.current && this.initialized) {
      this.pendingLoad = null;
      return;
    }

    const cached = this.scenes[mode];
    if (cached) {
      this.pendingLoad = null;
      this.switchTo(mode, cached);
      return;
    }

    const factory = lazyFactories[mode];
    if (!factory) {
      console.error(`Unbekannter Visual-Modus: "${mode}"`);
      return;
    }

    // Chunk wird nachgeladen – die aktuell sichtbare Szene bleibt bis dahin aktiv.
    this.pendingLoad = mode;
    factory()
      .then((instance) => {
        this.scenes[mode] = instance;
        // Nur wechseln, wenn der Nutzer in der Zwischenzeit nicht schon einen anderen Modus gewählt hat.
        if (this.pendingLoad === mode) {
          this.pendingLoad = null;
          this.switchTo(mode, instance);
        }
      })
      .catch((e) => {
        console.error(`Lazy-Load-Fehler der Szene "${mode}":`, e);
        if (this.pendingLoad === mode) this.pendingLoad = null;
      });
  }

  private switchTo(mode: VisualMode, instance: Scene3D): void {
    if (this.initialized) {
      try {
        this.scenes[this.current]?.dispose();
      } catch (e) {
        console.error('Dispose-Fehler:', e);
      }
    }
    this.current = mode;
    try {
      // Frischer Context: aktuelle Settings/Palette/Interaktion statt Boot-Snapshot
      const ctx = this.getCtx();
      this.resetAtmosphere(ctx);
      instance.init(ctx);
      this.attachAtmosphere(ctx);
      // Flag erst NACH erfolgreichem Init setzen, damit ein fehlgeschlagener
      // Aufbau (z. B. Shader-Kompilierungsfehler) beim nächsten Versuch retrybar ist.
      this.initialized = true;
    } catch (e) {
      console.error(`Init-Fehler der Szene "${mode}":`, e);
    }
  }

  /**
   * Legt das globale AtmosphereFX-Layer (3D-Tiefenstaub + Kick-Schockwellen)
   * über die aktive Szene – so hat JEDER Modus dieselbe audio-reaktive
   * Grundatmosphäre, ohne dass alle 19 Szenen es einzeln einbauen müssen.
   */
  private attachAtmosphere(ctx: EngineContext): void {
    this.atmosphere?.dispose();
    this.atmosphere = null;
    try {
      this.atmosphere = new AtmosphereFX();
      this.atmosphere.init(ctx.scene, ctx.settings.quality);
    } catch (e) {
      console.warn('AtmosphereFX nicht verfügbar:', e);
      this.atmosphere = null;
    }
  }

  /**
   * Setzt globale Szenen-Atmosphäre (Hintergrund, Nebel, IBL-Intensität) auf die
   * Defaults zurück, BEVOR eine Szene initialisiert wird. Szenen dürfen diese Werte
   * in ihrem `init()` frei überschreiben, ohne dass sie in den nächsten Modus leaken.
   */
  private resetAtmosphere(ctx: EngineContext): void {
    ctx.scene.background = new THREE.Color(0x02040a);
    ctx.scene.fog = new THREE.FogExp2(0x02040a, 0.008);
    ctx.scene.environmentIntensity = 0.5;
  }

  update(dt: number, time: number, audio: AudioData, ctx: EngineContext): void {
    const scene = this.scenes[this.current];
    if (!scene) return;
    // Persistentes Context-Objekt in-place aktualisieren → keine Frame-Allokation
    if (this.frameCtx) {
      Object.assign(this.frameCtx, ctx);
    } else {
      this.frameCtx = { ...ctx };
    }
    this.frameCtx.mode = this.current;
    try {
      scene.update(dt, time, audio, this.frameCtx);
    } catch (e) {
      console.error('Update-Fehler:', e);
    }
    this.atmosphere?.update(dt, audio, ctx.palette);
  }

  /** Baut die aktuelle Szene neu (init-only Settings wie particleCount/Symmetrie/Qualität). */
  rebuild(): void {
    const scene = this.scenes[this.current];
    if (!scene) return;
    try {
      scene.dispose();
    } catch (e) {
      console.error('Dispose-Fehler:', e);
    }
    this.initialized = true;
    try {
      const ctx = this.getCtx();
      this.resetAtmosphere(ctx);
      scene.init(ctx);
      this.attachAtmosphere(ctx);
    } catch (e) {
      console.error(`Re-Init-Fehler der Szene "${this.current}":`, e);
    }
  }

  /** Liefert den Shader-Controller der aktiven Shader-fähigen Szene */
  getShaderController(): ShaderController | null {
    const scene = this.scenes[this.current];
    if (scene instanceof ShaderSkyScene || scene instanceof FusionScene) {
      return scene;
    }
    return null;
  }

  /** Teardown: disposed NUR die aktuelle Szene – ohne Neu-Initialisierung. */
  dispose(): void {
    const scene = this.scenes[this.current];
    try {
      scene?.dispose();
    } catch (e) {
      console.error('Dispose-Fehler:', e);
    }
    this.atmosphere?.dispose();
    this.atmosphere = null;
    this.initialized = false;
    this.pendingLoad = null;
  }
}
