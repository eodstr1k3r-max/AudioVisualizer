import { describe, it, expect } from 'vitest';
import { createTempoTracker } from '../bands';

/** Simuliert regelmäßige Onsets im Abstand `intervalMs`. */
function feedRegular(tracker: ReturnType<typeof createTempoTracker>, intervalMs: number, count: number): void {
  let t = 1000;
  for (let i = 0; i < count; i++) {
    tracker.tick(t, true);
    t += intervalMs;
  }
}

describe('createTempoTracker · BPM-Erkennung', () => {
  it('liefert 0 BPM, bevor genug Intervalle gesammelt wurden', () => {
    const t = createTempoTracker();
    expect(t.tick(1000, true).bpm).toBe(0);
    // < 4 Intervalle → noch kein BPM
    feedRegular(t, 500, 3);
    expect(t.tick(3000, true).bpm).toBe(0);
  });

  it('erkennt 120 BPM aus regelmäßigen 500-ms-Onsets', () => {
    const t = createTempoTracker();
    feedRegular(t, 500, 8);
    const state = t.tick(1000 + 8 * 500, true);
    expect(state.bpm).toBe(120);
  });

  it('erkennt 100 BPM aus 600-ms-Onsets', () => {
    const t = createTempoTracker();
    feedRegular(t, 600, 8);
    const state = t.tick(1000 + 8 * 600, true);
    expect(state.bpm).toBe(100);
  });

  it('ignoriert zu kurze Intervalle (Onset-Bursts) – korrumpiert die Messung nicht', () => {
    const t = createTempoTracker();
    feedRegular(t, 500, 8); // sauberes Signal → 120 BPM
    // Jetzt ein dichtes Burst-Paket (alle 40 ms) – darf lastOnset nicht verschieben
    for (let i = 0; i < 10; i++) {
      t.tick(6000 + i * 40, true);
    }
    // Nächster echter Onset im 500-ms-Raster → Intervall muss weiterhin korrekt gemessen werden
    const state = t.tick(6500, true);
    expect(state.bpm).toBe(120);
  });

  it('startet die Messkette nach einer langen Pause neu', () => {
    const t = createTempoTracker();
    feedRegular(t, 500, 6); // 120 BPM
    // Lange Pause (> MAX_INTERVAL 1200 ms) → Reset der Kette, kein Riesen-Intervall
    t.tick(20000, true); // Reset
    feedRegular(t, 500, 8); // neue Kette ab 20000
    const state = t.tick(20000 + 8 * 500, true);
    expect(state.bpm).toBe(120);
  });
});

describe('createTempoTracker · Beat-Sync', () => {
  it('setzt beatPulse/onBeat direkt nach einem Beat und lässt sie abklingen', () => {
    const t = createTempoTracker();
    t.forceBpm(120); // 500 ms Intervall
    const beatTime = 2000;
    t.tick(beatTime, true);

    const rightAfter = t.tick(beatTime + 30, false);
    expect(rightAfter.onBeat).toBe(true);
    expect(rightAfter.beatPulse).toBeGreaterThan(0.7);
    expect(rightAfter.beatPhase).toBeCloseTo(30 / 500, 5);

    // 200 ms nach dem Beat → onBeat-Fenster (120 ms) vorbei, Puls aber noch aktiv
    const mid = t.tick(beatTime + 200, false);
    expect(mid.onBeat).toBe(false);
    expect(mid.beatPulse).toBeCloseTo(1 - 200 / 500, 5);

    // Kurz vor dem nächsten Beat → Puls nahe 0 (volles Intervall, kein harter Schnitt)
    const nearEnd = t.tick(beatTime + 490, false);
    expect(nearEnd.beatPulse).toBeLessThan(0.05);
  });

  it('beatPulse ist konsistent mit beatPhase (Puls = 1 − Phase)', () => {
    const t = createTempoTracker();
    t.forceBpm(120);
    t.tick(2000, true);
    const s = t.tick(2000 + 250, false);
    expect(s.beatPhase).toBeCloseTo(0.5, 5);
    expect(s.beatPulse).toBeCloseTo(0.5, 5);
  });

  it('liefert beatPhase bis 1.0 innerhalb des Beats', () => {
    const t = createTempoTracker();
    t.forceBpm(120);
    t.tick(2000, true);
    const nearEnd = t.tick(2000 + 480, false);
    expect(nearEnd.beatPhase).toBeCloseTo(480 / 500, 5);
  });

  it('forceBpm begrenzt auf 60..220', () => {
    const t = createTempoTracker();
    t.forceBpm(30);
    expect(t.tick(1000, false).bpm).toBe(60);
    t.forceBpm(400);
    expect(t.tick(2000, false).bpm).toBe(220);
  });
});

describe('createTempoTracker · reset', () => {
  it('setzt alle Metriken zurück', () => {
    const t = createTempoTracker();
    t.forceBpm(120);
    feedRegular(t, 500, 8);
    expect(t.tick(9000, false).bpm).toBe(120);
    t.reset();
    const s = t.tick(10000, false);
    expect(s.bpm).toBe(0);
    expect(s.beatPulse).toBe(0);
    expect(s.onBeat).toBe(false);
  });
});
