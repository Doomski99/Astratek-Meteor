export const IMPACT_YIELD_CATEGORIES = [
  {
    id: 'range-a',
    name: 'Range A — City/Metropolitan Scale',
    rangeLabel: '0.024 – 2.39 Mt',
    minYield: 0,
    maxYield: 2.390057361376673,
    description:
      'Minimal asteroid impacts or robust fragments that survive entry. Devastation generally stays within a metropolitan footprint and is often delivered by a high-altitude airburst shockwave.',
    effectZones: [
      {
        id: 'blast-100',
        label: '100 kPa Blast (Total Destruction)',
        severity: 'critical',
        description:
          'Near-total structural collapse; even reinforced buildings fail within roughly 0.5–1.5 km of the burst or crater.',
        radius: kmRange(0.5, 1.5)
      },
      {
        id: 'blast-35',
        label: '35 kPa Blast (Heavy Damage)',
        severity: 'high',
        description:
          'Serious structural damage, widespread tree blowdown, and life-threatening debris impacts across a 1–3 km belt.',
        radius: kmRange(1, 3)
      },
      {
        id: 'blast-10',
        label: '10 kPa Blast (Glass Breakage)',
        severity: 'elevated',
        description:
          'Light construction fails and windows shatter out to 5–15 km, producing injuries from debris and flying glass.',
        radius: kmRange(5, 15)
      },
      {
        id: 'thermal-100',
        label: '100 kJ/m² Thermal Flash',
        severity: 'high',
        description:
          'Spontaneous ignition of wood, fabrics, and vegetation within ~1–2 km of the burst.',
        radius: kmRange(1, 2)
      },
      {
        id: 'thermal-20',
        label: '20 kJ/m² Thermal Pulse',
        severity: 'high',
        description:
          '3rd-degree burns and ignition of thin fuels across roughly 1–3 km.',
        radius: kmRange(1, 3)
      },
      {
        id: 'thermal-2',
        label: '2–10 kJ/m² Thermal Exposure',
        severity: 'area',
        description:
          'Painful burns and scattered spot fires out to about 5–10 km.',
        radius: kmRange(5, 10)
      },
      {
        id: 'crater-final',
        label: 'Final Crater Footprint',
        severity: 'high',
        description:
          'If a ground strike occurs, final crater diameters of ~150–600 m (depth 10–70 m) with ejecta thinning to millimetres by ~2 km.',
        radius: kmRange(0.075, 0.3)
      },
      {
        id: 'seismic-mmi',
        label: 'Seismic Shaking (MMI VI–VII)',
        severity: 'elevated',
        description:
          'Mw ~4.0–5.5 equivalent shaking produces MMI VI–VII effects within about 5–15 km.',
        radius: kmRange(5, 15)
      },
      {
        id: 'tsunami-near',
        label: 'Near-Field Tsunami',
        severity: 'high',
        description:
          'Ocean strikes raise ~5–20 m waves within 20–50 km, with coastal run-up exceeding 10 m.',
        radius: kmRange(20, 50)
      }
    ]
  },
  {
    id: 'range-b',
    name: 'Range B — Regional Scale',
    rangeLabel: '2.39 – 239 Mt',
    minYield: 2.390057361376673,
    maxYield: 239.0057361376673,
    description:
      'Regional impacts comparable to scaled-up Barringer or Tunguska-class events. Blast, thermal, seismic, and tsunami footprints engulf entire regions or small countries.',
    effectZones: [
      {
        id: 'blast-100',
        label: '100 kPa Blast (Total Destruction)',
        severity: 'critical',
        description: 'Total structural failure expands to a 2–5 km radius.',
        radius: kmRange(2, 5)
      },
      {
        id: 'blast-35',
        label: '35 kPa Blast (Heavy Damage)',
        severity: 'critical',
        description: 'Heavy construction collapses and forests flatten across 5–15 km.',
        radius: kmRange(5, 15)
      },
      {
        id: 'blast-10',
        label: '10 kPa Blast (Glass Breakage)',
        severity: 'high',
        description: 'Universal window failure and light structural damage extend 15–40 km.',
        radius: kmRange(15, 40)
      },
      {
        id: 'thermal-100',
        label: '100 kJ/m² Thermal Flash',
        severity: 'critical',
        description: 'Spontaneous ignition within roughly 2–4 km.',
        radius: kmRange(2, 4)
      },
      {
        id: 'thermal-20',
        label: '20 kJ/m² Thermal Pulse',
        severity: 'high',
        description: 'Severe burns and wildfire ignition across 10–20 km.',
        radius: kmRange(10, 20)
      },
      {
        id: 'thermal-2',
        label: '2–10 kJ/m² Thermal Exposure',
        severity: 'area',
        description: 'Secondary burns and spot fires propagate 20–50 km from the impact.',
        radius: kmRange(20, 50)
      },
      {
        id: 'crater-final',
        label: 'Final Crater Footprint',
        severity: 'critical',
        description: 'Ground strikes excavate 1–5 km final craters with rims buried under metres of ejecta.',
        radius: kmRange(0.5, 2.5)
      },
      {
        id: 'seismic-mmi',
        label: 'Seismic Shaking (MMI VII–VIII)',
        severity: 'critical',
        description: 'Mw ~6.0–7.0 shaking produces MMI VII–VIII damage within roughly 50–100 km.',
        radius: kmRange(50, 100)
      },
      {
        id: 'tsunami-near',
        label: 'Near-Field Tsunami',
        severity: 'critical',
        description:
          'Ocean impacts generate 50–100 m waves within 50–100 km, with far-field heights of 5–10 m crossing ocean basins.',
        radius: kmRange(50, 100)
      }
    ]
  },
  {
    id: 'range-c',
    name: 'Range C — Continental Scale',
    rangeLabel: '239 – 23,900 Mt',
    minYield: 239.0057361376673,
    maxYield: 23900.57361376673,
    description:
      'Continental-scale catastrophes reminiscent of Chicxulub-class impacts. Nations vanish under crater excavation, blast, thermal firestorms, tsunamis, and seismic upheaval.',
    effectZones: [
      {
        id: 'blast-100',
        label: '100 kPa Blast (Total Destruction)',
        severity: 'critical',
        description: 'Complete destruction of infrastructure across a 10–20 km radius.',
        radius: kmRange(10, 20)
      },
      {
        id: 'blast-35',
        label: '35 kPa Blast (Heavy Damage)',
        severity: 'critical',
        description: 'Major urban centres levelled within 30–60 km.',
        radius: kmRange(30, 60)
      },
      {
        id: 'blast-10',
        label: '10 kPa Blast (Widespread Damage)',
        severity: 'critical',
        description: 'Glass-shattering overpressure reaches 100–200 km, affecting multiple countries.',
        radius: kmRange(100, 200)
      },
      {
        id: 'thermal-100',
        label: '100 kJ/m² Thermal Flash',
        severity: 'critical',
        description: 'Instant ignition of most fuels within 10–15 km.',
        radius: kmRange(10, 15)
      },
      {
        id: 'thermal-20',
        label: '20 kJ/m² Thermal Pulse',
        severity: 'critical',
        description: 'Severe burns and firestorms sweep across 30–60 km.',
        radius: kmRange(30, 60)
      },
      {
        id: 'thermal-2',
        label: '2–10 kJ/m² Thermal Exposure',
        severity: 'area',
        description: 'Ignition points and mass casualties from 100–200 km away.',
        radius: kmRange(100, 200)
      },
      {
        id: 'crater-final',
        label: 'Final Crater Footprint',
        severity: 'critical',
        description:
          'Final crater diameters span ~5–20 km (depths 0.5–1.5 km) with ejecta blankets metres thick out to tens of kilometres.',
        radius: kmRange(2.5, 10)
      },
      {
        id: 'seismic-mmi',
        label: 'Seismic Shaking (MMI VIII–IX)',
        severity: 'critical',
        description: 'Mw ~7.0–8.0 equivalent shaking drives MMI VIII–IX impacts within 100–300 km.',
        radius: kmRange(100, 300)
      },
      {
        id: 'tsunami-near',
        label: 'Near-Field Tsunami',
        severity: 'critical',
        description: 'Ocean impacts raise 100–300 m waves within 100–200 km and threaten multiple coastlines across oceans.',
        radius: kmRange(100, 200)
      }
    ]
  },
  {
    id: 'range-d',
    name: 'Range D — Global Scale',
    rangeLabel: '23,900 – 2.39 million Mt',
    minYield: 23900.57361376673,
    maxYield: 2390057.361376673,
    description:
      'Global extinction-class events that shroud the planet in ejecta, trigger worldwide firestorms, and plunge the biosphere into impact winter.',
    effectZones: [
      {
        id: 'blast-100',
        label: '100 kPa Blast (Total Destruction)',
        severity: 'critical',
        description: 'Atmosphere-shattering overpressure obliterates everything within ~50–100 km.',
        radius: kmRange(50, 100)
      },
      {
        id: 'blast-35',
        label: '35 kPa Blast (Heavy Damage)',
        severity: 'critical',
        description: 'Heavy damage extends 200–400 km, scouring multiple countries.',
        radius: kmRange(200, 400)
      },
      {
        id: 'blast-10',
        label: '10 kPa Blast (Widespread Damage)',
        severity: 'critical',
        description: 'Glass-shattering winds sweep 500–1000 km away.',
        radius: kmRange(500, 1000)
      },
      {
        id: 'thermal-100',
        label: '100 kJ/m² Thermal Flash',
        severity: 'critical',
        description: 'Combustibles ignite across 30–50 km.',
        radius: kmRange(30, 50)
      },
      {
        id: 'thermal-20',
        label: '20 kJ/m² Thermal Pulse',
        severity: 'critical',
        description: '3rd-degree burns and firestorms develop 200–400 km from impact.',
        radius: kmRange(200, 400)
      },
      {
        id: 'thermal-2',
        label: '2–10 kJ/m² Thermal Exposure',
        severity: 'area',
        description: 'Lower-level heating reaches at least 1000 km, igniting forests and cities across continents.',
        radius: kmRange(1000, undefined, 'atLeast')
      },
      {
        id: 'crater-final',
        label: 'Final Crater Footprint',
        severity: 'critical',
        description: 'Final crater diameters of ~50–150 km with depths of 3–5 km and global ejecta fallout.',
        radius: kmRange(25, 75)
      },
      {
        id: 'seismic-mmi',
        label: 'Seismic Shaking (MMI IX–X)',
        severity: 'critical',
        description: 'Mw ~9.0–10.0 equivalent shaking drives MMI IX–X damage within roughly 1000 km.',
        radius: kmRange(1000, 1000)
      },
      {
        id: 'tsunami-near',
        label: 'Near-Field Tsunami',
        severity: 'critical',
        description: 'Megatsunami waves exceed 500 m within 200–500 km, with far-field devastation across ocean basins.',
        radius: kmRange(200, 500)
      }
    ]
  },
  {
    id: 'range-e1',
    name: 'Range E1 — Global Catastrophe / Near-Planet Killer',
    rangeLabel: '2.39 – 23.9 million Mt',
    minYield: 2390057.361376673,
    maxYield: 23900573.61376673,
    description:
      'Upper-extreme extinction events. Multiple continents are simultaneously devastated while Earth’s basic rotation and orbit remain intact.',
    effectZones: [
      {
        id: 'blast-100',
        label: '100 kPa Blast (Total Destruction)',
        severity: 'critical',
        description: 'Complete destruction reaches 100–200 km.',
        radius: kmRange(100, 200)
      },
      {
        id: 'blast-35',
        label: '35 kPa Blast (Heavy Damage)',
        severity: 'critical',
        description: 'Heavy damage spreads 300–600 km, battering multiple continents.',
        radius: kmRange(300, 600)
      },
      {
        id: 'blast-10',
        label: '10 kPa Blast (Widespread Damage)',
        severity: 'critical',
        description: 'Shattering overpressure travels 1000–2000 km.',
        radius: kmRange(1000, 2000)
      },
      {
        id: 'thermal-100',
        label: '100 kJ/m² Thermal Flash',
        severity: 'critical',
        description: 'Transcontinental ignition and unsurvivable burns across 50–100 km.',
        radius: kmRange(50, 100)
      },
      {
        id: 'thermal-20',
        label: '20 kJ/m² Thermal Pulse',
        severity: 'critical',
        description: 'Thermal flux guaranteeing global firestorms spans 200–500 km.',
        radius: kmRange(200, 500)
      },
      {
        id: 'thermal-2',
        label: '2–10 kJ/m² Thermal Exposure',
        severity: 'area',
        description: 'Re-entering ejecta drives planet-wide heating; lower thresholds become globally relevant.',
        radius: kmRange(undefined, undefined, 'global')
      },
      {
        id: 'crater-final',
        label: 'Final Crater Footprint',
        severity: 'critical',
        description: 'Final crater diameters of 100–250 km reshape continental crust and blanket the globe in ejecta.',
        radius: kmRange(50, 125)
      },
      {
        id: 'seismic-mmi',
        label: 'Seismic Shaking (Global MMI X)',
        severity: 'critical',
        description: 'Mw ~10–10.5 shaking drives MMI X effects planet-wide; the Earth "rings like a bell" for months.',
        radius: kmRange(undefined, undefined, 'global')
      },
      {
        id: 'tsunami-near',
        label: 'Planetary Tsunami Hazard',
        severity: 'critical',
        description: 'Near-field waves approach 1 km high and every coastline on Earth is obliterated.',
        radius: kmRange(undefined, undefined, 'global')
      }
    ]
  },
  {
    id: 'range-e2',
    name: 'Range E2 — Planet Killer',
    rangeLabel: '23.9 million – 2.39 billion Mt',
    minYield: 23900573.61376673,
    maxYield: 2390057361.376673,
    description:
      'Planet-sterilising impacts that melt large portions of the crust, boil oceans, and perturb Earth’s day length or axial tilt.',
    effectZones: [
      {
        id: 'blast-100',
        label: '100 kPa Blast (Total Destruction)',
        severity: 'critical',
        description: 'Overpressure devastation spans roughly 500–1000 km.',
        radius: kmRange(500, 1000)
      },
      {
        id: 'blast-35',
        label: '35 kPa Blast (Heavy Damage)',
        severity: 'critical',
        description: 'Shock fronts deliver heavy damage 1500–3000 km away.',
        radius: kmRange(1500, 3000)
      },
      {
        id: 'blast-10',
        label: '10 kPa Blast (Widespread Damage)',
        severity: 'critical',
        description: 'Atmospheric compression becomes near-global; infrastructure everywhere is battered.',
        radius: kmRange(undefined, undefined, 'global'),
        radiusLabel: 'Near-global'
      },
      {
        id: 'thermal-100',
        label: '100 kJ/m² Thermal Flash',
        severity: 'critical',
        description: 'Fireball vaporises terrain within 200–500 km.',
        radius: kmRange(200, 500)
      },
      {
        id: 'thermal-20',
        label: '20 kJ/m² Thermal Pulse',
        severity: 'critical',
        description: 'Third-degree burns reach 1000–2500 km, guaranteeing continent-spanning firestorms.',
        radius: kmRange(1000, 2500)
      },
      {
        id: 'thermal-2',
        label: '2–10 kJ/m² Thermal Exposure',
        severity: 'area',
        description: 'Lower-level heating becomes global as oceans boil and the atmosphere superheats.',
        radius: kmRange(undefined, undefined, 'global')
      },
      {
        id: 'crater-final',
        label: 'Final Crater Footprint',
        severity: 'critical',
        description: 'Multi-ring basins 500–2000 km wide form, penetrating deep into the crust.',
        radius: kmRange(250, 1000)
      },
      {
        id: 'seismic-mmi',
        label: 'Seismic Shaking (MMI > X)',
        severity: 'critical',
        description: 'Mw ~11–12 shaking fractures the crust globally; conventional scales fail.',
        radius: kmRange(undefined, undefined, 'global')
      },
      {
        id: 'tsunami-near',
        label: 'Planetary Tsunami Hazard',
        severity: 'critical',
        description: 'Near-field waves tower several kilometres high and entire ocean basins are repeatedly emptied.',
        radius: kmRange(undefined, undefined, 'global')
      }
    ]
  },
  {
    id: 'range-e3',
    name: 'Range E3 — World-Former / Planetary Disruption',
    rangeLabel: '> 2.39 billion Mt',
    minYield: 2390057361.376673,
    maxYield: Infinity,
    description:
      'Planet-altering collisions akin to the Moon-forming Theia impact. Earth’s crust, oceans, and atmosphere are vaporised and the planet’s rotation and tilt reset.',
    effectZones: [
      {
        id: 'blast-100',
        label: 'Hemispheric Blast Scouring',
        severity: 'critical',
        description: '100 kPa concepts blur as hemispheres are stripped; devastation covers roughly a hemisphere.',
        radius: kmRange(undefined, undefined, 'hemisphere')
      },
      {
        id: 'blast-35',
        label: 'Global Blast Shock',
        severity: 'critical',
        description: 'Shockwaves circumnavigate the globe multiple times; surface materials are ejected to space.',
        radius: kmRange(undefined, undefined, 'global')
      },
      {
        id: 'blast-10',
        label: 'Planetary Atmosphere Disruption',
        severity: 'critical',
        description: 'Atmospheric overpressure becomes planet-wide as the air column itself is largely stripped.',
        radius: kmRange(undefined, undefined, 'planetary')
      },
      {
        id: 'thermal-100',
        label: 'Global Magma Ocean',
        severity: 'critical',
        description: 'Impact flash melts the crust and vaporises oceans worldwide; no discrete thermal radius exists.',
        radius: kmRange(undefined, undefined, 'planetary')
      },
      {
        id: 'thermal-20',
        label: 'Atmosphere Vaporisation',
        severity: 'critical',
        description: 'Thermal energy vaporises substantial portions of the atmosphere and surface rock globally.',
        radius: kmRange(undefined, undefined, 'planetary')
      },
      {
        id: 'thermal-2',
        label: 'Planetary Reformation Heat',
        severity: 'area',
        description: 'Radiation and melt persist worldwide as the planet reforms from ejecta.',
        radius: kmRange(undefined, undefined, 'planetary')
      },
      {
        id: 'crater-final',
        label: 'Global Resurfacing Zone',
        severity: 'critical',
        description: 'No discrete crater remains; the entire planet becomes a magma ocean with mass exchange into orbit.',
        radius: kmRange(undefined, undefined, 'planetary')
      },
      {
        id: 'seismic-mmi',
        label: 'Whole-Planet Seismic Liquefaction',
        severity: 'critical',
        description: 'Seismic energy liquefies the lithosphere and mixes mantle layers globally.',
        radius: kmRange(undefined, undefined, 'planetary')
      },
      {
        id: 'tsunami-near',
        label: 'Ocean Vaporisation Zone',
        severity: 'critical',
        description: 'Liquid water oceans are temporarily lost as the hydrosphere is vaporised and redistributed.',
        radius: kmRange(undefined, undefined, 'planetary')
      }
    ]
  }
];

export function getImpactYieldCategory(yieldMegatons) {
  const value = Number.isFinite(yieldMegatons) && yieldMegatons >= 0 ? yieldMegatons : 0;
  return (
    IMPACT_YIELD_CATEGORIES.find(category => value >= category.minYield && value < category.maxYield) ||
    IMPACT_YIELD_CATEGORIES[IMPACT_YIELD_CATEGORIES.length - 1]
  );
}

function kmRange(min, max, qualifier) {
  const range = {};
  if (Number.isFinite(min)) {
    range.min = min;
  }
  if (Number.isFinite(max)) {
    range.max = max;
  }
  if (qualifier) {
    range.qualifier = qualifier;
  }
  return range;
}
