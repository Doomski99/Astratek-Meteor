import * as THREE from 'three';
import * as dat from 'dat.gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import bgTexture1 from '/images/1.jpg';
import bgTexture2 from '/images/2.jpg';
import bgTexture3 from '/images/3.jpg';
import bgTexture4 from '/images/4.jpg';
import sunTexture from '/images/sun.jpg';
import mercuryTexture from '/images/mercurymap.jpg';
import mercuryBump from '/images/mercurybump.jpg';
import venusTexture from '/images/venusmap.jpg';
import venusBump from '/images/venusmap.jpg';
import venusAtmosphere from '/images/venus_atmosphere.jpg';
import earthTexture from '/images/earth_daymap.jpg';
import earthNightTexture from '/images/earth_nightmap.jpg';
import earthAtmosphere from '/images/earth_atmosphere.jpg';
import earthMoonTexture from '/images/moonmap.jpg';
import earthMoonBump from '/images/moonbump.jpg';
import marsTexture from '/images/marsmap.jpg';
import marsBump from '/images/marsbump.jpg';
import jupiterTexture from '/images/jupiter.jpg';
import ioTexture from '/images/jupiterIo.jpg';
import europaTexture from '/images/jupiterEuropa.jpg';
import ganymedeTexture from '/images/jupiterGanymede.jpg';
import callistoTexture from '/images/jupiterCallisto.jpg';
import saturnTexture from '/images/saturnmap.jpg';
import satRingTexture from '/images/saturn_ring.png';
import uranusTexture from '/images/uranus.jpg';
import uraRingTexture from '/images/uranus_ring.png';
import neptuneTexture from '/images/neptune.jpg';
import plutoTexture from '/images/plutomap.jpg';

import { scene, camera, renderer, controls, composer, outlinePass } from './core/scene.js';
import { createSimulationClock } from './core/time.js';
import { createPlanetFactory, planetData, createAsteroidEntries, asteroidCatalog } from './data/bodies.js';
import { initAsteroidPanel } from './ui/asteroidPanel.js';
import { initTimeControls } from './ui/timeControls.js';
import {
  createAsteroidMeshManager,
  updateAsteroidTransform,
  getAsteroidMeshes,
  findAsteroidEntryFromObject,
  getTrajectoryPoints,
  createTrajectoryLine,
  createImpactOverlayMesh,
  disposeObject
} from './simulation/asteroids.js';

const cubeTextureLoader = new THREE.CubeTextureLoader();
const textureLoader = new THREE.TextureLoader();

const FRAMES_PER_SECOND = 60;
const FRAMES_PER_MILLISECOND = FRAMES_PER_SECOND / 1000;
const DEFAULT_SIMULATION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

scene.background = cubeTextureLoader.load([
  bgTexture3,
  bgTexture1,
  bgTexture2,
  bgTexture2,
  bgTexture4,
  bgTexture2
]);

const gui = new dat.GUI({ autoPlace: false });
const customContainer = document.getElementById('gui-container');
if (customContainer) {
  customContainer.appendChild(gui.domElement);
}

const settings = {
  accelerationOrbit: 1,
  acceleration: 1,
  sunIntensity: 1.9
};

const simulationClock = createSimulationClock({ duration: DEFAULT_SIMULATION_DURATION });
const orbitTimeChannel = simulationClock.createChannel(settings.accelerationOrbit * FRAMES_PER_MILLISECOND);
const spinTimeChannel = simulationClock.createChannel(settings.acceleration * FRAMES_PER_MILLISECOND);

gui
  .add(settings, 'accelerationOrbit', 0, 10)
  .onChange(value => orbitTimeChannel.setMultiplier(value * FRAMES_PER_MILLISECOND));
gui
  .add(settings, 'acceleration', 0, 10)
  .onChange(value => spinTimeChannel.setMultiplier(value * FRAMES_PER_MILLISECOND));
gui.add(settings, 'sunIntensity', 1, 10).onChange(value => {
  sunMat.emissiveIntensity = value;
});

initTimeControls(simulationClock);

let lastFrameTime = performance.now();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const targetBoundingBox = new THREE.Box3();
const targetBoundingSphere = new THREE.Sphere();

let isManualOrbiting = false;
let isUserOrbitControlsActive = false;

controls.addEventListener('start', () => {
  isManualOrbiting = true;
  isUserOrbitControlsActive = true;
  isMovingTowardsAsteroid = false;
  isMovingTowardsPlanet = false;
  isZoomingOut = false;
});

