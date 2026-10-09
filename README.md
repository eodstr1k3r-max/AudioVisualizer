# 🎵 Advanced Audio Visualizer Ultimate Pro v5 · Real 3D

<div align="center">

[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.185-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-2B037A?style=for-the-badge&logo=webgl&logoColor=white)](https://www.w3.org/TR/webgpu/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Ein Broadcast-ready 3D-Audio-Visualizer der AAA-Klasse: komplett in echtem 3D, mit Cinematic-FX-Pipeline, globaler 3D-Atmosphäre, TSL-Shader-Studio und dem „NEON OS"-Cockpit-UI.**

</div>

 **Demo Page:** https://audio-visualizer.derstr1k3r.de
---

## ✨ Was ist neu in v5 (Cinematic FX, globale Atmosphäre & NEON OS UI)?

- 🎬 **Cinematic-FX-Stack in der Render-Pipeline:** Chromatic Aberration (kick-reaktiv), animiertes Film-Grain, CRT-Scanlines, Color Grade – identisch in WebGPU & WebGL2, mit Intensitätsregler und Auto-Ausnahme bei Alpha-Aufnahmen
- 🌌 **Globale AtmosphereFX über allen 19 Modi:** 3D-Tiefenstaub mit Parallaxe + Kick-Schockwellen-Ringe, die durch jede Szene expandieren
- 🎥 **Kamera-Kick-Shake** (+ subtiler Roll) für physische Wucht auf jedem Beat
- 🏙️ **Alle Kern-Szenen aufgewertet:** Warp-Streaks im Tunnel, Orbitalringe um die Audio Sphere, Glut-Funken + Mond im Terrain, Kick-Spritzer + Lichtsäulen bei den Ripples, Innenring + Funkenkranz bei Spectrum, Wireframe-Shell in Fusion, Bokeh-Tiefe im Shader-Studio, Sternschnuppen in der Nebula
- 📡 **Live-Spektrum direkt im Topbar** (gespiegeltes Log-Frequenzband mit Peak-Caps & Kick-Blitz)
- 🎛️ **Komplettes „NEON OS" Redesign:** Gradient-Hairlines, orbitierendes Brand-Logo, Label/Wert-HUD-Chips, gefüllte Slider-Tracks, animierter Boot-Spinner, Doppelklick auf den Viewport = Clean Mode, persistenter aktiver Tab
- 💥 **25 Shader-Presets** (4 neue: Supernova Shockwaves, Deep Ocean Caustics, Crystal Shards, Electric Storm) · **8 Look-Presets** (neu: Event Horizon 🕳️ & Neon City 🌆) – alle Looks verdrahten jetzt auch die FX-Ebene

## ✨ Was ist neu in v4.4 (Performance & Bedienbarkeit)?

- ⚡ **Qualitätsstufen-Skalierung nachgerüstet** für alle 11 neueren Szenen – spürbar mehr FPS bei `medium`/`high` statt immer voller `ultra`-Last
- 🔍 **Neuer Modus-Picker**: durchsuchbar, nach Kategorie gruppiert, mit persistenten Favoriten (★)
- ⌨️ **Barrierefreiheit**: Panel-Tabs jetzt vollwertig ARIA-konform mit Pfeiltasten-Navigation, größere Touch-Ziele (44px) auf Mobilgeräten
- 🧪 Neuer Dauerhaft-Test verifiziert alle 19 Modi bei `medium`- und `high`-Qualität

## ✨ Was ist neu in v4.3 (8 neue Szenen, Code-Splitting)?

- 🌌 **8 neue 3D-Modi** (jetzt 19 insgesamt): Aurora, Volcano, Storm at Sea, Bioluminescent Reef, Black Hole, Comet, Cyberpunk Rain, Crystal Cave
- 🗂️ **Modus-Dropdown gruppiert** nach Kategorie (Abstract/Space/Nature/Urban)
- ⚡ **Code-Splitting:** die 11 größten Szenen laden per `dynamic import()` erst bei Bedarf nach, statt das Startbundle aufzublähen
- ⏳ Dezenter Lade-Hinweis im HUD, während eine Szene nachlädt

## ✨ Was ist neu in v4.2 (Sonnenfinsternis)?

- 🌑 **10. 3D-Modus „Total Eclipse"** – totale Sonnenfinsternis wie durchs Fernrohr: Korona mit Streamer-Strahlen, Protuberanzen, Sonnengranulation, geometrischer Diamantring-Effekt beim Ein-/Austritt der Totalität, einfadender Sternenhimmel & Horizontglühen
- 🌍 **11. 3D-Modus „Eclipse from Space"** – Erde mit umkreisendem Mond, echter (nicht aufgesetzter) Kernschatten-Test auf der Erdoberfläche, sobald Sonne-Mond-Erde sich ausrichten
- ⌨️ **Shortcut erweitert:** Ziffer <kbd>0</kbd> für den 10. Modus

## ✨ Was ist neu in v4.1 (Solar System & Campfire)?

- 🪐 **9. 3D-Modus „Solar System"** – prozedural schattiertes Sonnensystem (alle 8 Planeten in korrekter Größen-/Abstands-/Umlaufordnung, echte Achsneigungen, Saturn-/Uranus-Ringe, Erdmond, Asteroidengürtel, Sonnenkorona)
- 🔥 **21. Shader-Preset „Lagerfeuer bei Nacht"** – Feuer mit Funkenflug vor funkelndem Sternenhimmel und Mond
- 🌍 **Erweitertes DE/EN-Wörterbuch:** Modus- und Shader-Preset-Namen können jetzt einzeln übersetzt werden (`translateOrFallback`), Solar System & Lagerfeuer sind die ersten so lokalisierten Einträge
- ⌨️ **Shortcut erweitert:** Ziffern <kbd>1</kbd>–<kbd>9</kbd> für alle 9 Modi (9 = Solar System)

## ✨ Was ist neu in v4 (Broadcast-Cockpit)?

- 🎛️ **Globale Transport-Leiste** (Play/Mic/Record/Snapshot) – immer erreichbar, egal welches Panel offen ist
- 📂 **Einklappbarer Settings-Drawer** (<kbd>Q</kbd> / Handle / <kbd>ESC</kbd>) → maximaler Viewport für die Visuals
- 📱 **Mobile-Bottom-Sheet** mit ✕-Schließen-Button
- 🧭 **Topbar:** Brand, Live-Status, Clean Mode, Fullscreen, DE/EN, Hilfe in einer Leiste

## ✨ Was ist neu in v3.2?

- 🌊 **8. 3D-Modus „Audio Ripples"** + 🖱️ **Maus-Interaktion** (Klick-Impuls in allen Szenen & Shadern)
- 🔁 **Wiedergabe-Modi** (Repeat all/one, Shuffle) + **Track-Fortschritt & Seek**
- 📊 **Session-Statistik** · 🖼️ **Hintergrundbild per URL** · 🏷️ **Logo-/Text-Overlay** (auch in Aufnahmen)
- 🎥 **Kamera-Presets** (3 Slots) · 🔄 **Szenen-Übergänge** (Fade)
- 🔥 **4 neue Shader-Presets** (Fire Vortex, Galaxy Core, Liquid Metal, Neon Waves → 20 total)
- 🌍 **DE/EN Sprachumschaltung** · ✨ **UI-Überholung** (Tab-Animationen, Statistik-Karten, Mobile-Polish)

## ✨ Was war neu in v3.1 (Feature-Expansion)?

- 🎧 **Demo-Synth:** eingebauter Beat-Generator – Visuals laufen sofort ohne Audiodatei
- 📈 **BPM-Erkennung & Beat-Sync:** sichtbarer Beat-Puls in allen Szenen + Shader-Presets, BPM im HUD
- 🎛️ **Live-Spektrum/Waveform-Monitor**, **Audio per URL** laden
- 🎥 **WebM-Aufnahme mit Alpha-Kanal** (transparenter Hintergrund für Overlays)
- 🎨 **Look-Presets** (6 Szenen-Kombis), **11 Farbpaletten** + eigene Akzentfarbe
- 🖥️ **OBS-Overlay-Modus** (echter 16:9-Letterbox), **Shader-Export/Import (JSON)**, Fullscreen
- ⚡ **Auto-Quality**, erweiterte Kamera- & Szenen-Parameter, Performance-HUD

## ✨ Was war neu in v3.0 („Everything Real 3D")?

Der komplette Umbau von der 2D-Canvas-Ära hin zu **echtem 3D**:

| Alt (2D) | Neu (3D) |
|---|---|
| Nebula Ring | **Nebula Galaxy** – 3D-Partikelgalaxie (instanzierte Glow-Partikel) |
| Spectrum Bars | **Spectrum Towers** – volumetrische 3D-Spektrum-Skyline |
| Pulse Tunnel | **Hyperspace Tunnel** – echter 3D-Fly-Through |
| 3D Terrain | **Terrain 2.0** – audio-verdrängtes Gelände |
| 3D Sphere | **Audio Sphere 2.0** – TSL-displaced Glow-Sphäre |
| Shader (Fullscreen) | **Shader Studio** – TSL-Shader als Skybox in der 3D-Szene |
| Hybrid | **Fusion 3D** – Shader-Himmel + Partikel + Türme + Orb in einer Szene |

### Technologie
- **Three.js 0.185 mit WebGPURenderer** – produktionsreif, mit **automatischem WebGL2-Fallback**
- **TSL (Three Shading Language)** – ein Shader-Code, kompiliert zu WGSL *und* GLSL identisch
- **React 19 + TypeScript + Zustand** – Engine läuft komplett außerhalb von React (60 FPS ohne Re-Renders)
- **GPU-Instancing** für alle Massenelemente (Partikel, Türme, Terrain)

### Features
- 🎧 **Demo-Synth:** eingebauter Beat-Generator – der Visualizer animiert sofort, ohne Audiodatei
- 🥁 **Kick-Stile** (Soft Glow / Puls / Flash / Ripple / Aus) – `kickLevel` wird je Stil geformt, wirkt in allen Szenen
- 📈 **BPM-Erkennung & Beat-Sync** (beatPhase/beatPulse/onBeat) mit Anzeige im HUD
- 📱 **PWA:** installierbar (Manifest + Icons) mit Service Worker (Offline-Fallback, aktualisiert sicher)
- 🎛️ **Multi-Band-Audio-DSP:** 5-Band-Analyse, Kick-Detection, Bass-Boost, Mikrofon, Playlist, URL-Streams, **Web-MIDI** (Learn-UI, erweitertes Mapping)
- 🎥 **Broadcast-Recorder:** 16:9, 1080p/1440p/4K @ 60 FPS WebM, **optional mit Alpha-Kanal** + High-Res-Snapshot
- 🖼️ **Chroma-Key-Video als 3D-Videoplane** in der Szene
- 💻 **Shader-Studio:** 25 TSL-Presets + Custom-GLSL-Editor, **Export/Import als JSON**
- 📷 **Kamera-Modi:** Auto-Flight (mit FOV/Radius/Höhe/Speed-Reglern), Orbit, First-Person (WASD) – mit weichen Modus-Übergängen & Kick-Shake
- ✨ **Post-Processing:** Bloom, Vignette · **Cinematic-FX-Layer** (Chromatic Aberration, Film-Grain, Scanlines, Color Grade – audio-reaktiv) · **Globale AtmosphereFX** (3D-Tiefenstaub + Kick-Schockwellen in allen Szenen) · **Look-Presets** (8 komplette 1-Klick-Szenen)
- ⚡ **Auto-Quality** (FPS-adaptiv) · 🖥️ **OBS-Overlay-Modus** (16:9-Letterbox)
- 🎨 **11 Farbpaletten** inkl. **eigener Akzentfarben** – persistenzerhaltend
- ⌨️ **Shortcuts:** `Space` Play · `M` Modus · `P` Palette · `K` Kamera · `F` Clean · `Shift+F` Fullscreen · `R` Record · `S` Snapshot · `B` Bloom · `X` Cinematic FX · `?` Hilfe

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 oder höher)
- **npm**

