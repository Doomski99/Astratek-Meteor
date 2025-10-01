import * as THREE from 'three';
import { createKeplerElements } from '../simulation/kepler.js';

const AU_TO_SCENE_UNITS = 90;
const FRAMES_PER_SECOND = 60;
const FRAMES_PER_DAY = FRAMES_PER_SECOND * 60 * 60 * 24;
const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_VISUAL_SCALE = 0.02;
const DEFAULT_TNT_YIELD_MT = 0;

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

  return (degPerDay * DEG_TO_RAD) / FRAMES_PER_DAY;
}

function transformAsteroidRow(row, rowIndex) {
  if (!Array.isArray(row)) {
    return null;
  }

  const [
    idValue,
    nameValue,
    eccentricityValue,
    semiMajorAxisValue,
    inclinationValue,
    ascendingNodeValue,
    argumentValue,
    meanAnomalyValue,
    meanMotionValue
  ] = row;

  const id = (idValue ?? '').toString().trim();
  if (!id) {
    console.warn(`Skipping asteroid row ${rowIndex}: missing id`);
    return null;
  }

  const semiMajorAxisAu = parseNumber(semiMajorAxisValue);
  const eccentricity = parseNumber(eccentricityValue);
  const inclination = parseNumber(inclinationValue);
  const ascendingNode = parseNumber(ascendingNodeValue);
  const argumentOfPeriapsis = parseNumber(argumentValue);
  const meanAnomalyAtEpoch = parseNumber(meanAnomalyValue);
  const meanMotionDegPerDay = parseNumber(meanMotionValue);

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

  return {
    id,
    name: (nameValue ?? '').toString().trim() || id,
    tntYieldMt: DEFAULT_TNT_YIELD_MT,
    visualScale: DEFAULT_VISUAL_SCALE,
    orbit
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
      if (index === 0 && (headerCandidate === 'id' || headerCandidate === '#')) {
        return;
      }

      const transformed = transformAsteroidRow(row, index + 1);
      if (transformed) {
        asteroids.push(transformed);
      }
    });

    return asteroids;
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

  return function createPlanet(
    planetName,
    size,
    position,
    tilt,
    texture,
    bump,
    ring,
    atmosphere,
    moons
  ) {
    let material;

    if (texture instanceof THREE.Material) {
      material = texture;
    } else if (bump) {
      material = new THREE.MeshPhongMaterial({
        map: loader.load(texture),
        bumpMap: loader.load(bump),
        bumpScale: 0.7
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        map: loader.load(texture)
      });
    }

    const name = planetName;
    const geometry = new THREE.SphereGeometry(size, 32, 20);
    const planet = new THREE.Mesh(geometry, material);
    const planet3d = new THREE.Object3D();
    const planetSystem = new THREE.Group();
    planetSystem.add(planet);

    let Atmosphere;
    let Ring;

    planet.position.x = position;
    planet.rotation.z = (tilt * Math.PI) / 180;

    const orbitPath = new THREE.EllipseCurve(0, 0, position, position, 0, 2 * Math.PI, false, 0);
    const pathPoints = orbitPath.getPoints(100);
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.03
    });
    const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
    orbit.rotation.x = Math.PI / 2;
    planetSystem.add(orbit);

    if (ring) {
      const RingGeo = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius, 30);
      const RingMat = new THREE.MeshStandardMaterial({
        map: loader.load(ring.texture),
        side: THREE.DoubleSide
      });
      Ring = new THREE.Mesh(RingGeo, RingMat);
      planetSystem.add(Ring);
      Ring.position.x = position;
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

    planet3d.add(planetSystem);
    scene.add(planet3d);

    return { name, planet, planet3d, Atmosphere, moons, planetSystem, Ring };
  };
}

function createAsteroidEntries(catalog = []) {
  return catalog.map((data, index) => ({
    data,
    mesh: null,
    keplerElements: createKeplerElements(data.orbit),
    templateIndex: index
  }));
}

export { loadAsteroidCatalog, planetData, createPlanetFactory, createAsteroidEntries };
