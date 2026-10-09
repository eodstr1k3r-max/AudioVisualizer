/** Pure Audio-Analyse-Helfer – ohne AudioContext/DOM, daher gut testbar. */
import type { KickStyle } from '../core/types';

export const BAND_RANGES = {
  subBass: [0, 4],
  bass: [4, 16],
  mid: [16, 70],
  treble: [70, 160],
  presence: [160, 255],
  energy: [0, 200]
} as const;

export interface BandLevels {
  subBass: number;
  bass: number;
  mid: number;
  treble: number;
  presence: number;
  energy: number;
}

/** Durchschnitt eines Frequenz-Bins 0..1 */
export function averageRange(data: Uint8Array, start: number, end: number): number {
  const s = Math.max(0, start);
  const e = Math.min(data.length, end);
  if (e <= s) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += data[i];
  return sum / (e - s) / 255;
}

/** 5-Band + Gesamt-Energie aus den Frequenzdaten. */
export function computeBands(freqData: Uint8Array): BandLevels {
  return {
    subBass: averageRange(freqData, ...BAND_RANGES.subBass),
    bass: averageRange(freqData, ...BAND_RANGES.bass),
    mid: averageRange(freqData, ...BAND_RANGES.mid),
    treble: averageRange(freqData, ...BAND_RANGES.treble),
    presence: averageRange(freqData, ...BAND_RANGES.presence),
    energy: averageRange(freqData, ...BAND_RANGES.energy)
  };
}

/** RMS-Lautheit 0..1 aus der Waveform. */
export function computeLoudness(waveData: Uint8Array): number {
  let sumSq = 0;
  let samples = 0;
  for (let i = 0; i < waveData.length; i += 4) {
    const v = (waveData[i] - 128) / 128;
    sumSq += v * v;
    samples++;
  }
  if (samples === 0) return 0;
  const rms = Math.sqrt(sumSq / samples);
  return Math.min(1, rms * 2.2);
}

/** Spectral Flux (Onset-Energie) 0..1 aus der Differenz zum vorherigen Frame. */
export function computeSpectralFlux(freqData: Uint8Array, prevFreqData: Uint8Array): number {
  if (freqData.length !== prevFreqData.length) return 0;
  let flux = 0;
  for (let i = 0; i < freqData.length; i += 2) {
    const diff = freqData[i] - prevFreqData[i];
    if (diff > 0) flux += diff;
  }
  return Math.min(1, (flux / (freqData.length * 255)) * 40);
}

/** Lineare Interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface KickResult {
  isKick: boolean;
  strength: number;
  pulse: number;
}

/**
 * Formt den Kick-Puls (0..1, exponentiell abklingend) in den gewählten Visual-Stil.
 * Wirkt auf den `kickLevel`, den alle Szenen konsumieren – ein Ort, alle Effekte.
 * - glow:   weicher, langsamer Abklang (fast unverändert)
 * - pulse:  kürzerer, knackigerer Abklang
 * - flash:  hart an/aus (Blitz)
 * - ripple: Wellen-Impuls mit Punch-Start (0.3 direkt auf dem Hit, dann Welle 0→1→0)
 * - off:    kein Kick-Visual
 */
export function shapeKick(pulse: number, style: KickStyle): number {
  if (style === 'off') return 0;
  if (style === 'flash') return pulse > 0.35 ? 1 : 0;
  if (style === 'ripple') return pulse > 0.85 ? 0.3 : Math.sin(pulse * Math.PI);
  if (style === 'pulse') return Math.pow(pulse, 1.7);
  return Math.pow(pulse, 0.85); // glow (und sicherer Fallback für unbekannte Stile)
}

/**
 * Kick-Detection: Bass über Schwelle + positiver Anstieg + Debounce-Zeit.
 * Liefert den neuen Kick-Puls (0..1, zerfällt mit decay pro Frame) und die Stärke.
 */
export function detectKick(
  bassRaw: number,
  smoothedBass: number,
  threshold: number,
  time: number,
  lastKickAt: number,
  prevPulse: number,
  prevStrength: number,
  decay = 0.88
): KickResult {
  const bassLift = bassRaw - smoothedBass;
  const isKick = bassRaw > threshold && bassLift > 0.045 && time - lastKickAt > 130;

  let pulse = prevPulse * decay;
  let strength = prevStrength * decay;

  if (isKick) {
    pulse = 1.0;
    strength = Math.min(1.0, bassRaw + bassLift * 1.5);
  }

  return { isKick, strength, pulse };
}

