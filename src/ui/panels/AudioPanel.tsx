import { useRef, useState } from 'react';
import { useStore } from '../../core/store';
import { useT, type TKey } from '../../core/i18n';
import { audioEngine } from '../../audio/AudioEngine';
import { addTracks, playTrack, removeTrack, loadUrlTrack } from '../../audio/playlist';
import { MIDI_PARAMS } from '../../audio/midi';
import { engine } from '../../engine/Engine';
import { Slider, SelectBox, ActionButton, PanelSection, Toggle } from '../components/ui';
import { AudioMonitor } from '../components/AudioMonitor';

/** MIDI-Parameter → i18n-Keys (Labels werden zur Laufzeit übersetzt) */
const MIDI_LABEL_KEYS: Record<string, TKey> = {
  sensitivity: 'audio.sensitivity',
  kickThreshold: 'audio.kickThreshold',
  bgOpacity: 'bg.opacity',
  bloomStrength: 'visuals.bloomStr',
  shaderBlend: 'midi.shaderBlend',
  overlayVideoScale: 'midi.videoSize',
  autoSpeed: 'midi.flightSpeed',
  cameraDistance: 'midi.camDistance',
  cameraHeight: 'midi.camHeight',
  cameraFov: 'midi.camFov',
  tunnelSpeed: 'midi.tunnelSpeed',
  terrainAmplitude: 'midi.terrainAmp',
  particleRotation: 'midi.particleRot',
  demoBpm: 'midi.demoBpm'
};

