import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../core/store';
import { extractShareParams } from '../core/settingsIO';
import { sessionStats, formatPlayTime, formatBytes } from '../core/sessionStats';
import { useT, t, translateOrFallback, type TKey } from '../core/i18n';
import { MODES, PRESET_LIST, CAMERA_MODES, type Lang } from '../core/types';
import { paletteFor } from '../core/colorPresets';
import { engine } from '../engine/Engine';
import { addTracks, handleTrackEnded } from '../audio/playlist';
import { Tabs, type TabDef } from './components/ui';
import { LiveSpectrum } from './components/LiveSpectrum';
import { AudioPanel } from './panels/AudioPanel';
import { VisualsPanel } from './panels/VisualsPanel';
import { CameraPanel } from './panels/CameraPanel';
import { ShaderPanel } from './panels/ShaderPanel';
import { BgVideoPanel } from './panels/BgVideoPanel';
import { ExportPanel } from './panels/ExportPanel';

const TAB_IDS = ['audio', 'visuals', 'camera', 'shader', 'bg', 'export'] as const;
const TAB_ICONS: Record<(typeof TAB_IDS)[number], string> = {
  audio: '🎵',
  visuals: '✨',
  camera: '🎥',
  shader: '💻',
  bg: '🖼️',
  export: '💾'
};

