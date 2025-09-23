import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function getYieldBand(tntMt) {
  if (tntMt <= 1) {
    return 'low';
  }

  if (tntMt <= 10) {
    return 'medium';
  }

  return 'high';
}

function updateAsteroidTransform(entry, settings, advance = true) {
  if (!entry.mesh) {
    return;
  }

  if (advance) {
    entry.orbitAngle += entry.orbitAngularVelocity * settings.accelerationOrbit;
  }

  const { semiMajorAxis: a, eccentricity, inclination } = entry.data.orbit;
  const b = a * Math.sqrt(1 - Math.pow(eccentricity, 2));
  const angle = entry.orbitAngle;

  const x = a * Math.cos(angle);
  const z = b * Math.sin(angle);
  const inclineRad = THREE.MathUtils.degToRad(inclination);
  const y = Math.sin(angle) * Math.sin(inclineRad) * a * 0.2;

  entry.mesh.position.set(x, y, z);

  const spinRate = entry.data.spinRate ?? 0.001;
  entry.mesh.rotation.y += spinRate * settings.acceleration;
}

function getTrajectoryPoints(entry, earthWorldPosition, elevation = 20) {
  if (!entry.mesh) {
    return [];
  }

  const asteroidPosition = new THREE.Vector3();
  const midpoint = new THREE.Vector3();

  entry.mesh.getWorldPosition(asteroidPosition);
  midpoint.copy(asteroidPosition).lerp(earthWorldPosition, 0.5);
  midpoint.y += elevation;

  const curve = new THREE.CatmullRomCurve3([
    asteroidPosition.clone(),
    midpoint.clone(),
    earthWorldPosition.clone()
  ]);

  return curve.getPoints(32);
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

function initializeAsteroidMeshes({ entries, scene, settings, gltfPath = '/asteroids/asteroidPack.glb' }) {
  const loader = new GLTFLoader();

  return new Promise(resolve => {
    loader.load(
      gltfPath,
      gltf => {
        const templates = [];
        gltf.scene.traverse(child => {
          if (child.isMesh) {
            templates.push(child);
          }
        });

        if (templates.length === 0) {
          createFallbackAsteroids(entries, scene, settings);
          resolve(false);
          return;
        }

        entries.forEach((entry, index) => {
          const source = templates[index % templates.length].clone(true);
          if (source.geometry) {
            source.geometry = source.geometry.clone();
          }
          if (Array.isArray(source.material)) {
            source.material = source.material.map(material => material.clone());
          } else if (source.material) {
            source.material = source.material.clone();
          }

          source.scale.setScalar(entry.data.visualScale);
          source.castShadow = true;
          source.receiveShadow = true;
          source.name = entry.data.name;

          source.traverse(node => {
            node.userData = node.userData || {};
            node.userData.asteroidId = entry.data.id;
            node.userData.metadata = entry.data;
          });

          scene.add(source);
          entry.mesh = source;
          updateAsteroidTransform(entry, settings, false);
        });

        resolve(true);
      },
      undefined,
      () => {
        createFallbackAsteroids(entries, scene, settings);
        resolve(false);
      }
    );
  });
}

function createFallbackAsteroids(entries, scene, settings) {
  const baseGeometry = new THREE.IcosahedronGeometry(2, 1);

  entries.forEach(entry => {
    const material = new THREE.MeshStandardMaterial({ color: 0xadb5bd, flatShading: true });
    const mesh = new THREE.Mesh(baseGeometry.clone(), material);
    mesh.scale.setScalar(entry.data.visualScale * 8);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = entry.data.name;
    mesh.userData = mesh.userData || {};
    mesh.userData.asteroidId = entry.data.id;
    mesh.userData.metadata = entry.data;

    scene.add(mesh);
    entry.mesh = mesh;
    updateAsteroidTransform(entry, settings, false);
  });
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
  initializeAsteroidMeshes,
  createFallbackAsteroids,
  disposeObject
};
