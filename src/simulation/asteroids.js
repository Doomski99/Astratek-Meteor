import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { propagateKepler } from './kepler.js';
import { orbitPositionToScene, sampleKeplerOrbit, estimateOrbitalVelocity } from './orbitUtils.js';
import { getEarthVelocitySnapshot } from './referenceFrames.js';

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

function ensureVelocityContainers(entry) {
  if (!entry.velocityOrbital) {
    entry.velocityOrbital = new THREE.Vector3();
  }

  if (!entry.velocityKilometersPerSecond) {
    entry.velocityKilometersPerSecond = new THREE.Vector3();
  }

  if (!entry.velocityRelativeKilometersPerSecond) {
    entry.velocityRelativeKilometersPerSecond = new THREE.Vector3();
  }

  if (!entry.data.velocity) {
    entry.data.velocity = {
      orbital: { x: 0, y: 0, z: 0 },
      kilometersPerSecond: { x: 0, y: 0, z: 0 },
      speedKilometersPerSecond: 0,
      relative: {
        kilometersPerSecond: { x: 0, y: 0, z: 0 },
        speedKilometersPerSecond: 0
      }
    };
  } else if (!entry.data.velocity.relative) {
    entry.data.velocity.relative = {
      kilometersPerSecond: { x: 0, y: 0, z: 0 },
      speedKilometersPerSecond: 0
    };
  }

  return entry.data.velocity;
}

function updateAsteroidTransform(entry, timing = { orbitFrames: 0, spinFrames: 0 }) {
  const orbitFrames = timing.orbitFrames ?? 0;
  const keplerElements = entry.keplerElements;
  const velocityData = ensureVelocityContainers(entry);

  if (!keplerElements) {
    if (entry.mesh) {
      entry.mesh.position.set(0, 0, 0);
    }
    entry.velocityOrbital.set(0, 0, 0);
    entry.velocityKilometersPerSecond.set(0, 0, 0);
    entry.velocityRelativeKilometersPerSecond.set(0, 0, 0);
    velocityData.orbital.x = 0;
    velocityData.orbital.y = 0;
    velocityData.orbital.z = 0;
    velocityData.kilometersPerSecond.x = 0;
    velocityData.kilometersPerSecond.y = 0;
    velocityData.kilometersPerSecond.z = 0;
    velocityData.speedKilometersPerSecond = 0;
    velocityData.relative.kilometersPerSecond.x = 0;
    velocityData.relative.kilometersPerSecond.y = 0;
    velocityData.relative.kilometersPerSecond.z = 0;
    velocityData.relative.speedKilometersPerSecond = 0;
  } else {
    const { position } = propagateKepler(keplerElements, orbitFrames);
    if (entry.mesh) {
      orbitPositionToScene(position, entry.mesh.position);
    }
    const velocity = estimateOrbitalVelocity(keplerElements, orbitFrames, {
      orbitalTarget: entry.velocityOrbital,
      kilometersPerSecondTarget: entry.velocityKilometersPerSecond
    });

    velocityData.orbital.x = velocity.orbital.x;
    velocityData.orbital.y = velocity.orbital.y;
    velocityData.orbital.z = velocity.orbital.z;

    if (velocity.kilometersPerSecond) {
      velocityData.kilometersPerSecond.x = velocity.kilometersPerSecond.x;
      velocityData.kilometersPerSecond.y = velocity.kilometersPerSecond.y;
      velocityData.kilometersPerSecond.z = velocity.kilometersPerSecond.z;
      velocityData.speedKilometersPerSecond = velocity.kilometersPerSecond.length();
    } else {
      velocityData.kilometersPerSecond.x = 0;
      velocityData.kilometersPerSecond.y = 0;
      velocityData.kilometersPerSecond.z = 0;
      velocityData.speedKilometersPerSecond = 0;
    }

    const earthVelocity = getEarthVelocitySnapshot();
    const earthKilometersPerSecond = earthVelocity?.kilometersPerSecond;

    if (velocity.kilometersPerSecond && earthKilometersPerSecond) {
      entry.velocityRelativeKilometersPerSecond.set(
        velocity.kilometersPerSecond.x - (earthKilometersPerSecond.x ?? 0),
        velocity.kilometersPerSecond.y - (earthKilometersPerSecond.y ?? 0),
        velocity.kilometersPerSecond.z - (earthKilometersPerSecond.z ?? 0)
      );
      velocityData.relative.kilometersPerSecond.x = entry.velocityRelativeKilometersPerSecond.x;
      velocityData.relative.kilometersPerSecond.y = entry.velocityRelativeKilometersPerSecond.y;
      velocityData.relative.kilometersPerSecond.z = entry.velocityRelativeKilometersPerSecond.z;
      velocityData.relative.speedKilometersPerSecond = entry.velocityRelativeKilometersPerSecond.length();
    } else {
      entry.velocityRelativeKilometersPerSecond.set(0, 0, 0);
      velocityData.relative.kilometersPerSecond.x = 0;
      velocityData.relative.kilometersPerSecond.y = 0;
      velocityData.relative.kilometersPerSecond.z = 0;
      velocityData.relative.speedKilometersPerSecond = 0;
    }
  }

  const spinRate = entry.data.spinRate ?? 0.001;
  if (entry.mesh) {
    const baseRotation = entry.baseRotationY ?? entry.mesh.rotation.y;
    entry.mesh.rotation.y = baseRotation + spinRate * (timing.spinFrames ?? 0);
  }
}

