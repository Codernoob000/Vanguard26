/**
 * Vanguard26 Backend Helpers, Data Managers & Fallbacks
 * Isolates data structures, validation schemas and static fallback responses
 * to keep codebase clean and modular.
 */

import { z } from 'zod';

// Zod Input Validation Schemas
export const schemas = {
  verifyPin: z.object({
    pin: z.string().min(1).max(20)
  }),
  coPilot: z.object({
    message: z.string().min(1).max(500).trim(),
    lang: z.enum(['en', 'es', 'fr']).default('en')
  }),
  dispatch: z.object({
    id: z.string().min(1)
  }),
  incident: z.object({
    type: z.enum(['medical', 'crowd', 'accessibility', 'security', 'sustainability']),
    location: z.enum(['Sector 101', 'Sector 205', 'Sector 315', 'Gate A Plaza', 'Transit Concourse']),
    details: z.string().min(3).max(1000).trim()
  })
};

// In-Memory Database Store
export const DB = {
  incidents: [
    {
      id: 'inc_1',
      type: 'medical',
      location: 'Sector 101',
      details: 'Elderly fan feeling lightheaded near row 12. Needs water and visual assessment.',
      severity: 'medium',
      createdAt: new Date().toISOString()
    },
    {
      id: 'inc_2',
      type: 'crowd',
      location: 'Transit Concourse',
      details: 'High bottle-neck density forming at the entry gate ramp. Need extra barrier control.',
      severity: 'high',
      createdAt: new Date().toISOString()
    }
  ],
  userBudgets: {} // IP -> request count tracking
};

/**
 * Returns dynamic fallback answers based on keyword parsing and metrics.
 * @param {string} msg - Cleansed user message query
 * @param {string} lang - Selected ISO language code
 * @returns {string} Safe reply text
 */
export function getLocalFanFallback(msg, lang) {
  const query = msg.toLowerCase();
  
  // Custom Dynamic Metrics Simulation (Rules Check & Mock Inference)
  const isElevatorQuery = query.includes('elevator') || query.includes('ascensor') || query.includes('wheelchair') || query.includes('ramp') || query.includes('access');
  const isGateQuery = query.includes('gate') || query.includes('queue') || query.includes('puerta') || query.includes('entry') || query.includes('line');
  const isTransitQuery = query.includes('transit') || query.includes('train') || query.includes('bus') || query.includes('metro') || query.includes('shuttle');

  // Compute a mock gate wait time fluctuation dynamically
  const calculatedGateA = Math.floor(Math.random() * 4) + 4; // 4-7 mins
  const calculatedGateB = Math.floor(Math.random() * 10) + 25; // 25-35 mins

  const translations = {
    en: {
      elevators: `The closest active accessibility elevator is located in the **West Concourse behind Sector 104**. *Live update:* East Elevator is down for scheduled maintenance, alternate route set to West elevator.`,
      gates: `Currently, **Gate A is recommended** with a queue wait time of approx. **${calculatedGateA} minutes**. Gate B is congested with a wait time of **${calculatedGateB} minutes**.`,
      transit: `Public transit shuttle buses depart from the **West Transit Concourse every 4 minutes** directly to Secaucus Junction. Live train shuttles are running on schedule.`,
      default: `Hello, I am Vanguard26. For the FIFA World Cup at MetLife Stadium, we recommend using **Gate A** (current wait: ~${calculatedGateA}m). For accessibility needs, please use the West Gate ramps.`
    },
    es: {
      elevators: `El ascensor de accesibilidad activo más cercano se encuentra en el **West Concourse detrás del Sector 104**. Nota: Ascensor Este temporalmente inactivo.`,
      gates: `Se recomienda la **Puerta A** (espera de **${calculatedGateA} min**). La Puerta B está congestionada (**${calculatedGateB} min** de espera).`,
      transit: `Los autobuses de transporte público salen del **West Transit Concourse cada 4 minutos** directamente a Secaucus Junction.`,
      default: `Hola, soy Vanguard26. Le sugerimos ingresar por la **Puerta A** (espera: ~${calculatedGateA}m) para evitar demoras.`
    },
    fr: {
      elevators: `L'ascenseur d'accessibilité actif le plus proche se trouve dans le **West Concourse derrière le Secteur 104**. L'ascenseur Est est en maintenance.`,
      gates: `Actuellement, la **Porte A est conseillee** (attente env. **${calculatedGateA} minutes**). Évitez la Porte B (attente de **${calculatedGateB} minutes**).`,
      transit: `Les bus navette partent du **West Transit Concourse toutes les 4 minutes** vers Secaucus Junction.`,
      default: `Bonjour, je suis Vanguard26. Pour la Coupe du Monde au MetLife Stadium, nous vous conseillons la **Porte A** (attente: ~${calculatedGateA}m).`
    }
  };

  const dict = translations[lang] || translations.en;
  if (isElevatorQuery) return dict.elevators;
  if (isGateQuery) return dict.gates;
  if (isTransitQuery) return dict.transit;
  return dict.default;
}

/**
 * Returns dynamic emergency dispatch guidelines based on incident fields.
 * @param {Object} incident - Logged incident record
 * @returns {Object} Calculated dispatch response content
 */
export function getLocalTriageFallback(incident) {
  const type = incident.type;
  const details = incident.details.toLowerCase();
  
  // Compute dynamic resource routing based on location and severity
  let severity = 'Low';
  let deploymentCount = 1;
  
  if (type === 'medical' || details.includes('chest') || details.includes('unconscious') || details.includes('breathing') || details.includes('sprain')) {
    severity = 'High';
    deploymentCount = 3;
  } else if (type === 'crowd' || details.includes('crush') || details.includes('congest') || details.includes('block') || details.includes('density')) {
    severity = 'High';
    deploymentCount = 4;
  } else if (type === 'accessibility' || details.includes('elevator') || details.includes('broken')) {
    severity = 'Medium';
    deploymentCount = 2;
  } else if (type === 'security' || details.includes('fight') || details.includes('gate crash') || details.includes('conflict')) {
    severity = 'High';
    deploymentCount = 5;
  }

  const locationSuffix = incident.location;
  
  const assessments = {
    High: `CRITICAL ACTION REQUIRED: Identified high-priority ${type} safety threat at ${locationSuffix}. Emergency protocol activated.`,
    Medium: `MODERATE WARNING: Action needed to address access or service bottleneck at ${locationSuffix}. Monitoring team engaged.`,
    Low: `ROUTINE RESPONSE: Standard logistics dispatch generated for minor incident at ${locationSuffix}.`
  };

  const instructions = {
    High: `- Immediately deploy a response team of ${deploymentCount} volunteer marshals to ${locationSuffix}.\n- Notify the Command Center supervisor and clear emergency access paths.\n- Dispatch on-site medical staff if incident type is medical.`,
    Medium: `- Send a maintenance specialist and ${deploymentCount} support staff to ${locationSuffix}.\n- Direct spectators to alternative facilities (e.g. West Concourse elevator or Gate A).`,
    Low: `- Alert closest volunteer squad (${deploymentCount} member) to monitor and clean up the reported zone.`
  };

  return {
    severity,
    analysis: assessments[severity],
    instructions: instructions[severity]
  };
}
