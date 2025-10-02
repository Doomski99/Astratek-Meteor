import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { propagateKepler } from './kepler.js';

const asteroidPackUrl = new URL('../asteroids/asteroidPack.glb', import.meta.url).href;

const ASTEROID_SCALE_MULTIPLIER = 15;
const DEFAULT_ORBIT_SEGMENTS = 256;

function getYieldBand(tntMt) {
  if (tntMt <= 1) {
    return 'low';
  }

  if (tntMt <= 10) {
    return 'medium';
  }

  return 'high';
}

function updateAsteroidTransform(entry, timing = { orbitFrames: 0, spinFrames: 0 }) {
  if (!entry.mesh) {
    return;
  }

  const orbitFrames = timing.orbitFrames ?? 0;
  const keplerElements = entry.keplerElements;

  if (!keplerElements) {
    entry.mesh.position.set(0, 0, 0);
  } else {
    const { position } = propagateKepler(keplerElements, orbitFrames);
    entry.mesh.position.set(position.x, position.y, position.z);
  }

  const spinRate = entry.data.spinRate ?? 0.001;
  const baseRotation = entry.baseRotationY ?? entry.mesh.rotation.y;
  entry.mesh.rotation.y = baseRotation + spinRate * (timing.spinFrames ?? 0);
}

function getTrajectoryPoints(entry, segments = DEFAULT_ORBIT_SEGMENTS) {
  const keplerElements = entry?.keplerElements;
  if (!keplerElements) {
    return [];
  }

  const clampedSegments = Math.max(16, Math.floor(segments));
  const meanAnomalyAtEpoch = keplerElements.meanAnomalyAtEpoch ?? 0;
  const epoch = keplerElements.epoch ?? 0;
  const meanMotion = keplerElements.meanMotion ?? 0;
  const hasMeanMotion = Number.isFinite(meanMotion) && Math.abs(meanMotion) > 1e-12;
  const points = [];
  const TWO_PI = Math.PI * 2;

  for (let index = 0; index <= clampedSegments; index += 1) {
    const progress = index / clampedSegments;
    const targetMeanAnomaly = meanAnomalyAtEpoch + TWO_PI * progress;

    let elementsForSample = keplerElements;
    let timeForSample = epoch;

    if (hasMeanMotion) {
      timeForSample = epoch + (targetMeanAnomaly - meanAnomalyAtEpoch) / meanMotion;
    } else {
      elementsForSample = { ...keplerElements, meanAnomalyAtEpoch: targetMeanAnomaly };
    }

    const { position } = propagateKepler(elementsForSample, timeForSample);
    points.push(new THREE.Vector3(position.x, position.y, position.z));
  }

  return points;
}

function createTrajectoryLine(points) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x9ecbff,
    transparent: true,
    opacity: 0.8
  });

  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  return line;
}

function createImpactOverlayMesh(entry, earthRadius, { colors, radiusScale }) {
  const yieldBand = getYieldBand(entry.data.tntYieldMt);
  const color = colors[yieldBand];
  const scaleFactor = radiusScale[yieldBand];

  const geometry = new THREE.CircleGeometry(earthRadius * scaleFactor, 48);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide
  });

  const overlay = new THREE.Mesh(geometry, material);
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.set(0, 0.1, 0);

  return overlay;
}

function getAsteroidMeshes(entries) {
  return entries.filter(entry => entry.mesh).map(entry => entry.mesh);
}

function findAsteroidEntryFromObject(entries, object) {
  let current = object;
  while (current && !current.userData?.asteroidId && current.parent) {
    current = current.parent;
  }

  const asteroidId = current?.userData?.asteroidId;
  if (!asteroidId) {
    return null;
  }

  return entries.find(entry => entry.data.id === asteroidId) ?? null;
}

