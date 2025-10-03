export const IMPACT_YIELD_CATEGORIES = [
  {
    id: 'micro-airburst',
    name: 'Micro Airburst',
    rangeLabel: '< 0.01 Mt',
    minYield: 0,
    maxYield: 0.01,
    description:
      'Fragments disintegrate in the upper atmosphere. Damage is highly localised with mostly overpressure and sonic-boom effects.',
    effects: {
      fireball: {
        title: 'Flash Luminosity',
        description:
          'A brief incandescent flash high in the atmosphere. Objects directly beneath the burst may ignite, but surface vaporisation is unlikely.',
        severity: 'elevated'
      },
      'severe-blast': {
        title: 'Shockwave Cone',
        description:
          'Peak overpressure shatters windows and can dislodge roof tiles within a few kilometres of the entry track.',
        severity: 'high'
      },
      'moderate-blast': {
        title: 'Pressure Rumble',
        description:
          'Lighter structures sustain broken glass and superficial damage. Injuries mostly from flying debris.',
        severity: 'elevated'
      },
      thermal: {
        title: 'Thermal Glare',
        description:
          'Short-lived radiant heating comparable to standing near a lightning strike. Outdoor observers may experience temporary vision loss.',
        severity: 'area'
      }
    }
  },
  {
    id: 'urban-damage',
    name: 'Urban-Level Event',
    rangeLabel: '0.01 – 0.1 Mt',
    minYield: 0.01,
    maxYield: 0.1,
    description:
      'Capable of levelling a dense urban core. Comparable to the largest historical nuclear detonations, though focused in a single strike.',
    effects: {
      fireball: {
        title: 'Urban Core Fireball',
        description:
          'Total annihilation inside the innermost zone. Reinforced concrete collapses and the ground can partially vitrify.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Total Structural Collapse',
        description:
          'Overpressure above 20 psi erases most buildings within a several-kilometre radius. Survival inside unshielded structures is unlikely.',
        severity: 'high'
      },
      'moderate-blast': {
        title: 'Severe Damage Belt',
        description:
          'Residential neighbourhoods and light industry are flattened. Fires ignite across the blast perimeter.',
        severity: 'elevated'
      },
      thermal: {
        title: 'Blistering Thermal Pulse',
        description:
          'Third-degree burns on exposed skin and widespread ignition of vegetation out to dozens of kilometres.',
        severity: 'area'
      }
    }
  },
  {
    id: 'regional-catastrophe',
    name: 'Regional Catastrophe',
    rangeLabel: '0.1 – 1 Mt',
    minYield: 0.1,
    maxYield: 1,
    description:
      'A blast this large can wipe out a metropolitan area and deliver hurricane-force winds and heat far beyond the fireball.',
    effects: {
      fireball: {
        title: 'Surface Vaporisation',
        description:
          'Ground zero is excavated to bedrock. Soil, asphalt, and water instantly vaporise leaving a glowing crater.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Unsurvivable Blast Core',
        description:
          'Overpressure above 30 psi flattens everything within a 10–20 km radius. Reinforced shelters fail without specialised engineering.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Regional Devastation',
        description:
          'Winds exceeding 200 km/h topple buildings across a major region. Steel-frame towers experience catastrophic failures.',
        severity: 'high'
      },
      thermal: {
        title: 'Mass Firestorm Footprint',
        description:
          'Thermal radiation ignites city blocks and forests alike, creating self-sustaining firestorms tens of kilometres from the impact.',
        severity: 'area'
      }
    }
  },
  {
    id: 'continental-impact',
    name: 'Continental Impact',
    rangeLabel: '1 – 10 Mt',
    minYield: 1,
    maxYield: 10,
    description:
      'Comparable to the Tunguska or Chelyabinsk events scaled up, delivering continental-scale devastation and intense atmospheric effects.',
    effects: {
      fireball: {
        title: 'Crater Furnace',
        description:
          'A crater kilometres wide is left incandescent. The fireball reaches the upper atmosphere and remains luminous for minutes.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Super-Hurricane Core',
        description:
          'Mach-level winds and pressure waves destroy hardened facilities out to several hundred kilometres.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Continental Shock Front',
        description:
          'Rail lines, highways, and infrastructure collapse across an entire country-sized area. Windows shatter across multiple nations.',
        severity: 'high'
      },
      thermal: {
        title: 'Skywide Thermal Curtain',
        description:
          'Cities well outside the blast radius experience flash burns and ignition of anything flammable that is not shielded.',
        severity: 'area'
      }
    }
  },
  {
    id: 'global-cataclysm',
    name: 'Global Cataclysm',
    rangeLabel: '10 – 100 Mt',
    minYield: 10,
    maxYield: 100,
    description:
      'Generates world-spanning atmospheric disturbances, tsunamis, and weeks of climatic disruption. Comparable to the largest nuclear devices ever conceived.',
    effects: {
      fireball: {
        title: 'Megacrater Inferno',
        description:
          'An incandescent cavity tens of kilometres wide opens. Surrounding rock is liquefied or vaporised.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Planetary Blast Zone',
        description:
          'Urban areas within several hundred kilometres are erased. Mountain ranges experience massive landslides.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Worldwide Shockwaves',
        description:
          'Atmospheric pressure waves circle the planet multiple times, toppling weak structures on other continents.',
        severity: 'high'
      },
      thermal: {
        title: 'Hemisphere-Wide Firestorms',
        description:
          'Firestorms merge across regions; airborne particulates dim sunlight leading to crop failures.',
        severity: 'area'
      }
    }
  },
  {
    id: 'extinction-level',
    name: 'Extinction-Level Impact',
    rangeLabel: '≥ 100 Mt',
    minYield: 100,
    maxYield: Infinity,
    description:
      'Comparable to the Chicxulub impactor. Causes mass extinctions, megatsunamis, and a years-long impact winter.',
    effects: {
      fireball: {
        title: 'Global Fireball',
        description:
          'Fireball pierces the upper atmosphere and radiates enough energy to ignite forests on the opposite side of the planet.',
        severity: 'critical'
      },
      'severe-blast': {
        title: 'Scoured Hemisphere',
        description:
          'Everything within thousands of kilometres is pulverised or ejected into space. Continental crust is excavated.',
        severity: 'critical'
      },
      'moderate-blast': {
        title: 'Global Seismic Upheaval',
        description:
          'Megaquakes, volcanic activation, and tsunamis reshape coastlines around the world.',
        severity: 'critical'
      },
      thermal: {
        title: 'Worldwide Thermal Pulse',
        description:
          'Entire biosphere experiences ignition and combustion. Atmospheric chemistry is fundamentally altered.',
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
