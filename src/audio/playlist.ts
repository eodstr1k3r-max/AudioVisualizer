import { useStore, type TrackInfo } from '../core/store';
import type { PlaybackMode } from '../core/types';
import { t } from '../core/i18n';
import { audioEngine } from './AudioEngine';

function audioEl(): HTMLAudioElement {
  return document.getElementById('audio') as HTMLAudioElement;
}

/** Nächster Track-Index (zyklisch vorwärts). Gibt -1 zurück, wenn die Liste leer ist. */
export function nextTrackIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return 0;
  return (current + 1) % length;
}

/** Vorheriger Track-Index (zyklisch rückwärts). Gibt -1 zurück, wenn die Liste leer ist. */
export function prevTrackIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return length - 1;
  return (current - 1 + length) % length;
}

/** Zufälliger Track-Index, der nie dem aktuellen entspricht. Gibt -1 bei leerer Liste zurück. */
export function shuffleTrackIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  if (length === 1) return 0;
  let idx = Math.floor(Math.random() * length);
  while (idx === current) idx = Math.floor(Math.random() * length);
  return idx;
}

/** Entfernt einen Track und liefert den neuen aktuellen Index (oder -1). */
export function removeTrackIndex(current: number, removed: number): number {
  if (current === removed) return -1;
  if (current > removed) return current - 1;
  return current;
}

export function addTracks(files: FileList | File[]): void {
  const tracks: TrackInfo[] = Array.from(files)
    .filter((f) => f.type.startsWith('audio/'))
    .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));

  if (!tracks.length) return;

  const { ui, setUi } = useStore.getState();
  const newTracks = [...ui.tracks, ...tracks];
  const firstIndex = ui.tracks.length;
  setUi({ tracks: newTracks, currentTrackIndex: firstIndex });

  const el = audioEl();
  el.src = tracks[0].url;
  el.load();
  el.play().catch(() => {});
  setUi({ sourceName: tracks[0].name, status: t('status.playlistLoaded') });
  void audioEngine.ensureReady(el);
}

/** Track aus einer URL laden (Stream/MP3) und abspielen. */
export function loadUrlTrack(url: string): void {
  if (!url) return;
  const name = url.split('/').pop()?.split('?')[0] || 'Stream'; // Dateiname aus URL
  const { ui, setUi } = useStore.getState();
  const track: TrackInfo = { name: name.length > 3 ? name : 'Stream', url };
  const newTracks = [...ui.tracks, track];
  const index = ui.tracks.length;
  setUi({ tracks: newTracks, currentTrackIndex: index });

  const el = audioEl();
  el.src = url;
  el.load();
  el.play().catch(() => {});
  setUi({ sourceName: track.name, status: t('status.streamLoaded') });
  void audioEngine.ensureReady(el);
}

export function playTrack(index: number): void {
  const { ui, setUi } = useStore.getState();
  const track = ui.tracks[index];
  if (!track) return;
  const el = audioEl();
  el.src = track.url;
  el.load();
  el.play().catch(() => {});
  setUi({ currentTrackIndex: index, sourceName: track.name, playing: true });
}

export function nextTrack(): void {
  const { ui, setUi } = useStore.getState();
  if (!ui.tracks.length) return;
  const idx = nextTrackIndex(ui.currentTrackIndex, ui.tracks.length);
  playTrack(idx);
  setUi({ currentTrackIndex: idx });
}

export function prevTrack(): void {
  const { ui, setUi } = useStore.getState();
  if (!ui.tracks.length) return;
  const idx = prevTrackIndex(ui.currentTrackIndex, ui.tracks.length);
  playTrack(idx);
  setUi({ currentTrackIndex: idx });
}

export function removeTrack(index: number): void {
  const { ui, setUi } = useStore.getState();
  const tracks = [...ui.tracks];
  tracks.splice(index, 1);
  const current = removeTrackIndex(ui.currentTrackIndex, index);
  setUi({ tracks, currentTrackIndex: current });
  if (current < 0) {
    const el = audioEl();
    el.pause();
    el.removeAttribute('src');
  }
}

/**
 * Nächster Track-Index gemäß Wiedergabe-Modus (pur & testbar).
 * -1 bedeutet: Wiedergabe stoppen. Leere Liste → -1.
 */
export function nextIndexForMode(mode: PlaybackMode, current: number, length: number): number {
  if (length <= 0) return -1;
  if (mode === 'off') return -1;
  if (mode === 'one') return current >= 0 ? current : -1;
  if (mode === 'shuffle') return shuffleTrackIndex(current, length);
  return nextTrackIndex(current, length); // 'all'
}

/**
 * Wird vom <audio>-Element bei 'ended' aufgerufen.
 * Respektiert den Wiedergabe-Modus: off = stoppen, one = wiederholen,
 * shuffle = zufälliger Track, all = nächster Track.
 */
export function handleTrackEnded(): void {
  const { settings, ui, setUi } = useStore.getState();
  const idx = nextIndexForMode(settings.playbackMode, ui.currentTrackIndex, ui.tracks.length);
  if (idx < 0) {
    if (ui.tracks.length) setUi({ playing: false, status: t('status.playbackEnded') });
    return;
  }
  playTrack(idx);
}
