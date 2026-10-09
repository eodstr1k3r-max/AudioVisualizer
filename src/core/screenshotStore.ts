import { create } from 'zustand';

/**
 * Ein Screenshot fürs visuelle Review – inkl. Metadaten zur Dokumentation
 * von Änderungen (Szene, Backend, Zeitpunkt, Auflösung, Notiz).
 */
export interface Screenshot {
  id: string;
  /** PNG als Data-URL (direkt anzeigbar, download-/clipboard-fähig). */
  dataUrl: string;
  /** Visual-Mode-ID (z. B. 'volcano'), für spätere Zuordnung. */
  mode: string;
  /** Anzeige-Label der Szene (aus MODES, zum Zeitpunkt der Aufnahme). */
  modeLabel: string;
  /** Render-Backend zum Aufnahmezeitpunkt (ACES-Grading-Vergleich WebGPU vs. WebGL2). */
  backend: 'WebGPU' | 'WebGL2';
  /** Aufnahmezeitpunkt (ms epoch). */
  timestamp: number;
  width: number;
  height: number;
  /** Freitext-Notiz des Nutzers (z. B. „ACES-Grading", „Lava-Bloom"). */
  note: string;
}

interface ScreenshotState {
  screenshots: Screenshot[];
  add: (shot: Omit<Screenshot, 'id' | 'note'>) => void;
  setNote: (id: string, note: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

let seq = 0;
const nextId = (): string => `shot-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Session-Speicher für die Screenshot-Galerie. Bewusst NICHT persistiert:
 * Data-URLs wären zu groß für localStorage und sind nur fürs Live-Review gedacht.
 */
export const useScreenshotStore = create<ScreenshotState>()((set) => ({
  screenshots: [],
  add: (shot) => set((s) => ({ screenshots: [{ ...shot, id: nextId(), note: '' }, ...s.screenshots] })),
  setNote: (id, note) =>
    set((s) => ({ screenshots: s.screenshots.map((x) => (x.id === id ? { ...x, note } : x)) })),
  remove: (id) => set((s) => ({ screenshots: s.screenshots.filter((x) => x.id !== id) })),
  clear: () => set({ screenshots: [] })
}));
