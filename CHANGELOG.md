# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.1.0/).

---

## [5.0.0] - 2026-08-23 — Cinematic FX, globale 3D-Atmosphäre & UI-Komplettüberholung

### Added (Engine · „alles hat Effekte")
- **🎬 Neuer Cinematic-FX-Stack in der Post-Processing-Pipeline** (beide Backends identisch):
  - **Chromatic Aberration** – radiale Farbfringe, pulsieren audio-reaktiv auf jedem Kick und mit Energy (WebGPU über den offiziellen `chromaticAberration`-TSL-Node, WebGL im kombinierten ShaderPass).
  - **Animiertes Film-Grain** – hash-basiertes Korn, zeitanimiert, Kick-boosted.
  - **CRT-Scanlines** – zuschaltbar.
  - **Color Grade** – Sättigungs- + Film-Kontrast-Anhebung.
  - Vignette & Bloom bleiben bestehen; die neue FX-Ebene liegt zwischen Bloom und Vignette. Während **Alpha-Aufnahmen** wird sie automatisch deaktiviert (sauber transparenter Hintergrund).
- **🌌 AtmosphereFX – globales Tiefen-Layer für ALLE 19 Modi:** Der `SceneManager` legt jetzt automatisch um jede Szene: hunderte schwebende **3D-Staubpartikel** (weites Kugelvolumen = echte Tiefenstaffelung/Parallaxe, Wirbel mit Energy, Auftrieb mit Bass) plus **Kick-Schockwellen-Ringe**, die bei jeder Kick-Flanke durch die Szene expandieren – palettengefärbt und qualitätsskaliert, bei nur ~2 Drawcalls.
- **🎥 Kamera-Kick-Shake:** abklingender Positions-Impuls (+ subtiler Roll im Auto-Modus) auf jeder steigenden Kick-Flanke – mehr physische Wucht zusätzlich zum bisherigen FOV-Punch.

### Added (UI)
- **📡 Live-Spektrum direkt im Topbar:** neue `LiveSpectrum`-Komponente zeichnet in einem eigenen rAF-Loop (vom React-Rendering entkoppelt) ein gespiegeltes Log-Frequenzband mit fallenden Peak-Caps und Kick-Blitz – inklusive „LIVE"-Badge.
- **🎛️ Komplettes Redesign „NEON OS":** dunklere Basis, Gradient-Hairlines auf Panel/Modal/Topbar-Pillen, orbitierender Brand-Ring, Sektionstitel mit Glow-Strich, HUD-Chips jetzt als Label/Wert-Kacheln (Szene/Palette/Kamera/Backend+FPS), animierter Doppel-Orbit-Boot-Spinner, gefüllte Slider-Tracks (Progress via CSS-Variable), geschliffene Tabs mit Unterstrich-Indikator, verfeinerte Buttons/Toggles/Dropzone/Shortcuts-Modal.
- **🎚️ Neue „Cinematic FX"-Sektion** im Visuals-Panel: Master-Toggle, Intensitäts-Regler und 2×2-Raster für Chromatic Aberration / Grain / Scanlines / Color Grade.

### Added (Szenen · „wirklich 3D" für jeden Modus)
- **🧩 Neues Effekt-Modul `SceneEffects.ts`:** wiederverwendbare, DOM-freie Bausteine mit prozeduralen DataTexture-Sprites – `OrbitSparks` (Funken auf geneigten Orbitbahnen), `RisingEmbers` (aufsteigende Glut), `SprayBurst` (Kick-Spritzer mit Gravitation), `SpeedStreaks` (echte Warp-Liniensegmente), `LightPillars` (pulsierender Lichtsäulen-Kranz), `BokehDust` (kamera-feste Tiefenschicht) und `MeteorShower` (Sternschnuppen).
- **🏙️ Spectrum Towers:** gegenläufig rotierender Innenring, pulsierender Glow-Orb im Zentrum und Orbit-Funken-Kran über den Türmen.
- **🌀 Hyperspace Tunnel:** echte Warp-Streaks rasen bass-getrieben an der Kamera vorbei, weiche Doppel-Corona am Energiekern, Sternfeld tönt sich live in die Palette.
- **⛰️ Terrain:** Glut-Funken steigen audio-reaktiv über den Kämmen auf, Mond mit beat-synchronem Halo und Treble-Pulsieren am Nachthimmel.
- **🔮 Audio Sphere:** zwei gegenläufige Orbitalringe mit Kick-Puls plus Satelliten-Funken auf geneigter Umlaufbahn.
- **🌊 Audio Ripples:** Kick-Spritzer schießen mit Gravitation aus dem Zentrum, Lichtsäulen-Kranz pulsiert band-abhängig am Horizont.
- **✨ Fusion 3D:** atmende Wireframe-Icosaeder-Schale um den Orb, wirbelt auf Kicks schneller.
- **💻 Shader Studio:** kamera-feste Bokeh-Staubschicht VOR dem Vollbild-Quad → selbst der flächige Shader-Modus hat jetzt echte Parallaxe/Tiefe.
- **🌌 Nebula Galaxy:** periodische Sternschnuppen quer über den Himmel.

### Added (Presets)
- **🎨 Alle 6 Look-Presets steuern jetzt auch die FX-Ebene** (Chromatic/Grain/Scanlines/Grade + Intensität pro Look, z. B. Synthwave & Energy Grid mit Scanlines, Hyperspace mit starker Aberration) – plus **2 neue Looks:** „Event Horizon" (🕳️ Black Hole) und „Neon City" (🌆 Cyberpunk Rain).
- **🌈 4 neue TSL-Shader-Presets (25 gesamt):** „Supernova Shockwaves" (expandierende Schockwellen-Fronts + Funkenkranz), „Deep Ocean Caustics" (Caustics + Godrays + Blasen), „Crystal Shards" (Kaleido-Facetten mit Kick-Brechungsversatz) und „Electric Storm" (Blitzverästelungen + Gewitterhimmel + Regen).

