export const IMPACT_YIELD_CATEGORIES = [
  {
    id: 'range-a',
    name: 'Range A — City/Metropolitan Scale',
    rangeLabel: '0.024 – 2.39 Mt',
    minYield: 0,
    maxYield: 2.390057361376673,
    description:
      'Small asteroids or robust comet fragments that survive atmospheric entry. Effects stay within a metropolitan footprint, often as luminous airbursts with shockwaves that level city blocks and ignite spot fires.',
    effects: {
      fireball: {
        title: 'Airburst Flash & Fireball',
        description:
          'Incandescent burst high in the atmosphere. 100 kJ/m² thermal fluence ignites combustibles within roughly 1–2 km, while most ground materials survive outside the inner kilometre.',
        severity: 'elevated'
      },
      'severe-blast': {
        title: 'Severe Overpressure Core',
        description:
          '100 kPa shock front collapses buildings inside ~0.5–1.5 km. Reinforced structures fail without specialised sheltering.',
        severity: 'high'
      },
      'moderate-blast': {
        title: 'Shockwave Footprint',
        description:
          '5–15 km of glass-shattering 10 kPa overpressure; lighter construction suffers heavy damage and injuries from debris.',
        severity: 'elevated'
      },
      thermal: {
        title: 'Thermal Pulse',
        description:
          '20 kJ/m² out to ~3 km causes third-degree burns and spot fires; 2–10 kJ/m² carries painful burns as far as ~10 km.',
        severity: 'area'
      }
    }
  },
  {
    id: 'range-b',
    name: 'Range B — Regional Scale',
    rangeLabel: '2.39 – 239 Mt',
    minYield: 2.390057361376673,
    maxYield: 239.0057361376673,
    description:
      'Regional devastation comparable to scaled-up Barringer or Tunguska-class events. Craters span kilometres, stratospheric dust darkens skies, and hurricanes of debris sweep entire regions.',
    effects: {
      fireball: {
        title: 'Regional Fireball & Crater Furnace',
        description:
          'Impact excavates 1–5 km wide craters with molten floors. Radiant energy vaporises ground materials near the rim.',
        severity: 'high'
      },
      'severe-blast': {
        title: 'Total Destruction Zone',
        description:
          '100 kPa overpressure expands to roughly 2–5 km, erasing reinforced structures and flattening forests.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Regional Shock Front',
        description:
          '35 kPa winds devastate towns within 5–15 km; 10 kPa pulses break windows and topple weak buildings out to 15–40 km.',
        severity: 'high'
      },
      thermal: {
        title: 'Regional Thermal Curtain',
        description:
          '100 kJ/m² ignition radii stretch 2–4 km; 20 kJ/m² burns reach 10–20 km, creating widespread wildfires and flash burns.',
        severity: 'area'
      }
    }
  },
  {
    id: 'range-c',
    name: 'Range C — Continental Scale',
    rangeLabel: '239 – 23,900 Mt',
    minYield: 239.0057361376673,
    maxYield: 23900.57361376673,
    description:
      'Continental-scale catastrophe reminiscent of Chicxulub-class impacts. Blast, thermal, tsunami, and seismic footprints engulf nations while ejecta blankets fall hundreds of kilometres away.',
    effects: {
      fireball: {
        title: 'Multi-Kilometre Fireball',
        description:
          '100 kJ/m² ignition spans 10–15 km; molten ejecta blankets nearby landscapes and seeds firestorms across continents.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Nation-Level Destruction',
        description:
          '100 kPa ring stretches 10–20 km; 35 kPa winds flatten cities 30–60 km away and trigger continent-wide infrastructure collapse.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Continental Shockwaves',
        description:
          '10 kPa overpressure reverberates 100–200 km, breaking windows and damaging structures across multiple countries.',
        severity: 'critical'
      },
      thermal: {
        title: 'Continental Firestorms',
        description:
          '20 kJ/m² burns extend 30–60 km; 2–10 kJ/m² heating reaches hundreds of kilometres, igniting forests and cities alike.',
        severity: 'area'
      }
    }
  },
  {
    id: 'range-d',
    name: 'Range D — Global Scale',
    rangeLabel: '23,900 – 2.39 million Mt',
    minYield: 23900.57361376673,
    maxYield: 2390057.361376673,
    description:
      'Global extinction-class events. Atmosphere-shattering blasts, ocean-basin tsunamis, and impact winters plunge the planet into years of darkness and biospheric collapse.',
    effects: {
      fireball: {
        title: 'Hemisphere-Spanning Fireball',
        description:
          'Ignition radii of 30–50 km; ejecta re-entry bakes the globe and kindles worldwide wildfires.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Scoured Hemispheres',
        description:
          '100 kPa destruction reaches 50–100 km; 35 kPa winds shred infrastructure 200–400 km out, with 10 kPa pulses travelling 500–1000 km.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Planetary Shockwaves',
        description:
          'Atmospheric waves and seismic shocks circle the globe, toppling weak structures on distant continents within an hour.',
        severity: 'critical'
      },
      thermal: {
        title: 'Global Thermal Pulse',
        description:
          'Firestorms burn continents and ejecta-heated skies ignite biomass worldwide, injecting soot that drives impact winter.',
        severity: 'area'
      }
    }
  },
  {
    id: 'range-e1',
    name: 'Range E1 — Global Catastrophe / Near-Planet Killer',
    rangeLabel: '2.39 – 23.9 million Mt',
    minYield: 2390057.361376673,
    maxYield: 23900573.61376673,
    description:
      'Upper-extreme extinction events. Multiple continents are simultaneously devastated and the biosphere nears total collapse, though Earth’s spin and orbit remain essentially unchanged.',
    effects: {
      fireball: {
        title: 'Transcontinental Fireball',
        description:
          '100 kPa destruction radii climb to 100–200 km with global firestorms from re-entering ejecta blanketing the planet.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Continent-Spanning Shockwaves',
        description:
          '35 kPa overpressure rolls 300–600 km and 10 kPa pulses travel 1000–2000 km, directly battering multiple continents.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Global Seismic Upheaval',
        description:
          'Mw 10+ shaking rings the planet for months, triggering volcanism and landslides across every margin.',
        severity: 'critical'
      },
      thermal: {
        title: 'Guaranteed Global Firestorms',
        description:
          'Thermal radiation guarantees worldwide conflagrations; oceans flash-boil near the impact and skies glow from ejecta.',
        severity: 'area'
      }
    }
  },
  {
    id: 'range-e2',
    name: 'Range E2 — Planet Killer',
    rangeLabel: '23.9 million – 2.39 billion Mt',
    minYield: 23900573.61376673,
    maxYield: 2390057361.376673,
    description:
      'Planet-sterilising impacts that melt significant portions of the crust, boil oceans, and alter Earth’s day length or axial tilt. Recovery of complex life becomes effectively impossible.',
    effects: {
      fireball: {
        title: 'Global Vaporisation Flash',
        description:
          'Fireball envelopes hundreds of kilometres instantly and radiative afterglow heats the entire globe, boiling nearby oceans.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Worldwide Blast Front',
        description:
          'Shock fronts deliver 35 kPa devastation 1500–3000 km away while atmospheric compression becomes near-global.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Crust-Fracturing Seismicity',
        description:
          'Mw 11–12 shaking fractures the crust planet-wide and drives mantle melting with secondary impacts from global ejecta.',
        severity: 'critical'
      },
      thermal: {
        title: 'Oceans Boil & Atmosphere Heats',
        description:
          'Thermal flux vaporises the upper ocean, superheats the atmosphere, and ensures sustained global ignition.',
        severity: 'area'
      }
    }
  },
  {
    id: 'range-e3',
    name: 'Range E3 — World-Former / Planetary Disruption',
    rangeLabel: '> 2.39 billion Mt',
    minYield: 2390057361.376673,
    maxYield: Infinity,
    description:
      'Planet-altering collisions akin to the Moon-forming Theia impact. Earth’s crust, oceans, and atmosphere are vaporised, with mass exchanged into space and the planet’s rotation and tilt reset.',
    effects: {
      fireball: {
        title: 'Global Magma Ocean',
        description:
          'Impact flash melts the crust and vaporises oceans worldwide; discrete fireball radii lose meaning.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Hemisphere-Stripping Shockwaves',
        description:
          'Shock energy scours hemispheres simultaneously and ejects vast amounts of mass into orbit or space.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Planetary Reshaping',
        description:
          'Seismic energy liquefies the lithosphere, mixes mantle layers, and can spawn moons or rings from expelled debris.',
        severity: 'critical'
      },
      thermal: {
        title: 'Atmospheric Loss & Reformation',
        description:
          'Atmosphere is partly lost, then reaccretes from vaporised rock and impactor material as the planet cools.',
        severity: 'area'
      }
    }
  }
];

export function getImpactYieldCategory(yieldMegatons) {
  const value = Number.isFinite(yieldMegatons) && yieldMegatons >= 0 ? yieldMegatons : 0;
  return (
    IMPACT_YIELD_CATEGORIES.find(category => value >= category.minYield && value < category.maxYield) ||
    IMPACT_YIELD_CATEGORIES[IMPACT_YIELD_CATEGORIES.length - 1]
  );
}