function getTrajectoryPoints(entry, segments = DEFAULT_ORBIT_SEGMENTS) {
  const keplerElements = entry?.keplerElements;
  if (!keplerElements) {
    return [];
  }

  return sampleKeplerOrbit(keplerElements, segments);
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

function createImpactOverlayMesh(
  entry,
  earthRadius,
  { colors, angularRadii, elevation = 0.1, bands } = {}
) {
  const defaultUp = new THREE.Vector3(0, 1, 0);
  const impactNormal = entry?.earthOrbitIntersection?.impactNormal;
  const hasCustomBands = Array.isArray(bands) && bands.length > 0;
  let orientationQuaternion = null;

  if (impactNormal instanceof THREE.Vector3 && impactNormal.lengthSq() > 1e-8) {
    const normal = impactNormal.clone().normalize();
    orientationQuaternion = new THREE.Quaternion().setFromUnitVectors(defaultUp, normal);
  }

  if (hasCustomBands) {
    const overlayGroup = new THREE.Group();
    overlayGroup.frustumCulled = false;

    const sortedBands = [...bands].sort((a, b) => (a.radiusKm ?? 0) - (b.radiusKm ?? 0));

    const vertexShader = `
      varying vec3 vLocalNormal;

      void main() {
        vLocalNormal = normalize(normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vLocalNormal;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uAngularRadius;
      uniform float uFeather;

      void main() {
        vec3 normal = normalize(vLocalNormal);
        float cosAngle = clamp(dot(normal, vec3(0.0, 1.0, 0.0)), -1.0, 1.0);
        float angle = acos(cosAngle);
        float outerEdge = max(uAngularRadius, 0.0);
        if (outerEdge <= 0.0001) {
          discard;
        }
        float innerEdge = max(outerEdge - uFeather, 0.0);
        float mask = 1.0 - smoothstep(innerEdge, outerEdge, angle);
        float alpha = mask * uOpacity;
        if (alpha <= 0.001) {
          discard;
        }
        gl_FragColor = vec4(uColor, alpha);
      }
    `;

    sortedBands.forEach((band, index) => {
      const angularRadiusRad = Math.min(Math.max(band.angularRadiusRad ?? 0, 0), Math.PI);
      if (angularRadiusRad <= 0) {
        return;
      }

      const overlayRadius = earthRadius + Math.max(elevation + index * 0.12, 0);
      const renderOrderBase = 100 + (sortedBands.length - index - 1) * 2;
      const geometry = new THREE.SphereGeometry(overlayRadius, 128, 64);
      const color = new THREE.Color(band.fillColor ?? band.color ?? 0xffffff);
      const opacity = Math.min(Math.max(band.opacity ?? 0.35, 0), 1);
      const feather = Math.max(
        Math.min(band.featherRadians ?? THREE.MathUtils.degToRad(band.featherDegrees ?? 5), Math.PI),
        0
      );

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: color },
          uOpacity: { value: opacity },
          uAngularRadius: { value: angularRadiusRad },
          uFeather: { value: Math.min(feather, angularRadiusRad) }
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader,
        fragmentShader
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 0, 0);
      mesh.frustumCulled = false;
      mesh.renderOrder = renderOrderBase;
      mesh.userData.impactorEffectBand = band.id;

      overlayGroup.add(mesh);

      const outlineRadius = overlayRadius * Math.sin(angularRadiusRad);
      const outlineHeight = overlayRadius * Math.cos(angularRadiusRad) + 0.002;
      const outlineThickness = Math.max(outlineRadius * 0.045, 0.05);
      if (outlineRadius > 0.001) {
        const outlineGeometry = new THREE.RingGeometry(
          Math.max(outlineRadius - outlineThickness, 0),
          outlineRadius,
          196
        );
        const outlineMaterial = new THREE.MeshBasicMaterial({
          color: band.outlineColor ?? band.fillColor ?? 0xffffff,
          transparent: true,
          opacity: Math.min((band.outlineOpacity ?? (band.opacity ?? 0.35) + 0.25), 1),
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending
        });
        const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outlineMesh.position.set(0, outlineHeight, 0);
        outlineMesh.rotation.x = Math.PI / 2;
        outlineMesh.frustumCulled = false;
        outlineMesh.renderOrder = renderOrderBase + 1;
        outlineMesh.userData.impactorEffectBand = `${band.id}-outline`;
        overlayGroup.add(outlineMesh);
      }
    });

    if (overlayGroup.children.length === 0) {
      return null;
    }

    if (orientationQuaternion) {
      overlayGroup.setRotationFromQuaternion(orientationQuaternion);
    } else {
      overlayGroup.rotation.x = -Math.PI / 2;
    }

    return overlayGroup;
  }

  const yieldBand = getYieldBand(entry.data.tntYieldMt);
  const color = colors?.[yieldBand] ?? 0xffffff;
  const angularRadiusDeg = angularRadii?.[yieldBand] ?? 0;
  const angularRadiusRad = THREE.MathUtils.degToRad(angularRadiusDeg);
  const clampedAngle = Math.min(Math.max(angularRadiusRad, 0), Math.PI);
  const overlayRadius = earthRadius + Math.max(elevation, 0);

  const geometry = new THREE.SphereGeometry(overlayRadius, 64, 32, 0, Math.PI * 2, 0, clampedAngle);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const overlay = new THREE.Mesh(geometry, material);
  overlay.position.set(0, 0, 0);
  overlay.frustumCulled = false;
  overlay.renderOrder = 2;

  if (orientationQuaternion) {
    overlay.quaternion.copy(orientationQuaternion);
  } else {
    overlay.rotation.x = -Math.PI / 2;
  }

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

  const nodes = [];
  if (typeof object.traverse === 'function') {
    object.traverse(child => {
      nodes.push(child);
    });
  } else {
    nodes.push(object);
  }

  nodes.forEach(node => {
    if (node.geometry) {
      node.geometry.dispose();
    }

    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach(material => material.dispose());
      } else {
        node.material.dispose();
      }
    }
  });

  if (object.parent) {
    object.parent.remove(object);
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
