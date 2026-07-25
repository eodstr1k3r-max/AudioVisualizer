export const state = {
  mode: 'nebula',
  preset: 'aurora',
  sensitivity: 1.45,
  smoothing: 0.82,
  particleCount: 140,
  kickThreshold: 0.29,
  kickStyle: 'glow',
  kickVisualStrength: 0.45,
  bgOpacity: 0.30,
  bgContrast: 0.55,
  bgFitMode: 'cover',
  bgScale: 1.0,
  bgPosX: 0.0,
  bgPosY: 0.0,
  overlayVideoScale: 0.6,
  overlayKeyThreshold: 222,
  overlayKeySoftness: 22,
  overlayVideoSpeed: 1.0,
  recordResolution: 1,
  spectrumScale: 'linear',
  bassBoost: 3,
  shaderPreset: 'cybergrid',
  shaderBlend: 0.65,
  shaderCode: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 color = vec3(0.0);

    float d = length(st);
    float angle = atan(st.y, st.x);

    // Audio reactive rings
    float r = sin(d * 10.0 - u_time * 2.0 + u_bass * 5.0);
    color += vec3(0.2, 0.5, 1.0) * (u_bass / (abs(r) + 0.1));

    // Kick flash
    color += vec3(0.8, 0.2, 0.5) * u_kick * (1.0 - d);

    // Energy grid
    color.r += sin(st.x * 10.0 + u_time) * u_energy * 0.2;
    color.b += cos(st.y * 10.0 - u_time) * u_treble * 0.2;

    gl_FragColor = vec4(color, 1.0);
}`,
  isPlaying: false
};

const STORAGE_KEY = 'audio_visualizer_ultimate_settings_v1';

export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}