### Installation & Local Development
```bash
cd Audio_Visualizer
npm install
npm run dev        # Vite-Dev-Server auf http://localhost:5173
```

### Production Build
```bash
npm run build      # tsc + Vite → dist/
npm run preview    # Preview auf http://localhost:4173
```

### Tests
```bash
npm test           # Vitest-Unit-Tests (107: Bands, Tempo, Store, Playlist, Settings-IO, Demo-Synth, Szenen, Qualitätsstufen, Shader-Presets, Look-Presets, SceneEffects/AtmosphereFX)
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause |
| <kbd>M</kbd> | Nächster Visualizer-Modus |
| <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> | Direkter Modus (erste 10 von 19; Rest per Dropdown/<kbd>M</kbd>) |
| <kbd>P</kbd> | Nächste Farbpalette |
| <kbd>K</kbd> | Nächster Kamera-Modus |
| <kbd>F</kbd> | Clean Mode (UI ausblenden) |
| <kbd>Shift</kbd>+<kbd>F</kbd> | Fullscreen |
| <kbd>R</kbd> | Aufnahme Start / Stop |
| <kbd>S</kbd> | Screenshot |
| <kbd>B</kbd> | Bloom an / aus |
| <kbd>X</kbd> | Cinematic-FX-Ebene an / aus |
| <kbd>Q</kbd> | Einstellungen-Drawer ein-/ausklappen |
| <kbd>?</kbd> / <kbd>ESC</kbd> | Shortcut-Hilfe |
| Doppelklick / Doppeltipp | Clean Mode |

---

## 🧱 Architektur

```
src/
├── main.tsx                 # React-Einstieg
├── core/                    # Typen, Zustand-Store (Persistenz), Farbpaletten
├── audio/                   # AudioEngine (TS), pure Band-Analyse, Playlist, MIDI
├── engine/                  # ⚡ Imperative 3D-Engine (KEIN React)
│   ├── Engine.ts            # Singleton: Renderloop, Resize, Szenen-Steuerung
│   ├── RendererFactory.ts   # WebGPU + WebGL2-Fallback
│   ├── PostProcessing.ts    # Bloom + Cinematic-FX (CA/Grain/Scanlines/Grade) – WebGPU & WebGL
│   ├── CameraSystem.ts      # Auto-Flight / Orbit / First-Person, weiche Übergänge, Kick-Shake
│   ├── SceneManager.ts      # Szenen-Wechsel & Dispose-Lifecycle + globales AtmosphereFX-Layer
│   ├── scenes/              # 19 3D-Szenen: 8 eager (Nebula, Spectrum, Tunnel, Terrain, Sphere, ShaderSky, Fusion, Ripples)
│   │                        # + 11 lazy code-gesplittet (SolarSystem, Eclipse, SpaceEclipse, Aurora, Volcano,
│   │                        #   Storm, Reef, BlackHole, Comet, Cyberpunk, CrystalCave)
│   ├── effects/             # ParticleCloud, SpectrumRing, GlowOrb, AtmosphereFX,
│   │                        # SceneEffects (OrbitSparks, Embers, Spray, Streaks, Pillars, Bokeh, Meteore)
│   └── shaders/             # 25 TSL-Presets + ShaderSkyScene
└── ui/                      # ⚛️ React 19: App, Panels, Neon-Design-System
```

**Wichtiges Prinzip:** Die 60-FPS-Renderloop lebt im Engine-Singleton. React subscribed nur auf den schlanken Zustand-Store – keine Re-Renders im Renderloop.

---

## 📦 PM2 Production Deployment

```bash
# Windows
pm2-start.bat    # baut + startet auf http://localhost:5174
pm2-stop.bat

# Linux / macOS
./pm2-start.sh
./pm2-stop.sh
```

---

## 📜 License

Distributed under the **MIT License**.
