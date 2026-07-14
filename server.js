import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import compression from 'compression';
import { schemas, DB, getLocalFanFallback, getLocalTriageFallback } from './server_helpers.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const OPS_PIN = process.env.OPS_PIN || '2026';

// Bind compression immediately
app.use(compression());

// Initialize Groq Client safely
let aiClient = null;
if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
  try {
    aiClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log("🏆 Groq Client successfully initialized.");
  } catch (err) {
    console.error("❌ Failed to initialize Groq Client:", err.message || err);
  }
} else {
  console.log("⚠️ Groq API key missing or unconfigured. Operating in fallback mode.");
}

/* ==========================================
   SECURITY RULES & MIDDLEWARE CONFIGURATION
   ========================================== */

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "connect-src": ["'self'"],
      "img-src": ["'self'", "data:"],
      "frame-ancestors": ["'none'"]
    }
  },
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(express.json());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === ALLOWED_ORIGIN || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by security CORS policy'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// Distribute static files with robust production cache control headers
app.use(express.static('.', {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  }
}));

/* ==========================================
   RATE LIMITERS (Rule 2)
   ========================================== */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many queries submitted. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

const incidentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many incidents logged. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

/* ==========================================
   ACCESS SECURITY GATE (Rule 4 Security Check)
   ========================================== */

const verifyOperationsHeader = (req, res, next) => {
  const pin = req.headers['x-ops-pin'];
  if (!pin || pin !== OPS_PIN) {
    return res.status(403).json({ error: 'Unauthorized access to Operations console.' });
  }
  next();
};

/* ==========================================
   MODULAR CONTROLLERS & ENDPOINTS
   ========================================== */

/**
 * Express handler to verify the operations PIN code.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 */
export function handleVerifyPin(req, res) {
  try {
    const parsed = schemas.verifyPin.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input payload.' });
    }
    const { pin } = parsed.data;
    if (pin === OPS_PIN) {
      return res.json({ verified: true });
    }
    return res.status(401).json({ verified: false, error: 'Invalid passcode.' });
  } catch (err) {
    console.error("❌ Failed to verify pin:", err.message || err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}

/**
 * Express handler to retrieve the list of logged incidents.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 */
export function handleGetIncidents(req, res) {
  try {
    const incidents = [...DB.incidents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ incidents });
  } catch (err) {
    console.error("❌ Failed to fetch incidents:", err.message || err);
    return res.status(500).json({ error: 'Failed to retrieve incidents.' });
  }
}

/**
 * Cleans user observation details string input.
 * @param {string} rawDetails - Raw detail text input
 * @returns {string} Cleaned details
 */
export function cleanIncidentDetails(rawDetails) {
  return rawDetails.replace(/[<>]/g, '');
}

/**
 * Computes incident severity based on text markers.
 * @param {string} type - Incident type
 * @param {string} details - Cleaned details text
 * @returns {string} Calculated severity
 */
export function computeSeverity(type, details) {
  const lowerDetails = details.toLowerCase();
  if (type === 'security' || type === 'medical' || lowerDetails.includes('unconscious') || lowerDetails.includes('blocked') || lowerDetails.includes('danger')) {
    return 'high';
  }
  if (lowerDetails.includes('broken') || lowerDetails.includes('help') || lowerDetails.includes('elevator')) {
    return 'medium';
  }
  return 'low';
}

/**
 * Express handler to log a new stadium incident.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 */
export function handleCreateIncident(req, res) {
  try {
    const parsed = schemas.incident.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid incident details provided.' });
    }
    const { type, location, details } = parsed.data;
    const cleanDetails = cleanIncidentDetails(details);
    const severity = computeSeverity(type, cleanDetails);
    const newIncident = {
      id: `inc_${Date.now()}`,
      type,
      location,
      details: cleanDetails,
      severity,
      createdAt: new Date().toISOString()
    };
    DB.incidents.push(newIncident);
    return res.status(201).json({ success: true, incident: newIncident });
  } catch (err) {
    console.error("❌ Failed to log incident:", err.message || err);
    return res.status(500).json({ error: 'Failed to record incident.' });
  }
}