### Improved
- **🔄 Auto-Cycle-Intervall konfigurierbar:** Der Kiosk-/Demo-Szenenwechsel war auf 15 s fix – jetzt per Regler einstellbar (5–60 s, neuer Setting `autoCycleSeconds`, erscheint beim Aktivieren des Auto-Wechsels).
- **🖱️ Klickbare HUD-Chips:** Die Szene-/Palette-/Kamera-Chips unten links sind jetzt echte Buttons und öffnen direkt das passende Panel (Visuals bzw. Kamera) – inkl. Hover-Glow, Fokus-Ring und Button-Semantik statt `aria-hidden`.
- **🛡️ Bereichs-Klemmung beim Rehydrieren:** Kritische Zahlen-Settings (`fxIntensity`, `bloomStrength/-Radius/-Threshold`, `sensitivity`, `kickThreshold`, `smoothing`, `volume`, `bgOpacity`, `autoCycleSeconds`) werden beim Laden aus localStorage auf gültige Bereiche geklemmt – kaputte Stände können nie wieder Extremwerte in die Engine bringen.
- **📸 Kamera-Blitz beim Screenshot:** Jeder Snapshot löst jetzt einen kurzen, hellen Aufhell-Puls über dem Viewport aus (Store-`flashTick` + CSS-Animation) – sofortiges visuelles Feedback, auch im Clean Mode.
- **📉 GPU-Kontextverlust-Recovery:** Setzt der Browser den WebGL-Kontext zurück (GPU-Treiberreset/Überlastung), erschien bisher nur ein schwarzer Canvas. Jetzt verhindert die Engine die Default-Behandlung und zeigt ein klares Overlay mit Erklärung + Reload-Angebot (`role="alert"`, neue i18n-Keys DE/EN) – Einstellungen bleiben dank Persistenz erhalten.
- **♿ Hilfe-Modal ARIA-konform:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby`-Verknüpfung zum Titel.
- **🐛 Space-Key-Konflikt behoben:** Im First-Person-Modus steuert <kbd>Space</kbd> jetzt ausschließlich das Aufsteigen – Play/Pause wird dort nicht mehr gleichzeitig ausgelöst.
- **🎥 Weiche Kamera-Modus-Wechsel:** Auto-Flight, First-Person und der Tunnel-View blenden jetzt über ~0.9 s (easeOutCubic + Quaternion-Slerp) von der alten Position/Blickrichtung ein, statt hart zu snappen – inklusive Übergang von Orbit.
- **🏷️ Text-Overlay viewport-adaptiv:** Das Logo-/Text-Sprite skaliert sich laufend auf max. 80 % der Viewport-Breite (FOV-/Aspect-abhängig) statt fixer Einheiten – kein Abschneiden mehr auf schmalen Screens.
- **🔗 Share-Links verbessert:** Der FX-Zustand wandert mit in geteilte Deep-Links (`?fxEnabled=0`, `?fxIntensity=1.3`); latenten Bug behoben, bei dem numerische Settings pauschal gegen den Demo-BPM-Default verglichen wurden (saubere `NUMBER_DEFAULTS`-Map).
- **⌨️ Neuer Shortcut <kbd>X</kbd>:** Cinematic-FX-Ebene komplett an/aus (parallel zu <kbd>B</kbd> für Bloom), inkl. Hilfe-Modal-Eintrag.
- **♿ Reduced-Motion-Support:** Bei `prefers-reduced-motion: reduce` werden Ambient-Drift, Brand-Orbit, Spinner-Deko und Puls-Animationen deaktiviert – ruhige UI ohne Bewegungsreize.
- **🌌 Aurora vervollständigt:** Die Szene hatte Mondlicht ohne sichtbaren Mond – jetzt leuchtet die Mondscheibe samt beat-flimmerndem Halo an der Lichtrichtung.
- **⚡ Performance-Polish (0-Allocations-Hot-Path):** `AudioMonitor` puffert Frequenz-/Wave-Buffer statt 60×/s neue `Uint8Array`s zu alloziieren; `Engine` cached die Palette (vorher pro Frame neu); `SceneManager` aktualisiert den Frame-Context in-place statt Spread pro Frame; Post-Processing-Parameter werden nur bei tatsächlicher Änderung gepusht. Zusätzlich: `Engine.buildContext()` gibt ein persistentes Context-Objekt zurück (vorher 2 Allokationen/Frame), `AudioEngine.analyze()` liefert den gecachten Datensatz direkt statt eines Zwillings, und die Fusion-Szene spreadt ihren Shader-Kontext nicht mehr pro Frame.
- **🧹 Dead-Code-Cleanup:** Vier seit v4 ungenutzte CSS-Klassen entfernt (`.status-bar` inkl. Clean-Mode-/Mobile-Referenzen, `.panel-header`, `.help-btn`, `.pulse-rec` samt Keyframes).
- **📚 README auf v5-Stand:** Feature-Liste (Cinematic FX, AtmosphereFX, 25 Shader-Presets, 8 Looks), Shortcut-Tabelle (<kbd>X</kbd>, Doppelklick), Architekturdiagramm und Test-Zähler aktualisiert.
- **🖱️ Bedienung:** Doppelklick auf den Viewport toggelt jetzt auch am Desktop den Clean Mode (Parität zum mobilen Doppeltipp); der aktive Panel-Tab wird über Sitzungen hinweg gemerkt.
- **♿ Accessibility:** Status-Zeile in der Topbar ist jetzt eine `aria-live`-Region (Screenreader verkünden Statuswechsel); Hilfe-Modal fokussiert beim Öffnen den Schließen-Button.
- **🌍 i18n-Lücken geschlossen:** Offline-Hinweis des Audio-Monitors, Demo-Synth-Hinweis und die Hintergrundbild-Fehlermeldung sind jetzt übersetzbar statt hartkodiert deutsch; PWA-Manifest auf v5 aktualisiert (Short-Name, Farben); Service-Worker-Cache auf `avp5-cache-v1` gehoben, damit Bestandsinstallationen frische Assets erhalten; Boot-Screen im HTML nutzt jetzt den neuen Doppel-Orbit-Spinner.
- **💾 Settings erweitert:** `fxEnabled`, `fxChromatic`, `fxGrain`, `fxScanlines`, `fxGrade`, `fxIntensity` – schema-sicher gemerged, damit alte localStorage-Stände weiterhin laden.
- **🌍 i18n:** DE/EN weiterhin exakt synchron (302/302 Keys, automatisiert geprüft).
- **🧪 Testsuite auf 112 Tests erweitert:** v5-Shader-Presets werden gebaut, alle Look-Presets müssen die komplette FX-Ebene setzen (Regressionsschutz), Modus-/Preset-IDs der Looks werden validiert, sämtliche neuen Effekt-Module (`OrbitSparks`, `RisingEmbers`, `SprayBurst`, `SpeedStreaks`, `LightPillars`, `BokehDust`, `MeteorShower`, `AtmosphereFX`) haben Smoke-Tests inkl. Kick-Verhalten und Qualitätsskalierung, Share-URLs werden auf FX-Zustand + Default-Omission geprüft, der Aufnahme-Store gibt Object-URLs bei Entfernen/Leeren nachweislich frei (Memory-Leak-Schutz), und die Bereichs-Klemmung korrumpierter Settings ist getestet. Typecheck & Production-Build verifiziert.

---

## [4.4.0] - 2026-08-14 — Szenen-Performance & Bedienbarkeits-Update

### Performance
- **⚡ Qualitätsstufen-Skalierung für alle 11 neueren Szenen nachgerüstet:** `AuroraScene`, `VolcanoScene`, `StormScene`, `ReefScene`, `BlackHoleScene`, `CometScene`, `CyberpunkScene`, `CrystalCaveScene`, `EclipseScene`, `SpaceEclipseScene` und die Korona von `SolarSystemScene` hatten bisher komplett hardcodierte Segment-/Partikelzahlen (immer volle „Ultra"-Last, unabhängig von der gewählten Qualitätsstufe). Jetzt skalieren Sphären-/Ring-/Kegel-Segmente, Wellen-Vertexdichte, Sternenzahl, Regen-/Funken-/Plankton-/Staubmengen und sogar Objektanzahlen (Gebäude, Kristallcluster) mit `ultra`/`high`/`medium` – spürbar mehr FPS bei niedrigerer Qualitätsstufe, besonders bei den vertex-lastigen Szenen (Storm-See-Displacement, Reef-Boden).
- **🧪 Neuer Dauerhaft-Test `quality.test.ts`:** verifiziert, dass alle 19 Modi bei `medium` UND `high` Qualität fehlerfrei laufen (Regressionsschutz gegen zukünftige hardcodierte Werte).

### Added (UI)
- **🔍 Neuer Modus-Picker mit Suche & Favoriten:** Das bisherige flache Dropdown für die 19 Visual-Modi ist einem durchsuchbaren, nach Kategorie gruppierten Grid gewichen (`ModePicker`-Komponente). Textsuche filtert über Namen/Kategorie, ein Stern pro Modus pinnt Favoriten oben an – Favoriten werden persistent gespeichert (`favoriteModes` in den Settings, inkl. Validierung beim Laden alter/kaputter Stände).
- **🗂️ `SelectBox` unterstützt jetzt `<optgroup>`-Gruppierung** (abwärtskompatibel für alle anderen Dropdowns).

### Accessibility
- **⌨️ Panel-Tabs sind jetzt vollwertig ARIA-konform:** `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, `aria-controls`/`aria-labelledby`-Verknüpfung, Pfeiltasten-Navigation zwischen Tabs (Roving-Tabindex-Pattern).
- **🔲 Touch-Ziele vergrößert:** Tab-Buttons (`min-height: 44px`), Transport-/Icon-Buttons auf mobilen Breakpoints (44px/40px statt 38px/32px) – erfüllt die gängige 44×44px-Empfehlung für Touch-Bedienung.
- **🎯 Sichtbarer Tastatur-Fokus** für alle neuen Modus-Picker-Elemente (Suchfeld, Modus-Buttons, Favoriten-Sterne).
- **✅ Kontrast geprüft:** `--muted`-Textfarbe gegen die Panel-Hintergründe liegt bei ~7.7:1 (übertrifft WCAG AAA für normalen Text) – keine Änderung nötig.

