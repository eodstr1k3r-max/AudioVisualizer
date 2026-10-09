import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoSynth } from '../DemoSynth';

/* ----------------------- Mock-AudioContext ----------------------- */

function makeParam(): unknown {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn()
  };
}

function makeNode(kind = 'node'): any {
  return {
    kind,
    gain: makeParam(),
    frequency: makeParam(),
    playbackRate: makeParam(),
    buffer: null,
    loop: false,
    connect: vi.fn((dest: unknown) => dest),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn()
  };
}

function makeCtx(): any {
  let currentTime = 0;
  return {
    destination: makeNode('destination'),
    state: 'running',
    sampleRate: 48000,
    createGain: vi.fn(() => makeNode('gain')),
    createOscillator: vi.fn(() => makeNode('oscillator')),
    createBufferSource: vi.fn(() => makeNode('bufferSource')),
    createBiquadFilter: vi.fn(() => makeNode('biquad')),
    createBuffer: vi.fn((_channels: number, len: number) => ({
      getChannelData: () => new Float32Array(len)
    })),
    get currentTime() {
      return currentTime;
    },
    set currentTime(v: number) {
      currentTime = v;
    }
  };
}

describe('DemoSynth', () => {
  let ctx: any;
  let analyser: any;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = makeCtx();
    analyser = makeNode('analyser');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setBpm klemmt auf 60..220 und rundet', () => {
    const s = new DemoSynth();
    s.setBpm(130.6);
    expect((s as any).bpm).toBe(131);
    s.setBpm(30);
    expect((s as any).bpm).toBe(60);
    s.setBpm(400);
    expect((s as any).bpm).toBe(220);
  });

  it('start verdrahtet Master → Analyser & Destination und erzeugt alle Stimmen', () => {
    const s = new DemoSynth();
    s.start(ctx, analyser);
    expect(s.active).toBe(true);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3); // Kick, Bass, Pad
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1); // Hi-Hat
    const master = (s as any).master;
    expect(master.connect).toHaveBeenCalledWith(analyser);
    expect(master.connect).toHaveBeenCalledWith(ctx.destination);
  });

  it('start ist idempotent (keine doppelten Nodes)', () => {
    const s = new DemoSynth();
    s.start(ctx, analyser);
    s.start(ctx, analyser);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('scheduled Beat-Pattern: Kick, Bass & Hi-Hat werden getriggert', () => {
    const s = new DemoSynth();
    s.start(ctx, analyser);
    ctx.currentTime = 0.5;
    vi.advanceTimersByTime(25);

    const kickGain = (s as any).kickGain;
    const bassOsc = (s as any).bassOsc;
    const hatGain = (s as any).hatGain;

    expect(kickGain.gain.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number)); // Kick auf Viertel
    expect(kickGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled(); // Kick-Decay
    expect(bassOsc.frequency.setValueAtTime).toHaveBeenCalled(); // Bass-Achtelnoten
    expect(hatGain.gain.setValueAtTime).toHaveBeenCalled(); // Hat auf Offbeats
  });

  it('stop räumt auf: active=false, Master getrennt, Timer beendet', () => {
    const s = new DemoSynth();
    s.start(ctx, analyser);
    const master = (s as any).master;
    // Ein Beat erzeugen (nur Step 0 = Kick), dann stoppen
    ctx.currentTime = 0.2;
    vi.advanceTimersByTime(25);
    expect((s as any).kickGain.gain.setValueAtTime).toHaveBeenCalledTimes(1);
    s.stop();
    expect(s.active).toBe(false);
    expect(master.disconnect).toHaveBeenCalled();
    expect((s as any).ctx).toBeNull();
    // Kein weiterer Beat nach stop
    ctx.currentTime = 1;
    vi.advanceTimersByTime(1000);
    expect((s as any).timer).toBeNull();
    expect((s as any).kickGain.gain.setValueAtTime).toHaveBeenCalledTimes(1);
  });

  it('stop ohne start wirft nicht', () => {
    const s = new DemoSynth();
    expect(() => s.stop()).not.toThrow();
  });

  it('setVolume klemmt auf 0..1 und skaliert den Master-Gain (Basis 0.5)', () => {
    const s = new DemoSynth();
    s.start(ctx, analyser);
    const master = (s as any).master;
    master.gain.setTargetAtTime.mockClear();
    s.setVolume(1);
    expect(master.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), 0.05);
    s.setVolume(0.5);
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.25, expect.any(Number), 0.05);
    s.setVolume(-1); // klemmt auf 0
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, expect.any(Number), 0.05);
    s.setVolume(9); // klemmt auf 1
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.5, expect.any(Number), 0.05);
  });
});
