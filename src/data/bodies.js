import * as THREE from 'three';

const asteroidCatalog = [
  {
    id: 'apophis',
    name: '99942 Apophis',
    designation: 'Apophis',
    tntYieldMt: 800,
    orbit: { semiMajorAxis: 150, eccentricity: 0.12, inclination: 6, angularVelocity: 0.00012 },
    spinRate: 0.0015,
    visualScale: 0.018,
    description: 'Potentially hazardous Aten asteroid with a close 2029 approach.'
  },
  {
    id: 'bennu',
    name: '101955 Bennu',
    designation: 'Bennu',
    tntYieldMt: 4.5,
    orbit: { semiMajorAxis: 120, eccentricity: 0.21, inclination: 6, angularVelocity: 0.00009 },
    spinRate: 0.0018,
    visualScale: 0.016,
    description: 'Carbonaceous near-Earth asteroid sampled by OSIRIS-REx.'
  },
  {
    id: 'didymos',
    name: '65803 Didymos',
    designation: 'Didymos',
    tntYieldMt: 15.0,
    orbit: { semiMajorAxis: 180, eccentricity: 0.08, inclination: 3, angularVelocity: 0.00007 },
    spinRate: 0.0012,
    visualScale: 0.02,
    description: 'Binary system primary targeted by the DART mission.'
  }
];

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
      moons.forEach(moon => {
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
        const moonOrbitDistance = size * 1.5;
        moonMesh.position.set(moonOrbitDistance, 0, 0);
        planetSystem.add(moonMesh);
        moon.mesh = moonMesh;
      });
    }

    planet3d.add(planetSystem);
    scene.add(planet3d);

    return { name, planet, planet3d, Atmosphere, moons, planetSystem, Ring };
  };
}

function createAsteroidEntries(catalog = asteroidCatalog) {
  return catalog.map((data, index) => ({
    data,
    mesh: null,
    orbitAngle: data.initialPhase ?? index * 1.3,
    orbitAngularVelocity: data.orbit.angularVelocity,
    templateIndex: index
  }));
}

export { asteroidCatalog, planetData, createPlanetFactory, createAsteroidEntries };
