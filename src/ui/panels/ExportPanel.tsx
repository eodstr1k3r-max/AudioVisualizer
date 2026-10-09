import { useEffect, useRef, useState } from 'react';
import { useStore, defaultSettings } from '../../core/store';
import { useT } from '../../core/i18n';
import { engine } from '../../engine/Engine';
import { exportShader, importShader } from '../../engine/shaders/shaderExchange';
import { serializeSettings, parseSettings, buildShareUrl } from '../../core/settingsIO';
import { sessionStats, formatPlayTime, formatBytes } from '../../core/sessionStats';
import { resolveCodec, computeBitrate } from '../../engine/Recorder';
import { SelectBox, ActionButton, PanelSection, Toggle } from '../components/ui';
import { ScreenshotGallery } from './ScreenshotGallery';
import { RecordingGallery } from './RecordingGallery';

/** Live-Session-Statistik (aktualisiert sich einmal pro Sekunde). */
function SessionStatsView() {
  const [, force] = useState(0);
  const tr = useT();
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="stats-grid">
      <div><strong>{sessionStats.tracksStarted}</strong><span>{tr('stats.tracks')}</span></div>
      <div><strong>{formatPlayTime(sessionStats.playSeconds)}</strong><span>{tr('stats.playtime')}</span></div>
      <div><strong>{sessionStats.kicks}</strong><span>{tr('stats.kicks')}</span></div>
      <div><strong>{sessionStats.modeChanges}</strong><span>{tr('stats.modeChanges')}</span></div>
      <div><strong>{sessionStats.snapshots}</strong><span>{tr('stats.snapshots')}</span></div>
    </div>
  );
}

/** Codec-Name für die Format-Anzeige (aus dem aufgelösten MIME-Type). */
function codecName(mime: string, ext: 'webm' | 'mp4'): string {
  const m = mime.toLowerCase();
  if (m.includes('av01')) return 'AV1 (WebM)';
  if (m.includes('vp9') || m.includes('webm')) return 'VP9 (WebM)';
  if (m.includes('mp4') || m.includes('avc1')) return 'H.264 (MP4)';
  return ext === 'mp4' ? 'MP4' : 'WebM';
}

