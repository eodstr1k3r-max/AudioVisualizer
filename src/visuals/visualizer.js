import * as THREE from 'three';
import { state } from '../core/state.js';
import { analyzeAudio } from '../audio/audioEngine.js';
import { initShaderEngine, renderShader } from './shaderEngine.js';

const presets = {
  aurora: { name: 'Aurora', baseHue: 220, accent: '#8b5cf6', accent2: '#22d3ee', sat: 1, light: 0, spread: [0, 65, 140] },
  sunset: { name: 'Sunset', baseHue: 10, accent: '#f97316', accent2: '#ec4899', sat: 1, light: 4, spread: [0, 35, 85] },
  neon: { name: 'Neon', baseHue: 290, accent: '#a855f7', accent2: '#10b981', sat: 1.15, light: 2, spread: [0, 100, 180] },
  ice: { name: 'Ice', baseHue: 190, accent: '#38bdf8', accent2: '#a5f3fc', sat: 0.95, light: 6, spread: [0, 35, 70] },
  mono: { name: 'Mono', baseHue: 210, accent: '#94a3b8', accent2: '#e2e8f0', sat: 0.18, light: 10, spread: [0, 8, 16] },
  cyberpunk: { name: 'Cyberpunk', baseHue: 50, accent: '#eab308', accent2: '#ef4444', sat: 1.3, light: 5, spread: [0, 40, 110] }
};

let currentPreset = presets.aurora;
let canvas, ctx, threeCanvas;
let width = 0, height = 0, dpr = 1, renderScaleBoost = 1, cx = 0, cy = 0, baseRadius = 120;
let lastTime = performance.now();
let hueDrift = 0;
let pulse = 0;
let particles = [];

// Background & Video state
let backgroundImage = null;
export function getBackgroundImage() { return backgroundImage; }
let overlayVideoEl = null;
let overlayVideoReady = false;
const overlayProcessingCanvas = document.createElement('canvas');
const overlayProcessingCtx = overlayProcessingCanvas.getContext('2d', { willReadFrequently: true });

// Three.js scene state
let threeScene, threeCamera, threeRenderer, terrainMesh, sphereMesh;
let threeInitialized = false;

export function initVisualizer() {
  canvas = document.getElementById('visualizer');
  ctx = canvas.getContext('2d');
  threeCanvas = document.getElementById('threeCanvas');
  overlayVideoEl = document.getElementById('overlayVideo');

  applyPreset(state.preset);
  resize();
  initThreeJs();
  initShaderEngine();
  window.addEventListener('resize', resize);
}

export function applyPreset(name) {
  state.preset = name;
  currentPreset = presets[name] || presets.aurora;
  document.documentElement.style.setProperty('--accent', currentPreset.accent);
  document.documentElement.style.setProperty('--accent-2', currentPreset.accent2);
}

