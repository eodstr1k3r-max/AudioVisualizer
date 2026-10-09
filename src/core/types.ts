export type VisualMode = 'nebula' | 'spectrum' | 'tunnel' | 'terrain' | 'sphere' | 'shader' | 'fusion' | 'ripples' | 'solarsystem' | 'eclipse' | 'spaceeclipse' | 'aurora' | 'volcano' | 'storm' | 'reef' | 'blackhole' | 'comet' | 'cyberpunk' | 'crystalcave';
export type PlaybackMode = 'off' | 'all' | 'one' | 'shuffle';
export type Lang = 'de' | 'en';
export type OverlayPosition = 'top' | 'bottom';
export type CameraMode = 'auto' | 'orbit' | 'firstperson';
export type ColorPreset =
  | 'aurora' | 'sunset' | 'neon' | 'ice' | 'mono' | 'cyberpunk'
  | 'fire' | 'ocean' | 'gold' | 'toxic' | 'custom';
export type Quality = 'ultra' | 'high' | 'medium';
export type KickStyle = 'glow' | 'ripple' | 'pulse' | 'flash' | 'off';
export type RecordCodec = 'auto' | 'vp9' | 'av1' | 'h264';
export type RecordQuality = 'low' | 'medium' | 'high';
export type SpectrumScale = 'linear' | 'log';
export type FitMode = 'cover' | 'contain';

/** Pro Frame von der Audio-Engine berechnete Metriken */
export interface AudioData {
  energy: number;
  subBass: number;
  bass: number;
  mid: number;
  treble: number;
  presence: number;
  isKick: boolean;
  /** geglätteter Kick-Visual-Level 0..1 */
  kickLevel: number;
  freqData: Uint8Array | null;
  waveData: Uint8Array | null;
  /** RMS-Lautheit 0..1 */
  loudness: number;
  /** Spectral Flux (Onset-Energie) 0..1 */
  spectralFlux: number;
  /** geschätztes Tempo in BPM (0 = unbekannt) */
  bpm: number;
  /** Phase innerhalb des aktuellen Beats 0..1 (beat-synced Zeitbasis) */
  beatPhase: number;
  /** 1.0 genau auf dem Beat, sonst abfallend (0..1) */
  beatPulse: number;
  /** wahr für ~120ms nach jedem detektierten Beat */
  onBeat: boolean;
}

export interface Settings {
  mode: VisualMode;
  preset: ColorPreset;
  cameraMode: CameraMode;
  quality: Quality;
  sensitivity: number;
  smoothing: number;
  particleCount: number;
  kickThreshold: number;
  kickStyle: KickStyle;
  kickVisualStrength: number;
  spectrumScale: SpectrumScale;
  bassBoost: number;
  bgOpacity: number;
  bgContrast: number;
  bgFitMode: FitMode;
  bgScale: number;
  bgPosX: number;
  bgPosY: number;
  overlayVideoScale: number;
  overlayKeyThreshold: number;
  overlayKeySoftness: number;
  overlayVideoSpeed: number;
  recordResolution: '1920' | '2560' | '3840';
  recordFps: 24 | 30 | 60;
  recordCodec: RecordCodec;
  recordQuality: RecordQuality;
  /** Auto-Stopp nach N Sekunden (0 = unbegrenzt). */
  recordMaxSeconds: number;
  shaderPreset: string;
  shaderBlend: number;
  shaderCode: string;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  vignette: boolean;

  /* ---- v5.0 Cinematic-FX-Stack (audio-reaktiv, alle Szenen) ---- */
  /** Master-Schalter der filmischen Effekt-Ebene (unterhalb von Bloom) */
  fxEnabled: boolean;
  /** Chromatische Aberration (Farbfringe am Rand, pulsen auf Kick) */
  fxChromatic: boolean;
  /** Animiertes Film-Korn */
  fxGrain: boolean;
  /** CRT-Scanlines */
  fxScanlines: boolean;
  /** Color Grade: Sättigung + Kontrast-Anhebung */
  fxGrade: boolean;
  /** Gesamtintensität der FX-Ebene 0..1.5 */
  fxIntensity: number;

  /* ---- v3.1 Feature-Set ---- */
  /** Eingebauter Demo-Synth (Beat-Generator) als Audioquelle */
  demoMode: boolean;
  demoBpm: number;
  /** Live-Analyse-Monitor sichtbar */
  showMonitor: boolean;
  /** Kamera-Steuerung */
  cameraFov: number;
  cameraDistance: number;
  cameraHeight: number;
  autoSpeed: number;
  orbitSpeed: number;
  /** Szenen-Parameter */
  tunnelSpeed: number;
  terrainAmplitude: number;
  particleRotation: number;
  particleSymmetry: number;
  orbSize: number;
  /** Performance */
  autoQuality: boolean;
  /** OBS-Overlay-Modus */
  obsMode: boolean;
  /** Aufnahme mit Alpha-Kanal (transparenter Hintergrund) */
  alphaRecording: boolean;
  /** Eigene Akzentfarbe (Preset = 'custom') */
  customAccent: string;
  customAccent2: string;
  /** Aktiver Look-Preset-Name (UI) */
  lookPreset: string;
  /** Automatischer Szenen-Wechsel (Kiosk/Demo) */
  autoCycle: boolean;
  /** Intervall des Auto-Szenenwechsels in Sekunden */
  autoCycleSeconds: number;
  /** Master-Lautstärke 0..1 (Audio-Element + Demo-Synth) */
  volume: number;