controls.addEventListener('end', () => {
  isUserOrbitControlsActive = false;
});

const viewTargetListElement = document.getElementById('viewTargetList');

function setActiveViewTarget(id) {
  if (!viewTargetListElement) {
    return;
  }

  const items = viewTargetListElement.querySelectorAll('[data-target-id]');
  items.forEach(item => {
    item.classList.toggle('view-panel__item--active', item.dataset.targetId === id);
  });
}

const MIN_CAMERA_DISTANCE = 0.2;
const MIN_CAMERA_DISTANCE_FLOOR = 0.1;
const MIN_CAMERA_PADDING_FACTOR = 1.6;
const SMALL_OBJECT_PADDING_FACTOR = 1.1;
const SMALL_OBJECT_RADIUS_THRESHOLD = 2;
const MAX_CAMERA_DISTANCE_FLOOR = 350;
const MAX_CAMERA_DISTANCE_FACTOR = 15;

function setCameraZoomLimitsForObject(object, fallbackRadius = 8) {
  let radius = fallbackRadius;

  if (object) {
    targetBoundingBox.setFromObject(object);
    if (!targetBoundingBox.isEmpty()) {
      targetBoundingBox.getBoundingSphere(targetBoundingSphere);
      const computedRadius = targetBoundingSphere.radius;
      if (computedRadius > 0) {
        radius = computedRadius;
      }
    }
  }

  let minDistance;

  if (radius <= SMALL_OBJECT_RADIUS_THRESHOLD) {
    const t = Math.min(radius / SMALL_OBJECT_RADIUS_THRESHOLD, 1);
    const paddingFactor = THREE.MathUtils.lerp(
      SMALL_OBJECT_PADDING_FACTOR,
      MIN_CAMERA_PADDING_FACTOR,
      t
    );
    minDistance = Math.max(radius * paddingFactor, MIN_CAMERA_DISTANCE_FLOOR);
  } else {
    minDistance = radius * MIN_CAMERA_PADDING_FACTOR;
  }

  minDistance = Math.max(minDistance, MIN_CAMERA_DISTANCE);
  const maxDistance = Math.max(radius * MAX_CAMERA_DISTANCE_FACTOR, MAX_CAMERA_DISTANCE_FLOOR);

  controls.minDistance = minDistance;
  controls.maxDistance = Math.max(maxDistance, minDistance * 1.2);
}

if (viewTargetListElement) {
  viewTargetListElement.addEventListener('click', event => {
    const item = event.target.closest('[data-target-id]');
    if (!item) {
      return;
    }

    const { targetId } = item.dataset;
    if (targetId === 'earth') {
      setActiveViewTarget('earth');
      const earthTarget = typeof earth !== 'undefined' ? earth.planet : null;
      setCameraZoomLimitsForObject(earthTarget, 6.4);
      updateEarthDefaultView(true);
      isManualOrbiting = false;
      isMovingTowardsAsteroid = false;
      isMovingTowardsPlanet = false;
      isZoomingOut = true;
    }
  });
}

setActiveViewTarget('earth');

if (renderer?.domElement) {
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.addEventListener('pointerdown', () => {
    renderer.domElement.style.cursor = 'grabbing';
  });
  renderer.domElement.addEventListener('pointerup', () => {
    renderer.domElement.style.cursor = 'grab';
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    renderer.domElement.style.cursor = 'grab';
  });
}

const earthDefaultCameraOffset = new THREE.Vector3(-90, 45, 140);
const earthDefaultCameraPosition = new THREE.Vector3();
const earthDefaultTargetPosition = new THREE.Vector3();
const zoomOutTargetPosition = new THREE.Vector3();
const planetFocusPosition = new THREE.Vector3();

let selectedPlanet = null;
let isMovingTowardsPlanet = false;
let targetCameraPosition = new THREE.Vector3();
let offset;

let isZoomingOut = false;
function updateEarthDefaultView(applyToCamera = false) {
  if (typeof earth !== 'undefined' && earth.planet) {
    earth.planet.getWorldPosition(earthDefaultTargetPosition);
  } else {
    earthDefaultTargetPosition.set(0, 0, 0);
  }

  earthDefaultCameraPosition.copy(earthDefaultTargetPosition).add(earthDefaultCameraOffset);
  zoomOutTargetPosition.copy(earthDefaultCameraPosition);

  if (applyToCamera) {
    controls.target.copy(earthDefaultTargetPosition);
    camera.position.copy(earthDefaultCameraPosition);
  }

  const earthTarget = typeof earth !== 'undefined' ? earth.planet : null;
  setCameraZoomLimitsForObject(earthTarget, 6.4);
}