export function resize() {
  if (isRecording) {
    width = parseInt(state.recordResolution, 10) || 1920;
    height = Math.round(width * 9 / 16);
    dpr = 1;
  } else {
    const baseDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    dpr = Math.max(1, Math.min(baseDpr, 3));
    width = window.innerWidth;
    height = window.innerHeight;
  }

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  if (!isRecording) {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  } else {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  cx = width / 2;
  cy = height / 2;
  baseRadius = Math.min(width, height) * 0.16;

  rebalanceParticles();

  if (threeInitialized && threeRenderer) {
    threeRenderer.setSize(width, height);
    threeCamera.aspect = width / height;
    threeCamera.updateProjectionMatrix();
  }
}

function rebalanceParticles() {
  const target = state.particleCount;
  while (particles.length < target) {
    particles.push({
      angle: Math.random() * Math.PI * 2,
      radius: Math.random() * Math.min(width, height) * 0.52 + baseRadius * 0.55,
      speed: (Math.random() * 0.003 + 0.0005),
      size: Math.random() * 2.4 + 0.8,
      drift: (Math.random() - 0.5) * 0.24,
      wobble: Math.random() * 1.6 + 0.8,
      wobblePhase: Math.random() * Math.PI * 2,
      bandOffset: Math.floor(Math.random() * 64)
    });
  }
  while (particles.length > target) {
    particles.pop();
  }
}

function paletteHue(offset = 0) {
  const hue = (currentPreset.baseHue + hueDrift + offset) % 360;
  return hue < 0 ? hue + 360 : hue;
}

function hsla(offset = 0, sat = 100, light = 50, alpha = 1) {
  const s = Math.min(100, sat * currentPreset.sat);
  const l = Math.min(100, light + currentPreset.light);
  return `hsla(${paletteHue(offset)}, ${s}%, ${l}%, ${alpha})`;
}

// Three.js Setup
function initThreeJs() {
  try {
    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    threeCamera.position.set(0, -30, 40);
    threeCamera.lookAt(0, 10, 0);

    threeRenderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3D Terrain
    const geometry = new THREE.PlaneGeometry(80, 80, 48, 48);
    const material = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.rotation.x = -Math.PI / 2.3;
    terrainMesh.position.y = -20;
    threeScene.add(terrainMesh);

    // 3D Audio Sphere
    const sphereGeo = new THREE.SphereGeometry(12, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(0, 15, 0);
    threeScene.add(sphereMesh);

    threeInitialized = true;
  } catch (e) {
    console.error('Three.js initialization failed:', e);
    threeInitialized = false;
  }
}

function updateThreeScene(audioData) {
  if (!threeInitialized || !threeRenderer) return;
  const { energy, bass, treble, freqData } = audioData;

  threeCanvas.style.display = (state.mode === 'terrain' || state.mode === 'sphere') ? 'block' : 'none';

  if (state.mode === 'terrain' && terrainMesh && freqData) {
    terrainMesh.visible = true;
    sphereMesh.visible = false;
    const posAttr = terrainMesh.geometry.attributes.position;
    const count = posAttr.count;
    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const freqIdx = Math.floor(Math.abs(vx + 40) / 80 * 64);
      const val = (freqData[freqIdx] / 255) * bass * 12;
      posAttr.setZ(i, val);
    }
    posAttr.needsUpdate = true;
    terrainMesh.rotation.z += 0.002;
    threeRenderer.render(threeScene, threeCamera);
  } else if (state.mode === 'sphere' && sphereMesh) {
    terrainMesh.visible = false;
    sphereMesh.visible = true;
    const scale = 1 + bass * 0.8 + energy * 0.3;
    sphereMesh.scale.set(scale, scale, scale);
    sphereMesh.rotation.y += 0.005;
    sphereMesh.rotation.x += 0.003;
    threeRenderer.render(threeScene, threeCamera);
  } else {
    threeRenderer.clear();
  }
}

// Background Image Handler
export function setBackgroundImage(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    backgroundImage = img;
    const nameEl = document.getElementById('backgroundName');
    if (nameEl) nameEl.textContent = file.name;
  };
  img.src = url;
}

export function setOverlayVideo(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  overlayVideoReady = false;
  overlayVideoEl.src = url;
  overlayVideoEl.load();
  overlayVideoEl.onloadedmetadata = () => {
    overlayVideoReady = true;
    overlayVideoEl.play().catch(() => {});
    const nameEl = document.getElementById('overlayVideoName');
    if (nameEl) nameEl.textContent = file.name;
  };
}

function drawBackground(time, energy, bass, mid, treble) {
  ctx.fillStyle = '#030510';
  ctx.fillRect(0, 0, width, height);

  if (backgroundImage) {
    const imgRatio = backgroundImage.naturalWidth / backgroundImage.naturalHeight;
    const canvasRatio = width / height;
    const fit = state.bgFitMode;
    const scale = state.bgScale;
    let dw, dh;

    if (fit === 'contain') {
      if (imgRatio > canvasRatio) { dw = width; dh = dw / imgRatio; }
      else { dh = height; dw = dh * imgRatio; }
    } else {
      if (imgRatio > canvasRatio) { dh = height; dw = dh * imgRatio; }
      else { dw = width; dh = dw / imgRatio; }
    }
    dw *= scale; dh *= scale;

    const dx = (width - dw) / 2 + state.bgPosX * (width * 0.5);
    const dy = (height - dh) / 2 + state.bgPosY * (height * 0.5);

    ctx.save();
    ctx.globalAlpha = state.bgOpacity;
    ctx.filter = `contrast(${state.bgContrast * 100}%) saturate(120%) blur(${Math.max(0, (1 - state.bgContrast) * 4)}px)`;
    ctx.drawImage(backgroundImage, dx, dy, dw, dh);
    ctx.restore();
  }

  // Radial gradients based on preset
  const [a, b, c] = currentPreset.spread;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.65);
  g.addColorStop(0, hsla(a + bass * 35, 95, 18 + energy * 14, 0.28));
  g.addColorStop(0.5, hsla(b + mid * 30, 90, 10, 0.14));
  g.addColorStop(1, hsla(c + treble * 26, 85, 4, 0.9));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function drawCoreOrb(time, bass, energy, kickLevel) {
  const r = baseRadius * (0.55 + bass * 0.25 + pulse * 0.12 + kickLevel * 0.08);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.8);
  glow.addColorStop(0, hsla(currentPreset.spread[0] + 20, 100, 60 + energy * 20, 0.5));
  glow.addColorStop(0.35, hsla(currentPreset.spread[1], 100, 50, 0.2));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2);
  ctx.fill();

  const orb = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.08, cx, cy, r * 1.1);
  orb.addColorStop(0, 'rgba(255,255,255,0.95)');
  orb.addColorStop(0.25, hsla(currentPreset.spread[0] + 28, 100, 72, 0.9));
  orb.addColorStop(0.65, hsla(currentPreset.spread[2], 95, 52, 0.5));
  orb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawRadialSpectrum(audioData, kickLevel) {
  const { freqData, bass, mid, treble } = audioData;
  if (!freqData) return;
  const bars = 160;
  const usableBins = Math.max(bars, Math.floor(freqData.length * 0.8));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < bars; i++) {
    const sampleIdx = Math.floor((i / bars) * usableBins);
    const value = freqData[sampleIdx] / 255;
    const angle = (i / bars) * Math.PI * 2;
    const amp = Math.pow(value * state.sensitivity, 1.2);
    const inner = baseRadius * (1.25 + bass * 0.15 + kickLevel * 0.05);
    const length = 12 + amp * (Math.min(width, height) * 0.22) + kickLevel * 8;
    
    ctx.strokeStyle = hsla(i * 1.4 + treble * 90, 100, 56 + value * 24, 0.25 + value * 0.7);
    ctx.lineWidth = 1.2 + amp * 4.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * (inner + length), Math.sin(angle) * (inner + length));
    ctx.stroke();
  }
  ctx.restore();
}