/* ------------------------- BPM & Beat-Sync ------------------------- */

export interface TempoState {
  /** geschätztes Tempo in BPM (0 = unbekannt) */
  bpm: number;
  /** Phase im aktuellen Beat 0..1 */
  beatPhase: number;
  /** 1.0 exakt auf dem Beat, abfallend */
  beatPulse: number;
  /** wahr für ~120 ms nach einem Beat */
  onBeat: boolean;
}

export interface TempoTracker {
  /** pro Frame aufrufen; liefert aktuelle Tempo-Metriken */
  tick(timeMs: number, onset: boolean): TempoState;
  /** Tempo extern vorgeben (z. B. Demo-Synth mit bekanntem BPM) */
  forceBpm(bpm: number): void;
  /** BPM-Zustand für Tests/Reset */
  reset(): void;
}

const MIN_INTERVAL = 250; // 240 BPM
const MAX_INTERVAL = 1200; // 50 BPM
const BEAT_WINDOW_MS = 120;

/**
 * Einfacher Onset-basierter Tempo-Tracker.
 * – Sammelt Inter-Onset-Intervalle, wählt das Median-Intervall, wandelt in BPM.
 * – Hält eine Beat-Phase: Zeit seit letztem Beat / Beat-Intervall.
 */
export function createTempoTracker(): TempoTracker {
  let bpm = 0;
  let lastOnset = -10000;
  let lastBeat = -10000;
  let beatIntervalMs = 0; // 60s / bpm * 1000
  const intervals: number[] = [];

  const recalcBpm = (): void => {
    if (intervals.length < 4) return;
    const sorted = [...intervals].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    bpm = 60000 / mid;
    // plausibel halten
    if (bpm < 60) bpm *= 2;
    if (bpm > 220) bpm /= 2;
    bpm = Math.round(bpm);
    beatIntervalMs = 60000 / bpm;
  };

  const tick = (timeMs: number, onset: boolean): TempoState => {
    if (onset) {
      const interval = timeMs - lastOnset;
      if (interval > MIN_INTERVAL && interval < MAX_INTERVAL) {
        intervals.push(interval);
        if (intervals.length > 16) intervals.shift();
        recalcBpm();
        // Jeder detektierte Onset = Beat-Kandidat
        lastBeat = timeMs;
        // lastOnset nur bei gültigem Intervall verschieben – dichte Onset-Bursts
        // (z. B. Hi-Hats) dürfen die Intervall-Messung nicht korrumpieren
        lastOnset = timeMs;
      } else if (interval >= MAX_INTERVAL) {
        // Lange Pause ODER allererster Onset (lastBeat noch nie gesetzt):
        // Messkette neu starten, aber den Beat-Kandidaten trotzdem markieren,
        // damit beatPhase/beatPulse nach forceBpm()/reset() sofort funktionieren
        lastOnset = timeMs;
        lastBeat = timeMs;
      }
      // interval <= MIN_INTERVAL: ignorieren (Burst), lastOnset unverändert
    }

    let beatPulse = 0;
    let onBeat = false;
    let beatPhase = 0;

    if (beatIntervalMs > 0 && timeMs - lastBeat < beatIntervalMs * 2) {
      const sinceBeat = timeMs - lastBeat;
      beatPhase = Math.min(1, sinceBeat / beatIntervalMs);
      // Puls klingt über das GESAMTE Beat-Intervall ab (1 auf dem Beat → 0 vor dem
      // nächsten) – konsistent zu beatPhase, kein harter Schnitt nach 120 ms.
      beatPulse = Math.max(0, 1 - beatPhase);
      onBeat = sinceBeat < BEAT_WINDOW_MS;
    }

    return { bpm, beatPhase, beatPulse, onBeat };
  };

  const forceBpm = (value: number): void => {
    bpm = Math.max(60, Math.min(220, Math.round(value)));
    beatIntervalMs = 60000 / bpm;
  };

  const reset = (): void => {
    bpm = 0;
    lastOnset = -10000;
    lastBeat = -10000;
    beatIntervalMs = 0;
    intervals.length = 0;
  };

  return { tick, forceBpm, reset };
}