function closeInfo() {
  const info = document.getElementById('planetInfo');
  if (info) {
    info.style.display = 'none';
  }
  settings.accelerationOrbit = 1;
  orbitTimeChannel.setMultiplier(settings.accelerationOrbit * FRAMES_PER_MILLISECOND);
  updateEarthDefaultView();
  controls.target.copy(earthDefaultTargetPosition);
  isManualOrbiting = false;
  isZoomingOut = true;
}

function closeInfoNoZoomOut() {
  const info = document.getElementById('planetInfo');
  if (info) {
    info.style.display = 'none';
  }
  settings.accelerationOrbit = 1;
  orbitTimeChannel.setMultiplier(settings.accelerationOrbit * FRAMES_PER_MILLISECOND);
  isManualOrbiting = false;
}

function showPlanetInfo(planet) {
  const info = document.getElementById('planetInfo');
  const name = document.getElementById('planetName');
  const details = document.getElementById('planetDetails');

  if (!info || !name || !details) {
    return;
  }

  name.innerText = planet;
  const data = planetData[planet];
  if (data) {
    details.innerText =
      `Radius: ${data.radius}\n` +
      `Tilt: ${data.tilt}\n` +
      `Rotation: ${data.rotation}\n` +
      `Orbit: ${data.orbit}\n` +
      `Distance: ${data.distance}\n` +
      `Moons: ${data.moons}\n` +
      `Info: ${data.info}`;
  } else {
    details.innerText = '';
  }

  info.style.display = 'block';
}

window.closeInfo = closeInfo;

const createPlanet = createPlanetFactory({ scene, textureLoader });

const sunSize = 697 / 40;
const sunGeom = new THREE.SphereGeometry(sunSize, 32, 20);
const sunMat = new THREE.MeshStandardMaterial({
  emissive: 0xfff88f,
  emissiveMap: textureLoader.load(sunTexture),
  emissiveIntensity: settings.sunIntensity
});
const sun = new THREE.Mesh(sunGeom, sunMat);
scene.add(sun);

const pointLight = new THREE.PointLight(0xfdffd3, 1200, 400, 1.4);
scene.add(pointLight);

function loadObject(path, position, scale, callback) {
  const loader = new GLTFLoader();
  loader.load(
    path,
    gltf => {
      const obj = gltf.scene;
      obj.position.set(position, 0, 0);
      obj.scale.set(scale, scale, scale);
      scene.add(obj);
      if (callback) {
        callback(obj);
      }
    },
    undefined,
    error => {
      console.error('An error happened', error);
    }
  );
}

const asteroidYieldColors = {
  low: 0x58d68d,
  medium: 0xf4d03f,
  high: 0xe74c3c
};

const asteroidYieldRadiusScale = {
  low: 1.3,
  medium: 1.8,
  high: 2.6
};

const defaultAsteroidCameraOffset = new THREE.Vector3(25, 15, 25);
const asteroidCameraOffsetDirection = defaultAsteroidCameraOffset.clone().normalize();
const ASTEROID_CAMERA_OFFSET_RADIUS_MULTIPLIER = 4;
const ASTEROID_CAMERA_OFFSET_MIN = 0.6;
const ASTEROID_CAMERA_OFFSET_MIN_MULTIPLIER = 1.5;

function computeAsteroidCameraOffset(entry) {
  if (!entry?.mesh) {
    return defaultAsteroidCameraOffset.clone();
  }

  targetBoundingBox.setFromObject(entry.mesh);
  if (targetBoundingBox.isEmpty()) {
    return defaultAsteroidCameraOffset.clone();
  }

  targetBoundingBox.getBoundingSphere(targetBoundingSphere);
  const radius = targetBoundingSphere.radius || 0;
  if (radius <= 0) {
    return defaultAsteroidCameraOffset.clone();
  }

  const minDistanceFromZoom = controls.minDistance ?? 0;
  const targetDistance = Math.max(
    radius * ASTEROID_CAMERA_OFFSET_RADIUS_MULTIPLIER,
    minDistanceFromZoom * ASTEROID_CAMERA_OFFSET_MIN_MULTIPLIER,
    ASTEROID_CAMERA_OFFSET_MIN
  );

  return asteroidCameraOffsetDirection
    .clone()
    .multiplyScalar(targetDistance);
}