### Improved
- **🌍 i18n-Konsistenz weiterhin 100 %:** DE/EN-Wörterbücher exakt synchron (256/256 Keys, automatisiert geprüft), alle neuen UI-Strings (Suche, Favoriten) in beiden Sprachen.
- **🧪 Testsuite auf 92 Tests erweitert** (2 neue `favoriteModes`-Validierungstests + 2 neue Qualitätsstufen-Smoke-Tests).

---

## [4.3.0] - 2026-08-13 — 8 neue Szenen, Code-Splitting & UI-Politur

### Added
- **8 neue 3D-Modi** (jetzt insgesamt 19 Modi):
  - **🌌 Aurora** – Nordlicht über Bergsee: wallende, additiv geschichtete Lichtbänder (Grün→Violett), Bergkette mit Schneekämmen, spiegelnder See, Sternenhimmel.
  - **🌋 Volcano** – Vulkanausbruch bei Nacht: glühende Lavaadern am Kegel, pulsierender Kraterschein, Aschewolke mit Untergrund-Glühen, physikalisch simulierter Funkenregen.
  - **⛈️ Storm at Sea** – Gewittersturm auf See: per Vertex-Displacement animierte Wellen, zufällig UND kick-getriggerte Blitzeinschläge mit echtem `PointLight`-Aufhellen von Himmel/Wasser, fallender Regen.
  - **🐠 Bioluminescent Reef** – Unterwasserriff: glühende, prozedural geformte Korallencluster in 5 Neonfarben, Licht-Gottesstrahlen von der Oberfläche, treibendes Plankton, Fischschwarm auf Lissajous-Bahnen.
  - **🕳️ Black Hole** – Ereignishorizont, Photonenring, rotierende Akkretionsscheibe mit Temperatur-Gradient und Doppler-Beaming (die dem Betrachter entgegenkommende Seite leuchtet heller – physikalisch korrekt), grob angedeutete Gravitationslinse im Sternenhintergrund.
  - **☄️ Comet** – unregelmäßig geformter Kometenkern (verformtes Ikosaeder) mit Kratern und ausgasenden Jets, glühende Koma, zwei separate Schweife (gerader blauer Ionenschweif, gekrümmter gelber Staubschweif) – Schweiflänge wächst mit Energy/Bass.
  - **🌆 Cyberpunk Rain** – Neon-Skyline im Regen: pro Gebäude einzigartiges Fenstermuster mit Kick-synchronem Flackern, 5 Neonfarben, nasser reflektierender Boden, fallender Regen, Bodennebel.
  - **💎 Crystal Cave** – unterirdische Höhle mit 14 glühenden Kristallclustern (5 Farben, phasenversetztes Pulsieren), spiegelndem Höhlensee, treibenden Lichtstäubchen.
