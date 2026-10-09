import { useEffect, useRef } from 'react';
import { audioEngine } from '../../audio/AudioEngine';

interface LiveSpectrumProps {
  width?: number;
  height?: number;
}

/**
 * Live-Spektrum-Monitor für den Topbar: zeichnet in einem eigenen rAF-Loop
 * (vom React-Renderzyklus entkoppelt) ein kompakt gespiegeltes Frequenzband
 * aus den letzten Analysedaten der AudioEngine – inklusive Kick-Blitz und
 * fallenden Peak-Caps. Ohne Audioquelle läuft eine ruhige Idle-Animation.
 */
export function LiveSpectrum({ width = 148, height = 30 }: LiveSpectrumProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const BARS = 24;
    const peaks = new Float32Array(BARS);
    let raf = 0;
    let lastColorRead = 0;
    let cAccent = '#8b5cf6';
    let cAccent2 = '#22d3ee';

    const readColors = (): void => {
      const cs = getComputedStyle(document.documentElement);
      cAccent = cs.getPropertyValue('--accent').trim() || cAccent;
      cAccent2 = cs.getPropertyValue('--accent-2').trim() || cAccent2;
    };

    const draw = (now: number): void => {
      raf = requestAnimationFrame(draw);
      if (now - lastColorRead > 800) {
        readColors();
        lastColorRead = now;
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);

      const audio = audioEngine.getLastAudioData();
      const freq = audio?.freqData ?? null;
      const bins = freq ? Math.floor(freq.length * 0.72) : 0;

      const grad = g.createLinearGradient(0, height, width, 0);
      grad.addColorStop(0, cAccent);
      grad.addColorStop(1, cAccent2);

      const bw = width / BARS;
      const kick = audio?.kickLevel ?? 0;

      for (let i = 0; i < BARS; i++) {
        // Log-Verteilung über das Spektrum
        const t0 = i / BARS;
        const idx = freq ? Math.floor(Math.pow(t0, 1.7) * bins) : -1;
        const raw = idx >= 0 && freq ? freq[idx] / 255 : 0;
        const idle = 0.08 + 0.05 * Math.sin(now / 480 + i * 0.7);
        const v = Math.min(1, Math.max(idle, raw));

        const h = Math.max(2, v * (height - 4) * (0.85 + kick * 0.3));
        const x = i * bw;
        const y = height - h;

        g.globalAlpha = 0.9;
        g.fillStyle = grad;
        g.fillRect(x + 1, y, bw - 2.4, h);

        // Peak-Caps mit träge fallender Höhe
        peaks[i] = Math.max(peaks[i] - 0.02, v);
        const py = height - Math.max(2, peaks[i] * (height - 4)) - 2.5;
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(x + 1, py, bw - 2.4, 1.5);
      }

      // Kick-Blitz: heller Untergrund-Puls
      if (kick > 0.02) {
        g.globalAlpha = kick * 0.35;
        g.fillStyle = cAccent2;
        g.fillRect(0, height - 2, width, 2);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return <canvas ref={ref} className="live-spectrum" style={{ width, height }} aria-hidden="true" />;
}