const asteroidFocusPoint = new THREE.Vector3();
const asteroidCameraTarget = new THREE.Vector3();
const asteroidWorkVector = new THREE.Vector3();
const previousControlsTarget = new THREE.Vector3();
const controlsTargetDelta = new THREE.Vector3();
const earthWorldPosition = new THREE.Vector3();

const asteroidEntries = createAsteroidEntries(asteroidCatalog);
const asteroidPanel = initAsteroidPanel(asteroidEntries, {
  onSelect: id => handleAsteroidSelection(id)
});

function getCurrentSimulationTiming() {
  return {
    orbitFrames: orbitTimeChannel.getValue(),
    spinFrames: spinTimeChannel.getValue()
  };
}

const asteroidMeshManagerPromise = createAsteroidMeshManager({
  scene,
  getCurrentTiming: getCurrentSimulationTiming
});
let asteroidMeshManager = null;

async function getAsteroidMeshManager() {
  if (asteroidMeshManager) {
    return asteroidMeshManager;
  }

  asteroidMeshManager = await asteroidMeshManagerPromise;
  return asteroidMeshManager;
}

asteroidMeshManagerPromise
  .then(manager => {
    asteroidEntries.forEach(entry => {
      manager.ensureMesh(entry, getCurrentSimulationTiming());
    });
    return manager;
  })
  .catch(error => {
    console.error('Failed to preload asteroid meshes', error);
  });

let selectedAsteroidEntry = null;
let hoveredAsteroidEntry = null;
let asteroidTrajectoryLine = null;
let asteroidImpactOverlay = null;
let isMovingTowardsAsteroid = false;

