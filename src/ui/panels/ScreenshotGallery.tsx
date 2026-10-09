import { useState } from 'react';
import { useScreenshotStore, type Screenshot } from '../../core/screenshotStore';
import { useT, translateOrFallback } from '../../core/i18n';
import { ActionButton } from '../components/ui';

/** PNG als Datei herunterladen (einzelner Screenshot). */
function downloadShot(shot: Screenshot): void {
  const a = document.createElement('a');
  a.href = shot.dataUrl;
  a.download = `visualizer-${shot.mode}-${new Date(shot.timestamp).toISOString().replace(/[:.]/g, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Data-URL in die Zwischenablage kopieren (zum Einfügen in PRs/Dokumente). */
async function copyShot(shot: Screenshot): Promise<void> {
  const blob = await (await fetch(shot.dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/** Alle Screenshots nacheinander als PNGs herunterladen. */
function downloadAll(shots: Screenshot[]): void {
  shots.forEach((s, i) => window.setTimeout(() => downloadShot(s), i * 350));
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function ShotCard({ shot }: { shot: Screenshot }) {
  const tr = useT();
  const setNote = useScreenshotStore((s) => s.setNote);
  const remove = useScreenshotStore((s) => s.remove);
  const [copied, setCopied] = useState(false);

  const onCopy = async (): Promise<void> => {
    try {
      await copyShot(shot);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error('Kopieren fehlgeschlagen:', e);
      downloadShot(shot); // Fallback: herunterladen
    }
  };

  return (
    <figure className="shot-card">
      <a className="shot-thumb" href={shot.dataUrl} download={`visualizer-${shot.mode}-${shot.timestamp}.png`}>
        <img src={shot.dataUrl} alt={shot.modeLabel} loading="lazy" />
      </a>
      <figcaption>
        <div className="shot-meta">
          <span className="shot-label">{translateOrFallback(tr, `modes.${shot.mode}`, shot.modeLabel)}</span>
          <span className="shot-chip">{shot.backend}</span>
          <span className="shot-chip">{shot.width}×{shot.height}</span>
          <span className="shot-chip">{formatTime(shot.timestamp)}</span>
        </div>
        <input
          className="shot-note"
          type="text"
          value={shot.note}
          placeholder={tr('export.shotNote')}
          maxLength={120}
          onChange={(e) => setNote(shot.id, e.target.value)}
        />
        <div className="shot-actions">
          <ActionButton variant="ghost" className="shot-btn" onClick={() => downloadShot(shot)}>
            {tr('export.shotDownload')}
          </ActionButton>
          <ActionButton variant="ghost" className="shot-btn" onClick={() => void onCopy()}>
            {copied ? tr('export.shotCopied') : tr('export.shotCopy')}
          </ActionButton>
          <ActionButton variant="ghost" className="shot-btn danger-text" onClick={() => remove(shot.id)} title={tr('export.shotDelete')}>
            ✕
          </ActionButton>
        </div>
      </figcaption>
    </figure>
  );
}

/** Galerie aller aufgenommenen Screenshots fürs visuelle Review. */
export function ScreenshotGallery() {
  const tr = useT();
  const screenshots = useScreenshotStore((s) => s.screenshots);
  const clear = useScreenshotStore((s) => s.clear);

  if (screenshots.length === 0) {
    return <p className="hint">{tr('export.shotEmpty')}</p>;
  }

  return (
    <div className="shot-gallery">
      <div className="button-row">
        <ActionButton variant="ghost" onClick={() => downloadAll(screenshots)}>
          {tr('export.shotDownloadAll')}
        </ActionButton>
        <ActionButton variant="danger" onClick={() => clear()}>
          {tr('export.shotClear')}
        </ActionButton>
      </div>
      <div className="shot-grid">
        {screenshots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} />
        ))}
      </div>
    </div>
  );
}
