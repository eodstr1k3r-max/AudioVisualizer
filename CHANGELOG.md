# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.1.0/).

---

## [2.1.0] - 2026-07-25

### Added
- **AudioWorklet Integration:** High-performance off-main-thread audio processing using `AudioWorkletNode` and dynamic Blob modules.
- **Mobile Touch & Gesture Controls:** Swipe left/right to cycle visual modes, swipe up/down to cycle color presets, and double-tap to toggle Clean Fullscreen mode.
- **Audio Playlist & Queue Management:** Multi-track audio queue support with automatic track advancement on song end.
- **High-Res PNG Snapshot Export:** Instant snapshot button (`📸 High-Res Screenshot`) to capture and download crystal-clear PNG snapshots of the active visualizer scene.
- **4 New 3D Raymarched Shader Presets:** *3D Audio Sphere*, *3D Circular Ring Bars*, *3D Spectrum Wall*, and *3D Audio Wormhole*, bringing the total professional shader presets to 15.

### Improved
- **Master Composite Canvas Recording:** Fixed video recording so that GLSL shaders, Three.js 3D elements, and 2D canvas visuals are all captured simultaneously into the 16:9 Broadcast video export (1080p, 1440p, 4K at 60 FPS).
- **Glassmorphism UI Redesign:** Sleeker floating glass panels, responsive grids, and refined neon aesthetics (v2.1 PRO).
- **WebGL Background Texture Mapping (`u_image`):** Background images are now fed directly into custom GLSL shaders as textures for audio-reactive displacement and glitch effects.

---

## [2.0.0] - 2026-07-12

### Added
- **Modular Vite + ES6 Architecture:** Refactored single-file script into a maintainable modular structure (`src/core`, `src/audio`, `src/visuals`, `src/ui`).
- **Three.js 3D Integration:** Added 3D Terrain landscape and 3D Audio Sphere visualizer modes.
- **Custom GLSL Fragment Shader Editor:** Shadertoy-style shader studio with real-time compilation, error checking, and multiple presets.
- **Shader Fusion Mode:** Blend custom GLSL shaders as dynamic backgrounds with classic 2D visualizer elements in the foreground.
- **Web MIDI API Support:** Connect external hardware controllers to map sensitivity, thresholds, and opacity in real-time.
- **PM2 Production Deployment:** Ecosystem configuration (`ecosystem.config.cjs`) and automated start/stop scripts for Windows and Linux/macOS.

---

## [1.0.0] - 2026-07-02

### Added
- Initial release of *Advanced Audio Visualizer Pro* (Single-file HTML demo by Martin Kraken / DerStr1k3r).
- Core Web Audio API Analyser, beat/kick detection, Nebula Ring, Spectrum Bars, Pulse Tunnel, and local video recording.