export function AudioPanel() {
  const settings = useStore((s) => s.settings);
  const ui = useStore((s) => s.ui);
  const setSetting = useStore((s) => s.setSetting);
  const setUi = useStore((s) => s.setUi);
  const tr = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');

  const toggleLearn = (key: string): void => {
    setUi({ midiLearnTarget: ui.midiLearnTarget === key ? null : key });
  };

  /* Zeitformat mm:ss */
  const fmt = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  /* Klick auf den Fortschrittsbalken = Seek */
  const seek = (e: React.MouseEvent<HTMLDivElement>): void => {
    const el = document.getElementById('audio') as HTMLAudioElement | null;
    if (!el || !ui.trackDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * ui.trackDuration;
    setUi({ trackTime: el.currentTime });
  };

  const progressPct = ui.trackDuration > 0 ? (ui.trackTime / ui.trackDuration) * 100 : 0;

  const handleDemoToggle = (v: boolean): void => {
    setSetting('demoMode', v);
    // Demo-Synth starten/stop über die Engine-Loop (syncDemo) – hier nur Status setzen
    if (v) {
      const el = document.getElementById('audio') as HTMLAudioElement | null;
      if (el) void audioEngine.ensureReady(el);
      setUi({ status: tr('status.demoOn') });
    } else {
      setUi({ status: tr('status.demoOff') });
    }
  };

  return (
    <>
      <PanelSection title={tr('audio.source')}>
        <div className="demo-row">
          <Toggle label={tr('audio.demo')} checked={settings.demoMode} onChange={handleDemoToggle} />
          {settings.demoMode && (
            <Slider
              label={tr('audio.demoTempo')}
              value={settings.demoBpm}
              min={70}
              max={180}
              step={1}
              format={(v) => `${v} BPM`}
              onChange={(v) => setSetting('demoBpm', v)}
            />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addTracks(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="button-row">
          <ActionButton onClick={() => fileRef.current?.click()} disabled={settings.demoMode}>
            {tr('audio.load')}
          </ActionButton>
          <ActionButton
            variant="ghost"
            onClick={() => void engine.toggleMicrophone()}
            className={ui.micActive ? 'active-ghost' : ''}
            disabled={settings.demoMode}
          >
            {ui.micActive ? tr('audio.micOn') : tr('audio.mic')}
          </ActionButton>
        </div>
        <div className="button-row">
          <ActionButton variant="ghost" onClick={() => void engine.playPause()} disabled={settings.demoMode}>
            {ui.playing ? tr('audio.pause') : tr('audio.play')}
          </ActionButton>
        </div>

        <SelectBox
          label={tr('audio.playbackMode')}
          value={settings.playbackMode}
          options={[
            { value: 'all', label: tr('audio.modeAll') },
            { value: 'one', label: tr('audio.modeOne') },
            { value: 'shuffle', label: tr('audio.modeShuffle') },
            { value: 'off', label: tr('audio.modeOff') }
          ]}
          onChange={(v) => setSetting('playbackMode', v as never)}
        />

        {ui.trackDuration > 0 && (
          <div className="progress-row">
            <span className="progress-time">{fmt(ui.trackTime)}</span>
            <div className="progress-track" onClick={seek} title={tr('audio.seekTitle')}>
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="progress-time">{fmt(ui.trackDuration)}</span>
          </div>
        )}

        <div className="url-row">
          <input
            type="url"
            name="audio-url"
            className="url-input"
            placeholder={tr('audio.urlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim()) {
                loadUrlTrack(url.trim());
                setUrl('');
              }
            }}
          />
          <ActionButton
            variant="ghost"
            disabled={!url.trim() || settings.demoMode}
            onClick={() => {
              loadUrlTrack(url.trim());
              setUrl('');
            }}
          >
            {tr('audio.loadBtn')}
          </ActionButton>
        </div>

        <div className="playlist">
          {ui.tracks.length === 0 && <div className="playlist-empty">{tr('audio.queueEmpty')}</div>}
          {ui.tracks.map((t, i) => (
            <div
              key={`${t.url}-${i}`}
              className={`playlist-item${i === ui.currentTrackIndex ? ' active' : ''}`}
              onClick={() => playTrack(i)}
            >
              <span className="playlist-name">
                {i === ui.currentTrackIndex ? '🔊 ' : `${i + 1}. `}
                {t.name}
              </span>
              <button
                type="button"
                className="playlist-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTrack(i);
                }}
                title={tr('audio.removeTrack')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title={tr('audio.monitor')}>
        <Toggle label={tr('audio.showMonitor')} checked={settings.showMonitor} onChange={(v) => setSetting('showMonitor', v)} />
        {settings.showMonitor && <AudioMonitor />}
      </PanelSection>

      <PanelSection title={tr('audio.volume')}>
        <Slider
          label={tr('audio.masterVolume')}
          value={settings.volume}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)} %`}
          onChange={(v) => {
            setSetting('volume', v);
            audioEngine.applyVolume(v);
          }}
        />
      </PanelSection>

      <PanelSection title={tr('audio.analysis')}>
        <Slider
          label={tr('audio.sensitivity')}
          value={settings.sensitivity}
          min={0.5}
          max={3}
          step={0.05}
          onChange={(v) => setSetting('sensitivity', v)}
        />
        <Slider
          label={tr('audio.smoothing')}
          value={settings.smoothing}
          min={0}
          max={0.95}
          step={0.01}
          onChange={(v) => {
            setSetting('smoothing', v);
            audioEngine.setSmoothing(v);
          }}
        />
        <Slider
          label={tr('audio.kickThreshold')}
          value={settings.kickThreshold}
          min={0.1}
          max={0.8}
          step={0.01}
          onChange={(v) => setSetting('kickThreshold', v)}
        />
        <Slider
          label={tr('audio.bassBoost')}
          value={settings.bassBoost}
          min={0}
          max={15}
          step={1}
          format={(v) => `${v} dB`}
          onChange={(v) => {
            setSetting('bassBoost', v);
            audioEngine.setBassBoost(v);
          }}
        />
      </PanelSection>

      <PanelSection title={tr('audio.midi')}>
        <div className="midi-state-row">
          <span className={`live-dot${ui.midiLearnTarget ? ' hot' : ''}`} />
          <span>{ui.midiState}</span>
        </div>
        <p className="hint" dangerouslySetInnerHTML={{ __html: tr('audio.midiHint') }} />
        <div className="midi-learn">
          {Object.entries(MIDI_PARAMS).map(([key]) => (
            <button
              key={key}
              type="button"
              className={`learn-chip${ui.midiLearnTarget === key ? ' armed' : ''}`}
              onClick={() => toggleLearn(key)}
            >
              {ui.midiLearnTarget === key ? '🎯 ' : ''}
              {tr(MIDI_LABEL_KEYS[key] ?? 'audio.sensitivity')}
            </button>
          ))}
        </div>
      </PanelSection>

      <div className="meta">
        <div>
          <strong>{tr('meta.source')}</strong> {settings.demoMode ? '🎧 Demo-Synth' : ui.sourceName}
        </div>
        <div>
          <strong>{tr('meta.beat')}</strong> <span className={`live-dot${ui.beatActive ? ' hot' : ''}`} /> {ui.beatText}
        </div>
        <div>
          <strong>{tr('meta.backend')}</strong> {engine.isWebGPU ? 'WebGPU' : 'WebGL2'}
        </div>
      </div>
    </>
  );
}