- **🧩 Gemeinsames Silhouetten-Modul:** `buildRidgeSilhouette()` in `tslNoise.ts` – erzeugt jagged Berg-/Hügel-/Skyline-Kämme, wird jetzt von `EclipseScene` (Hügel), `AuroraScene` (Bergkette) gemeinsam genutzt.
- **🗂️ Modus-Kategorien:** `MODES` trägt jetzt ein `category`-Feld (Abstract/Space/Nature/Urban). Das Modus-Dropdown gruppiert alle 19 Modi entsprechend per `<optgroup>` – die `SelectBox`-Komponente unterstützt Gruppierung jetzt generell (abwärtskompatibel für alle anderen Dropdowns der App).
- **⏳ Lade-Hinweis:** Ein HUD-Chip zeigt „Szene wird geladen…“, während eine code-gesplittete Szene im Hintergrund nachlädt.

### Performance
- **⚡ Code-Splitting für alle 11 größeren Szenen:** `SolarSystemScene`, `EclipseScene`, `SpaceEclipseScene` sowie alle 8 neuen Szenen werden jetzt per `dynamic import()` erst beim ersten Aufruf nachgeladen statt beim Start eager mitgebundelt zu werden (~72 KB, die jetzt außerhalb des initialen Bundles liegen). Die zuvor sichtbare Szene bleibt währenddessen aktiv (kein Flackern), inklusive Schutz gegen veraltete Switches bei schnellem Moduswechsel während des Ladens.

### Improved
- **🧪 Szenen-Smoke-Tests erweitert:** Laufen jetzt durch alle 19 Modi (inkl. Warten auf lazy-geladene Chunks). Gesamtzahl weiterhin **88 Tests**.
- **🌍 i18n-Konsistenz geprüft:** DE/EN-Wörterbücher enthalten exakt dieselben 251 Keys (automatisiert verifiziert), alle 8 neuen Modus-Namen sind in beiden Sprachen hinterlegt.

---

## [4.2.0] - 2026-08-13 — Sonnenfinsternis (2 neue Szenen)