const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { type: 't', value: textureLoader.load(earthTexture) },
    nightTexture: { type: 't', value: textureLoader.load(earthNightTexture) },
    sunPosition: { type: 'v3', value: sun.position }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    uniform vec3 sunPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
      vSunDirection = normalize(sunPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    void main() {
      float intensity = max(dot(vNormal, vSunDirection), 0.0);
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv) * 0.2;
      gl_FragColor = mix(nightColor, dayColor, intensity);
    }
  `
});

const earthMoon = [
  {
    size: 1.6,
    texture: earthMoonTexture,
    bump: earthMoonBump,
    orbitSpeed: 0.0166667,
    orbitRadius: 10,
    spinRate: 0.01,
    tilt: 5
  }
];

const marsMoons = [
  {
    modelPath: '/images/mars/phobos.glb',
    scale: 0.1,
    orbitRadius: 5,
    orbitSpeed: 0.0333333,
    position: 100,
    mesh: null,
    spinRate: 0.001
  },
  {
    modelPath: '/images/mars/deimos.glb',
    scale: 0.1,
    orbitRadius: 9,
    orbitSpeed: 0.0083333,
    position: 120,
    mesh: null,
    spinRate: 0.001
  }
];

const jupiterMoons = [
  {
    size: 1.6,
    texture: ioTexture,
    orbitRadius: 20,
    orbitSpeed: 0.0083333,
    spinRate: 0.01
  },
  {
    size: 1.4,
    texture: europaTexture,
    orbitRadius: 24,
    orbitSpeed: 0.0041667,
    spinRate: 0.01
  },
  {
    size: 2,
    texture: ganymedeTexture,
    orbitRadius: 28,
    orbitSpeed: 0.0020833,
    spinRate: 0.01
  },
  {
    size: 1.7,
    texture: callistoTexture,
    orbitRadius: 32,
    orbitSpeed: 0.001,
    spinRate: 0.01
  }
];

const mercury = createPlanet('Mercury', 2.4, 40, 0, mercuryTexture, mercuryBump);
const venus = createPlanet('Venus', 6.1, 65, 3, venusTexture, venusBump, null, venusAtmosphere);
const earth = createPlanet('Earth', 6.4, 90, 23, earthMaterial, null, null, earthAtmosphere, earthMoon);
const mars = createPlanet('Mars', 3.4, 115, 25, marsTexture, marsBump);

marsMoons.forEach((moon, index) => {
  moon.initialPhase = moon.initialPhase ?? index * (Math.PI / 2);
  loadObject(moon.modelPath, moon.position, moon.scale, loadedModel => {
    moon.mesh = loadedModel;
    mars.planetSystem.add(moon.mesh);
    moon.baseRotation = moon.mesh.rotation.y;
    moon.mesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  });
});

const jupiter = createPlanet('Jupiter', 69 / 4, 200, 3, jupiterTexture, null, null, null, jupiterMoons);
const saturn = createPlanet('Saturn', 58 / 4, 270, 26, saturnTexture, null, {
  innerRadius: 18,
  outerRadius: 29,
  texture: satRingTexture
});
const uranus = createPlanet('Uranus', 25 / 4, 320, 82, uranusTexture, null, {
  innerRadius: 6,
  outerRadius: 8,
  texture: uraRingTexture
});
const neptune = createPlanet('Neptune', 24 / 4, 340, 28, neptuneTexture);
const pluto = createPlanet('Pluto', 1, 350, 57, plutoTexture);

const spinBindings = [];
const orbitBindings = [];

function registerSpinBinding(object, ratePerFrame) {
  if (!object) {
    return;
  }
  spinBindings.push({ object, rate: ratePerFrame, base: object.rotation.y });
}

function registerOrbitBinding(object, ratePerFrame) {
  if (!object) {
    return;
  }
  orbitBindings.push({ object, rate: ratePerFrame, base: object.rotation.y });
}

registerSpinBinding(sun, 0.001);
registerSpinBinding(mercury.planet, 0.001);
registerSpinBinding(venus.planet, 0.0005);
registerSpinBinding(venus.Atmosphere, 0.0005);
registerSpinBinding(earth.planet, 0.005);
registerSpinBinding(earth.Atmosphere, 0.001);
registerSpinBinding(mars.planet, 0.01);
registerSpinBinding(jupiter.planet, 0.005);
registerSpinBinding(saturn.planet, 0.01);
registerSpinBinding(uranus.planet, 0.005);
registerSpinBinding(neptune.planet, 0.005);
registerSpinBinding(pluto.planet, 0.001);

registerOrbitBinding(mercury.planet3d, 0.004);
registerOrbitBinding(venus.planet3d, 0.0006);
registerOrbitBinding(earth.planet3d, 0.001);
registerOrbitBinding(mars.planet3d, 0.0007);
registerOrbitBinding(jupiter.planet3d, 0.0003);
registerOrbitBinding(saturn.planet3d, 0.0002);
registerOrbitBinding(uranus.planet3d, 0.0001);
registerOrbitBinding(neptune.planet3d, 0.00008);
registerOrbitBinding(pluto.planet3d, 0.00006);

updateEarthDefaultView(true);
setCameraZoomLimitsForObject(earth?.planet ?? null, 6.4);

renderer.shadowMap.enabled = true;
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 1024;
pointLight.shadow.mapSize.height = 1024;
pointLight.shadow.camera.near = 10;
pointLight.shadow.camera.far = 20;

[earth, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto].forEach(body => {
  if (body?.planet) {
    body.planet.castShadow = true;
    body.planet.receiveShadow = true;
  }
  if (body?.Atmosphere) {
    body.Atmosphere.castShadow = true;
    body.Atmosphere.receiveShadow = true;
  }
  if (body?.Ring) {
    body.Ring.receiveShadow = true;
  }
  if (body?.moons) {
    body.moons.forEach(moon => {
      if (moon.mesh) {
        moon.mesh.castShadow = true;
        moon.mesh.receiveShadow = true;
      }
    });
  }
});

function handlePlanetSelection(clickedObject) {
  if (clickedObject.material === mercury.planet.material) {
    offset = 10;
    return mercury;
  }
  if (
    clickedObject.material === venus.planet.material ||
    clickedObject.material === venus.Atmosphere?.material
  ) {
    offset = 25;
    return venus;
  }
  if (
    clickedObject.material === earth.planet.material ||
    clickedObject.material === earth.Atmosphere?.material
  ) {
    offset = 25;
    return earth;
  }
  if (clickedObject.material === mars.planet.material) {
    offset = 15;
    return mars;
  }
  if (clickedObject.material === jupiter.planet.material) {
    offset = 50;
    return jupiter;
  }
  if (clickedObject.material === saturn.planet.material) {
    offset = 50;
    return saturn;
  }
  if (clickedObject.material === uranus.planet.material) {
    offset = 25;
    return uranus;
  }
  if (clickedObject.material === neptune.planet.material) {
    offset = 20;
    return neptune;
  }
  if (clickedObject.material === pluto.planet.material) {
    offset = 10;
    return pluto;
  }
  return null;
}

function focusCameraOnPlanet(planet) {
  if (!planet?.planet) {
    return;
  }

  const planetRadius = planet.planet.geometry?.parameters?.radius ?? 8;
  setCameraZoomLimitsForObject(planet.planet, planetRadius);

  planet.planet.getWorldPosition(planetFocusPosition);
  controls.target.copy(planetFocusPosition);

  targetCameraPosition.copy(planetFocusPosition);
  targetCameraPosition.z += offset;
  targetCameraPosition.y += offset / 2;
  isManualOrbiting = false;
  isMovingTowardsPlanet = true;
}

function setHoveredAsteroidEntry(entry) {
  hoveredAsteroidEntry = entry;
  const hoveredId = hoveredAsteroidEntry ? hoveredAsteroidEntry.data.id : null;
  asteroidPanel.setHovered(hoveredId);
}

function removeTrajectoryLine() {
  if (asteroidTrajectoryLine) {
    disposeObject(asteroidTrajectoryLine);
    asteroidTrajectoryLine = null;
  }
}

function removeImpactOverlay() {
  if (!asteroidImpactOverlay) {
    return;
  }
  disposeObject(asteroidImpactOverlay);
  asteroidImpactOverlay = null;
}

function createTrajectoryForEntry(entry) {
  removeTrajectoryLine();
  if (!entry.mesh) {
    return;
  }

  if (earth?.planet) {
    earth.planet.getWorldPosition(earthWorldPosition);
  } else {
    earthWorldPosition.set(0, 0, 0);
  }
  const points = getTrajectoryPoints(entry, earthWorldPosition, 20);
  asteroidTrajectoryLine = createTrajectoryLine(points);
  scene.add(asteroidTrajectoryLine);
}

function updateTrajectoryLine(entry) {
  if (!asteroidTrajectoryLine) {
    return;
  }
  if (earth?.planet) {
    earth.planet.getWorldPosition(earthWorldPosition);
  } else {
    earthWorldPosition.set(0, 0, 0);
  }
  const points = getTrajectoryPoints(entry, earthWorldPosition, 20);
  asteroidTrajectoryLine.geometry.setFromPoints(points);
}

function createImpactOverlay(entry) {
  removeImpactOverlay();
  const earthRadius = earth?.planet?.geometry?.parameters?.radius ?? 6.4;
  asteroidImpactOverlay = createImpactOverlayMesh(entry, earthRadius, {
    colors: asteroidYieldColors,
    radiusScale: asteroidYieldRadiusScale
  });

  if (earth?.planet) {
    earth.planet.add(asteroidImpactOverlay);
  } else {
    scene.add(asteroidImpactOverlay);
  }
}

function clearAsteroidSelection({ keepCamera = false, keepViewTarget = false } = {}) {
  if (!selectedAsteroidEntry) {
    return;
  }

  asteroidPanel.clearSelection();
  removeTrajectoryLine();
  removeImpactOverlay();

  const previousEntry = selectedAsteroidEntry;
  previousEntry.cameraOffset = null;

  selectedAsteroidEntry = null;
  isMovingTowardsAsteroid = false;

  if (!keepViewTarget) {
    setActiveViewTarget('earth');
  }

  if (!keepCamera) {
    const earthTarget = typeof earth !== 'undefined' ? earth.planet : null;
    setCameraZoomLimitsForObject(earthTarget, 6.4);
    updateEarthDefaultView();
    controls.target.copy(earthDefaultTargetPosition);
    isManualOrbiting = false;
    isZoomingOut = true;
  }
}

function focusCameraOnAsteroid(entry) {
  closeInfoNoZoomOut();
  selectedPlanet = null;
  isMovingTowardsPlanet = false;
  isZoomingOut = false;

  if (!entry.mesh) {
    return;
  }

  setCameraZoomLimitsForObject(entry.mesh, 2.5);

  entry.cameraOffset = computeAsteroidCameraOffset(entry);

  entry.mesh.getWorldPosition(asteroidWorkVector);
  asteroidCameraTarget.copy(asteroidWorkVector).add(entry.cameraOffset);
  controls.target.copy(asteroidWorkVector);
  isManualOrbiting = false;
  isMovingTowardsAsteroid = true;
}

async function handleAsteroidSelection(id) {
  const entry = asteroidEntries.find(item => item.data.id === id);
  if (!entry) {
    return;
  }

  const meshManager = await getAsteroidMeshManager();

  if (selectedAsteroidEntry && selectedAsteroidEntry.data.id === id) {
    clearAsteroidSelection();
    return;
  }

  if (selectedAsteroidEntry) {
    clearAsteroidSelection({ keepCamera: true, keepViewTarget: true });
  }

  meshManager.ensureMesh(entry, getCurrentSimulationTiming());

  selectedAsteroidEntry = entry;
  setActiveViewTarget(null);
  asteroidPanel.setSelected(entry.data.id);
  focusCameraOnAsteroid(entry);
  createTrajectoryForEntry(entry);
  createImpactOverlay(entry);
}

function updateHoveredAsteroid() {
  const meshes = getAsteroidMeshes(asteroidEntries);
  if (meshes.length === 0) {
    setHoveredAsteroidEntry(null);
    return;
  }

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(meshes, true);
  if (intersects.length === 0) {
    setHoveredAsteroidEntry(null);
    return;
  }

  const entry = findAsteroidEntryFromObject(asteroidEntries, intersects[0].object);
  setHoveredAsteroidEntry(entry || null);
}

function onMouseMove(event) {
  const isCanvasInteraction = event.target === renderer.domElement;
  if (!isCanvasInteraction) {
    setHoveredAsteroidEntry(null);
    return;
  }

  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  updateHoveredAsteroid();
}

function updateAsteroids(timing) {
  asteroidEntries.forEach(entry => updateAsteroidTransform(entry, timing));
  if (selectedAsteroidEntry && selectedAsteroidEntry.mesh) {
    updateTrajectoryLine(selectedAsteroidEntry);
  }
}

function animateMoons(timing) {
  const orbitFrames = timing.orbitFrames ?? 0;
  const spinFrames = timing.spinFrames ?? 0;

  if (earth.moons) {
    earth.moons.forEach((moon, index) => {
      if (!moon.mesh) {
        return;
      }

      const tiltAngle = ((moon.tilt ?? 5) * Math.PI) / 180;
      const phase = moon.initialPhase ?? index * (Math.PI / 2);
      const angle = phase + (moon.orbitSpeed ?? 0) * orbitFrames;

      const moonX = earth.planet.position.x + (moon.orbitRadius ?? 10) * Math.cos(angle);
      const moonY = (moon.orbitRadius ?? 10) * Math.sin(angle) * Math.sin(tiltAngle);
      const moonZ = earth.planet.position.z + (moon.orbitRadius ?? 10) * Math.sin(angle) * Math.cos(tiltAngle);

      moon.mesh.position.set(moonX, moonY, moonZ);

      if (moon.baseRotation === undefined) {
        moon.baseRotation = moon.mesh.rotation.y;
      }
      const spinRate = moon.spinRate ?? 0.01;
      moon.mesh.rotation.y = moon.baseRotation + spinRate * spinFrames;
    });
  }

  marsMoons.forEach((moon, index) => {
    if (!moon.mesh) {
      return;
    }

    const phase = moon.initialPhase ?? index * (Math.PI / 2);
    const angle = phase + (moon.orbitSpeed ?? 0) * orbitFrames;
    const radius = moon.orbitRadius ?? 0;

    const moonX = mars.planet.position.x + radius * Math.cos(angle);
    const moonY = radius * Math.sin(angle);
    const moonZ = mars.planet.position.z + radius * Math.sin(angle);

    moon.mesh.position.set(moonX, moonY, moonZ);

    if (moon.baseRotation === undefined) {
      moon.baseRotation = moon.mesh.rotation.y;
    }
    const spinRate = moon.spinRate ?? 0.001;
    moon.mesh.rotation.y = moon.baseRotation + spinRate * spinFrames;
  });

  if (jupiter.moons) {
    jupiter.moons.forEach((moon, index) => {
      if (!moon.mesh) {
        return;
      }

      const phase = moon.initialPhase ?? index * (Math.PI / 2);
      const angle = phase + (moon.orbitSpeed ?? 0) * orbitFrames;
      const radius = moon.orbitRadius ?? jupiter.planet.geometry.parameters.radius * 1.5;

      const moonX = jupiter.planet.position.x + radius * Math.cos(angle);
      const moonY = radius * Math.sin(angle);
      const moonZ = jupiter.planet.position.z + radius * Math.sin(angle);

      moon.mesh.position.set(moonX, moonY, moonZ);

      if (moon.baseRotation === undefined) {
        moon.baseRotation = moon.mesh.rotation.y;
      }
      const spinRate = moon.spinRate ?? 0.01;
      moon.mesh.rotation.y = moon.baseRotation + spinRate * spinFrames;
    });
  }
}

function animate(now = performance.now()) {
  const deltaMs = now - lastFrameTime;
  lastFrameTime = now;

  simulationClock.advance(deltaMs);

  const timing = getCurrentSimulationTiming();

  spinBindings.forEach(binding => {
    binding.object.rotation.y = binding.base + binding.rate * timing.spinFrames;
  });

  orbitBindings.forEach(binding => {
    binding.object.rotation.y = binding.base + binding.rate * timing.orbitFrames;
  });

  animateMoons(timing);
  updateEarthDefaultView();
  updateAsteroids(timing);

  if (selectedAsteroidEntry && selectedAsteroidEntry.mesh) {
    selectedAsteroidEntry.mesh.getWorldPosition(asteroidFocusPoint);

    let asteroidCameraOffset = selectedAsteroidEntry.cameraOffset;
    if (!asteroidCameraOffset) {
      asteroidCameraOffset = computeAsteroidCameraOffset(selectedAsteroidEntry);
      selectedAsteroidEntry.cameraOffset = asteroidCameraOffset;
    }

    const shouldUpdateAsteroidTarget = !isUserOrbitControlsActive || isMovingTowardsAsteroid;
    let asteroidTargetUpdated = false;

    if (shouldUpdateAsteroidTarget) {
      previousControlsTarget.copy(controls.target);
      controls.target.lerp(asteroidFocusPoint, 0.15);
      asteroidTargetUpdated = true;
    }

    if (isMovingTowardsAsteroid) {
      asteroidCameraTarget.copy(asteroidFocusPoint).add(asteroidCameraOffset);
    } else if (isManualOrbiting && asteroidTargetUpdated) {
      controlsTargetDelta.subVectors(controls.target, previousControlsTarget);
      camera.position.add(controlsTargetDelta);
    } else if (!isManualOrbiting) {
      asteroidCameraTarget.copy(asteroidFocusPoint).add(asteroidCameraOffset);
      camera.position.lerp(asteroidCameraTarget, 0.02);
    }
  } else if (!selectedPlanet && !isMovingTowardsPlanet && !isMovingTowardsAsteroid && !isZoomingOut) {
    if (!isUserOrbitControlsActive) {
      previousControlsTarget.copy(controls.target);
      controls.target.lerp(earthDefaultTargetPosition, 0.1);

      if (isManualOrbiting) {
        controlsTargetDelta.subVectors(controls.target, previousControlsTarget);
        camera.position.add(controlsTargetDelta);
      } else {
        camera.position.lerp(earthDefaultCameraPosition, 0.02);
      }
    }
  }

  if (selectedAsteroidEntry && selectedAsteroidEntry.mesh) {
    outlinePass.selectedObjects = [selectedAsteroidEntry.mesh];
  } else {
    outlinePass.selectedObjects = [];
  }

  if (isMovingTowardsPlanet) {
    camera.position.lerp(targetCameraPosition, 0.03);
    if (camera.position.distanceTo(targetCameraPosition) < 1) {
      isMovingTowardsPlanet = false;
      if (selectedPlanet) {
        showPlanetInfo(selectedPlanet.name);
      }
    }
  } else if (isMovingTowardsAsteroid) {
    camera.position.lerp(asteroidCameraTarget, 0.03);
    if (camera.position.distanceTo(asteroidCameraTarget) < 1) {
      isMovingTowardsAsteroid = false;
    }
  } else if (isZoomingOut) {
    controls.target.lerp(earthDefaultTargetPosition, 0.1);
    camera.position.lerp(zoomOutTargetPosition, 0.05);
    if (camera.position.distanceTo(zoomOutTargetPosition) < 1) {
      isZoomingOut = false;
    }
  }

  controls.update();
  requestAnimationFrame(animate);
  composer.render();
}

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(animate);
