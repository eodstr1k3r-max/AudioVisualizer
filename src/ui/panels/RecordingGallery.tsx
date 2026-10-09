import { useRecordingStore, type Recording } from '../../core/recordingStore';
import { useT, translateOrFallback } from '../../core/i18n';
import { formatPlayTime, formatBytes } from '../../core/sessionStats';
import { ActionButton } from '../components/ui';

function downloadRecording(rec: Recording): void {
  const a = document.createElement('a');
  a.href = rec.url;
  a.download = rec.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Galerie aller fertigen Aufnahmen mit Vorschau + Download. */
export function RecordingGallery() {
  const tr = useT();
  const recordings = useRecordingStore((s) => s.recordings);
  const remove = useRecordingStore((s) => s.remove);
  const clear = useRecordingStore((s) => s.clear);

  if (recordings.length === 0) {
    return <p className="hint">{tr('export.recEmpty')}</p>;
  }

  return (
    <div className="shot-gallery">
      <div className="button-row">
        <ActionButton variant="danger" onClick={() => clear()}>
          {tr('export.recClear')}
        </ActionButton>
      </div>
      <div className="rec-grid">
        {recordings.map((rec) => (
          <figure className="rec-card" key={rec.id}>
            <video className="rec-video" src={rec.url} controls preload="metadata" />
            <figcaption>
              <div className="shot-meta">
                <span className="shot-label">{translateOrFallback(tr, `modes.${rec.mode}`, rec.modeLabel)}</span>
                <span className="shot-chip">{formatPlayTime(rec.duration)}</span>
                <span className="shot-chip">{formatBytes(rec.sizeBytes)}</span>
                <span className="shot-chip">{rec.extension.toUpperCase()}</span>
              </div>
              <div className="shot-actions">
                <ActionButton variant="ghost" className="shot-btn" onClick={() => downloadRecording(rec)}>
                  {tr('export.recDownload')}
                </ActionButton>
                <ActionButton variant="ghost" className="shot-btn danger-text" onClick={() => remove(rec.id)} title={tr('export.shotDelete')}>
                  ✕
                </ActionButton>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
