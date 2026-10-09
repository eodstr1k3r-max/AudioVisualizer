import * as THREE from 'three';
import { useStore } from '../core/store';
import { useScreenshotStore } from '../core/screenshotStore';
import { useRecordingStore } from '../core/recordingStore';
import { t } from '../core/i18n';
import { sessionStats } from '../core/sessionStats';
import { MODES, type RecordCodec, type RecordQuality } from '../core/types';
import { audioEngine } from '../audio/AudioEngine';
import type { Engine } from './Engine';

/** Renderer-Clear-API (WebGLRenderer & WebGPURenderer teilen sich diese Methoden). */
interface ClearApi {
  setClearColor: (color: THREE.ColorRepresentation, alpha?: number) => void;
  getClearColor: (target: THREE.Color) => THREE.Color;
  getClearAlpha: () => number;
}

interface CodecDef {
  /** Kandidaten-MIME-Types, in Prioritätsreihenfolge. */
  mimes: string[];
  extension: 'webm' | 'mp4';
}

const CODECS: Record<'vp9' | 'av1' | 'h264', CodecDef> = {
  vp9: { mimes: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm'], extension: 'webm' },
  av1: { mimes: ['video/webm;codecs=av01,opus', 'video/webm;codecs=av01'], extension: 'webm' },
  h264: { mimes: ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'], extension: 'mp4' }
};

/**
 * Wählt den bestmöglichen unterstützten Codec.
 * Alpha ist nur mit WebM (VP9/AV1) möglich – MP4/H.264 unterstützt kein Alpha.
 * 'auto' bevorzugt VP9 (beste Qualität/Perf-Balance), danach AV1, dann H.264.
 */
export function resolveCodec(pref: RecordCodec, alpha: boolean): { mimeType: string; extension: 'webm' | 'mp4' } {
  let order: ('vp9' | 'av1' | 'h264')[];
  if (alpha) {
    order = pref === 'av1' ? ['av1', 'vp9'] : ['vp9', 'av1'];
  } else if (pref === 'auto') {
    order = ['vp9', 'av1', 'h264'];
  } else {
    const rest = (['vp9', 'av1', 'h264'] as const).filter((x) => x !== pref);
    order = [pref, ...rest];
  }
  for (const id of order) {
    for (const mime of CODECS[id].mimes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        return { mimeType: mime, extension: CODECS[id].extension };
      }
    }
  }
  return { mimeType: '', extension: 'webm' }; // '' → Browser-Default
}

/** Bitrate an Auflösung, FPS & Qualitätsstufe koppeln (Basis ~14 Mbps @ 1080p60/medium). */
export function computeBitrate(resolution: number, fps: number, quality: RecordQuality = 'medium'): number {
  const w = resolution;
  const h = Math.round(resolution * (9 / 16));
  const factor = quality === 'low' ? 0.5 : quality === 'high' ? 1.5 : 1.0;
  const bitrate = Math.round(14_000_000 * ((w * h) / (1920 * 1080)) * (fps / 60) * factor);
  return Math.max(2_500_000, bitrate);
}

export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private savedBackground: unknown = null;
  private savedClearColor = new THREE.Color(0x02040a);
  private savedClearAlpha = 1;
  private startTs = 0;
  private accumulatedMs = 0;
  private timer: number | null = null;
  private alpha = false;
  private extension: 'webm' | 'mp4' = 'webm';
  private paused = false;
  private maxSeconds = 0;

  constructor(private engine: Engine) {}

  async start(): Promise<void> {
    if (this.mediaRecorder || !this.engine.renderer) return;

    const settings = useStore.getState().settings;
    const resolution = parseInt(settings.recordResolution, 10) || 1920;
    const fps = settings.recordFps === 24 ? 24 : settings.recordFps === 30 ? 30 : 60;
    this.alpha = settings.alphaRecording;
    this.maxSeconds = Math.max(0, settings.recordMaxSeconds || 0);

    try {
      this.engine.setRecording(true, resolution);
      const canvas = this.engine.renderer.domElement;

      if (this.alpha) this.applyAlphaBackground();

      const stream = canvas.captureStream(fps);

      // Audio: bevorzugt der gemeinsame WebAudio-Ausgang (Datei + Demo-Synth +
      // Mikrofon, inkl. Bass-Boost). audioElement.captureStream() wäre nach
      // createMediaElementSource stumm – nur als Fallback vor der AudioEngine-Init.
      const audioStream =
        audioEngine.getRecordStream() ?? (document.getElementById('audio') as HTMLAudioElement | null)?.captureStream?.();
      if (audioStream) {
        audioStream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }

      const codec = resolveCodec(settings.recordCodec, this.alpha);
      this.extension = codec.extension;
      const options: MediaRecorderOptions = { videoBitsPerSecond: computeBitrate(resolution, fps, settings.recordQuality) };
      if (codec.mimeType) options.mimeType = codec.mimeType;

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      this.mediaRecorder.onerror = (e) => {
        console.error('Recording-Fehler:', e);
        this.abort();
      };
      this.mediaRecorder.onstop = () => this.finalize();
      this.mediaRecorder.start(500); // 2×/s Data-Chunks → flüssige Live-Größe

      this.paused = false;
      this.accumulatedMs = 0;
      this.startTs = performance.now();
      this.startTimer();
      this.pushStatus(resolution, fps);
    } catch (e) {
      console.error('Recording fehlgeschlagen:', e);
      this.engine.setRecording(false);
      this.restoreBackground();
      useStore.getState().setUi({ status: t('status.recFailed') });
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /** Umschalter für den Panel-Button (Pause ↔ Resume). */
  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  pause(): void {
    if (!this.mediaRecorder || this.paused) return;
    if (this.mediaRecorder.state === 'recording') this.mediaRecorder.pause();
    this.paused = true;
    this.accumulatedMs += performance.now() - this.startTs;
    this.stopTimer();
    this.syncUi(true);
    useStore.getState().setUi({ status: t('status.recPaused') });
  }

  resume(): void {
    if (!this.mediaRecorder || !this.paused) return;
    if (this.mediaRecorder.state === 'paused') this.mediaRecorder.resume();
    this.paused = false;
    this.startTs = performance.now();
    this.startTimer();
    useStore.getState().setUi({ status: t('status.recRunning') });
  }

  /* ------------------------------ Live-Anzeige ------------------------------ */

  private startTimer(): void {
    this.stopTimer();
    this.timer = window.setInterval(() => this.syncUi(false), 500);
    this.syncUi(false);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private syncUi(forcePaused: boolean): void {
    const elapsed = this.accumulatedMs + (this.paused || forcePaused ? 0 : performance.now() - this.startTs);
    const seconds = Math.floor(elapsed / 1000);
    const bytes = this.chunks.reduce((n, c) => n + c.size, 0);
    useStore.getState().setUi({ recSeconds: seconds, recSizeBytes: bytes });
    // Auto-Stopp: nach dem Zeitlimit sauber beenden (nicht im Pause-Zustand)
    if (!this.paused && this.maxSeconds > 0 && elapsed >= this.maxSeconds * 1000) {
      this.stop();
    }
  }

  private pushStatus(resolution: number, fps: number): void {
    useStore.getState().setUi({
      recording: true,
      recPaused: false,
      recSeconds: 0,
      recSizeBytes: 0,
      status: `${resolution}p @ ${fps}fps${this.alpha ? ' · Alpha' : ''} · ${t('status.recRunning')}`
    });
  }

  /* ------------------------------ Export & Aufräumen ------------------------------ */

  private finalize(): void {
    const type = this.extension === 'mp4' ? 'video/mp4' : 'video/webm';
    const blob = new Blob(this.chunks, { type });
    const url = URL.createObjectURL(blob);
    const { settings } = useStore.getState();
    const meta = MODES.find((m) => m.id === settings.mode);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const duration = Math.floor((this.accumulatedMs + (this.paused ? 0 : performance.now() - this.startTs)) / 1000);

    // In die Aufnahme-Galerie legen (Vorschau + Download dort) statt sofort zu laden
    useRecordingStore.getState().add({
      url,
      blob,
      filename: `visualizer-${settings.mode}-${stamp}${this.alpha ? '-alpha' : ''}.${this.extension}`,
      mode: settings.mode,
      modeLabel: meta?.label ?? settings.mode,
      timestamp: Date.now(),
      duration,
      sizeBytes: blob.size,
      extension: this.extension
    });

    this.stopTimer();
    this.mediaRecorder = null;
    this.engine.setRecording(false);
    this.restoreBackground();
    useStore.getState().setUi({
      recording: false,
      recPaused: false,
      recSeconds: 0,
      recSizeBytes: 0,
      status: t('status.recSaved')
    });
  }

  /** Fehler/Abort: Aufnahme verwerfen und Zustand sauber zurücksetzen. */
  private abort(): void {
    this.stopTimer();
    const mr = this.mediaRecorder;
    this.mediaRecorder = null;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = null;
      try { mr.stop(); } catch { /* noop */ }
    }
    this.chunks = [];
    this.engine.setRecording(false);
    this.restoreBackground();
    useStore.getState().setUi({
      recording: false,
      recPaused: false,
      recSeconds: 0,
      recSizeBytes: 0,
      status: t('status.recFailed')
    });
  }

  /** Alpha-Aufnahme: Hintergrund transparent schalten (Klarbild + Hintergrund sichern). */
  private applyAlphaBackground(): void {
    if (!this.engine.scene || !this.engine.renderer) return;
    const renderer = this.engine.renderer as unknown as ClearApi;
    this.savedBackground = this.engine.scene.background;
    renderer.getClearColor(this.savedClearColor);
    this.savedClearAlpha = renderer.getClearAlpha();
    this.engine.scene.background = null;
    renderer.setClearColor(0x000000, 0);
  }

  /** Hintergrund & Clear-Farbe nach der Alpha-Aufnahme exakt wiederherstellen. */
  private restoreBackground(): void {
    if (!this.engine.scene) return;
    const renderer = this.engine.renderer as unknown as ClearApi;
    this.engine.scene.background = (this.savedBackground as THREE.Color | THREE.Texture | null) ?? new THREE.Color(0x02040a);
    renderer.setClearColor(this.savedClearColor, this.savedClearAlpha);
  }

  /**
   * Screenshot fürs visuelle Review aufnehmen: landet in der In-App-Galerie
   * (mit Szene/Backend/Zeitpunkt/Auflösung als Metadaten). Download & Kopieren
   * übernimmt die Galerie – so lassen sich Änderungen dokumentieren & vergleichen.
   */
  async snapshot(): Promise<void> {
    const renderer = this.engine.renderer;
    if (!renderer) return;

    try {
      const canvas = renderer.domElement;
      const dataUrl = canvas.toDataURL('image/png');
      const { settings } = useStore.getState();
      const meta = MODES.find((m) => m.id === settings.mode);
      useScreenshotStore.getState().add({
        dataUrl,
        mode: settings.mode,
        modeLabel: meta?.label ?? settings.mode,
        backend: this.engine.isWebGPU ? 'WebGPU' : 'WebGL2',
        timestamp: Date.now(),
        width: canvas.width,
        height: canvas.height
      });
      sessionStats.snapshots++;
      // flashTick triggert den Kamera-Blitz in der UI (Feedback, dass ausgelöst wurde)
      useStore.getState().setUi({ status: t('status.snapGallerySaved'), flashTick: Date.now() });
    } catch (e) {
      console.error('Snapshot fehlgeschlagen:', e);
      useStore.getState().setUi({ status: t('status.snapFailed') });
    }
  }
}
