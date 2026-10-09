import { create } from 'zustand';

/**
 * Eine fertige Aufnahme fürs Review – inkl. Metadaten zur Dokumentation.
 * Object-URL wird beim Entfernen/Leeren wieder freigegeben (revokeObjectURL).
 */
export interface Recording {
  id: string;
  /** Object-URL zum Abspielen/Herunterladen. */
  url: string;
  blob: Blob;
  filename: string;
  mode: string;
  modeLabel: string;
  timestamp: number;
  /** Dauer in Sekunden. */
  duration: number;
  sizeBytes: number;
  extension: 'webm' | 'mp4';
}

interface RecordingState {
  recordings: Recording[];
  add: (rec: Omit<Recording, 'id'>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

let seq = 0;
const nextId = (): string => `rec-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Session-Speicher für die Aufnahme-Galerie. Bewusst NICHT persistiert:
 * Videos gehören nur in den Speicher, nicht nach localStorage.
 */
export const useRecordingStore = create<RecordingState>()((set, get) => ({
  recordings: [],
  add: (rec) => set((s) => ({ recordings: [{ ...rec, id: nextId() }, ...s.recordings] })),
  remove: (id) =>
    set((s) => {
      const rec = s.recordings.find((r) => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return { recordings: s.recordings.filter((r) => r.id !== id) };
    }),
  clear: () => {
    get().recordings.forEach((r) => URL.revokeObjectURL(r.url));
    set({ recordings: [] });
  }
}));