async function createAsteroidMeshManager({
  scene,
  getCurrentTiming,
  gltfPath = asteroidPackUrl
}) {
  const loader = new GLTFLoader();

  const templateMeshes = await new Promise(resolve => {
    loader.load(
      gltfPath,
      gltf => {
        const meshes = [];
        gltf.scene.traverse(child => {
          if (child.isMesh) {
            meshes.push(child);
          }
        });

        resolve(meshes.length > 0 ? meshes : null);
      },
      undefined,
      () => {
        resolve(null);
      }
    );
  });

  const hasTemplates = Array.isArray(templateMeshes) && templateMeshes.length > 0;
  const fallbackGeometry = hasTemplates ? null : new THREE.IcosahedronGeometry(2, 1);

  function applyMetadata(mesh, entry) {
    mesh.scale.setScalar(entry.data.visualScale * ASTEROID_SCALE_MULTIPLIER);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = entry.data.name;
    mesh.userData = mesh.userData || {};
    mesh.userData.asteroidId = entry.data.id;
    mesh.userData.metadata = entry.data;

    mesh.traverse(node => {
      if (!node.isMesh) {
        return;
      }

      if (node.geometry) {
        node.geometry = node.geometry.clone();
      }

      if (Array.isArray(node.material)) {
        node.material = node.material.map(material => material.clone());
      } else if (node.material) {
        node.material = node.material.clone();
      }

      node.castShadow = true;
      node.receiveShadow = true;
      node.userData = node.userData || {};
      node.userData.asteroidId = entry.data.id;
      node.userData.metadata = entry.data;
    });
  }

  function createMeshFromTemplate(entry) {
    const templateIndex = entry.templateIndex ?? 0;
    const template = templateMeshes[templateIndex % templateMeshes.length];
    const mesh = template.clone(true);
    applyMetadata(mesh, entry);
    return mesh;
  }

  function createFallbackMesh(entry) {
    const geometry = fallbackGeometry.clone();
    const material = new THREE.MeshStandardMaterial({ color: 0xadb5bd, flatShading: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(entry.data.visualScale * ASTEROID_SCALE_MULTIPLIER);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = entry.data.name;
    mesh.userData = mesh.userData || {};
    mesh.userData.asteroidId = entry.data.id;
    mesh.userData.metadata = entry.data;
    return mesh;
  }

  function ensureMesh(entry, timingOverride) {
    if (entry.mesh) {
      if (!entry.mesh.parent) {
        scene.add(entry.mesh);
      }
      const timing =
        timingOverride ?? (typeof getCurrentTiming === 'function' ? getCurrentTiming() : undefined);
      if (timing) {
        updateAsteroidTransform(entry, timing);
      }
      return entry.mesh;
    }

    const mesh = hasTemplates ? createMeshFromTemplate(entry) : createFallbackMesh(entry);
    scene.add(mesh);
    entry.mesh = mesh;
    entry.baseRotationY = mesh.rotation.y;
    const timing =
      timingOverride ?? (typeof getCurrentTiming === 'function' ? getCurrentTiming() : undefined);
    if (timing) {
      updateAsteroidTransform(entry, timing);
    }
    return mesh;
  }

  function removeMesh(entry) {
    if (!entry?.mesh) {
      return;
    }

    disposeObject(entry.mesh);
    entry.mesh = null;
    entry.baseRotationY = undefined;
  }

  return {
    ensureMesh,
    removeMesh
  };
}

function disposeObject(object) {
  if (!object) {
    return;
  }

  if (object.parent) {
    object.parent.remove(object);
  }

  if (object.geometry) {
    object.geometry.dispose();
  }

  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach(material => material.dispose());
    } else {
      object.material.dispose();
    }
  }
}

export {
  getYieldBand,
  updateAsteroidTransform,
  getTrajectoryPoints,
  createTrajectoryLine,
  createImpactOverlayMesh,
  getAsteroidMeshes,
  findAsteroidEntryFromObject,
  createAsteroidMeshManager,
  disposeObject
};
