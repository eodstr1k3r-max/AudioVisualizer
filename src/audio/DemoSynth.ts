/**
 * Demo-Synth: eingebauter Beat-Generator (Kick, Hi-Hat, Bass, Pad).
 * Erzeugt ein synthetisches Audio-Signal, das durch die Analyse-Kette
 * (Analyser) läuft – so animiert der Visualizer sofort, ohne Audiodatei.
 */
export class DemoSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private kickOsc: OscillatorNode | null = null;
  private kickGain: GainNode | null = null;
  private kickGainCtl: GainNode | null = null;
  private hatNoise: AudioBufferSourceNode | null = null;
  private hatGain: GainNode | null = null;
  private bassOsc: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private padOsc: OscillatorNode | null = null;
  private padGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bpm = 124;
  active = false;

  /** In die Analyse-Kette einklinken. */
  start(ctx: AudioContext, analyser: AnalyserNode): void {
    if (this.active) return;
    this.ctx = ctx;

    const now = ctx.currentTime;

    // Master-Gain → Analyser (Signal geht in die Analyse UND hörbar auf Output)
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0.5, now);
    this.master.connect(analyser);
    this.master.connect(ctx.destination);

    // ---- Kick (Sinussweep 150→45 Hz) ----
    this.kickOsc = ctx.createOscillator();
    this.kickOsc.type = 'sine';
    this.kickGain = ctx.createGain();
    this.kickGainCtl = ctx.createGain();
    this.kickGainCtl.gain.setValueAtTime(0, now);
    this.kickOsc.connect(this.kickGain).connect(this.kickGainCtl).connect(this.master);
    this.kickOsc.start(now);

    // ---- Hi-Hat (Rauschen + Hochpass) ----
    const hatLen = 0.08;
    const hatBuf = ctx.createBuffer(1, ctx.sampleRate * hatLen, ctx.sampleRate);
    const hatData = hatBuf.getChannelData(0);
    for (let i = 0; i < hatData.length; i++) hatData[i] = Math.random() * 2 - 1;
    this.hatNoise = ctx.createBufferSource();
    this.hatNoise.buffer = hatBuf;
    this.hatNoise.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'highpass';
    this.filter.frequency.setValueAtTime(7500, now);
    this.hatGain = ctx.createGain();
    this.hatGain.gain.setValueAtTime(0, now);
    this.hatNoise.connect(this.filter).connect(this.hatGain).connect(this.master);
    this.hatNoise.start(now);

    // ---- Bass (Sägezahn, Achtelnoten-Pattern) ----
    this.bassOsc = ctx.createOscillator();
    this.bassOsc.type = 'sawtooth';
    this.bassGain = ctx.createGain();
    this.bassGain.gain.setValueAtTime(0, now);
    this.bassOsc.connect(this.bassGain).connect(this.master);
    this.bassOsc.start(now);

    // ---- Pad (weiche Fläche, dezente Energie) ----
    this.padOsc = ctx.createOscillator();
    this.padOsc.type = 'triangle';
    this.padOsc.frequency.setValueAtTime(110, now);
    this.padGain = ctx.createGain();
    this.padGain.gain.setValueAtTime(0, now);
    this.padOsc.connect(this.padGain).connect(this.master);
    this.padOsc.start(now);

    this.bpm = 124;
    this.step = 0;
    this.nextTime = now + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
    this.active = true;
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(60, Math.min(220, Math.round(bpm)));
  }

  /** Lautstärke 0..1 (skaliert den Master-Gain, Basis 0.5). */
  setVolume(v: number): void {
    if (this.master && this.ctx) {
      const level = Math.max(0, Math.min(1, v)) * 0.5;
      this.master.gain.setTargetAtTime(level, this.ctx.currentTime, 0.05);
    }
  }

  /** Scheduler: plant Beats im Voraus. */
  private schedule(): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const stepDur = 60 / this.bpm / 4; // 16tel
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 16;
      this.nextTime += stepDur;
    }
  }

  private playStep(step: number, t: number): void {
    if (!this.ctx) return;

    // Kick auf 4/4-Vierteln (Schritte 0,4,8,12) + Offbeat 14 (Ghost)
    if (step % 4 === 0 || step === 14) {
      this.triggerKick(t);
    }
    // Hi-Hat: Offbeats (2,6,10,14) leise, Backbeat offen
    if (step % 4 === 2 || step % 8 === 6) {
      this.triggerHat(t, step % 8 === 6 ? 0.22 : 0.1);
    }
    // Bass: Achtelnoten (gerade Schritte), synkopiert
    if (step % 2 === 0) {
      this.triggerBass(t, step % 8 === 6 ? 0.9 : 0.55, step);
    }
    // Pad-Welligkeit
    if (this.padGain && this.padOsc) {
      const level = 0.06 + 0.03 * Math.sin(t * 2);
      this.padGain.gain.setTargetAtTime(level, t, 0.15);
      this.padOsc.frequency.setTargetAtTime(98 + Math.sin(t * 0.7) * 30, t, 0.4);
    }
  }

  private triggerKick(t: number): void {
    if (!this.ctx || !this.kickOsc || !this.kickGain || !this.kickGainCtl) return;
    this.kickOsc.frequency.setValueAtTime(150, t);
    this.kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    this.kickGain.gain.setValueAtTime(1, t);
    this.kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    this.kickGainCtl.gain.setValueAtTime(0.9, t);
  }

  private triggerHat(t: number, level: number): void {
    if (!this.ctx || !this.hatGain) return;
    this.hatGain.gain.cancelScheduledValues(t);
    this.hatGain.gain.setValueAtTime(level, t);
    this.hatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  }

  private triggerBass(t: number, level: number, step: number): void {
    if (!this.ctx || !this.bassOsc || !this.bassGain) return;
    const notes = [55, 55, 65.4, 55, 49, 49, 58.3, 55]; // A-Moll Pattern
    const freq = notes[step % notes.length];
    this.bassOsc.frequency.setValueAtTime(freq, t);
    this.bassGain.gain.setValueAtTime(0, t);
    this.bassGain.gain.linearRampToValueAtTime(level * 0.5, t + 0.01);
    this.bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const now = this.ctx?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(0, now, 0.05);
    const stopAll = (node: AudioScheduledSourceNode | null): void => {
      if (node) {
        try {
          node.stop(now + 0.15);
        } catch {
          /* bereits gestoppt */
        }
      }
    };
    stopAll(this.kickOsc);
    stopAll(this.hatNoise);
    stopAll(this.bassOsc);
    stopAll(this.padOsc);
    this.master?.disconnect();
    this.active = false;
    this.ctx = null;
    this.master = null;
  }
}

export const demoSynth = new DemoSynth();
