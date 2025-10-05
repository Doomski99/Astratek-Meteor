import * as THREE from 'three';
import { createKeplerElements, propagateKepler } from '../simulation/kepler.js';
import { orbitPositionToScene, sampleKeplerOrbit } from '../simulation/orbitUtils.js';
import { classifyAsteroid } from '../model/neoClassifier.js';
import { AU_TO_SCENE_UNITS, FRAMES_PER_SIMULATION_DAY } from '../simulation/scales.js';

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_VISUAL_SCALE = 0.02;
const DEFAULT_TNT_YIELD_MT = 0;
const PLANET_ORBIT_SEGMENTS = 256;

function parseCsv(text) {
  const source = typeof text === 'string' ? text : '';
  const input = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        const nextChar = input[i + 1];
        if (nextChar === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(current);
      current = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(current);
      if (row.some(field => field.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current !== '' || row.length > 0) {
    row.push(current);
    if (row.some(field => field.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function parseNumber(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function convertMeanMotion(degPerDay) {
  if (!Number.isFinite(degPerDay)) {
    return 0;
  }

  return (degPerDay * DEG_TO_RAD) / FRAMES_PER_SIMULATION_DAY;
}

function transformAsteroidRow(row, rowIndex) {
  if (!Array.isArray(row)) {
    return null;
  }

  const [
    idValue,
    nameValue,
    diameterValue,
    eccentricityValue,
    semiMajorAxisValue,
    inclinationValue,
    ascendingNodeValue,
    argumentValue,
    meanAnomalyValue,
    meanMotionValue,
    sigmaEValue,
    sigmaAValue,
    sigmaIValue,
    sigmaOmValue,
    sigmaWValue,
    sigmaMaValue,
    sigmaNValue,
    absoluteMagnitudeValue,
    absoluteMagnitudeSigmaValue,
    moidValue
  ] = row;

  const id = (idValue ?? '').toString().trim();
  if (!id) {
    console.warn(`Skipping asteroid row ${rowIndex}: missing id`);
    return null;
  }

  const name = (nameValue ?? '').toString().trim() || id;
  const semiMajorAxisAu = parseNumber(semiMajorAxisValue);
  const diameter = parseNumber(diameterValue);
  const eccentricity = parseNumber(eccentricityValue);
  const inclination = parseNumber(inclinationValue);
  const ascendingNode = parseNumber(ascendingNodeValue);
  const argumentOfPeriapsis = parseNumber(argumentValue);
  const meanAnomalyAtEpoch = parseNumber(meanAnomalyValue);
  const meanMotionDegPerDay = parseNumber(meanMotionValue);
  const sigmaEccentricity = parseNumber(sigmaEValue);
  const sigmaSemiMajorAxis = parseNumber(sigmaAValue);
  const sigmaInclination = parseNumber(sigmaIValue);
  const sigmaLongitudeAscendingNode = parseNumber(sigmaOmValue);
  const sigmaArgumentOfPeriapsis = parseNumber(sigmaWValue);
  const sigmaMeanAnomaly = parseNumber(sigmaMaValue);
  const sigmaMeanMotion = parseNumber(sigmaNValue);
  const absoluteMagnitude = parseNumber(absoluteMagnitudeValue);
  const absoluteMagnitudeSigma = parseNumber(absoluteMagnitudeSigmaValue);
  const minimumOrbitIntersectionDistance = parseNumber(moidValue);

  if (
    !Number.isFinite(semiMajorAxisAu) ||
    !Number.isFinite(eccentricity) ||
    !Number.isFinite(inclination) ||
    !Number.isFinite(ascendingNode) ||
    !Number.isFinite(argumentOfPeriapsis) ||
    !Number.isFinite(meanAnomalyAtEpoch)
  ) {
    console.warn(`Skipping asteroid row ${rowIndex}: missing orbital parameters`);
    return null;
  }

  const semiMajorAxis = semiMajorAxisAu * AU_TO_SCENE_UNITS;
  const orbit = {
    semiMajorAxis,
    eccentricity,
    inclination,
    longitudeOfAscendingNode: ascendingNode,
    argumentOfPeriapsis,
    meanAnomalyAtEpoch,
    meanMotion: convertMeanMotion(meanMotionDegPerDay ?? 0)
  };

  const classificationFeatures = {
    diameter: Number.isFinite(diameter) ? diameter : 0,
    diameter_sigma:
      Number.isFinite(diameter) && diameter > 0 ? Math.max(diameter * 0.05, 0.01) : 0,
    e: eccentricity,
    a: semiMajorAxisAu,
    i: inclination,
    om: ascendingNode,
    w: argumentOfPeriapsis,
    ma: meanAnomalyAtEpoch,
    n: Number.isFinite(meanMotionDegPerDay) ? meanMotionDegPerDay : 0,
    sigma_e: Number.isFinite(sigmaEccentricity) ? sigmaEccentricity : 0,
    sigma_a: Number.isFinite(sigmaSemiMajorAxis) ? sigmaSemiMajorAxis : 0,
    sigma_i: Number.isFinite(sigmaInclination) ? sigmaInclination : 0,
    sigma_om: Number.isFinite(sigmaLongitudeAscendingNode) ? sigmaLongitudeAscendingNode : 0,
    sigma_w: Number.isFinite(sigmaArgumentOfPeriapsis) ? sigmaArgumentOfPeriapsis : 0,
    sigma_ma: Number.isFinite(sigmaMeanAnomaly) ? sigmaMeanAnomaly : 0,
    sigma_n: Number.isFinite(sigmaMeanMotion) ? sigmaMeanMotion : 0,
    H: Number.isFinite(absoluteMagnitude) ? absoluteMagnitude : 0,
    H_sigma: Number.isFinite(absoluteMagnitudeSigma) ? absoluteMagnitudeSigma : 0,
    moid: Number.isFinite(minimumOrbitIntersectionDistance)
      ? minimumOrbitIntersectionDistance
      : 0
  };

  return {
    id,
    name,
    tntYieldMt: DEFAULT_TNT_YIELD_MT,
    visualScale: DEFAULT_VISUAL_SCALE,
    orbit,
    diameter: Number.isFinite(diameter) ? diameter : null,
    absoluteMagnitude: Number.isFinite(absoluteMagnitude) ? absoluteMagnitude : null,
    moid: Number.isFinite(minimumOrbitIntersectionDistance)
      ? minimumOrbitIntersectionDistance
      : null,
    classificationFeatures
  };
}

async function loadAsteroidCatalog(url = '/data/asteroids.csv') {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);
    const asteroids = [];

    rows.forEach((row, index) => {
      const headerCandidate = row[0]?.trim().toLowerCase();
      if (index === 0 && (headerCandidate === 'id' || headerCandidate === '#' || headerCandidate === 'spkid')) {
        return;
      }

      const transformed = transformAsteroidRow(row, index + 1);
      if (transformed) {
        asteroids.push(transformed);
      }
    });

    const classified = await Promise.all(
      asteroids.map(async asteroid => {
        if (!asteroid?.classificationFeatures) {
          return asteroid;
        }

        try {
          const classification = await classifyAsteroid(asteroid.classificationFeatures);
          return {
            ...asteroid,
            isNeo: classification.isNeo,
            neoProbability: classification.neoProbability,
            isPhaHazardous: classification.isPhaHazardous,
            phaProbability: classification.phaProbability
          };
        } catch (error) {
          console.error(`Failed to classify asteroid ${asteroid.id}:`, error);
          return asteroid;
        }
      })
    );

    return classified.map(asteroid => {
      const { classificationFeatures, ...rest } = asteroid;
      return rest;
    });
  } catch (error) {
    console.error('Unable to load asteroid catalog:', error);
    return [];
  }
}

const planetData = {
  Mercury: {
    radius: '2,439.7 km',
    tilt: '0.034°',
    rotation: '58.6 Earth days',
    orbit: '88 Earth days',
    distance: '57.9 million km',
    moons: '0',
    info: 'The smallest planet in our solar system and nearest to the Sun.'
  },
  Venus: {
    radius: '6,051.8 km',
    tilt: '177.4°',
    rotation: '243 Earth days',
    orbit: '225 Earth days',
    distance: '108.2 million km',
    moons: '0',
    info: 'Second planet from the Sun, known for its extreme temperatures and thick atmosphere.'
  },
  Earth: {
    radius: '6,371 km',
    tilt: '23.5°',
    rotation: '24 hours',
    orbit: '365 days',
    distance: '150 million km',
    moons: '1 (Moon)',
    info: 'Third planet from the Sun and the only known planet to harbor life.'
  },
  Mars: {
    radius: '3,389.5 km',
    tilt: '25.19°',
    rotation: '1.03 Earth days',
    orbit: '687 Earth days',
    distance: '227.9 million km',
    moons: '2 (Phobos and Deimos)',
    info: 'Known as the Red Planet, famous for its reddish appearance and potential for human colonization.'
  },
  Jupiter: {
    radius: '69,911 km',
    tilt: '3.13°',
    rotation: '9.9 hours',
    orbit: '12 Earth years',
    distance: '778.5 million km',
    moons: '95 known moons (Ganymede, Callisto, Europa, Io are the 4 largest)',
    info: 'The largest planet in our solar system, known for its Great Red Spot.'
  },
  Saturn: {
    radius: '58,232 km',
    tilt: '26.73°',
    rotation: '10.7 hours',
    orbit: '29.5 Earth years',
    distance: '1.4 billion km',
    moons: '146 known moons',
    info: 'Distinguished by its extensive ring system, the second-largest planet in our solar system.'
  },
  Uranus: {
    radius: '25,362 km',
    tilt: '97.77°',
    rotation: '17.2 hours',
    orbit: '84 Earth years',
    distance: '2.9 billion km',
    moons: '27 known moons',
    info: 'Known for its unique sideways rotation and pale blue color.'
  },
  Neptune: {
    radius: '24,622 km',
    tilt: '28.32°',
    rotation: '16.1 hours',
    orbit: '165 Earth years',
    distance: '4.5 billion km',
    moons: '14 known moons',
    info: 'The most distant planet from the Sun in our solar system, known for its deep blue color.'
  },
  Pluto: {
    radius: '1,188.3 km',
    tilt: '122.53°',
    rotation: '6.4 Earth days',
    orbit: '248 Earth years',
    distance: '5.9 billion km',
    moons: '5 (Charon, Styx, Nix, Kerberos, Hydra)',
    info: 'Originally classified as the ninth planet, Pluto is now considered a dwarf planet.'
  }
};

function createPlanetFactory({ scene, textureLoader }) {
  const loader = textureLoader ?? new THREE.TextureLoader();

  function loadTextureMaterial(texture, bump) {
    if (texture instanceof THREE.Material) {
      return texture;
    }

    if (bump) {
      return new THREE.MeshPhongMaterial({
        map: loader.load(texture),
        bumpMap: loader.load(bump),
        bumpScale: 0.7
      });
    }

    return new THREE.MeshPhongMaterial({ map: loader.load(texture) });
  }

  function createOrbitLine(elements, segments = PLANET_ORBIT_SEGMENTS) {
    if (!elements) {
      return null;
    }

    const points = sampleKeplerOrbit(elements, segments);
    if (points.length === 0) {
      return null;
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.03
    });

    const line = new THREE.LineLoop(geometry, material);
    line.frustumCulled = false;
    return line;
  }

  return function createPlanet({
    name: planetName,
    size,
    tilt = 0,
    texture,
    bump,
    ring,
    atmosphere,
    moons,
    orbit
  }) {
    const material = loadTextureMaterial(texture, bump);
    const geometry = new THREE.SphereGeometry(size, 32, 20);
    const planet = new THREE.Mesh(geometry, material);
    const planet3d = new THREE.Object3D();
    const planetSystem = new THREE.Group();
    planetSystem.add(planet);

    let Atmosphere;
    let Ring;

    planet.rotation.z = (tilt * Math.PI) / 180;

    if (ring) {
      const RingGeo = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius, 30);
      const RingMat = new THREE.MeshStandardMaterial({
        map: loader.load(ring.texture),
        side: THREE.DoubleSide
      });
      Ring = new THREE.Mesh(RingGeo, RingMat);
      planetSystem.add(Ring);
      Ring.rotation.x = -0.5 * Math.PI;
      Ring.rotation.y = -(tilt * Math.PI) / 180;
    }

    if (atmosphere) {
      const atmosphereGeom = new THREE.SphereGeometry(size + 0.1, 32, 20);
      const atmosphereMaterial = new THREE.MeshPhongMaterial({
        map: loader.load(atmosphere),
        transparent: true,
        opacity: 0.4,
        depthTest: true,
        depthWrite: false
      });
      Atmosphere = new THREE.Mesh(atmosphereGeom, atmosphereMaterial);
      Atmosphere.rotation.z = 0.41;
      planet.add(Atmosphere);
    }

    if (moons) {
      moons.forEach((moon, index) => {
        let moonMaterial;

        if (moon.bump) {
          moonMaterial = new THREE.MeshStandardMaterial({
            map: loader.load(moon.texture),
            bumpMap: loader.load(moon.bump),
            bumpScale: 0.5
          });
        } else {
          moonMaterial = new THREE.MeshStandardMaterial({
            map: loader.load(moon.texture)
          });
        }
        const moonGeometry = new THREE.SphereGeometry(moon.size, 32, 20);
        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        const orbitRadius = moon.orbitRadius ?? size * 1.5;
        moonMesh.position.set(orbitRadius, 0, 0);
        planetSystem.add(moonMesh);
        moon.mesh = moonMesh;
        moon.orbitRadius = orbitRadius;
        moon.initialPhase = moon.initialPhase ?? index * (Math.PI / 2);
        moon.spinRate = moon.spinRate ?? 0;
        moon.baseRotation = moonMesh.rotation.y;
      });
    }

    const keplerElements = orbit ? createKeplerElements(orbit) : null;
    const orbitLine = createOrbitLine(keplerElements);

    if (orbitLine) {
      planet3d.add(orbitLine);
    }

    planet3d.add(planetSystem);
    scene.add(planet3d);

    if (keplerElements) {
      const { position } = propagateKepler(keplerElements, keplerElements.epoch ?? 0);
      orbitPositionToScene(position, planetSystem.position);
    }

    return {
      name: planetName,
      planet,
      planet3d,
      Atmosphere,
      moons,
      planetSystem,
      Ring,
      keplerElements,
      orbitLine
    };
  };
}

const planetOrbitDefinitions = {
  Mercury: {
    semiMajorAxisAu: 0.38709927,
    eccentricity: 0.20563593,
    inclination: 7.00497902,
    longitudeOfAscendingNode: 48.33076593,
    longitudeOfPerihelion: 77.45779628,
    meanLongitude: 252.2503235,
    meanMotion: 4.09233445
  },
  Venus: {
    semiMajorAxisAu: 0.72333566,
    eccentricity: 0.00677672,
    inclination: 3.39467605,
    longitudeOfAscendingNode: 76.67984255,
    longitudeOfPerihelion: 131.60246718,
    meanLongitude: 181.9790995,
    meanMotion: 1.60213034
  },
  Earth: {
    semiMajorAxisAu: 1.00000261,
    eccentricity: 0.01671123,
    inclination: -0.00001531,
    longitudeOfAscendingNode: -11.26064,
    longitudeOfPerihelion: 102.93768193,
    meanLongitude: 100.46457166,
    meanMotion: 0.98564736
  },
  Mars: {
    semiMajorAxisAu: 1.52371034,
    eccentricity: 0.0933941,
    inclination: 1.84969142,
    longitudeOfAscendingNode: 49.57854,
    longitudeOfPerihelion: 336.04084,
    meanLongitude: 355.453432,
    meanMotion: 0.52403293
  },
  Jupiter: {
    semiMajorAxisAu: 5.202887,
    eccentricity: 0.04838624,
    inclination: 1.30439695,
    longitudeOfAscendingNode: 100.47390909,
    longitudeOfPerihelion: 14.72847983,
    meanLongitude: 34.39644,
    meanMotion: 0.08308529
  },
  Saturn: {
    semiMajorAxisAu: 9.53667594,
    eccentricity: 0.05386179,
    inclination: 2.48599187,
    longitudeOfAscendingNode: 113.66242448,
    longitudeOfPerihelion: 92.59887831,
    meanLongitude: 49.954244,
    meanMotion: 0.03344414
  },
  Uranus: {
    semiMajorAxisAu: 19.18916464,
    eccentricity: 0.04725744,
    inclination: 0.77263783,
    longitudeOfAscendingNode: 74.01692503,
    longitudeOfPerihelion: 170.9542763,
    meanLongitude: 313.23810451,
    meanMotion: 0.011718015
  },
  Neptune: {
    semiMajorAxisAu: 30.06992276,
    eccentricity: 0.00859048,
    inclination: 1.77004347,
    longitudeOfAscendingNode: 131.78422574,
    longitudeOfPerihelion: 44.96476227,
    meanLongitude: 304.88003,
    meanMotion: 0.005995147
  },
  Pluto: {
    semiMajorAxisAu: 39.48211675,
    eccentricity: 0.2488273,
    inclination: 17.14001206,
    longitudeOfAscendingNode: 110.30393684,
    longitudeOfPerihelion: 224.06891629,
    meanLongitude: 238.92903833,
    meanMotion: 0.0039640155
  }
};

function normalizeAngleDegrees(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function transformPlanetOrbit(definition) {
  if (!definition) {
    return null;
  }

  const semiMajorAxis = (definition.semiMajorAxisAu ?? 0) * AU_TO_SCENE_UNITS;
  const eccentricity = definition.eccentricity ?? 0;
  const inclination = definition.inclination ?? 0;
  const longitudeOfAscendingNode = definition.longitudeOfAscendingNode ?? 0;
  const argumentOfPeriapsis =
    normalizeAngleDegrees((definition.longitudeOfPerihelion ?? 0) - (definition.longitudeOfAscendingNode ?? 0));
  const meanAnomalyAtEpoch = normalizeAngleDegrees(
    (definition.meanLongitude ?? 0) - (definition.longitudeOfPerihelion ?? 0)
  );
  const meanMotion = convertMeanMotion(definition.meanMotion ?? 0);

  return {
    semiMajorAxis,
    eccentricity,
    inclination,
    longitudeOfAscendingNode,
    argumentOfPeriapsis,
    meanAnomalyAtEpoch,
    meanMotion,
    epoch: 0
  };
}

const planetOrbitCatalog = Object.fromEntries(
  Object.entries(planetOrbitDefinitions).map(([name, definition]) => [name, transformPlanetOrbit(definition)])
);

function toVector3(value) {
  if (value instanceof THREE.Vector3) {
    return value.clone();
  }

  if (value && typeof value === 'object') {
    const { x, y, z } = value;
    if ([x, y, z].every(component => Number.isFinite(component))) {
      return new THREE.Vector3(x, y, z);
    }
  }

  return null;
}

function sanitizeEarthIntersection(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const intersects = Boolean(source.intersects);
  const minimumDistanceSceneUnits = Number.isFinite(source.minimumDistanceSceneUnits)
    ? source.minimumDistanceSceneUnits
    : null;
  const thresholdSceneUnits = Number.isFinite(source.thresholdSceneUnits)
    ? source.thresholdSceneUnits
    : null;
  const impactPoint = toVector3(source.impactPoint);
  let impactNormal = toVector3(source.impactNormal);

  if (impactNormal && impactNormal.lengthSq() > 1e-8) {
    impactNormal = impactNormal.normalize();
  } else {
    impactNormal = null;
  }

  return {
    ...source,
    intersects,
    minimumDistanceSceneUnits,
    thresholdSceneUnits,
    impactPoint,
    impactNormal
  };
}

function createAsteroidEntries(catalog = []) {
  return catalog.map((data, index) => {
    const keplerElements = createKeplerElements(data.orbit);
    const earthOrbitIntersection = sanitizeEarthIntersection(data.earthOrbitIntersection);

    return {
      data: {
        ...data,
        velocity:
          data.velocity ?? {
            orbital: { x: 0, y: 0, z: 0 },
            kilometersPerSecond: { x: 0, y: 0, z: 0 },
            speedKilometersPerSecond: 0,
            relative: {
              kilometersPerSecond: { x: 0, y: 0, z: 0 },
              speedKilometersPerSecond: 0
            }
          }
      },
      mesh: null,
      keplerElements,
      templateIndex: index,
      earthOrbitIntersection
    };
  });
}

export {
  loadAsteroidCatalog,
  planetData,
  createPlanetFactory,
  createAsteroidEntries,
  planetOrbitCatalog
};