  /* ---- v3.2 Feature-Set ---- */
  /** Wiedergabe-Modus: aus / alle / einer / zufall */
  playbackMode: PlaybackMode;
  /** UI-Sprache */
  lang: Lang;
  /** Logo-/Text-Overlay (leer = aus) – erscheint auch in Aufnahmen */
  overlayText: string;
  overlaySize: number;
  overlayPosition: OverlayPosition;
  overlayColor: string;

  /* ---- v4.4 Feature-Set ---- */
  /** Favorisierte Visual-Modi (angepinnt oben im Modus-Picker) */
  favoriteModes: VisualMode[];
}

export type ModeCategory = 'abstract' | 'space' | 'nature' | 'urban';

export const MODES: { id: VisualMode; label: string; icon: string; category: ModeCategory }[] = [
  { id: 'nebula', label: 'Nebula Galaxy', icon: '🌌', category: 'abstract' },
  { id: 'spectrum', label: 'Spectrum Towers', icon: '🏙️', category: 'abstract' },
  { id: 'tunnel', label: 'Hyperspace Tunnel', icon: '🌀', category: 'abstract' },
  { id: 'terrain', label: '3D Terrain', icon: '⛰️', category: 'abstract' },
  { id: 'sphere', label: 'Audio Sphere', icon: '🔮', category: 'abstract' },
  { id: 'shader', label: 'Shader Studio', icon: '💻', category: 'abstract' },
  { id: 'fusion', label: 'Fusion 3D', icon: '✨', category: 'abstract' },
  { id: 'ripples', label: 'Audio Ripples', icon: '🌊', category: 'abstract' },
  { id: 'solarsystem', label: 'Solar System', icon: '🪐', category: 'space' },
  { id: 'eclipse', label: 'Total Eclipse', icon: '🌑', category: 'space' },
  { id: 'spaceeclipse', label: 'Eclipse from Space', icon: '🌍', category: 'space' },
  { id: 'blackhole', label: 'Black Hole', icon: '🕳️', category: 'space' },
  { id: 'comet', label: 'Comet', icon: '☄️', category: 'space' },
  { id: 'aurora', label: 'Aurora', icon: '🌌', category: 'nature' },
  { id: 'volcano', label: 'Volcano', icon: '🌋', category: 'nature' },
  { id: 'storm', label: 'Storm at Sea', icon: '⛈️', category: 'nature' },
  { id: 'reef', label: 'Bioluminescent Reef', icon: '🐠', category: 'nature' },
  { id: 'crystalcave', label: 'Crystal Cave', icon: '💎', category: 'nature' },
  { id: 'cyberpunk', label: 'Cyberpunk Rain', icon: '🌆', category: 'urban' }
];

export const MODE_CATEGORY_LABELS: Record<ModeCategory, string> = {
  abstract: 'Abstract',
  space: 'Space',
  nature: 'Nature',
  urban: 'Urban'
};

export const PRESET_LIST: { id: ColorPreset; label: string }[] = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'neon', label: 'Neon' },
  { id: 'ice', label: 'Ice' },
  { id: 'mono', label: 'Mono' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'fire', label: 'Fire' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'gold', label: 'Gold' },
  { id: 'toxic', label: 'Toxic' },
  { id: 'custom', label: 'Eigene Farbe' }
];

export const CAMERA_MODES: { id: CameraMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto-Flight', hint: 'Audiogesteuerte Kamerafahrt' },
  { id: 'orbit', label: 'Orbit', hint: 'Mit Maus/Touch frei drehen' },
  { id: 'firstperson', label: 'First-Person', hint: 'WASD bewegen · Maus ziehen zum Schauen' }
];

export const QUALITY_OPTIONS: { id: Quality; label: string }[] = [
  { id: 'ultra', label: 'Ultra (4K-ready)' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' }
];

export const KICK_STYLES: { id: KickStyle; label: string }[] = [
  { id: 'glow', label: 'Soft Glow' },
  { id: 'ripple', label: 'Ripple Ring' },
  { id: 'pulse', label: 'Sanfter Puls' },
  { id: 'flash', label: 'Soft Flash' },
  { id: 'off', label: 'Aus' }
];
