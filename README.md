# 🎵 Advanced Audio Visualizer Ultimate Pro

<div align="center">

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.160-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![WebGL 2.0](https://img.shields.io/badge/WebGL-2.0-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![PM2](https://img.shields.io/badge/PM2-Production-2B037A?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**A next-generation, AAA-level audio visualizer & custom GLSL fragment shader studio engineered for music producers, video creators, and live performers.**

</div>

> **Demo Page:** https://audio-visualizer.derstr1k3r.de
> **Idea by:** Martin Kraken  
> **Author & Implementation:** DerStr1k3r


---

## 💡 Origin & Credits
- **Original Concept & Vision:** Martin Kraken
- **Lead Developer & Architecture:** DerStr1k3r

---

## ✨ Key Architectural & Visual Features

### 🎛️ 1. Multi-Band Audio DSP Engine
- Real-time frequency bin analysis split across **Sub-Bass, Bass, Mids, Treble, and Presence**.
- Adaptive transient/kick detection algorithm with adjustable sensitivity, smoothing, and multi-stage release envelopes.
- Web Audio API BiquadFilter (Bass Boost up to +15 dB) and Microphone (`getUserMedia`) live audio stream support.
- **Web MIDI API Integration:** Connect any hardware MIDI controller to map knobs and sliders in real-time.

### 🌌 2. Visualizer Modes & 3D Engine
- **2D Canvas Modes:** Nebula Ring, Spectrum Bars, Pulse Tunnel, and Hybrid.
- **Three.js 3D Modes:** 3D Terrain Landscape & 3D Audio-Reactive Sphere.
- **Custom GLSL Shader Studio:** 11+ built-in professional Demoszene / Raymarched presets (*Cyber Grid*, *Fluid Plasma*, *Synthwave Sun & Grid*, *Cyberpunk Tunnel*, *Hyperspace Warp*, *Audio Kaleidoscope*, *Cyber Audio City*, etc.).
- **Shader Fusion Mode:** Blend custom GLSL shaders as immersive dynamic backgrounds with classic 2D visualizer elements on top.

### 🖼️ 3. Background Texture Mapping & Video Overlays
- **WebGL Background Textures (`sampler2D u_image`):** Uploaded background images are fed directly into GLSL shaders for audio-reactive displacement, chromatic aberration, and beat glitching.
- **Chroma Key Video Overlays:** Center video overlay playback with real-time white/green screen chroma keying, edge feathering, and speed control.

### 🎥 4. Broadcast-Ready 16:9 Video Recorder
- Record high-performance canvas streams at strict **16:9 aspect ratios** in **Full HD 1080p, QHD 1440p, or Ultra HD 4K at 60 FPS** with 12 Mbps WebM encoding.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **pnpm**

### Installation & Local Development
```bash
# Clone or navigate to the project directory
cd Audio_Visualizer

# Install dependencies
npm install

# Start local development server with Vite
npm run dev
```

### Production Build
```bash
# Compile optimized static bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## 📦 PM2 Production Deployment

Pre-configured PM2 start and stop scripts are included for enterprise-grade production deployment.

### Windows
- **Start:** Double-click `pm2-start.bat` (automatically builds and starts via PM2 on port 5174)
- **Stop:** Double-click `pm2-stop.bat`

### Linux / macOS
- **Start:** `./pm2-start.sh`
- **Stop:** `./pm2-stop.sh`

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause audio playback |
| <kbd>F</kbd> or <kbd>Double Click</kbd> | Toggle Clean Fullscreen Mode (hide all UI controls) |
| <kbd>M</kbd> | Cycle through visualizer modes |
| <kbd>P</kbd> | Cycle through color presets |
| <kbd>?</kbd> or <kbd>ESC</kbd> | Open / Close Shortcuts Modal |

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