/** Fängt Laufzeit-Fehler in den Panels ab, statt die ganze App zu crashen. */
class PanelErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(err: unknown): void {
    console.error('Panel-Fehler:', err);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="panel-error">
          <strong>{t('panel.crashed')}</strong>
          <button type="button" className="btn ghost" onClick={() => this.setState({ hasError: false })}>
            {t('panel.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  // Aktiven Tab über Sitzungen hinweg merken (QoL)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('avp3-active-tab');
      return saved && TAB_IDS.includes(saved as (typeof TAB_IDS)[number]) ? saved : 'audio';
    } catch {
      return 'audio';
    }
  });
  const [panelOpen, setPanelOpen] = useState(true);

  const settings = useStore((s) => s.settings);
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const setSetting = useStore((s) => s.setSetting);
  const tr = useT();

  const tabs: TabDef[] = TAB_IDS.map((id) => ({
    id,
    icon: TAB_ICONS[id],
    label: tr(`app.tabs.${id}` as TKey)
  }));

  /* Tab-Wechsel persistieren */
  useEffect(() => {
    try {
      localStorage.setItem('avp3-active-tab', activeTab);
    } catch { /* In-Memory-Fallback */ }
  }, [activeTab]);

  /* Doppelklick auf den Viewport toggelt Clean Mode (Desktop-Parität zum Doppeltipp) */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let lastClick = 0;
    const onDown = (): void => {
      const now = performance.now();
      if (now - lastClick < 320) {
        const s = useStore.getState();
        s.setUi({ cleanMode: !s.ui.cleanMode });
        lastClick = 0;
        return;
      }
      lastClick = now;
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, []);

  /* Deep-Link-Parameter: ?mode=shader&preset=neon&camera=orbit&demoMode=1&demoBpm=140 … */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const { settings, setSettings } = useStore.getState();
    const partial = extractShareParams(params, settings);
    // Enum-Felder zusätzlich gegen gültige Werte validieren
    if (partial.mode && !MODES.some((m) => m.id === partial.mode)) delete partial.mode;
    if (partial.preset && !PRESET_LIST.some((p) => p.id === partial.preset)) delete partial.preset;
    if (partial.cameraMode && !CAMERA_MODES.some((c) => c.id === partial.cameraMode)) delete partial.cameraMode;
    if (partial.quality && !['ultra', 'high', 'medium'].includes(partial.quality)) delete partial.quality;
    if (Object.keys(partial).length > 0) setSettings(partial);
  }, []);

  /* Engine booten */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!viewportRef.current) return;
      try {
        await engine.init(viewportRef.current);
        if (!cancelled) setBooted(true);
      } catch (e) {
        console.error('Engine-Init fehlgeschlagen:', e);
        if (!cancelled) setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Farb-Preset als CSS-Tokens (inkl. Custom-Farben) */
  useEffect(() => {
    const p = paletteFor(settings.preset, settings);
    document.documentElement.style.setProperty('--accent', p.accent);
    document.documentElement.style.setProperty('--accent-2', p.accent2);
  }, [settings.preset, settings.customAccent, settings.customAccent2]);

  /* Sprache: statische Default-Texte (Status, Quelle, MIDI, Beat) beim Wechsel nachziehen –
     nur solange sie noch unverändert die alten Defaults sind (live-Status bleibt unangetastet). */
  useEffect(() => {
    const { ui: u, setUi: su } = useStore.getState();
    const patch: Record<string, string> = {};
    if (u.status === 'Ready · Lade Musik oder aktiviere Mikrofon') patch.status = t('status.ready');
    if (u.sourceName === 'Keine Quelle') patch.sourceName = t('source.none');
    if (u.midiState === 'Kein MIDI-Controller') patch.midiState = t('status.midiNone');
    if (u.beatText === 'Bereit') patch.beatText = t('status.beatReady');
    if (Object.keys(patch).length) su(patch);
  }, [settings.lang]);

  /* Audio-Element Events (inkl. Fortschritt für den Seek-Balken) */
  useEffect(() => {
    const el = document.getElementById('audio') as HTMLAudioElement | null;
    if (!el) return;
    let lastUpdate = 0;
    const onPlay = (): void => {
      setUi({ playing: true });
      sessionStats.tracksStarted++;
    };
    const onPause = (): void => setUi({ playing: false });
    const onEnded = (): void => handleTrackEnded();
    const onTime = (): void => {
      // ~5×/s reicht für die Anzeige (kein unnötiges Re-Rendering)
      const now = performance.now();
      if (now - lastUpdate < 180) return;
      lastUpdate = now;
      setUi({ trackTime: el.currentTime, trackDuration: el.duration || 0 });
    };
    const onMeta = (): void => setUi({ trackDuration: el.duration || 0, trackTime: 0 });
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
    };
  }, [setUi]);

  /* Fullscreen-API togglen */
  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  /* Keyboard-Shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? '';
      if (['input', 'textarea', 'select'].includes(tag)) return;
      // Modifier-Kombinationen (Ctrl/Cmd/Alt) nicht abfangen – Browser-Shortcuts behalten Vorrang
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { settings: s, ui: u, setSetting: ss, setUi: su } = useStore.getState();

      if (e.code === 'Space' && !e.repeat) {
        // Im First-Person-Modus gehört Space dem Fliegen (aufsteigen) –
        // dort Play/Pause NICHT auslösen (sonst Kamera- vs. Playback-Konflikt).
        if (!s.demoMode && s.cameraMode !== 'firstperson') {
          e.preventDefault();
          void engine.playPause();
        }
      } else if (e.key >= '1' && e.key <= '9') {
        // Direkter Modus-Wechsel: 1=Nebula … 9=Solar System (Modi 10–19: Dropdown oder „M")
        const modes = MODES.map((m) => m.id);
        const idx = parseInt(e.key, 10) - 1;
        if (modes[idx]) ss('mode', modes[idx]);
      } else if (e.key === '0') {
        // 10. Modus (Total Eclipse; Modi 11–19 nur per Dropdown/„M")
        const modes = MODES.map((m) => m.id);
        if (modes[9]) ss('mode', modes[9]);
      } else if (e.key === 'm' || e.key === 'M') {
        const modes = MODES.map((m) => m.id);
        const i = modes.indexOf(s.mode);
        ss('mode', modes[(i + 1) % modes.length]);
      } else if (e.key === 'p' || e.key === 'P') {
        const presets = PRESET_LIST.map((p) => p.id);
        const i = presets.indexOf(s.preset);
        ss('preset', presets[(i + 1) % presets.length]);
      } else if (e.key === 'k' || e.key === 'K') {
        const cams = CAMERA_MODES.map((c) => c.id);
        const i = cams.indexOf(s.cameraMode);
        ss('cameraMode', cams[(i + 1) % cams.length]);
      } else if (e.key === 'f' || e.key === 'F') {
        if (e.shiftKey) {
          toggleFullscreen();
        } else {
          su({ cleanMode: !u.cleanMode });
        }
      } else if (e.key === 'q' || e.key === 'Q') {
        // Einstellungen-Drawer ein-/ausklappen
        setPanelOpen((open) => !open);
      } else if (e.key === 'r' || e.key === 'R') {
        // Aufnahme start/stopp
        if (u.recording) engine.recorder?.stop();
        else void engine.recorder?.start();
      } else if (e.key === 's' || e.key === 'S') {
        void engine.recorder?.snapshot();
      } else if (e.key === 'b' || e.key === 'B') {
        ss('bloomEnabled', !s.bloomEnabled);
      } else if (e.key === 'x' || e.key === 'X') {
        // v5: Cinematic-FX-Ebene komplett an/aus
        ss('fxEnabled', !s.fxEnabled);
      } else if (e.key === '?') {
        su({ helpOpen: !u.helpOpen });
      } else if (e.key === 'Escape') {
        su({ cleanMode: false, helpOpen: false });
        setPanelOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Session-Statistik: Spielzeit zählt, solange gespielt wird */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (useStore.getState().ui.playing) sessionStats.playSeconds++;
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* Session-Statistik: Kicks zählen (steigende Flanke von beatActive) */
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      if (state.ui.beatActive && !prev.ui.beatActive) sessionStats.kicks++;
    });
  }, []);

  /* Session-Statistik: Modus-Wechsel zählen (ohne den initialen Mount) */
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    sessionStats.modeChanges++;
  }, [settings.mode]);

  /* Auto-Szenen-Wechsel (Kiosk/Demo-Modus) – Intervall einstellbar (5–60 s) */
  useEffect(() => {
    if (!settings.autoCycle) return;
    const interval = Math.max(5, Math.min(60, settings.autoCycleSeconds || 15)) * 1000;
    const id = window.setInterval(() => {
      const { settings: s, setSetting } = useStore.getState();
      const modes = MODES.map((m) => m.id);
      const i = modes.indexOf(s.mode);
      setSetting('mode', modes[(i + 1) % modes.length]);
    }, interval);
    return () => window.clearInterval(id);
  }, [settings.autoCycle, settings.autoCycleSeconds]);

  /* Touch-Gesten: Swipe = Modi/Presets, Doppeltipp = Clean Mode */
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let lastTap = 0;

    const onTouchStart = (e: TouchEvent): void => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      const now = performance.now();
      if (now - lastTap < 320) {
        const s = useStore.getState();
        s.setUi({ cleanMode: !s.ui.cleanMode });
      }
      lastTap = now;
    };

    const onTouchEnd = (e: TouchEvent): void => {
      if (e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const { settings, setSetting } = useStore.getState();
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? '';
      if (['input', 'select', 'textarea'].includes(tag)) return;

      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
        const modes = MODES.map((m) => m.id);
        const i = modes.indexOf(settings.mode);
        setSetting('mode', modes[(i + (dx > 0 ? -1 : 1) + modes.length) % modes.length]);
      } else if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx)) {
        const presets = PRESET_LIST.map((p) => p.id);
        const i = presets.indexOf(settings.preset);
        setSetting('preset', presets[(i + (dy > 0 ? -1 : 1) + presets.length) % presets.length]);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  /* Drag & Drop */
  useEffect(() => {
    const dropzone = document.getElementById('dropzone');
    let depth = 0;

    const inc = (e: DragEvent): void => {
      e.preventDefault();
      depth++;
      dropzone?.classList.add('active');
    };
    const dec = (e: DragEvent): void => {
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) dropzone?.classList.remove('active');
    };
    const drop = (e: DragEvent): void => {
      e.preventDefault();
      depth = 0;
      dropzone?.classList.remove('active');
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      const audio: File[] = [];
      for (const f of Array.from(files)) {
        if (f.type.startsWith('audio/')) audio.push(f);
        else if (f.type.startsWith('image/')) engine.setBackgroundImage(f);
        else if (f.type.startsWith('video/')) engine.setOverlayVideo(f);
      }
      if (audio.length) addTracks(audio);
    };

    window.addEventListener('dragenter', inc);
    window.addEventListener('dragover', inc);
    window.addEventListener('dragleave', dec);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', inc);
      window.removeEventListener('dragover', inc);
      window.removeEventListener('dragleave', dec);
      window.removeEventListener('drop', drop);
    };
  }, []);

  /* Szenen-Übergang: kurzes Fade-through-black beim Modus-Wechsel */
  const [fadeKey, setFadeKey] = useState(0);
  const prevModeRef = useRef(settings.mode);
  useEffect(() => {
    if (prevModeRef.current !== settings.mode) {
      prevModeRef.current = settings.mode;
      setFadeKey((k) => k + 1);
    }
  }, [settings.mode]);

  const modeMeta = MODES.find((m) => m.id === settings.mode);
  const presetMeta = PRESET_LIST.find((p) => p.id === settings.preset);
  const camMeta = CAMERA_MODES.find((c) => c.id === settings.cameraMode);

  return (
    <div id="app" className={ui.cleanMode ? 'clean' : ''}>
      <div id="viewport" ref={viewportRef} />
      {fadeKey > 0 && <div key={fadeKey} className="mode-fade" aria-hidden="true" />}

      <audio id="audio" />

      {!booted && !bootError && (
        <div className="boot-overlay">
          <div className="spinner" />
          <div>{tr('boot.init')}</div>
        </div>
      )}

      {bootError && (
        <div className="boot-overlay error">
          <div className="boot-error-icon">⚠️</div>
          <div className="boot-error-title">{tr('boot.errTitle')}</div>
          <div className="boot-error-msg">{bootError}</div>
          <p className="hint" style={{ marginTop: 12 }}>
            {tr('boot.errHint')}
          </p>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              {tr('boot.reload')}
            </button>
          </div>
        </div>
      )}

      {/* GPU-Kontext zur Laufzeit verloren (Treiberreset) → Reload-Angebot */}
      {ui.contextLost && (
        <div className="boot-overlay error" role="alert">
          <div className="boot-error-icon">📉</div>
          <div className="boot-error-title">{tr('ctx.lostTitle')}</div>
          <div className="boot-error-msg">{tr('ctx.lostMsg')}</div>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              {tr('boot.reload')}
            </button>
          </div>
        </div>
      )}

      {/* Kamera-Blitz bei Screenshot (key=flashTick startet die Animation neu) */}
      {ui.flashTick > 0 && <div key={ui.flashTick} className="snap-flash" aria-hidden="true" />}

      <div className="dropzone" id="dropzone">
        <div>
          <strong>{tr('drop.title')}</strong>
          <span>{tr('drop.hint')}</span>
        </div>
      </div>

      {/* ============================ Broadcast-Cockpit ============================ */}
      <div className="topbar">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">
            <span className="brand-ring" />
            🎛️
          </span>
          <h1>
            Visualizer <span className="badge">v5</span>
          </h1>
        </div>

        {/* Globale Transport-Leiste: immer erreichbar, unabhängig vom Panel */}
        <div className="transport" role="group" aria-label="Transport">
          <button
            type="button"
            className={`transport-btn${ui.playing ? ' active' : ''}`}
            onClick={() => void engine.playPause()}
            disabled={settings.demoMode}
            title={tr('help.play')}
            aria-label={tr('help.play')}
          >
            {ui.playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className={`transport-btn${ui.micActive ? ' active' : ''}`}
            onClick={() => void engine.toggleMicrophone()}
            disabled={settings.demoMode}
            title={tr('audio.mic')}
            aria-label={tr('audio.mic')}
          >
            🎙️
          </button>
          <button
            type="button"
            className={`transport-btn rec${ui.recording ? ' active' : ''}`}
            onClick={() => (ui.recording ? engine.recorder?.stop() : void engine.recorder?.start())}
            title={tr('help.rec')}
            aria-label={tr('help.rec')}
          >
            {ui.recording ? '⏹' : '⏺'}
          </button>
          <button
            type="button"
            className="transport-btn"
            onClick={() => void engine.recorder?.snapshot()}
            title={tr('help.snap')}
            aria-label={tr('help.snap')}
          >
            📸
          </button>
        </div>

        {/* Live-Spektrum: audio-reaktiver Monitor direkt in der Topbar */}
        <div className="spectrum-pill" aria-hidden="true">
          <LiveSpectrum width={148} height={30} />
        </div>

        <div className="topbar-spacer" />

        <div className="topbar-status">
          <span className={`live-dot${ui.recording ? ' rec' : ui.beatActive ? ' hot' : ''}`} />
          <span className="status-text" role="status" aria-live="polite">{ui.status}</span>
          {ui.recording && (
            <span className={`rec-timer${ui.recPaused ? ' paused' : ''}`}>
              {ui.recPaused ? '⏸' : '⏺'} {formatPlayTime(ui.recSeconds)} · {formatBytes(ui.recSizeBytes)}
            </span>
          )}
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className={`icon-btn${ui.cleanMode ? ' active' : ''}`}
            onClick={() => setUi({ cleanMode: !ui.cleanMode })}
            title={tr('help.clean')}
            aria-label={tr('help.clean')}
          >
            🖥️
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleFullscreen}
            title={tr('app.fullscreen')}
            aria-label={tr('app.fullscreen')}
          >
            ⛶
          </button>
          <div className="lang-toggle" role="group" aria-label="Sprache / Language">
            {(['de', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                className={`lang-btn${settings.lang === l ? ' active' : ''}`}
                onClick={() => setSetting('lang', l)}
                title={tr(`app.lang.${l}` as TKey)}
                aria-pressed={settings.lang === l}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setUi({ helpOpen: true })}
            title={tr('app.help')}
            aria-label={tr('app.help')}
          >
            ?
          </button>
        </div>
      </div>

      {/* Einstellungen-Drawer (rechts, einklappbar) */}
      <div className={`ui${panelOpen ? '' : ' collapsed'}`}>
        {!panelOpen && (
          <button
            type="button"
            className="drawer-open"
            onClick={() => setPanelOpen(true)}
            title={tr('app.openPanel')}
            aria-label={tr('app.openPanel')}
          >
            🎛️
          </button>
        )}
        <div className="drawer">
          <div className="panel">
            <div className="panel-scroll">
              <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
              <div className="tab-body" role="tabpanel" id={`tab-panel-${activeTab}`} aria-labelledby={`tab-btn-${activeTab}`}>
                <PanelErrorBoundary>
                  {activeTab === 'audio' && <AudioPanel />}
                  {activeTab === 'visuals' && <VisualsPanel />}
                  {activeTab === 'camera' && <CameraPanel />}
                  {activeTab === 'shader' && <ShaderPanel />}
                  {activeTab === 'bg' && <BgVideoPanel />}
                  {activeTab === 'export' && <ExportPanel />}
                </PanelErrorBoundary>
              </div>
            </div>
            <button
              type="button"
              className="panel-close"
              onClick={() => setPanelOpen(false)}
              title={tr('app.closePanel')}
              aria-label={tr('app.closePanel')}
            >
              ✕
            </button>
          </div>
          <button
            type="button"
            className="panel-collapse"
            onClick={() => setPanelOpen(false)}
            title={tr('app.closePanel')}
            aria-label={tr('app.closePanel')}
          >
            »
          </button>
        </div>
      </div>

      <div className="hud">
        <button
          type="button"
          className="hud-chip hud-click"
          onClick={() => { setPanelOpen(true); setActiveTab('visuals'); }}
          title={tr('app.openPanel')}
        >
          <span className="hud-ico" aria-hidden="true">{modeMeta?.icon}</span>
          <span className="hud-body">
            <span className="hud-label">{tr('hud.scene')}</span>
            <span className="hud-value">{modeMeta ? translateOrFallback(tr, `modes.${modeMeta.id}`, modeMeta.label) : ''}</span>
          </span>
        </button>
        <button
          type="button"
          className="hud-chip hud-click"
          onClick={() => { setPanelOpen(true); setActiveTab('visuals'); }}
          title={tr('app.openPanel')}
        >
          <span className="hud-ico" aria-hidden="true">🎨</span>
          <span className="hud-body">
            <span className="hud-label">{tr('hud.palette')}</span>
            <span className="hud-value">{presetMeta?.label}</span>
          </span>
        </button>
        <button
          type="button"
          className="hud-chip hud-click"
          onClick={() => { setPanelOpen(true); setActiveTab('camera'); }}
          title={tr('app.openPanel')}
        >
          <span className="hud-ico" aria-hidden="true">🎥</span>
          <span className="hud-body">
            <span className="hud-label">{tr('hud.camera')}</span>
            <span className="hud-value">{camMeta?.label}</span>
          </span>
        </button>
        <div className="hud-chip">
          <span className="hud-ico" aria-hidden="true">⚡</span>
          <span className="hud-body">
            <span className="hud-label">{engine.isWebGPU ? 'WebGPU' : 'WebGL2'}</span>
            <span className="hud-value">{settings.quality} · {ui.fps} FPS</span>
          </span>
        </div>
        {ui.loadingScene && (
          <div className="hud-chip loading">
            <span className="hud-ico">⏳</span>
            <span className="hud-body">
              <span className="hud-value">{tr('hud.loadingScene')}</span>
            </span>
          </div>
        )}
        {settings.obsMode && (
          <div className="hud-chip obs">
            <span className="hud-ico">🔴</span>
            <span className="hud-body">
              <span className="hud-value">{tr('hud.obs')}</span>
            </span>
          </div>
        )}
      </div>

      {ui.helpOpen && (
        <div className="modal-backdrop" onClick={() => setUi({ helpOpen: false })}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="help-title">{tr('help.title')}</h2>
            <div className="shortcut-list">
              <div className="shortcut-item"><span>{tr('help.play')}</span><kbd>Space</kbd></div>
              <div className="shortcut-item"><span>{tr('help.mode')}</span><kbd>M</kbd></div>
              <div className="shortcut-item"><span>{tr('help.modeDirect')}</span><kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> ({tr('help.modeDirectRest')})</div>
              <div className="shortcut-item"><span>{tr('help.preset')}</span><kbd>P</kbd></div>
              <div className="shortcut-item"><span>{tr('help.camera')}</span><kbd>K</kbd></div>
              <div className="shortcut-item"><span>{tr('help.clean')}</span><kbd>F</kbd> / <kbd>Doppeltipp</kbd></div>
              <div className="shortcut-item"><span>{tr('help.fullscreen')}</span><kbd>Shift+F</kbd></div>
              <div className="shortcut-item"><span>{tr('help.rec')}</span><kbd>R</kbd></div>
              <div className="shortcut-item"><span>{tr('help.snap')}</span><kbd>S</kbd></div>
              <div className="shortcut-item"><span>{tr('help.bloom')}</span><kbd>B</kbd></div>
              <div className="shortcut-item"><span>{tr('help.fx')}</span><kbd>X</kbd></div>
              <div className="shortcut-item"><span>{tr('app.openPanel')}</span><kbd>Q</kbd></div>
              <div className="shortcut-item"><span>{tr('help.help')}</span><kbd>?</kbd> / <kbd>ESC</kbd></div>
            </div>
            <div className="button-row" style={{ marginTop: 16 }}>
              <button type="button" className="btn" autoFocus onClick={() => setUi({ helpOpen: false })}>
                {tr('help.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