/**
 * Cleanses user co-pilot chat query messages.
 * @param {string} text - Raw query text
 * @returns {string} Filtered query text
 */
export function cleanChatQuery(text) {
  return text.replace(/(system|prompt|override|ignore previous)/gi, '[filtered]');
}

/**
 * Checks and increments the hourly AI query budget limit for a specific IP.
 * @param {string} ip - The requester IP address
 * @returns {boolean} True if budget is safe, false if exceeded
 */
export function checkUserAiBudget(ip) {
  DB.userBudgets[ip] = (DB.userBudgets[ip] || 0) + 1;
  return DB.userBudgets[ip] <= 50;
}

/**
 * Builds stadium facilities dynamic context.
 * @param {string} lang - Language setting
 * @returns {string} Formatted context
 */
export function buildStadiumContext(lang) {
  return `
    Current Stadium: MetLife Stadium (New York New Jersey Stadium)
    Match Day: FIFA World Cup 2026 Group Stage
    Language setting: ${lang}
    Live Sensors & Facilities Info:
    - Sector 101/102: Access ramp open.
    - Gate A: 5 mins line wait time (Recommended Entry).
    - Gate B: 35 mins wait time (Congested).
    - Accessibility elevators: West Side fully active, East Elevator undergoing routine maintenance (use West elevator).
    - Transit Shuttle: Arriving every 4 minutes.
    - First Aid Stations: Located behind Sectors 112 and 322.
  `;
}

/**
 * Builds co-pilot system prompts instructions.
 * @param {string} lang - Selected ISO language
 * @returns {string} Prompts content
 */
export function buildSystemInstructions(lang) {
  return `
    You are Vanguard26, the official FIFA 2026 Smart Stadium Fan Co-Pilot.
    Your job is to assist spectators at the stadium with questions about entry gates, public transit, lines, facilities, translations, and accessibility routes.
    Guidelines:
    - Answer in the selected language: ${lang}.
    - Rely ONLY on the provided Live Sensors & Facilities Info.
    - Keep answers short, direct, and welcoming (max 4-5 sentences).
    - Use standard Markdown (*italic*, **bold**, lists).
    - If a fan asks about accessibility, prioritize ramps, elevators, and low-wait gates.
    - Refuse to answer non-stadium/non-FIFA operations questions.
  `;
}

/**
 * Fetches AI chat response from Groq or triggers local fallback.
 * @param {string} cleanMsg - Cleaned user message query
 * @param {string} lang - Selected ISO language code
 * @param {string} stadiumContext - Live facility context
 * @param {string} systemInstructions - LLM Instructions
 * @returns {Promise<string>} Chat response
 */
export async function fetchAiReply(cleanMsg, lang, stadiumContext, systemInstructions) {
  if (aiClient) {
    try {
      const chatCompletion = await aiClient.chat.completions.create({
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: `Context:\n${stadiumContext}\n\nUser Query: ${cleanMsg}` }
        ],
        model: 'llama-3.1-8b-instant',
        max_tokens: 500,
        temperature: 0.3
      });
      return chatCompletion.choices[0].message.content;
    } catch (err) {
      console.error("❌ Groq Co-Pilot Completion Call Failed. Triggering local fallback. Error:", err.message || err);
      return getLocalFanFallback(cleanMsg, lang);
    }
  }
  console.log("ℹ️ Operating Co-Pilot in local fallback mode (Groq client unconfigured).");
  return getLocalFanFallback(cleanMsg, lang);
}

/**
 * Express handler to chat with the AI Fan Co-Pilot.
 * @param {express.Request} req - The Express request
 * @param {express.Response} res - The Express response
 */