export function ExportPanel() {
  const settings = useStore((s) => s.settings);
  const ui = useStore((s) => s.ui);
  const setSetting = useStore((s) => s.setSetting);
  const setSettings = useStore((s) => s.setSettings);
  const tr = useT();
  const shaderImportRef = useRef<HTMLInputElement>(null);
  const settingsImportRef = useRef<HTMLInputElement>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  /* Teilbaren Deep-Link erzeugen und in die Zwischenablage kopieren */
  const copyShareLink = async (): Promise<void> => {
    const url = buildShareUrl(settings, window.location.href);
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt(tr('export.promptLink'), url);
    }
  };

  /* Alle Einstellungen als JSON-Datei herunterladen */
  const exportSettings = (): void => {
    const blob = new Blob([serializeSettings(settings)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visualizer-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Einstellungen aus JSON-Datei laden (validiert & gemerged) */
  const handleSettingsImport = (f: File): void => {
    void f.text().then(
      (text) => {
        try {
          const parsed = parseSettings(text, defaultSettings);
          setSettings(parsed);
          setImportMsg(`✅ ${tr('export.imported')}`);
        } catch (e) {
          setImportMsg(`❌ ${e instanceof Error ? e.message : String(e)}`);
        }
        window.setTimeout(() => setImportMsg(null), 4000);
      },
      () => {
        setImportMsg(`❌ ${tr('export.readError')}`);
        window.setTimeout(() => setImportMsg(null), 4000);
      }
    );
  };

  const res = parseInt(settings.recordResolution, 10) || 1920;
  const codecInfo = resolveCodec(settings.recordCodec, settings.alphaRecording);
  const bitrate = computeBitrate(res, settings.recordFps, settings.recordQuality);

  return (
    <>
      <PanelSection title={tr('export.recorder')}>
        <SelectBox
          label={tr('export.resolution')}
          value={settings.recordResolution}
          options={[
            { value: '1920', label: 'Full HD 1080p (1920×1080)' },
            { value: '2560', label: 'QHD 1440p (2560×1440)' },
            { value: '3840', label: 'Ultra HD 4K (3840×2160)' }
          ]}
          onChange={(v) => setSetting('recordResolution', v as never)}
        />
        <div className="field-row">
          <SelectBox
            label={tr('export.fps')}
            value={String(settings.recordFps)}
            options={[
              { value: '24', label: '24 FPS' },
              { value: '30', label: '30 FPS' },
              { value: '60', label: '60 FPS' }
            ]}
            onChange={(v) => setSetting('recordFps', v === '24' ? 24 : v === '30' ? 30 : 60)}
          />
          <SelectBox
            label={tr('export.codec')}
            value={settings.recordCodec}
            options={[
              { value: 'auto', label: tr('export.codecAuto') },
              { value: 'vp9', label: 'VP9 (WebM)' },
              { value: 'av1', label: 'AV1 (WebM)' },
              { value: 'h264', label: 'H.264 (MP4)' }
            ]}
            onChange={(v) => setSetting('recordCodec', v as never)}
          />
        </div>
        <div className="field-row">
          <SelectBox
            label={tr('export.quality')}
            value={settings.recordQuality}
            options={[
              { value: 'low', label: tr('export.qualityLow') },
              { value: 'medium', label: tr('export.qualityMedium') },
              { value: 'high', label: tr('export.qualityHigh') }
            ]}
            onChange={(v) => setSetting('recordQuality', v as never)}
          />
          <SelectBox
            label={tr('export.maxDuration')}
            value={String(settings.recordMaxSeconds)}
            options={[
              { value: '0', label: tr('export.maxOff') },
              { value: '60', label: '1 min' },
              { value: '300', label: '5 min' },
              { value: '900', label: '15 min' },
              { value: '1800', label: '30 min' }
            ]}
            onChange={(v) => setSetting('recordMaxSeconds', parseInt(v, 10) || 0)}
          />
        </div>
        <Toggle
          label={tr('export.alpha')}
          checked={settings.alphaRecording}
          onChange={(v) => setSetting('alphaRecording', v)}
        />
        <div className="button-row">
          {!ui.recording ? (
            <ActionButton onClick={() => void engine.recorder?.start()}>{tr('export.start')}</ActionButton>
          ) : (
            <>
              <ActionButton variant="ghost" onClick={() => engine.recorder?.togglePause()}>
                {ui.recPaused ? tr('export.resume') : tr('export.pause')}
              </ActionButton>
              <ActionButton variant="danger" onClick={() => engine.recorder?.stop()}>
                {tr('export.stop')}
              </ActionButton>
            </>
          )}
        </div>
        <div className="button-row">
          <ActionButton variant="ghost" onClick={() => void engine.recorder?.snapshot()}>
            {tr('export.snapshot')}
          </ActionButton>
        </div>
        <div className="meta">
          <div>
            <strong>{tr('export.status')}</strong> <span className={`live-dot${ui.recording ? ' rec' : ''}`} />{' '}
            {ui.recording ? (ui.recPaused ? tr('export.paused') : tr('export.recording')) : tr('export.inactive')}
          </div>
          {ui.recording && (
            <div>
              <strong>{tr('export.timer')}</strong> {formatPlayTime(ui.recSeconds)}
              {' · '}
              <strong>{tr('export.size')}</strong> {formatBytes(ui.recSizeBytes)}
            </div>
          )}
          <div>
            <strong>{tr('export.format')}</strong>{' '}
            {codecName(codecInfo.mimeType, codecInfo.extension)} · {res}p @ {settings.recordFps} FPS · ~{(bitrate / 1e6).toFixed(1)} Mbps
          </div>
          <div>
            <strong>{tr('export.tip')}</strong>{' '}
            <span dangerouslySetInnerHTML={{ __html: tr('export.tipText') }} />
          </div>
        </div>
      </PanelSection>

      <PanelSection title={tr('export.screenshots')}>
        <ScreenshotGallery />
        <p className="hint">{tr('export.shotHint')}</p>
      </PanelSection>

      <PanelSection title={tr('export.recordings')}>
        <RecordingGallery />
        <p className="hint">{tr('export.recHint')}</p>
      </PanelSection>

      <PanelSection title={tr('export.obs')}>
        <Toggle
          label={tr('export.obsToggle')}
          checked={settings.obsMode}
          onChange={(v) => setSetting('obsMode', v)}
        />
        <p className="hint" dangerouslySetInnerHTML={{ __html: tr('export.obsHint') }} />
      </PanelSection>

      <PanelSection title={tr('export.stats')}>
        <SessionStatsView />
        <p className="hint">{tr('export.statsHint')}</p>
      </PanelSection>

      <PanelSection title={tr('export.share')}>
        <div className="button-row">
          <ActionButton variant="ghost" onClick={() => void copyShareLink()}>
            {shareCopied ? tr('export.copied') : tr('export.copyLink')}
          </ActionButton>
        </div>
        <div className="button-row">
          <ActionButton variant="ghost" onClick={exportSettings}>
            {tr('export.exportJson')}
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => settingsImportRef.current?.click()}>
            {tr('export.importJson')}
          </ActionButton>
        </div>
        <input
          ref={settingsImportRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleSettingsImport(f);
            e.target.value = '';
          }}
        />
        {importMsg && <p className="hint">{importMsg}</p>}
        <p className="hint" dangerouslySetInnerHTML={{ __html: tr('export.shareHint') }} />
      </PanelSection>

      <PanelSection title={tr('export.shaderExport')}>
        <input
          ref={shaderImportRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importShader(f);
            e.target.value = '';
          }}
        />
        <div className="button-row">
          <ActionButton variant="ghost" onClick={() => exportShader()}>
            {tr('export.exportShader')}
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => shaderImportRef.current?.click()}>
            {tr('export.importShader')}
          </ActionButton>
        </div>
        <p className="hint">{tr('export.shaderHint')}</p>
      </PanelSection>
    </>
  );
}
