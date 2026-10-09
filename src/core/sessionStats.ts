/** Session-Statistik (seit Seitenaufruf, bewusst nicht persistiert). */
export interface SessionStats {
  tracksStarted: number;
  playSeconds: number;
  kicks: number;
  modeChanges: number;
  snapshots: number;
}

export const sessionStats: SessionStats = {
  tracksStarted: 0,
  playSeconds: 0,
  kicks: 0,
  modeChanges: 0,
  snapshots: 0
};

/** Sekunden → "m:ss" bzw. "h:mm:ss". */
export function formatPlayTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Bytes → "1.2 MB" (für die Live-Dateigröße während der Aufnahme). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