export async function handleCoPilotChat(req, res) {
  try {
    const parsed = schemas.coPilot.parse(req.body);
    const { message, lang } = parsed;
    if (!checkUserAiBudget(req.ip)) {
      return res.status(429).json({ error: 'Hourly AI budget limit reached for your session.' });
    }
    const cleanMsg = cleanChatQuery(message);
    const stadiumContext = buildStadiumContext(lang);
    const systemInstructions = buildSystemInstructions(lang);
    const aiReply = await fetchAiReply(cleanMsg, lang, stadiumContext, systemInstructions);
    const sanitizedReply = aiReply.replace(/[<>]/g, '');
    return res.json({ reply: sanitizedReply });
  } catch (err) {
    console.error("❌ Failed to process co-pilot request handler:", err.message || err);
    return res.status(400).json({ error: 'Failed to process chat query.' });
  }
}

/**
 * Fetches triage dispatch assessment from Groq or triggers local fallback.
 * @param {Object} incident - Stadium incident object
 * @returns {Promise<Object>} Completed triage results
 */
export async function fetchTriageAnalysis(incident) {
  if (aiClient) {
    try {
      const prompt = `
        You are the Vanguard26 Operations Triage Advisor. Analyze this reported stadium incident:
        Incident Type: ${incident.type}
        Location: ${incident.location}
        Details: ${incident.details}
        Provide your analysis. You must output a valid JSON object matching this structure:
        {
          "severity": "Low" | "Medium" | "High",
          "analysis": "Provide a brief 1-2 sentence safety assessment.",
          "instructions": "Provide actionable, bullet-pointed instructions for dispatching stadium staff or volunteer marshals."
        }
        Return ONLY this raw JSON object. Do not wrap in markdown or backticks.
      `;
      const chatCompletion = await aiClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        max_tokens: 400,
        temperature: 0.2
      });
      return JSON.parse(chatCompletion.choices[0].message.content.trim());
    } catch (err) {
      console.error("❌ Groq Dispatch completion failure. Triggering local fallback triage. Error:", err.message || err);
      return getLocalTriageFallback(incident);
    }
  }
  console.log("ℹ️ Operating Triage Advisor in local fallback mode.");
  return getLocalTriageFallback(incident);
}

/**
 * Express handler to request triage planning for an incident.
 * @param {express.Request} req - Express request
 * @param {express.Response} res - Express response
 */
export async function handleIncidentDispatch(req, res) {
  try {
    const parsed = schemas.dispatch.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid incident ID.' });
    }
    const incident = DB.incidents.find(i => i.id === parsed.data.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }
    const triageResult = await fetchTriageAnalysis(incident);
    return res.json({
      plan: {
        id: incident.id,
        severity: triageResult.severity || incident.severity,
        analysis: triageResult.analysis || 'Standard incident recorded.',
        instructions: triageResult.instructions || '- Dispatch closest volunteer team for crowd checks.'
      }
    });
  } catch (err) {
    console.error("❌ Failed to process dispatch handler:", err.message || err);
    return res.status(500).json({ error: 'Failed to process triage dispatch planning.' });
  }
}

app.post('/api/verify-pin', authLimiter, handleVerifyPin);
app.get('/api/incidents', verifyOperationsHeader, handleGetIncidents);
app.post('/api/incidents', verifyOperationsHeader, incidentLimiter, handleCreateIncident);
app.post('/api/co-pilot', llmLimiter, handleCoPilotChat);
app.post('/api/dispatch', verifyOperationsHeader, handleIncidentDispatch);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🏆 VANGUARD26 CORE KERNEL ONLINE`);
  console.log(`🔒 Security Matrix: Helmet CSP & CORS Bound`);
  console.log(`⚡ Inference: Groq SDK Llama3 Pipeline Primed`);
  console.log(`🌐 Live Link: Operating securely on port ${PORT}`);
  console.log(`=================================================`);
});

export default app;
