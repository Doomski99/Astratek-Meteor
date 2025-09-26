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
import { createPlanetFactory, planetData, createAsteroidEntries, asteroidCatalog } from './data/bodies.js';
import { initAsteroidPanel } from './ui/asteroidPanel.js';
import {
  initializeAsteroidMeshes,
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

gui.add(settings, 'accelerationOrbit', 0, 10);
gui.add(settings, 'acceleration', 0, 10);
gui.add(settings, 'sunIntensity', 1, 10).onChange(value => {
  sunMat.emissiveIntensity = value;
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const targetBoundingBox = new THREE.Box3();
const targetBoundingSphere = new THREE.Sphere();

let isManualOrbiting = false;

controls.addEventListener('start', () => {
  isManualOrbiting = true;
});

controls.addEventListener('end', () => {
  // keep the manual flag until the UI requests a recenter, so orbit input persists
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

function setCameraZoomLimitsForObject(object, fallbackRadius = 8) {
  let radius = fallbackRadius;

  if (object) {
    targetBoundingBox.setFromObject(object);
    if (!targetBoundingBox.isEmpty()) {
      targetBoundingBox.getBoundingSphere(targetBoundingSphere);
      radius = Math.max(targetBoundingSphere.radius, fallbackRadius);
    }
  }

  controls.minDistance = Math.max(radius * 1.6, 2.5);
  controls.maxDistance = Math.max(radius * 15, 350);
}

if (viewTargetListElement) {
  viewTargetListElement.addEventListener('click', event => {
    const item = event.target.closest('[data-target-id]');
    if (!item) {
      return;
    }

    const { targetId } = item.dataset;
    if (targetId === 'earth') {
      clearAsteroidSelection();
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

const asteroidDefaultCameraOffset = new THREE.Vector3(25, 15, 25);
const asteroidFocusPoint = new THREE.Vector3();
const asteroidCameraTarget = new THREE.Vector3();
const asteroidWorkVector = new THREE.Vector3();
const earthWorldPosition = new THREE.Vector3();

const asteroidEntries = createAsteroidEntries(asteroidCatalog);
const asteroidPanel = initAsteroidPanel(asteroidEntries, {
  onSelect: id => handleAsteroidSelection(id)
});

let selectedAsteroidEntry = null;
let hoveredAsteroidEntry = null;
let asteroidTrajectoryLine = null;
let asteroidImpactOverlay = null;
let isMovingTowardsAsteroid = false;

initializeAsteroidMeshes({ entries: asteroidEntries, scene, settings });

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
    orbitSpeed: 0.001 * settings.accelerationOrbit,
    orbitRadius: 10
  }
];

const marsMoons = [
  {
    modelPath: '/images/mars/phobos.glb',
    scale: 0.1,
    orbitRadius: 5,
    orbitSpeed: 0.002 * settings.accelerationOrbit,
    position: 100,
    mesh: null
  },
  {
    modelPath: '/images/mars/deimos.glb',
    scale: 0.1,
    orbitRadius: 9,
    orbitSpeed: 0.0005 * settings.accelerationOrbit,
    position: 120,
    mesh: null
  }
];

const jupiterMoons = [
  {
    size: 1.6,
    texture: ioTexture,
    orbitRadius: 20,
    orbitSpeed: 0.0005 * settings.accelerationOrbit
  },
  {
    size: 1.4,
    texture: europaTexture,
    orbitRadius: 24,
    orbitSpeed: 0.00025 * settings.accelerationOrbit
  },
  {
    size: 2,
    texture: ganymedeTexture,
    orbitRadius: 28,
    orbitSpeed: 0.000125 * settings.accelerationOrbit
  },
  {
    size: 1.7,
    texture: callistoTexture,
    orbitRadius: 32,
    orbitSpeed: 0.00006 * settings.accelerationOrbit
  }
];

const mercury = createPlanet('Mercury', 2.4, 40, 0, mercuryTexture, mercuryBump);
const venus = createPlanet('Venus', 6.1, 65, 3, venusTexture, venusBump, null, venusAtmosphere);
const earth = createPlanet('Earth', 6.4, 90, 23, earthMaterial, null, null, earthAtmosphere, earthMoon);
const mars = createPlanet('Mars', 3.4, 115, 25, marsTexture, marsBump);

marsMoons.forEach(moon => {
  loadObject(moon.modelPath, moon.position, moon.scale, loadedModel => {
    moon.mesh = loadedModel;
    mars.planetSystem.add(moon.mesh);
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

function clearAsteroidSelection() {
  if (selectedAsteroidEntry) {
    asteroidPanel.clearSelection();
  }
  removeTrajectoryLine();
  removeImpactOverlay();
  selectedAsteroidEntry = null;
  isMovingTowardsAsteroid = false;
  setActiveViewTarget('earth');
  const earthTarget = typeof earth !== 'undefined' ? earth.planet : null;
  setCameraZoomLimitsForObject(earthTarget, 6.4);
  updateEarthDefaultView();
  controls.target.copy(earthDefaultTargetPosition);
  isManualOrbiting = false;
  isZoomingOut = true;
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

  entry.mesh.getWorldPosition(asteroidWorkVector);
  asteroidCameraTarget.copy(asteroidWorkVector).add(asteroidDefaultCameraOffset);
  controls.target.copy(asteroidWorkVector);
  isManualOrbiting = false;
  isMovingTowardsAsteroid = true;
}

function handleAsteroidSelection(id) {
  const entry = asteroidEntries.find(item => item.data.id === id);
  if (!entry || !entry.mesh) {
    return;
  }

  if (selectedAsteroidEntry && selectedAsteroidEntry.data.id === id) {
    clearAsteroidSelection();
    return;
  }

  clearAsteroidSelection();

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

function updateAsteroids() {
  asteroidEntries.forEach(entry => updateAsteroidTransform(entry, settings));
  if (selectedAsteroidEntry && selectedAsteroidEntry.mesh) {
    updateTrajectoryLine(selectedAsteroidEntry);
  }
}

function animateMoons() {
  if (earth.moons) {
    earth.moons.forEach(moon => {
      const time = performance.now();
      const tiltAngle = (5 * Math.PI) / 180;

      const moonX = earth.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
      const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed) * Math.sin(tiltAngle);
      const moonZ = earth.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed) * Math.cos(tiltAngle);

      moon.mesh.position.set(moonX, moonY, moonZ);
      moon.mesh.rotateY(0.01);
    });
  }

  marsMoons.forEach(moon => {
    if (moon.mesh) {
      const time = performance.now();
      const moonX = mars.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
      const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
      const moonZ = mars.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
      moon.mesh.position.set(moonX, moonY, moonZ);
      moon.mesh.rotateY(0.001);
    }
  });

  if (jupiter.moons) {
    jupiter.moons.forEach(moon => {
      const time = performance.now();
      const moonX = jupiter.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
      const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
      const moonZ = jupiter.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
      moon.mesh.position.set(moonX, moonY, moonZ);
      moon.mesh.rotateY(0.01);
    });
  }
}

function animate() {
  sun.rotateY(0.001 * settings.acceleration);
  mercury.planet.rotateY(0.001 * settings.acceleration);
  mercury.planet3d.rotateY(0.004 * settings.accelerationOrbit);
  venus.planet.rotateY(0.0005 * settings.acceleration);
  venus.Atmosphere?.rotateY(0.0005 * settings.acceleration);
  venus.planet3d.rotateY(0.0006 * settings.accelerationOrbit);
  earth.planet.rotateY(0.005 * settings.acceleration);
  earth.Atmosphere?.rotateY(0.001 * settings.acceleration);
  earth.planet3d.rotateY(0.001 * settings.accelerationOrbit);
  mars.planet.rotateY(0.01 * settings.acceleration);
  mars.planet3d.rotateY(0.0007 * settings.accelerationOrbit);
  jupiter.planet.rotateY(0.005 * settings.acceleration);
  jupiter.planet3d.rotateY(0.0003 * settings.accelerationOrbit);
  saturn.planet.rotateY(0.01 * settings.acceleration);
  saturn.planet3d.rotateY(0.0002 * settings.accelerationOrbit);
  uranus.planet.rotateY(0.005 * settings.acceleration);
  uranus.planet3d.rotateY(0.0001 * settings.accelerationOrbit);
  neptune.planet.rotateY(0.005 * settings.acceleration);
  neptune.planet3d.rotateY(0.00008 * settings.accelerationOrbit);
  pluto.planet.rotateY(0.001 * settings.acceleration);
  pluto.planet3d.rotateY(0.00006 * settings.accelerationOrbit);

  animateMoons();
  updateEarthDefaultView();
  updateAsteroids();

  if (selectedAsteroidEntry && selectedAsteroidEntry.mesh) {
    selectedAsteroidEntry.mesh.getWorldPosition(asteroidFocusPoint);
    controls.target.lerp(asteroidFocusPoint, 0.15);

    if (!isManualOrbiting || isMovingTowardsAsteroid) {
      asteroidCameraTarget.copy(asteroidFocusPoint).add(asteroidDefaultCameraOffset);
      camera.position.lerp(asteroidCameraTarget, 0.02);
    }
  } else if (!selectedPlanet && !isMovingTowardsPlanet && !isMovingTowardsAsteroid && !isZoomingOut) {
    controls.target.lerp(earthDefaultTargetPosition, 0.1);
    if (!isManualOrbiting) {
      camera.position.lerp(earthDefaultCameraPosition, 0.02);
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

animate();
