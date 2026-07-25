import { state, loadSettings, saveSettings } from '../core/state.js';
import { ensureAudioReady, toggleMicrophone, updateSmoothing, updateBassBoost } from '../audio/audioEngine.js';
import { initVisualizer, applyPreset, setBackgroundImage, setOverlayVideo, startRecording, stopRecording } from '../visuals/visualizer.js';
import { compileShader, shaderPresets } from '../visuals/shaderEngine.js';

export function initUi() {
  loadSettings();
  initVisualizer();
  setupTabs();
  setupControls();
  setupKeyboardShortcuts();
  setupDragAndDrop();
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');
    });
  });
}

function setupControls() {
  const audioEl = document.getElementById('audio');
  const fileInput = document.getElementById('fileInput');
  const bgInput = document.getElementById('backgroundInput');
  const videoInput = document.getElementById('overlayVideoInput');
  const micBtn = document.getElementById('micButton');
  const playBtn = document.getElementById('playButton');
  const fullscreenBtn = document.getElementById('fullscreenButton');
  const cleanFullscreenBtn = document.getElementById('cleanFullscreenButton');
  const recordStartBtn = document.getElementById('recordStartButton');
  const recordStopBtn = document.getElementById('recordStopButton');
  const helpBtn = document.getElementById('helpBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const helpModal = document.getElementById('helpModal');

  // Inputs & Bindings
  const bindings = [
    { id: 'mode', key: 'mode', type: 'value' },
    { id: 'preset', key: 'preset', type: 'value', callback: val => applyPreset(val) },
    { id: 'sensitivity', key: 'sensitivity', type: 'float', display: 'valSens' },
    { id: 'smoothing', key: 'smoothing', type: 'float', display: 'valSmooth', callback: val => updateSmoothing(val) },
    { id: 'particleCount', key: 'particleCount', type: 'int', display: 'valParticles' },
    { id: 'kickThreshold', key: 'kickThreshold', type: 'float', display: 'valKickThresh' },
    { id: 'kickStyle', key: 'kickStyle', type: 'value' },
    { id: 'kickVisualStrength', key: 'kickVisualStrength', type: 'float', display: 'valKickStr' },
    { id: 'bgOpacity', key: 'bgOpacity', type: 'float', display: 'valBgOp' },
    { id: 'bgContrast', key: 'bgContrast', type: 'float', display: 'valBgCon' },
    { id: 'bgFitMode', key: 'bgFitMode', type: 'value' },
    { id: 'bgScale', key: 'bgScale', type: 'float', display: 'valBgZoom' },
    { id: 'bgPosX', key: 'bgPosX', type: 'float', display: 'valBgX' },
    { id: 'bgPosY', key: 'bgPosY', type: 'float', display: 'valBgY' },
    { id: 'overlayVideoScale', key: 'overlayVideoScale', type: 'float', display: 'valVidScale' },
    { id: 'overlayKeyThreshold', key: 'overlayKeyThreshold', type: 'int', display: 'valKeyThresh' },
    { id: 'overlayKeySoftness', key: 'overlayKeySoftness', type: 'int', display: 'valKeySoft' },
    { id: 'overlayVideoSpeed', key: 'overlayVideoSpeed', type: 'float', display: 'valVidSpeed', callback: val => {
      const vEl = document.getElementById('overlayVideo');
      if (vEl) vEl.playbackRate = val;
    }},
    { id: 'recordResolution', key: 'recordResolution', type: 'float' },
    { id: 'spectrumScale', key: 'spectrumScale', type: 'value' },
    { id: 'bassBoost', key: 'bassBoost', type: 'int', display: 'valBassBoost', callback: val => updateBassBoost(val) },
    { id: 'shaderBlend', key: 'shaderBlend', type: 'float', display: 'valShaderBlend' }
  ];

  bindings.forEach(b => {
    const el = document.getElementById(b.id);
    if (!el) return;

    // Set initial DOM value from state
    if (state[b.key] !== undefined) {
      el.value = state[b.key];
      const displayEl = document.getElementById(b.display);
      if (displayEl) displayEl.textContent = el.value + (b.id === 'bassBoost' ? ' dB' : '');
    }

    el.addEventListener('input', () => {
      let val = el.value;
      if (b.type === 'float') val = parseFloat(val);
      else if (b.type === 'int') val = parseInt(val, 10);

      state[b.key] = val;
      saveSettings();

      const displayEl = document.getElementById(b.display);
      if (displayEl) displayEl.textContent = val + (b.id === 'bassBoost' ? ' dB' : '');

      if (b.callback) b.callback(val);
    });
  });

  // File Loaders
  fileInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    audioEl.src = url;
    audioEl.load();
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('status').textContent = 'Audio geladen · Bereit';
    ensureAudioReady(audioEl);
  });

  bgInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) setBackgroundImage(file);
  });

  videoInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) setOverlayVideo(file);
  });

  micBtn.addEventListener('click', async () => {
    const active = await toggleMicrophone(audioEl);
    micBtn.textContent = active ? 'Mikrofon aktiv (Stop)' : 'Mikrofon Aktivieren';
    document.getElementById('status').textContent = active ? 'Live Mikrofon aktiv' : 'Mikrofon gestoppt';
  });

  playBtn.addEventListener('click', async () => {
    await ensureAudioReady(audioEl);
    if (audioEl.paused) {
      await audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  });

  audioEl.addEventListener('play', () => ensureAudioReady(audioEl));

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  cleanFullscreenBtn.addEventListener('click', async () => {
    document.body.classList.toggle('clean-mode');
    if (!document.fullscreenElement && document.body.classList.contains('clean-mode')) {
      await document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement && !document.body.classList.contains('clean-mode')) {
      await document.exitFullscreen?.().catch(() => {});
    }
  });

  recordStartBtn.addEventListener('click', () => startRecording(audioEl));
  recordStopBtn.addEventListener('click', stopRecording);

  helpBtn.addEventListener('click', () => helpModal.classList.add('open'));
  closeModalBtn.addEventListener('click', () => helpModal.classList.remove('open'));
  helpModal.addEventListener('click', e => {
    if (e.target === helpModal) helpModal.classList.remove('open');
  });

  // Shader Editor Setup
  const shaderCodeInput = document.getElementById('shaderCodeInput');
  const shaderPresetSelect = document.getElementById('shaderPresetSelect');
  const compileShaderBtn = document.getElementById('compileShaderBtn');
  const shaderErrorBox = document.getElementById('shaderErrorBox');
  const shaderErrorOutput = document.getElementById('shaderErrorOutput');

  if (shaderCodeInput) {
    shaderCodeInput.value = state.shaderCode;
    shaderCodeInput.addEventListener('input', () => {
      state.shaderCode = shaderCodeInput.value;
      saveSettings();
    });
  }

  if (shaderPresetSelect) {
    shaderPresetSelect.value = state.shaderPreset;
    shaderPresetSelect.addEventListener('change', () => {
      const preset = shaderPresets[shaderPresetSelect.value];
      if (preset) {
        state.shaderPreset = shaderPresetSelect.value;
        state.shaderCode = preset.code;
        if (shaderCodeInput) shaderCodeInput.value = preset.code;
        saveSettings();
        const res = compileShader(preset.code);
        if (res.success) {
          if (shaderErrorBox) shaderErrorBox.style.display = 'none';
        } else {
          if (shaderErrorBox) shaderErrorBox.style.display = 'block';
          if (shaderErrorOutput) shaderErrorOutput.textContent = res.error;
        }
      }
    });
  }

  if (compileShaderBtn) {
    compileShaderBtn.addEventListener('click', () => {
      const res = compileShader(state.shaderCode);
      if (res.success) {
        if (shaderErrorBox) shaderErrorBox.style.display = 'none';
        document.getElementById('status').textContent = 'Shader erfolgreich kompiliert!';
      } else {
        if (shaderErrorBox) shaderErrorBox.style.display = 'block';
        if (shaderErrorOutput) shaderErrorOutput.textContent = res.error;
        document.getElementById('status').textContent = 'Shader Kompilierungsfehler';
      }
    });
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', e => {
    const tag = e.target?.tagName?.toLowerCase() || '';
    if (['input', 'select', 'textarea'].includes(tag)) return;

    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      const audioEl = document.getElementById('audio');
      if (audioEl.paused) audioEl.play().catch(() => {});
      else audioEl.pause();
    } else if (e.key === 'f' || e.key === 'F') {
      const cleanBtn = document.getElementById('cleanFullscreenButton');
      if (cleanBtn) cleanBtn.click();
    } else if (e.key === 'm' || e.key === 'M') {
      const modes = ['nebula', 'spectrum', 'tunnel', 'terrain', 'sphere', 'hybrid'];
      const idx = modes.indexOf(state.mode);
      state.mode = modes[(idx + 1) % modes.length];
      const modeEl = document.getElementById('mode');
      if (modeEl) { modeEl.value = state.mode; modeEl.dispatchEvent(new Event('input')); }
    } else if (e.key === 'p' || e.key === 'P') {
      const presets = ['aurora', 'sunset', 'neon', 'ice', 'mono', 'cyberpunk'];
      const idx = presets.indexOf(state.preset);
      state.preset = presets[(idx + 1) % presets.length];
      applyPreset(state.preset);
      const presetEl = document.getElementById('preset');
      if (presetEl) { presetEl.value = state.preset; }
    } else if (e.key === 'Escape') {
      document.body.classList.remove('clean-mode');
      const helpModal = document.getElementById('helpModal');
      if (helpModal) helpModal.classList.remove('open');
    }
  });
}

function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');
  let dragDepth = 0;

  ['dragenter', 'dragover'].forEach(type => {
    window.addEventListener(type, e => {
      e.preventDefault();
      dragDepth++;
      dropzone.classList.add('active');
    });
  });

  ['dragleave', 'dragend'].forEach(type => {
    window.addEventListener(type, e => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) dropzone.classList.remove('active');
    });
  });

  window.addEventListener('drop', e => {
    e.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove('active');
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;

    const audioEl = document.getElementById('audio');
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        audioEl.src = url;
        audioEl.load();
        document.getElementById('fileName').textContent = file.name;
        ensureAudioReady(audioEl);
      } else if (file.type.startsWith('image/')) {
        setBackgroundImage(file);
      } else if (file.type.startsWith('video/')) {
        setOverlayVideo(file);
      }
    }
  });
}
