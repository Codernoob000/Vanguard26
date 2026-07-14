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
      location: 'West Transit Concourse',
      details: 'High bottle-neck density forming at the entry gate ramp. Need extra barrier control.',
      severity: 'high',
      createdAt: new Date().toISOString()
    }
  ],
  userBudgets: {} // IP -> request count tracking
};

/**
 * Returns localized static fallback answers when Gemini API is unconfigured/offline.
 * @param {string} msg - Cleansed user message query
 * @param {string} lang - Selected ISO language code
 * @returns {string} Safe reply text
 */
export function getLocalFanFallback(msg, lang) {
  const query = msg.toLowerCase();
  
  const translations = {
    en: {
      elevators: "The closest active accessibility elevator is located in the **West Concourse behind Sector 104**. The East Elevator is temporarily down for service.",
      gates: "Currently, **Gate A has the shortest queue** (approx. 5 minutes wait). We recommend entering through Gate A and avoiding Gate B, which has a 35-minute line.",
      transit: "Public transit shuttle buses depart from the **West Transit Concourse every 4 minutes** directly to Secaucus Junction.",
      default: "Thank you for asking. For the FIFA World Cup 2026 at MetLife Stadium, we recommend using **Gate A** for fast entry. If you have mobility needs, our **accessibility lanes at the West Gate** are open."
    },
    es: {
      elevators: "El ascensor de accesibilidad activo más cercano se encuentra en el **West Concourse detrás del Sector 104**.",
      gates: "Actualmente, la **Puerta A tiene la fila más corta** (5 minutos de espera). Se recomienda ingresar por allí.",
      transit: "Los autobuses de transporte público salen del **West Transit Concourse cada 4 minutos**.",
      default: "Gracias por su consulta. Para la Copa Mundial de la FIFA 2026 en el MetLife Stadium, le sugerimos ingresar por la **Puerta A**."
    },
    fr: {
      elevators: "L'ascenseur d'accessibilité actif le plus proche se trouve dans le **West Concourse derrière le Secteur 104**.",
      gates: "Actuellement, la **Porte A a la file d'attente la plus courte** (environ 5 minutes).",
      transit: "Les bus navette partent du **West Transit Concourse toutes les 4 minutes**.",
      default: "Merci pour votre question. Pour la Coupe du Monde de la FIFA 2026 au MetLife Stadium, nous vous conseillons d'entrer par la **Porte A**."
    }
  };

  const dict = translations[lang] || translations.en;
  
  if (query.includes('elevator') || query.includes('ascensor') || query.includes('wheelchair') || query.includes('ramp')) {
    return dict.elevators;
  }
  if (query.includes('gate') || query.includes('queue') || query.includes('puerta') || query.includes('entry')) {
    return dict.gates;
  }
  if (query.includes('transit') || query.includes('train') || query.includes('bus') || query.includes('metro')) {
    return dict.transit;
  }
  return dict.default;
}

/**
 * Returns emergency dispatch guidelines for triage fallback.
 * @param {Object} incident - Logged incident record
 * @returns {Object} Static dispatch response content
 */
export function getLocalTriageFallback(incident) {
  const type = incident.type;
  
  if (type === 'medical') {
    return {
      severity: 'High',
      analysis: 'Potential threat to life or severe physical distress. Requires rapid medical checking to ensure spectator safety.',
      instructions: '- Dispatch nearest First-Aid volunteer team to the sector.\n- Instruct local Sector Volunteers to clear paths for emergency response.\n- Notify main medical bay behind Sector 112.'
    };
  }
  if (type === 'crowd') {
    return {
      severity: 'High',
      analysis: 'Crowd density forming a potential crush or exit barrier threat, impeding stadium traffic operations.',
      instructions: '- Deploy 4 transit volunteer marshals to implement queue guidelines.\n- Direct incoming spectator flows to alternate exit gates.\n- Monitor crowd density sensors.'
    };
  }
  if (type === 'accessibility') {
    return {
      severity: 'Medium',
      analysis: 'Barrier hindering accessible navigation for disabled spectators. Immediate routing workaround needed.',
      instructions: '- Send elevator support technician to the reported terminal.\n- Assign volunteer at the concourse to direct wheelchair users to the alternative West Concourse elevators.'
    };
  }
  return {
    severity: 'Low',
    analysis: 'Minor operations adjustment required. No immediate safety threat detected.',
    instructions: '- Notify closest volunteer squad to monitor and clean up the reported zone.'
  };
}
