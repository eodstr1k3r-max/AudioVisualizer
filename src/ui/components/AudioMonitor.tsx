import { useEffect, useRef } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import { useStore } from '../../core/store';
import { t } from '../../core/i18n';

/**
 * Live-Spektrum + Wellenform-Monitor (liest direkt den Analyser).
 * Perf: Frequenz-/Wave-Buffer werden einmalig gepuffert statt pro Frame
 * neu allokiert; die Akzentfarbe wird nur 2×/s neu ausgelesen.
 */
export function AudioMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let freq: Uint8Array<ArrayBuffer> | null = null;
    let wave: Uint8Array<ArrayBuffer> | null = null;
    let accent = '#8b5cf6';
    let lastColorRead = 0;

    const draw = (now: number): void => {
      raf = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      const analyser = audioEngine.getAnalyser();
      if (!analyser) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(148,163,184,0.4)';
        ctx.font = '11px system-ui';
        ctx.fillText(t('audio.monitorOffline'), 10, 16);
        return;
      }

      // Buffer lazy anlegen und wiederverwenden (keine GC-Last pro Frame)
      if (!freq || freq.length !== analyser.frequencyBinCount) {
        freq = new Uint8Array(analyser.frequencyBinCount);
      }
      if (!wave || wave.length !== analyser.fftSize) {
        wave = new Uint8Array(analyser.fftSize);
      }
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(wave);

      if (now - lastColorRead > 500) {
        accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent;
        lastColorRead = now;
      }

      ctx.clearRect(0, 0, w, h);

      // ---- Spektrum (obere Hälfte) ----
      const bars = 48;
      const barW = w / bars;
      const specH = h * 0.55;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor(Math.pow(i / bars, 1.6) * freq.length * 0.9);
        const v = (freq[idx] ?? 0) / 255;
        const bh = Math.max(2, v * specH);
        // Farbverlauf von Accent zu hell – HSL-Rotation um den Akzentton
        ctx.fillStyle = `hsla(${270 - i * 1.4}, 90%, ${58 + v * 18}%, ${0.35 + v * 0.6})`;
        ctx.fillRect(i * barW + 1, specH - bh, barW - 2, bh);
      }

      // ---- Wellenform (untere Hälfte) ----
      const waveY = h * 0.78;
      const step = Math.floor(wave.length / w);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const v = (wave[x * step] - 128) / 128;
        const y = waveY + v * (h * 0.18);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Beat-Marker
      const settings = useStore.getState().settings;
      const last = audioEngine.getLastAudioData();
      if (last?.onBeat) {
        ctx.fillStyle = 'rgba(255,80,120,0.9)';
        ctx.fillRect(0, 0, w, 2);
      }
      if (settings.demoMode) {
        ctx.fillStyle = 'rgba(52,211,153,0.8)';
        ctx.font = '10px system-ui';
        ctx.fillText(`● ${t('status.demoOn')}`, 6, h - 6);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="audio-monitor" width={520} height={150} aria-label="Live-Spektrum" />;
}