function drawCircularWaveform(audioData, energy, kickLevel) {
  const { waveData } = audioData;
  if (!waveData) return;
  const radius = baseRadius * (0.9 + energy * 0.12 + kickLevel * 0.04);
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.18 + energy * 0.28})`;
  ctx.lineWidth = 1.6 + kickLevel;
  ctx.beginPath();
  for (let i = 0; i < waveData.length; i += 8) {
    const v = (waveData[i] - 128) / 128;
    const angle = (i / waveData.length) * Math.PI * 2;
    const wobble = v * baseRadius * 0.24;
    const x = cx + Math.cos(angle) * (radius + wobble);
    const y = cy + Math.sin(angle) * (radius + wobble);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawMirroredBars(audioData, kickLevel) {
  const { freqData, bass } = audioData;
  if (!freqData) return;
  const count = 88;
  const usableWidth = width * 0.78;
  const barSpace = usableWidth / count;
  const baseY = height * 0.78;
  const leftStart = (width - usableWidth) / 2;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const value = Math.min(1, (freqData[i * 2] / 255) * state.sensitivity);
    const h = 10 + Math.pow(value, 1.5) * (height * 0.34) + kickLevel * 10;
    const x = leftStart + i * barSpace;
    const w = Math.max(2, barSpace * 0.72);
    ctx.fillStyle = hsla(i * 2.2, 100, 52 + value * 22, 0.18 + value * 0.75);
    ctx.fillRect(x, baseY - h, w, h);
    ctx.fillRect(x, baseY + 4, w, h * (0.45 + bass * 0.25));
  }
  ctx.restore();
}

function drawTunnel(time, audioData, kickLevel) {
  const { energy, bass, treble } = audioData;
  const rings = 22;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const radius = baseRadius * (0.8 + t * 6.4 + Math.sin(time * 0.0016 + i * 0.45) * (0.1 + bass * 0.35 + kickLevel * 0.04));
    const alpha = 0.02 + (1 - t) * 0.12 + energy * 0.04;
    ctx.strokeStyle = hsla(i * 10 + treble * 90, 100, 45 + (1 - t) * 20, alpha);
    ctx.lineWidth = 0.8 + (1 - t) * 2.2 + kickLevel * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(time, audioData, kickLevel) {
  if (!particles.length) return;
  const { energy, treble, freqData } = audioData;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const band = freqData ? freqData[(p.bandOffset + i * 3) % freqData.length] / 255 : 0.1;
    p.angle += p.speed * (1 + energy * 5 + band * state.sensitivity * 2 + kickLevel * 2.5);
    p.radius += p.drift * (0.2 + energy * 0.8);

    const maxR = Math.min(width, height) * 0.55;
    if (p.radius < baseRadius * 0.55) p.radius = maxR;
    if (p.radius > maxR) p.radius = baseRadius * 0.6;

    const wobble = Math.sin(time * 0.0015 * p.wobble + p.wobblePhase) * (6 + band * 18 + kickLevel * 4);
    const x = cx + Math.cos(p.angle) * (p.radius + wobble);
    const y = cy + Math.sin(p.angle * 1.02) * (p.radius + wobble);
    const size = p.size + band * 4.5 + energy * 1.8 + kickLevel * 1.2;

    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
    glow.addColorStop(0, hsla(i * 1.7 + treble * 70, 100, 70, 0.35 + band * 0.4));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawKickAccent(time, kickLevel) {
  const style = state.kickStyle;
  if (style === 'off' || kickLevel <= 0.01) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (style === 'glow') {
    const r = baseRadius * (1.3 + kickLevel * 1.1);
    const g = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r * 2.5);
    g.addColorStop(0, hsla(currentPreset.spread[0] + 12, 100, 74, 0.05 + kickLevel * 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'flash') {
    ctx.fillStyle = hsla(currentPreset.spread[0], 100, 88, kickLevel * 0.1);
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawOverlayVideo() {
  if (!overlayVideoReady || !overlayVideoEl.videoWidth) return;
  const vw = overlayVideoEl.videoWidth;
  const vh = overlayVideoEl.videoHeight;
  const scale = Math.min(1, 480 / Math.max(vw, vh));
  const pw = Math.max(2, Math.round(vw * scale));
  const ph = Math.max(2, Math.round(vh * scale));

  if (overlayProcessingCanvas.width !== pw || overlayProcessingCanvas.height !== ph) {
    overlayProcessingCanvas.width = pw;
    overlayProcessingCanvas.height = ph;
  }

  if (overlayVideoEl.readyState >= 2) {
    overlayProcessingCtx.clearRect(0, 0, pw, ph);
    overlayProcessingCtx.drawImage(overlayVideoEl, 0, 0, pw, ph);
    const frame = overlayProcessingCtx.getImageData(0, 0, pw, ph);
    const data = frame.data;
    const thresh = state.overlayKeyThreshold;
    const soft = state.overlayKeySoftness;
    const startFade = Math.max(0, thresh - soft);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const minChan = Math.min(r, g, b);
      if (Math.max(r,g,b) - minChan <= 20 && minChan >= thresh) {
        data[i+3] = 0;
      } else if (minChan > startFade) {
        const mix = (minChan - startFade) / Math.max(1, thresh - startFade);
        data[i+3] = Math.round(data[i+3] * (1 - mix));
      }
    }
    overlayProcessingCtx.putImageData(frame, 0, 0);
  }

  const ratio = vw / vh;
  let dh = Math.min(width, height) * state.overlayVideoScale;
  let dw = dh * ratio;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;

  ctx.save();
  ctx.drawImage(overlayProcessingCanvas, dx, dy, dw, dh);
  ctx.restore();
}

export function renderVisualizer(time) {
  const dt = Math.min(40, time - lastTime);
  lastTime = time;
  hueDrift = (hueDrift + dt * 0.012) % 360;

  ctx.clearRect(0, 0, width, height);

  const audioData = analyzeAudio(time);
  const { energy, bass, mid, treble, isKick, kickVisualLevel } = audioData;

  pulse = Math.max(pulse * 0.93, bass * 0.9 + energy * 0.35 + kickVisualLevel * 0.45);

  updateThreeScene(audioData);
  renderShader(time, audioData, getBackgroundImage());

  if (state.mode !== 'terrain' && state.mode !== 'sphere' && state.mode !== 'shader') {
    if (state.mode === 'fusion') {
      ctx.save();
      ctx.globalAlpha = 1 - (state.shaderBlend || 0.65);
      drawBackground(time, energy, bass, mid, treble);
      ctx.restore();
    } else {
      drawBackground(time, energy, bass, mid, treble);
    }
    drawKickAccent(time, kickVisualLevel);

    const mode = state.mode;
    if (mode === 'nebula' || mode === 'fusion') {
      drawTunnel(time, audioData, kickVisualLevel);
      drawParticles(time, audioData, kickVisualLevel);
      drawCircularWaveform(audioData, energy, kickVisualLevel);
      drawRadialSpectrum(audioData, kickVisualLevel);
      drawCoreOrb(time, bass, energy, kickVisualLevel);
    } else if (mode === 'spectrum') {
      drawParticles(time, audioData, kickVisualLevel);
      drawMirroredBars(audioData, kickVisualLevel);
      drawCoreOrb(time, bass * 0.9, energy * 0.9, kickVisualLevel);
    } else if (mode === 'tunnel') {
      drawTunnel(time, audioData, kickVisualLevel);
      drawParticles(time, audioData, kickVisualLevel);
      drawRadialSpectrum(audioData, kickVisualLevel);
      drawCoreOrb(time, bass, energy, kickVisualLevel);
    } else { // hybrid
      drawTunnel(time, audioData, kickVisualLevel);
      drawParticles(time, audioData, kickVisualLevel);
      drawMirroredBars(audioData, kickVisualLevel);
      drawCircularWaveform(audioData, energy, kickVisualLevel);
      drawRadialSpectrum(audioData, kickVisualLevel);
      drawCoreOrb(time, bass, energy, kickVisualLevel);
    }

    drawOverlayVideo();
  }

  // Update Beat UI
  const beatDot = document.getElementById('beatDot');
  const beatState = document.getElementById('beatState');
  if (beatDot && beatState) {
    const isHot = isKick || bass > state.kickThreshold * 0.82;
    beatDot.classList.toggle('hot', isHot);
    beatState.textContent = isKick ? 'Kick erkannt' : (isHot ? 'Beat aktiv' : 'Bereit');
  }

  if (isRecording) {
    if (recordCanvas.width !== canvas.width || recordCanvas.height !== canvas.height) {
      recordCanvas.width = canvas.width;
      recordCanvas.height = canvas.height;
    }
    recordCtx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
    const shaderCanvasEl = document.getElementById('shaderCanvas');
    if (shaderCanvasEl && shaderCanvasEl.style.display !== 'none') {
      recordCtx.drawImage(shaderCanvasEl, 0, 0, recordCanvas.width, recordCanvas.height);
    }
    if (canvas) {
      recordCtx.drawImage(canvas, 0, 0, recordCanvas.width, recordCanvas.height);
    }
    if (threeCanvas && threeCanvas.style.display !== 'none') {
      recordCtx.drawImage(threeCanvas, 0, 0, recordCanvas.width, recordCanvas.height);
    }
  }

  requestAnimationFrame(renderVisualizer);
}

// MediaRecorder / Export
let mediaRecorder = null;
let recordingStream = null;
let recordedChunks = [];
let isRecording = false;
const recordCanvas = document.createElement('canvas');
const recordCtx = recordCanvas.getContext('2d');

export function startRecording(audioEl) {
  if (isRecording || !window.MediaRecorder) return;
  try {
    isRecording = true;
    resize();

    recordCanvas.width = canvas.width;
    recordCanvas.height = canvas.height;

    recordedChunks = [];
    const stream = recordCanvas.captureStream(60);
    const captureAudio = audioEl.captureStream ? audioEl.captureStream() : null;
    if (captureAudio) {
      captureAudio.getAudioTracks().forEach(t => stream.addTrack(t));
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16000000 });
    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = exportRecording;
    mediaRecorder.start(250);

    updateRecordingUi(true);
    document.getElementById('status').textContent = '1080p 16:9 Broadcast Aufnahme läuft...';
  } catch (e) {
    console.error('Recording failed:', e);
    isRecording = false;
    resize();
    alert('Aufnahme konnte nicht gestartet werden.');
  }
}

export function stopRecording() {
  if (!mediaRecorder || !isRecording) return;
  mediaRecorder.stop();
}

function exportRecording() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visualizer-1080p-${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  isRecording = false;
  resize();
  updateRecordingUi(false);
  document.getElementById('status').textContent = 'Aufnahme erfolgreich exportiert (1080p 16:9)';
}

function updateRecordingUi(active) {
  const startBtn = document.getElementById('recordStartButton');
  const stopBtn = document.getElementById('recordStopButton');
  const dot = document.getElementById('recordDot');
  const stateEl = document.getElementById('recordingState');

  if (startBtn) startBtn.disabled = active;
  if (stopBtn) stopBtn.disabled = !active;
  if (dot) dot.classList.toggle('rec', active);
  if (stateEl) stateEl.textContent = active ? 'Aufnahme läuft' : 'Nicht aktiv';
}

export function takeSnapshot() {
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = canvas.width;
  snapCanvas.height = canvas.height;
  const snapCtx = snapCanvas.getContext('2d');

  const shaderCanvasEl = document.getElementById('shaderCanvas');
  if (shaderCanvasEl && shaderCanvasEl.style.display !== 'none') {
    snapCtx.drawImage(shaderCanvasEl, 0, 0);
  }
  if (canvas) {
    snapCtx.drawImage(canvas, 0, 0);
  }
  if (threeCanvas && threeCanvas.style.display !== 'none') {
    snapCtx.drawImage(threeCanvas, 0, 0);
  }

  const url = snapCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `visualizer-snapshot-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  document.getElementById('status').textContent = 'High-Res Screenshot gespeichert!';
}
