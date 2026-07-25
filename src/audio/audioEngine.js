import { state } from '../core/state.js';

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let micStream = null;
let micSourceNode = null;
let bassFilterNode = null;
let trebleFilterNode = null;
let freqData = null;
let waveData = null;
let isMicActive = false;

let smoothedEnergy = 0.08;
let smoothedSubBass = 0.08;
let smoothedBass = 0.08;
let smoothedMid = 0.08;
let smoothedTreble = 0.08;
let smoothedPresence = 0.08;

let kickPulse = 0;
let kickStrength = 0;
let kickVisualLevel = 0;
let lastKickAt = 0;

export async function initAudioEngine(audioElement) {
  if (audioCtx) return;
  
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = state.smoothing;

  // Professional Multi-band EQ Filters (Bass Boost & Treble Enhancer)
  bassFilterNode = audioCtx.createBiquadFilter();
  bassFilterNode.type = 'lowshelf';
  bassFilterNode.frequency.setValueAtTime(120, audioCtx.currentTime);
  bassFilterNode.gain.setValueAtTime(state.bassBoost, audioCtx.currentTime);

  trebleFilterNode = audioCtx.createBiquadFilter();
  trebleFilterNode.type = 'highshelf';
  trebleFilterNode.frequency.setValueAtTime(6000, audioCtx.currentTime);
  trebleFilterNode.gain.setValueAtTime(2.0, audioCtx.currentTime);

  sourceNode = audioCtx.createMediaElementSource(audioElement);
  sourceNode.connect(bassFilterNode);
  bassFilterNode.connect(trebleFilterNode);
  trebleFilterNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  freqData = new Uint8Array(analyser.frequencyBinCount);
  waveData = new Uint8Array(analyser.fftSize);

  // Initialize AudioWorklet for off-thread DSP processing
  if (audioCtx.audioWorklet) {
    try {
      const workletCode = `
        class AudioAnalysisProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              this.port.postMessage(input[0]);
            }
            return true;
          }
        }
        registerProcessor('audio-analysis-processor', AudioAnalysisProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(workletUrl);
      const analysisNode = new AudioWorkletNode(audioCtx, 'audio-analysis-processor');
      analysisNode.port.onmessage = () => {};
      trebleFilterNode.connect(analysisNode);
      analysisNode.connect(audioCtx.destination);
    } catch (e) {
      console.warn('AudioWorklet initialization fallback:', e);
    }
  }

  initMidi();
}

export async function ensureAudioReady(audioElement) {
  initAudioEngine(audioElement);
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

export async function toggleMicrophone(audioElement) {
  initAudioEngine(audioElement);
  if (isMicActive) {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    if (micSourceNode) {
      micSourceNode.disconnect();
      micSourceNode = null;
    }
    if (sourceNode) {
      try { sourceNode.connect(bassFilterNode); } catch(e){}
    }
    isMicActive = false;
    return false;
  } else {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch(e){}
      }
      micSourceNode = audioCtx.createMediaStreamSource(micStream);
      micSourceNode.connect(bassFilterNode);
      isMicActive = true;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      return true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Mikrofon-Zugriff verwehrt oder nicht unterstützt.');
      return false;
    }
  }
}

export function updateSmoothing(val) {
  state.smoothing = val;
  if (analyser) {
    analyser.smoothingTimeConstant = val;
  }
}

export function updateBassBoost(gainVal) {
  state.bassBoost = gainVal;
  if (bassFilterNode && audioCtx) {
    bassFilterNode.gain.setValueAtTime(gainVal, audioCtx.currentTime);
  }
}

function averageRange(data, start, end) {
  const s = Math.max(0, start);
  const e = Math.min(data.length, end);
  if (e <= s) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += data[i];
  return sum / (e - s) / 255;
}

export function analyzeAudio(time) {
  if (!analyser || !freqData || !waveData) {
    return { energy: 0.1, subBass: 0.1, bass: 0.1, mid: 0.1, treble: 0.1, presence: 0.1, isKick: false, kickVisualLevel: 0 };
  }

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(waveData);

  const subBassRaw = averageRange(freqData, 0, 4);
  const bassRaw = averageRange(freqData, 4, 16);
  const midRaw = averageRange(freqData, 16, 70);
  const trebleRaw = averageRange(freqData, 70, 160);
  const presenceRaw = averageRange(freqData, 160, 255);
  const energyRaw = averageRange(freqData, 0, 200);

  const bassLift = bassRaw - smoothedBass;
  const isKick = bassRaw > state.kickThreshold && bassLift > 0.045 && (time - lastKickAt > 130);

  if (isKick) {
    kickPulse = 1.0;
    kickStrength = Math.min(1.0, bassRaw + bassLift * 1.5);
    lastKickAt = time;
  }

  kickPulse *= 0.88;
  kickStrength *= 0.88;
  kickVisualLevel = kickPulse * state.kickVisualStrength;

  smoothedSubBass = lerp(smoothedSubBass, subBassRaw, 0.16);
  smoothedBass = lerp(smoothedBass, bassRaw, 0.14);
  smoothedMid = lerp(smoothedMid, midRaw, 0.12);
  smoothedTreble = lerp(smoothedTreble, trebleRaw, 0.12);
  smoothedPresence = lerp(smoothedPresence, presenceRaw, 0.1);
  smoothedEnergy = lerp(smoothedEnergy, energyRaw, 0.1);

  return {
    energy: smoothedEnergy,
    subBass: smoothedSubBass,
    bass: smoothedBass,
    mid: smoothedMid,
    treble: smoothedTreble,
    presence: smoothedPresence,
    isKick,
    kickVisualLevel,
    freqData,
    waveData
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Web MIDI Support for Hardware Controllers
function initMidi() {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(midiAccess => {
      const inputs = midiAccess.inputs.values();
      for (let input of inputs) {
        input.onmidimessage = handleMidiMessage;
      }
      midiAccess.onstatechange = (e) => {
        if (e.port.type === 'input' && e.port.state === 'connected') {
          e.port.onmidimessage = handleMidiMessage;
        }
      };
      const midiStateEl = document.getElementById('midiState');
      if (midiStateEl) midiStateEl.textContent = 'MIDI Hardware Verbunden';
    }).catch(() => {});
  }
}

function handleMidiMessage(event) {
  const [status, data1, data2] = event.data;
  const command = status >> 4;
  if (command === 11) {
    const val = data2 / 127;
    const midiStateEl = document.getElementById('midiState');
    if (midiStateEl) midiStateEl.textContent = `MIDI CC #${data1}: ${data2}`;
    
    if (data1 === 1) {
      state.sensitivity = 0.5 + val * 2.5;
      const el = document.getElementById('sensitivity');
      if (el) { el.value = state.sensitivity; el.dispatchEvent(new Event('input')); }
    } else if (data1 === 2) {
      state.kickThreshold = 0.1 + val * 0.7;
      const el = document.getElementById('kickThreshold');
      if (el) { el.value = state.kickThreshold; el.dispatchEvent(new Event('input')); }
    } else if (data1 === 3) {
      state.bgOpacity = val;
      const el = document.getElementById('bgOpacity');
      if (el) { el.value = state.bgOpacity; el.dispatchEvent(new Event('input')); }
    }
  }
}