### Added
- **🌑 10. 3D-Modus „Total Eclipse" (Erdsicht):** Totale Sonnenfinsternis wie durchs Fernrohr beobachtet – die komplette Himmels-Szene (Sonne, Mond, Korona, Horizont) hängt an der Kamera (wie `ShaderSkyScene`/Logo-Overlay es bereits tun), sodass man unabhängig vom Kamera-Modus (Auto-Flight/Orbit/First-Person) immer direkt auf das Ereignis blickt. Enthält alle fünf angefragten Sonneneffekte: Korona mit Streamer-Strahlen, drei flackernde Protuberanzen (rote Gasfontänen), Oberflächen-Granulation/-Turbulenz der Sonne, ein geometrisch berechneter Diamantring-Effekt exakt beim Ein-/Austritt der Totalität sowie die Korona-Streamer als Sonnenwind-Andeutung. Dazu: einfadender Sternenhimmel, sich verdunkelnder Himmelshintergrund und eine prozedurale Hügel-Silhouette mit warmem Horizontglühen während der Totalität. Endlosschleife, deren Tempo und Korona-/Flare-Intensität an Bass/Energy/Kick gekoppelt sind.
- **🌍 11. 3D-Modus „Eclipse from Space":** Sonnenfinsternis aus der All-Perspektive – Erde im Zentrum (prozedurale Kontinente/Ozeane, Atmosphären-Rim), der Mond umkreist sie auf einer Bahn, deren Ebene die Sonnenrichtung enthält. Dadurch entsteht einmal pro Umlauf automatisch eine echte Sonne-Mond-Erde-Ausrichtung – rein geometrisch, ganz ohne Sonderfall-Logik. Der wandernde Kernschatten des Mondes auf der Erdoberfläche wird pro Bildpunkt über einen echten Schattenstrahl-Test berechnet (kein aufgesetzter Fake-Fleck). Freie Kamera wie bei „Solar System"; Sonne mit eigenem Granulations-/Korona-Effekt im Hintergrund.
- **🧩 Gemeinsames Noise-Modul:** Die prozeduralen 3D-Noise-Funktionen (`hash3`/`noise3`/`fbm3`) wurden aus `SolarSystemScene` in ein gemeinsames `tslNoise.ts`-Modul ausgelagert und werden jetzt von allen drei Weltraum-Szenen genutzt (weniger Code-Duplikation).
- **⌨️ Shortcut erweitert:** Ziffer <kbd>0</kbd> springt direkt in den 10. Modus (Total Eclipse); Ziffern <kbd>1</kbd>–<kbd>9</kbd> weiterhin für die ersten 9 Modi. Der 11. Modus („Eclipse from Space") ist über Dropdown oder die <kbd>M</kbd>-Taste erreichbar.

### Improved
- **🧪 Szenen-Smoke-Tests erweitert:** `SceneManager`-Tests laufen jetzt durch alle 11 Modi (vorher 8/9). Gesamtzahl weiterhin **88 Tests**.

---

## [4.1.0] - 2026-08-11 — Solar System & Lagerfeuer

### Added
- **🪐 9. 3D-Modus „Solar System":** Prozedural schattiertes Sonnensystem ohne Texturdateien – alle 8 Planeten in korrekter Reihenfolge, mit an die echten Verhältnisse angelehnter relativer Größe, relativem Abstand und relativer Umlaufgeschwindigkeit (Kepler-Ordnung: innere Planeten schneller als äußere), korrekten Achsneigungen (inkl. Uranus' 98°-Seitenlage und Venus' Rückwärtsrotation), echter Tag-/Nachtseiten-Beleuchtung, Saturn-/Uranus-Ringen mit Cassini-artigen Lücken, Erdmond, Asteroidengürtel zwischen Mars und Jupiter und Sonnenkorona mit Kick-Flares.
- **🔥 21. Shader-Preset „Lagerfeuer bei Nacht":** Flackerndes Feuer mit aufsteigenden Funken und Glut vor funkelndem Sternenhimmel mit Mond – reagiert auf Bass/Kick/Treble.
- **🌍 Teilweise Modus-/Preset-Übersetzung:** Neue `translateOrFallback()`-Hilfsfunktion im i18n-System übersetzt einzelne Modus-/Shader-Preset-Namen, sofern ein Wörterbuch-Eintrag existiert, sonst greift automatisch der bisherige Name. „Solar System"/„Sonnensystem" und das Lagerfeuer-Preset sind die ersten so lokalisierten Einträge (Modus-Dropdown, HUD-Chip, Shader-Preset-Dropdown).
- **⌨️ Shortcut erweitert:** Ziffern <kbd>1</kbd>–<kbd>9</kbd> für alle 9 Modi (9 = Solar System).

### Improved
- **🧪 Szenen-Smoke-Tests erweitert:** `SceneManager`-Tests laufen jetzt durch alle 9 Modi (vorher 8). Gesamtzahl weiterhin **88 Tests** (Modus-Liste + Shader-Preset-Registry-Checks aktualisiert statt neuer Fälle).

---

## [4.0.1] - 2026-08-11 — Alle 8 Modi repariert

### Fixed
- **🐛 Boot-Modus (Nebula) wurde NIE initialisiert:** `SceneManager.current` startete bei `'nebula'` und `setMode('nebula')` machte einen early-return → die Start-Szene blieb leer (schwarzer Screen beim Laden). Neues `initialized`-Flag sorgt dafür, dass der Start-Modus wirklich aufgebaut wird.
- **🐛 Veralteter Settings-Snapshot bei Modus-/Look-/Qualitätswechseln:** `setMode()`/`rebuild()` nutzten einen beim Engine-Start eingefrorenen `ctx` → Szenen wurden mit Boot-Settings/Palette statt den aktuellen initialisiert (Look-Presets, Partikel-Anzahl, Qualität wirkten oft nicht). Der SceneManager bekommt jetzt eine `getCtx()`-Factory und liest bei JEDEM Aufbau die aktuellen Werte.
- **🐛 Shader-Modus & Logo-Overlay unsichtbar:** Der Shader-Quad und das Text-Overlay hängen an der Kamera – die Kamera war aber nie Teil der Szene (`scene.add(camera)` fehlte), und der Renderer traversiert nur den Szenengraph → die Objekte wurden NIE gezeichnet. Jetzt wird die Kamera zur Szene hinzugefügt; der Shader-Modus rendert vollflächig (browser-verifiziert).
- **🐛 Qualitätswechsel baute die Szene nie neu:** Der Qualitäts-Pfad rief `setMode(settings.mode)` auf, das bei unverändertem Modus early-returnet → Partikelzahl blieb beim alten Wert. Jetzt `rebuild()`.
- **🐛 Teardown-Bug:** `Engine.dispose()` rief `setMode('nebula')` → bei bereits aktivem Nebula wurde die Szene nie disposed, sonst eine neue aufgebaut, die nie abgeräumt wurde. Neues `SceneManager.dispose()` räumt nur die aktive Szene ab.
- **🛡️ Retry nach fehlgeschlagenem Szenen-Init:** `initialized` wird erst NACH erfolgreichem `init()` gesetzt – ein fehlgeschlagener Aufbau (z. B. Shader-Fehler) ist damit erneut versuchbar.

### Added
- **🧪 Szenen-Smoke-Tests (5 neue):** Alle 8 Modi durchlaufen `setMode` → `update` → `rebuild` ohne Fehler; Boot-Init wird verifiziert; `getCtx()` wird bei jedem Aufbau frisch aufgerufen. Gesamtzahl: **88 Tests**.

---

## [4.0.0] - 2026-08-10 — Broadcast-Cockpit Layout

### Added
- **🎛️ Globale Transport-Leiste (Topbar):** Play/Pause, Mikrofon, Aufnahme und Screenshot sind jetzt **immer erreichbar** – unabhängig davon, welches Panel offen ist (vorher in Audio-/Export-Tabs vergraben).
- **🧭 Neue Topbar:** Brand + Transport links, Live-Status-Pill, Aktionen (Clean Mode, Fullscreen, DE/EN, Hilfe) rechts – alles in einer Glas-Sektion.
- **📂 Einklappbarer Settings-Drawer:** Das rechte Bedienpanel lässt sich per Handle (»), Taste <kbd>Q</kbd> oder <kbd>ESC</kbd> einklappen → maximaler Viewport für die Visuals. Im eingeklappten Zustand erscheint ein schwebender Mixer-Button zum Wiederöffnen.
- **📱 Mobile-Overhaul:** Auf Touch-Geräten wird das Panel zum **Bottom-Sheet** (62vh) mit eigenem ✕-Schließen-Button (Q/ESC existieren dort nicht).
- **✨ Fade-through-black-Szenenübergang** wurde sichtbar gemacht (`.mode-fade`-CSS fehlte zuvor komplett).

### Fixed
- **🎨 Look-Presets & Shader-Studio repariert:** (1) `settings.shaderPreset`-Änderungen (Look-Presets „Cosmic/Synthwave/Energy Grid", Deep-Links, Shader-Import) werden jetzt in der Engine überwacht und an die aktive Shader-Szene weitergegeben – vorher wirkten sie nur, wenn der Modus wechselte. (2) Der Shader-Quad (2×2 auf z=-8) deckte nur ~20 % des Viewports ab – jetzt wird er pro Frame aus FOV+Aspect auf **Vollbild** skaliert. (3) `particleCount`/`particleSymmetry` (init-only) erzwingen einen Szenen-Neubau (`SceneManager.rebuild()`), damit Look-Presets wie „Default" sofort wirken. (4) Shader-Preset-Wahl & Kompilierung wechseln automatisch in den Shader-Modus, wenn man in einer anderen Szene ist.
- **🚀 Build-Fix für Server-Deployments:** Vite löst jetzt **TypeScript vor JavaScript** auf (`resolve.extensions`). Alte Legacy-Dateien aus der 2D-Ära (z. B. `src/audio/playlist.js`), die auf dem Server beim TS-Umzug übrig geblieben waren, verdrängten sonst die neuen `.ts`-Module → `MISSING_EXPORT` beim `vite build`. Der Build ist damit auch gegen Stale-Files robust (per Test mit simulierter Legacy-Datei verifiziert).
- **🐛 Kollaps-Handle nicht mehr geclippt:** Das Handle saß im scrollbaren Panel (`overflow-y: auto`) und wurde an der Padding-Kante abgeschnitten. Neuer `.drawer`-Wrapper (Panel + Handle) außerhalb des Scroll-Containers behebt das.
- **🐛 Topbar-Overlap bei ≤900px:** `.ui`-Höhe ist jetzt adaptiv über die CSS-Variable `--topbar-h` (128px bei umbrechender Topbar).
- **Topbar-Status** nicht mehr klickbar (Pointer-Events korrekt).

---

## [3.2.0] - 2026-08-10 — Interaktiv & zweisprachig

### Added
- **🌊 8. 3D-Modus „Audio Ripples":** Konzentrische Ringe expandieren vom Zentrum – großer Impuls auf jedem Kick, stetiges Bass-Rauschen, pulsierender Zentrums-Glow mit Maus-Impuls.
- **🖱️ Maus-Interaktion:** Klick auf den Viewport erzeugt einen Impuls (`ctx.interaction.pulse`), der Partikel-Glühen, Orb-Skala, Spektrum-Türme, Sphere, Ripple-Ringe und alle Shader (`uClick`) antreibt.
- **🔁 Wiedergabe-Modi:** Repeat all / Repeat one / Shuffle / Stop am Ende (`playbackMode`) + **Track-Fortschritt & Seek** (klickbarer Fortschrittsbalken mit mm:ss).
- **📊 Session-Statistik:** Tracks, Spielzeit, Kicks, Modus-Wechsel, Snapshots – live im Export-Panel.
- **🖼️ Hintergrundbild per URL** laden (zusätzlich zu Datei & Drag&Drop).
- **🏷️ Logo-/Text-Overlay:** Wird als 3D-Sprite an der Kamera gerendert (Größe, Position oben/unten, Farbe) – erscheint dadurch auch in WebM-Aufnahmen & OBS-Modus.
- **🎥 Kamera-Presets:** 3 Slots (Speichern/Laden/Löschen) für FOV, Flug-/Orbit-Parameter, Abstand & Höhe – persistent via localStorage.
- **🔄 Szenen-Übergänge:** Kurzes Fade-through-black beim Modus-Wechsel.
- **🔥 4 neue Shader-Presets:** Fire Vortex, Galaxy Core, Liquid Metal, Neon Waves (jetzt 20 TSL-Presets).
- **🌍 DE/EN Sprachumschaltung:** Komplettes UI-Wörterbuch (App-Shell, alle Panels, Hilfe, HUD, Status-Texte) mit Umschalter im Panel-Header; Sprache wird persistent gespeichert.
- **⌨️ Shortcut erweitert:** Ziffern <kbd>1</kbd>–<kbd>8</kbd> für alle 8 Modi (8 = Audio Ripples).
- **✨ UI-Überholung:** Tab-Icon-Animation, Button-Hover-Feinheiten, pulssierender Record-Indikator, 2-spaltiges Hilfe-Raster, Statistik-Karten, Kamera-Preset-Slots, Mobile-Polish.

### Improved
- **MIDI-Labels & Status-Texte übersetzbar** (i18n-Keys statt hartkodierter Strings).

---

## [3.1.0] - 2026-08-10 — Feature-Expansion

### Added
- **🎧 Demo-Synth (eingebauter Beat-Generator):** Synthetischer Kick/Hi-Hat/Bass/Pad-Generator, der direkt in die Analyse-Kette läuft – der Visualizer animiert sofort ohne Audiodatei. Tempo einstellbar (70–180 BPM).
- **📈 BPM-Erkennung & Beat-Sync:** Onset-basierter Tempo-Tracker (Median-Intervall), liefert `bpm`, `beatPhase`, `beatPulse` und `onBeat` pro Frame; BPM wird im HUD/Status angezeigt.
- **🎛️ Live-Spektrum/Waveform-Monitor:** Echtzeit-Canvas im Audio-Panel (5-Band-Spektrum + Wellenform + Beat-Marker).
- **🔗 Audio von URL laden:** Stream/MP3 direkt per URL einbinden (neben Dateien & Mikrofon).
- **🎥 Erweiterte Kamera-Steuerung:** FOV, Flug-Radius, Flug-Höhe, Flug-Geschwindigkeit (Auto) und Orbit-Geschwindigkeit als Regler.
- **🌍 Szenen-Parameter:** Tunnel-Geschwindigkeit, Terrain-Amplitude, Partikel-Rotation, Partikel-Symmetrie (Arme) und Orb-Größe.
- **⚡ Performance-Monitor & Auto-Quality:** FPS + Qualitätsstufe im HUD; automatisches, schrittweises Herunter-/Hochstufen bei anhaltend niedrigen/hohen FPS.
- **🎨 Look-Presets (1-Klick):** 6 komplette Szenen-Kombinationen (Default, Cosmic Deep, Synthwave, Hyperspace, Energy Grid, Ice Planet).
- **🖥️ OBS-Overlay-Modus:** Echter 16:9-Letterbox-Viewport (Renderer wird skaliert & zentriert), Auto-Kamera + Ultra-Qualität – ideal als Browser-Quelle.
- **🎞️ WebM mit Alpha-Kanal:** Transparenter Hintergrund für Overlay-Nutzung in Video-Editoren (VP9, Clear-Color auf Alpha 0; Hintergrund wird nach Aufnahme wiederhergestellt).
- **💾 Shader-Export/Import (JSON):** Eigene Custom-Shader speichern, teilen und laden.
- **⌨️ Neue Shortcuts:** `Shift+F` Fullscreen, `R` Aufnahme Start/Stop, `S` Screenshot, `B` Bloom an/aus + Fullscreen-Button im Panel.
- **🌈 5 neue Farbpaletten** (Fire, Ocean, Gold, Toxic) + **Eigene Farbe** mit zwei Farbwählern.
- **🎛️ MIDI-Mapping erweitert:** Flug-Speed, Kamera-Distanz/-Höhe/-FOV, Tunnel-Speed, Terrain-Amplitude, Partikel-Rotation, Demo-BPM.

### Added (Polish-Pass)
- **🔗 Setup-Link kopieren:** Teilt Szene, Palette, Kamera, Demo-Tempo, Qualität & Co. als Deep-Link (validierte Query-Parameter).
- **💾 Einstellungen exportieren/importieren (JSON):** Komplettes Setup sichern, teilen und wiederherstellen – typ- & enum-validiert.
- **🎲 Überraschungs-Button:** Zufällige Szene + Palette + Kamera in einem Klick.
- **🔄 Auto-Szenen-Wechsel (Kiosk/Demo):** Wechselt alle 15 s automatisch durch die Modi.
- **🎥 Kick-Kamera-Punch:** FOV-Impuls auf jedem Kick/Beat für mehr Wucht.
- **⚠️ Engine-Fehler-Overlay:** Schlägt die 3D-Initialisierung fehl, erscheint eine klare Fehlermeldung mit Retry statt leerer Viewport.
- **🧱 Panel-Error-Boundary:** Abstürze einzelner Bedienfelder crashen nicht mehr die ganze App.
- **🔗 Erweiterte Deep-Links:** `?shaderPreset=`, `?lookPreset=`, `?demoMode=`, `?demoBpm=`, `?quality=`, `?obsMode=`, `?autoCycle=` (enum- & bereichsvalidiert, demoBpm 60–220 geklemmt).
- **♿ Barrierefreiheit:** Sichtbare Tastatur-Fokus-Ringe, `aria-label`s, `name`-Attribute für alle Formularfelder.

### Added (Kick-Stile, MIDI, PWA)
- **🥁 Kick-Stile jetzt echt:** Der vorher tote `Kick-Stil`-Regler steuert jetzt den Kick-Envelope über `shapeKick` – Soft Glow (weich/lang), Sanfter Puls (knackig), Soft Flash (hart an/aus), Ripple Ring (Wellen-Impuls), Aus. Wirkt automatisch in allen Szenen (ein Ort, alle Effekte).
- **📱 PWA-Unterstützung:** `manifest.webmanifest`, generierte Neon-Icons (192/512 px), `theme-color` – die App ist installierbar (standalone).
- **📡 Service Worker** (nur Produktions-Build): network-first für Navigationen (nie veraltetes HTML), cache-first für gehashte Assets, Offline-Fallback auf die letzte Seite.
- **🎛️ MIDI-Lazy-Init:** MIDI-Zugriff wird erst bei der ersten Nutzerinteraktion angefragt – die Boot-Warnung „Web MIDI will ask a permission…" ist weg, Permission-Prompt passiert auf einer Geste.

### Fixed
- **🐛 Deep-Link-Demo startet jetzt wirklich:** `?demoMode=1` (oder gespeichertes Setting) erzeugt beim Boot den Analyser vorab und startet den Demo-Synth; eine einmalige Audio-Unlock-Geste (erste Interaktion) resumiert den AudioContext – Beats & BPM laufen nun auch ohne Klick auf den Toggle. `ensureReady` fängt abgelehnte `resume()`-Promises ab (keine unhandled Rejections).

### Added
- **🔊 Master-Lautstärke-Regler** (0–100 %) im Audio-Panel – wirkt auf Datei-Playback UND Demo-Synth (persistent; wird beim Demo-Start erneut angewendet – Reviewer-Fix).
- **⌨️ Direkter Modus-Wechsel:** Ziffern <kbd>1</kbd>–<kbd>7</kbd> springen direkt in die Szene (1=Nebula … 7=Fusion).

### Fixed
- **🖥️ OBS-Modus während Aufnahme eingefroren:** Canvas-Größe wird während laufender Aufnahme nie mehr geändert (hätte den Capture-Stream korrumpiert); nach Stop wird die OBS-Ansicht korrekt wiederhergestellt.
- **📡 SW-Precache erweitert:** `manifest.webmanifest` + Icons werden beim Install gecacht – Offline-Installierbarkeit schon nach dem ersten Besuch.

### Improved
- **DemoSynth robust & testbar:** `globalThis.setInterval` (SSR/test-sicher), `triggerBass` nutzt den Step-Parameter statt Klassen-Zustand; **6 neue Unit-Tests** mit gemocktem AudioContext (Node-Verdrahtung, Pattern-Scheduling, Cleanup).
- **🐛 Kritischer Rehydration-Fix:** Veraltete localStorage-Stände (altes Schema, fehlende v3.1-Felder) setzten Settings auf `undefined` → Tunnel-Geschwindigkeit NaN → Sterne unsichtbar + Console-Warnung. Beim Laden wird jetzt schema-sicher über die Defaults gemerged (Typ- & Enum-Validierung via `mergeSettings`).
- **🛡️ Tunnel-Stars:** Defensiver NaN-Guard verhindert, dass korrupte Werte je die Stern-Positionen vergiften.
- **🥁 Beat-Puls verbessert:** `beatPulse` klingt jetzt über das GESAMTE Beat-Intervall ab (konsistent zu `beatPhase`, `Puls = 1 − Phase`) statt hartem 120-ms-Schnitt – weichere, sichtbarere Beat-Sync bei allen Tempi.
- **Beat-Sync jetzt sichtbar in allen Szenen:** `beatPulse`/`beatPhase` treiben Partikel-Größe, Orb-Skala, Spektrum-Balken, Tunnel-Ringe/Glow, Terrain-Höhe, Sphere-Skala, Kamera-Bob und 4 Shader-Presets (Beat-Flash) – mit Demo-Synth sofort erlebbar.
- **9 neue Unit-Tests** für den Tempo-Tracker (BPM-Erkennung, Burst-Robustheit, Beat-Phase) + **15 Tests** für settingsIO (Export/Import, Share-URLs, Rehydration) + **5 Tests** für shapeKick (Kick-Stile) + **6 Tests** für DemoSynth – Gesamtzahl: **72 Tests**.
- **Tempo-Tracker-Fix:** `lastBeat` wird auch beim allerersten Onset gesetzt (nach forceBpm/reset), damit Beat-Pulse sofort funktionieren.
- **WebGPU-Renderer mit Alpha-Kanal** (`alpha: true` + opaker Clear im Normalbetrieb) – Grundlage für Alpha-Aufnahmen.
- **Tempo-Tracker robuster:** `lastOnset` wird nur bei gültigen Intervallen verschoben (dichte Onset-Bursts korrumpieren die BPM-Messung nicht mehr).
- **Inline-Favicon (SVG, Neon-Stil)** – behebt den 404-Fehler in der Konsole.
- **Auto-Quality stabiler:** schrittweise Stufen (medium→high→ultra) statt Direktsprung, längeres stabiles Fenster gegen Oszillation.
- **OBS-Modus als echter Letterbox** statt verzerrter Kamera-Aspekt.

---

## [3.0.0] - 2026-08-10 — „Everything Real 3D"

### Added
- **Kompletter 3D-Neuaufbau:** Alle 2D-Canvas-Modi durch echte 3D-Szenen ersetzt (Nebula Galaxy, Spectrum Towers, Hyperspace Tunnel, Terrain 2.0, Audio Sphere 2.0, Shader Skybox, Fusion 3D).
- **Three.js WebGPURenderer (r0.185)** mit automatischem **WebGL2-Fallback** – produktionsreif, 60+ FPS.
- **TSL-Shader-Studio:** Alle 16 GLSL-Presets auf TSL portiert (ein Shader-Code → WGSL + GLSL identisch), plus Custom-GLSL-Editor mit Live-Kompilierung und Fehler-Anzeige.
- **React 19 + TypeScript + Zustand UI:** Professionelles Neon/Cyberpunk-Design-System, Panels für Audio/Visuals/Kamera/Shader/BG/Video/Export.
- **3 Kamera-Modi:** Auto-Flight (audiogesteuert), Orbit (Maus/Touch), First-Person (WASD).
- **Post-Processing:** Bloom + Vignette als TSL-Pipeline (WebGPU) bzw. EffectComposer (WebGL2).
- **Chroma-Key-Video als 3D-Videoplane** in der Szene (statt Canvas-Overlay).
- **6 Farbpaletten** (Aurora, Sunset, Neon, Ice, Mono, Cyberpunk) mit Preset-Persistenz.
- **Deep-Link-Parameter:** `?mode=nebula|spectrum|tunnel|terrain|sphere|shader|fusion` für direkten Modus-Start.
- **Unit-Tests (Vitest):** 37 Tests für Band-Analyse, Kick-Detection, Store-Persistenz und Playlist-Logik.

### Improved
- **Performance:** GPU-Instancing für Partikel, Spektrum-Türme und Terrain; Engine-Renderloop komplett außerhalb von React (keine Re-Renders).
- **WGSL-Korrektheit:** Alle `smoothstep`-Aufrufe mit vertauschten Kanten auf spezifikationskonforme Form umgestellt (Portabilität zu Safari/Firefox).
- **Instanced-Attribute:** Korrekte Nutzung im WebGPU-Backend (stepMode=Instance statt manuellem Indexing).
- **Settings-Persistenz:** Robuster localStorage-Zugriff mit In-Memory-Fallback (SSR/Tests).

### Removed
- Kompletter 2D-Canvas-Renderpfad (Nebula/Spectrum/Tunnel/Hybrid 2D) – durch 3D ersetzt.

---

## [2.1.0] - 2026-07-25

### Added
- **AudioWorklet Integration:** High-performance off-main-thread audio processing using `AudioWorkletNode` and dynamic Blob modules.
- **Mobile Touch & Gesture Controls:** Swipe left/right to cycle visual modes, swipe up/down to cycle color presets, and double-tap to toggle Clean Fullscreen mode.
- **Audio Playlist & Queue Management:** Multi-track audio queue support with automatic track advancement on song end.
- **High-Res PNG Snapshot Export:** Instant snapshot button (`📸 High-Res Screenshot`) to capture and download crystal-clear PNG snapshots of the active visualizer scene.
- **Dedicated Cinematic Music Video Shader:** Added `Infinite Galaxies` shader preset based on the 4:20 music video script (Prolog, Hyperspace, Infinite Galaxies, Supernova, Event Horizon Black Hole, Rebirth).
- **4 New 3D Raymarched Shader Presets:** *3D Audio Sphere*, *3D Circular Ring Bars*, *3D Spectrum Wall*, and *3D Audio Wormhole*, bringing total professional shader presets to 16.

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
