import { useStore } from '../core/store';
import type { AudioData } from '../core/types';
import {
  computeBands, computeLoudness, computeSpectralFlux, detectKick, lerp, shapeKick,
  createTempoTracker, type TempoTracker
} from './bands';
import { demoSynth } from './DemoSynth';

const WORKLET_CODE = `
class AudioAnalysisProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('audio-analysis-processor', AudioAnalysisProcessor);
`;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private waveData: Uint8Array<ArrayBuffer> | null = null;
  private prevFreqData: Uint8Array<ArrayBuffer> | null = null;
  micActive = false;

  private lastAudioData: AudioData | null = null;

  private smoothedEnergy = 0.08;
  private smoothedSubBass = 0.08;
  private smoothedBass = 0.08;
  private smoothedMid = 0.08;
  private smoothedTreble = 0.08;
  private smoothedPresence = 0.08;
  private smoothedLoudness = 0.05;
  private smoothedFlux = 0;

  private kickPulse = 0;
  private kickStrength = 0;
  private lastKickAt = -10000;
  private tempo: TempoTracker = createTempoTracker();
  private lastDemoMode = false;
  private lastDemoBpm = 0;

  async init(audioElement: HTMLAudioElement): Promise<void> {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    const ctx = this.ctx;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = useStore.getState().settings.smoothing;

    this.bassFilter = ctx.createBiquadFilter();
    this.bassFilter.type = 'lowshelf';
    this.bassFilter.frequency.setValueAtTime(120, ctx.currentTime);
    this.bassFilter.gain.setValueAtTime(useStore.getState().settings.bassBoost, ctx.currentTime);

    this.trebleFilter = ctx.createBiquadFilter();
    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.frequency.setValueAtTime(6000, ctx.currentTime);
    this.trebleFilter.gain.setValueAtTime(2.0, ctx.currentTime);

    this.sourceNode = ctx.createMediaElementSource(audioElement);
    this.sourceNode.connect(this.bassFilter);
    this.bassFilter.connect(this.trebleFilter);
    this.trebleFilter.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveData = new Uint8Array(this.analyser.fftSize);
    this.prevFreqData = new Uint8Array(this.analyser.frequencyBinCount);

    // AudioWorklet (off-main-thread Analyse, optional)
    if (ctx.audioWorklet) {
      try {
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        const node = new AudioWorkletNode(ctx, 'audio-analysis-processor');
        node.port.onmessage = () => { /* PCM steht für zukünftige Nutzung bereit */ };
        this.trebleFilter.connect(node);
        node.connect(ctx.destination);
      } catch (e) {
        console.warn('AudioWorklet Fallback:', e);
      }
    }
  }

  async ensureReady(audioElement: HTMLAudioElement): Promise<void> {
    await this.init(audioElement);
    if (this.ctx && this.ctx.state === 'suspended') {
      // Ohne Nutzergeste lehnt der Browser resume() ab – kein unhandled Rejection,
      // der nächste ensureReady-Aufruf (nach einer Geste) holt es nach.
      await this.ctx.resume().catch(() => {});
    }
  }

  async toggleMicrophone(audioElement: HTMLAudioElement): Promise<boolean> {
    await this.init(audioElement);
    const ctx = this.ctx;
    if (!ctx) return false;

    if (this.micActive) {
      this.micStream?.getTracks().forEach((t) => t.stop());
      this.micStream = null;
      this.micSourceNode?.disconnect();
      this.micSourceNode = null;
      try { this.sourceNode?.connect(this.bassFilter!); } catch { /* noop */ }
      this.micActive = false;
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      try { this.sourceNode?.disconnect(); } catch { /* noop */ }
      this.micSourceNode = ctx.createMediaStreamSource(stream);
      this.micSourceNode.connect(this.bassFilter!);
      this.micStream = stream;
      this.micActive = true;
      if (ctx.state === 'suspended') await ctx.resume();
      return true;
    } catch (err) {
      console.error('Mikrofon-Zugriff verweigert:', err);
      return false;
    }
  }

  setSmoothing(v: number): void {
    if (this.analyser) this.analyser.smoothingTimeConstant = v;
  }

  /** Demo-Synth an/aus – folgt den Settings (demoMode, demoBpm). */
  syncDemo(): void {
    const settings = useStore.getState().settings;
    if (settings.demoMode !== this.lastDemoMode) {
      this.lastDemoMode = settings.demoMode;
      if (settings.demoMode) {
        if (this.ctx && this.analyser) {
          demoSynth.start(this.ctx, this.analyser);
          demoSynth.setBpm(settings.demoBpm);
          demoSynth.setVolume(settings.volume); // gespeicherte Lautstärke anwenden (start() setzt 0.5 hart)
          this.tempo.forceBpm(settings.demoBpm);
          this.lastDemoBpm = settings.demoBpm;
        } else {
          // Engine/Analyser noch nicht bereit – im nächsten Frame nachholen
          this.lastDemoMode = false;
        }
      } else {
        demoSynth.stop();
      }
    } else if (settings.demoMode && settings.demoBpm !== this.lastDemoBpm) {
      demoSynth.setBpm(settings.demoBpm);
      this.tempo.forceBpm(settings.demoBpm);
      this.lastDemoBpm = settings.demoBpm;
    }
  }

  setBassBoost(gain: number): void {
    if (this.bassFilter && this.ctx) {
      this.bassFilter.gain.setValueAtTime(gain, this.ctx.currentTime);
    }
  }

  /** Master-Lautstärke 0..1 – wirkt auf Datei-Playback UND Demo-Synth. */
  applyVolume(v: number): void {
    const el = document.getElementById('audio') as HTMLAudioElement | null;
    if (el) el.volume = Math.max(0, Math.min(1, v));
    demoSynth.setVolume(v);
  }

  analyze(time: number): AudioData {
    if (!this.analyser || !this.freqData || !this.waveData || !this.prevFreqData) {
      return {
        energy: 0.1, subBass: 0.1, bass: 0.1, mid: 0.1, treble: 0.1, presence: 0.1,
        isKick: false, kickLevel: 0, freqData: null, waveData: null, loudness: 0.05, spectralFlux: 0,
        bpm: 0, beatPhase: 0, beatPulse: 0, onBeat: false
      };
    }

    this.syncDemo();

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.waveData);

    const raw = computeBands(this.freqData);
    const subBassRaw = raw.subBass;
    const bassRaw = raw.bass;
    const midRaw = raw.mid;
    const trebleRaw = raw.treble;
    const presenceRaw = raw.presence;
    const energyRaw = raw.energy;

    // RMS-Lautheit aus der Waveform
    this.smoothedLoudness = lerp(this.smoothedLoudness, computeLoudness(this.waveData), 0.25);

    // Spectral Flux (Onset-Detektion)
    this.smoothedFlux = lerp(this.smoothedFlux, computeSpectralFlux(this.freqData, this.prevFreqData), 0.35);

    // BPM / Beat-Sync (Onset = Flux-Spitze oder Kick)
    const settings = useStore.getState().settings;
    const onset = this.smoothedFlux > 0.5 || bassRaw > settings.kickThreshold * 0.95;
    const tempo = this.tempo.tick(time, onset);
    const kick = detectKick(
      bassRaw, this.smoothedBass, settings.kickThreshold,
      time, this.lastKickAt, this.kickPulse, this.kickStrength
    );
    this.kickPulse = kick.pulse;
    this.kickStrength = kick.strength;
    if (kick.isKick) this.lastKickAt = time;

    this.smoothedSubBass = lerp(this.smoothedSubBass, subBassRaw, 0.16);
    this.smoothedBass = lerp(this.smoothedBass, bassRaw, 0.14);
    this.smoothedMid = lerp(this.smoothedMid, midRaw, 0.12);
    this.smoothedTreble = lerp(this.smoothedTreble, trebleRaw, 0.12);
    this.smoothedPresence = lerp(this.smoothedPresence, presenceRaw, 0.1);
    this.smoothedEnergy = lerp(this.smoothedEnergy, energyRaw, 0.1);

    // Kick-Visual-Stil anwenden (glow/pulse/flash/ripple/off) – wirkt auf alle Szenen
    const kickLevel = shapeKick(this.kickPulse, settings.kickStyle) * settings.kickVisualStrength;

    this.prevFreqData.set(this.freqData);

    this.lastAudioData = {
      energy: this.smoothedEnergy,
      subBass: this.smoothedSubBass,
      bass: this.smoothedBass,
      mid: this.smoothedMid,
      treble: this.smoothedTreble,
      presence: this.smoothedPresence,
      isKick: kick.isKick,
      kickLevel,
      freqData: this.freqData,
      waveData: this.waveData,
      loudness: this.smoothedLoudness,
      spectralFlux: this.smoothedFlux,
      bpm: tempo.bpm,
      beatPhase: tempo.beatPhase,
      beatPulse: tempo.beatPulse,
      onBeat: tempo.onBeat
    };

    // Gecachtes Objekt direkt zurückgeben statt ein zweites identisches zu bauen
    // (spart eine Objekt-Allokation pro Frame). AudioData ist read-only per Konvention.
    return this.lastAudioData;
  }

  /** Aktuelles AudioData für externe Abnehmer (z. B. Live-Monitor). */
  getLastAudioData(): AudioData | null {
    return this.lastAudioData;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * MediaStream des GESAMTEN Audio-Ausgangs (Datei + Demo-Synth + Mikrofon) für
   * Aufnahmen. Der Analyser ist der gemeinsame Konvergenzpunkt aller Quellen –
   * ein daran gekoppelter MediaStreamAudioDestinationNode liefert alles hörbare
   * Signal inkl. Bass-Boost. (audioElement.captureStream() wäre nach
   * createMediaElementSource stumm, weil der Ausgang in den WebAudio-Graph umgeleitet wird.)
   */
  getRecordStream(): MediaStream | null {
    if (!this.ctx || !this.analyser) return null;
    if (!this.recordDest) {
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.analyser.connect(this.recordDest);
    }
    return this.recordDest.stream;
  }
}

export const audioEngine = new AudioEngine();
