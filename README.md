# Advanced Audio Visualizer Ultimate Pro 🎵✨

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.160-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![PM2](https://img.shields.io/badge/PM2-Production-2B037A?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)

A next-generation, AAA-level 2D/3D audio visualizer and custom GLSL fragment shader editor engineered for music producers, video creators, and live performers. 

> **Idea by:** Martin Kraken  
> **Author & Implementation:** DerStr1k3r

---

## 🌟 Key Features

- **Multi-Band Audio DSP Engine:** Advanced real-time frequency analysis (Sub-Bass, Bass, Mids, Treble, Presence) with adaptive transient kick detection and adjustable Bass Boost.
- **Multiple Visual Modes:**
  - **2D Canvas Modes:** Nebula Ring, Spectrum Bars, Pulse Tunnel, and Hybrid.
  - **Three.js 3D Modes:** 3D Terrain Landscape & 3D Audio-Reactive Sphere.
  - **Custom GLSL Shader Engine:** 11+ professional Demoszene / Raymarched presets (*Cyber Grid*, *Fluid Plasma*, *Synthwave Sun & Grid*, *Cyberpunk Tunnel*, *Hyperspace Warp*, *Audio Kaleidoscope*, etc.).
  - **Shader Fusion Mode:** Seamlessly blend custom GLSL shaders as dynamic backgrounds with 2D audio-reactive visualizer elements in the foreground.
- **Background Texture Integration:** Uploaded background images are loaded as WebGL textures (`sampler2D u_image`) directly into custom shaders for audio-reactive displacement, chromatic aberration, and glitch effects.
- **Professional Video Overlay (Chroma Key):** Support for center video overlays with real-time white/green keying and edge feathering.
- **Broadcast-Ready 16:9 Recorder:** Export crystal-clear visualizer recordings at strict 16:9 aspect ratios in Full HD 1080p, QHD 1440p, or Ultra HD 4K at 60 FPS.
- **Hardware MIDI Control:** Connect external MIDI controllers via the Web MIDI API to map knobs and sliders in real-time.
- **Ultimate Pro Glassmorphism UI:** Sleek, futuristic floating glass panels with intuitive tabs and keyboard shortcuts.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Installation & Development
```bash
# Clone or open the repository
cd Audio_Visualizer

# Install dependencies
npm install

# Start the local development server
npm run dev
```

### Production Build
```bash
# Build optimized static bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## 📦 PM2 Production Deployment

This project includes pre-configured PM2 start and stop scripts to run a production server easily.

### Windows
- **Start:** Double-click `pm2-start.bat` (automatically builds and starts via PM2 on port 3000)
- **Stop:** Double-click `pm2-stop.bat`

### Linux / macOS
- **Start:** `./pm2-start.sh`
- **Stop:** `./pm2-stop.sh`

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause audio |
| <kbd>F</kbd> / <kbd>Double Click</kbd> | Toggle Clean Fullscreen Mode |
| <kbd>M</kbd> | Cycle Visual Modes |
| <kbd>P</kbd> | Cycle Color Presets |
| <kbd>?</kbd> / <kbd>ESC</kbd> | Open / Close Shortcuts Modal |

---

## 📜 Credits

- **Original Concept & Idea:** Martin Kraken
- **Development & Architecture:** DerStr1k3r

---

## 📄 License

MIT License. Free to use for personal and commercial projects.
