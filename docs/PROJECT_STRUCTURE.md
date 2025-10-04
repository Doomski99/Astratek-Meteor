# Project Structure

This document describes how the Astratek Meteor codebase is organised and how the main pieces fit together when the simulation runs.

## Runtime Flow Overview
1. **Entry bootstrap (`src/main.js`)** – Imports textures, orbital data, and UI helpers before wiring everything together. It initialises the Three.js scene, loads planet and asteroid assets, registers UI event handlers, and starts the render loop.
2. **Scene creation (`src/core/scene.js`)** – Sets up the global renderer, camera, controls, lighting, and post-processing passes, exposing shared instances to the rest of the application.
3. **Simulation timing (`src/core/time.js`)** – Exposes a simulation clock that keeps master time, supports multiple channels (orbit vs. spin), and notifies subscribers such as UI controls.
4. **Data loading (`src/data`)** – Parses orbital elements from CSV, builds planet descriptors, and exposes helpers for asteroid catalogues and yield categories.
5. **Physics helpers (`src/simulation`)** – Provides Kepler propagation, frame transformations, asteroid mesh management, impact overlays, and reference frame updates.
6. **User interface (`src/ui` + `src/index.html`)** – Builds DOM-based panels for time controls, asteroid tracking, impactor inputs, and telemetry readouts, synchronising them with the simulation state.

## Directory Breakdown
### `src/`
- `main.js` – Application entry point and render loop controller. Configures simulation settings, loads textures, instantiates factories, manages event listeners, and coordinates asteroid/impactor workflows.
- `index.html` – Defines the base DOM structure for control panels, impact maps, telemetry readouts, and pop-up information cards that the UI modules populate.
- `style.css` – Global styles for panels, buttons, typography, and overlay elements used across the interface.
- `images/` – Texture assets for planets, backgrounds, and UI elements.
- `asteroids/asteroidPack.glb` – GLTF mesh bundle for procedurally instanced asteroids.

### `src/core/`
- `scene.js` – Creates the Three.js `Scene`, `PerspectiveCamera`, renderer, and orbit controls. Configures bloom and outline passes for highlighting bodies and adds the ambient lighting used across the simulation.
- `time.js` – Implements a composable simulation clock with pause/resume, looping, adjustable duration, playback speed, and derived “channels” that advance at different rates.

### `src/data/`
- `bodies.js` – Parses CSV orbit data, constructs `planetData`, generates Kepler elements, instantiates planets/moons, and exposes helpers for asteroid mesh creation and trajectory sampling.
- `impactYieldCategories.js` – Defines descriptive yield bands, labels, and severity metadata used by the impact analysis overlay and summary panel.

### `src/simulation/`
- `kepler.js` – Contains orbital propagation utilities built on Keplerian elements, including conversions between anomalies and scene coordinates.
- `orbitUtils.js` – Houses transformations between orbital and scene frames, interpolation helpers, and trajectory sampling logic shared by planets and asteroids.
- `asteroids.js` – Manages GLTF loading, instanced asteroid meshes, orbital updates per frame, trajectory line generation, impact overlay creation, and disposal helpers.
- `referenceFrames.js` – Tracks Earth’s instantaneous velocity for relative motion calculations and provides reference frame conversions.
- `scales.js` – Stores constants for astronomical unit conversion, Earth radius scaling, and frames-per-day multipliers to keep the simulation numerically stable.
- `impactorManager.js` – Calculates impact yields, derives effect bands and categories, projects blast radii onto the Earth overlay, and synthesises Keplerian trajectories from custom impactor inputs.

### `src/ui/`
- `timeControls.js` – Renders floating playback controls, syncs slider/button states with the simulation clock, and exposes speed presets while injecting the widget’s styles at runtime.
- `asteroidPanel.js` – Generates the tracked asteroid list, handles hover/selection styling, and triggers callbacks when users toggle tracking.
- `asteroidInfoPanel.js` – Formats and updates telemetry readouts (velocity vectors, speed, etc.) when asteroids are tracked or focused.
- `impactTimeWidget.js` – Displays countdowns and status indicators related to predicted impacts.

### `static/`
- `data/asteroids.csv` – Source catalogue of asteroid orbital elements consumed by `bodies.js` at runtime.
- Additional static textures (e.g., `door.jpg`) that Vite serves directly without bundling.

### `docs/`
- `PROJECT_STRUCTURE.md` (this document) – High-level documentation for the repository.

## Data & Asset Dependencies
- All runtime imagery lives under `src/images/` and is imported directly in `main.js`, allowing Vite to bundle them.
- Asteroid GLTF assets (`src/asteroids/asteroidPack.glb`) are lazily loaded by the asteroid mesh manager and instanced within the scene.
- The asteroid CSV catalogue (`static/data/asteroids.csv`) must be hosted alongside the production build; without it, no asteroid entries will load.

## Extending the Simulation
- To add new UI panels, define the markup in `src/index.html` and pair it with a controller module under `src/ui/` that listens to simulation clock or data events.
- Planet or moon adjustments should be made in `src/data/bodies.js`, where you can introduce new texture imports, orbital parameters, or mesh configuration.
- Custom physics behaviours belong in `src/simulation/`, leveraging existing utilities like `propagateKepler` and `orbitPositionToScene` to remain consistent with the current coordinate system.
