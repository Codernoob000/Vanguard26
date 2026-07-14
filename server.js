import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { schemas, DB, getLocalFanFallback, getLocalTriageFallback } from './server_helpers.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const OPS_PIN = process.env.OPS_PIN || '2026';

// Initialize Groq Client safely
let aiClient = null;
if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
  try {
    aiClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log("🏆 Groq Client successfully initialized.");
  } catch (err) {
    console.error("❌ Failed to initialize Groq Client:", err);
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

app.use(express.static('.'));

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
   API ENDPOINTS
   ========================================== */

app.post('/api/verify-pin', authLimiter, (req, res) => {
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
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get('/api/incidents', verifyOperationsHeader, (req, res) => {
  try {
    const incidents = [...DB.incidents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ incidents });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve incidents.' });
  }
});

app.post('/api/incidents', verifyOperationsHeader, incidentLimiter, (req, res) => {
  try {
    const parsed = schemas.incident.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid incident details provided.' });
    }

    const { type, location, details } = parsed.data;
    const cleanDetails = details.replace(/[<>]/g, '');

    let severity = 'low';
    const lowerDetails = cleanDetails.toLowerCase();
    if (type === 'security' || type === 'medical' || lowerDetails.includes('unconscious') || lowerDetails.includes('blocked') || lowerDetails.includes('danger')) {
      severity = 'high';
    } else if (lowerDetails.includes('broken') || lowerDetails.includes('help') || lowerDetails.includes('elevator')) {
      severity = 'medium';
    }

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
    return res.status(500).json({ error: 'Failed to record incident.' });
  }
});

app.post('/api/co-pilot', llmLimiter, async (req, res) => {
  try {
    const parsed = schemas.coPilot.parse(req.body);
    const { message, lang } = parsed;

    const ip = req.ip;
    DB.userBudgets[ip] = (DB.userBudgets[ip] || 0) + 1;
    if (DB.userBudgets[ip] > 50) {
      return res.status(429).json({ error: 'Hourly AI budget limit reached for your session.' });
    }

    const cleanMsg = message.replace(/(system|prompt|override|ignore previous)/gi, '[filtered]');

    const stadiumContext = `
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

    const systemInstructions = `
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

    let aiReply = '';
    
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
        aiReply = chatCompletion.choices[0].message.content;
      } catch (err) {
        console.error("❌ Groq Co-Pilot Completion Call Failed. Triggering local fallback. Error:", err.message || err);
        aiReply = getLocalFanFallback(cleanMsg, lang);
      }
    } else {
      console.log("ℹ️ Operating Co-Pilot in local fallback mode (Groq client unconfigured).");
      aiReply = getLocalFanFallback(cleanMsg, lang);
    }

    const sanitizedReply = aiReply.replace(/[<>]/g, '');
    return res.json({ reply: sanitizedReply });
  } catch (err) {
    console.error("❌ Failed to process co-pilot request handler:", err.message || err);
    return res.status(400).json({ error: 'Failed to process chat query.' });
  }
});

app.post('/api/dispatch', verifyOperationsHeader, async (req, res) => {
  try {
    const parsed = schemas.dispatch.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid incident ID.' });
    }

    const incident = DB.incidents.find(i => i.id === parsed.data.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    let triageResult = null;

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
          messages: [
            { role: 'user', content: prompt }
          ],
          model: 'llama-3.1-8b-instant',
          max_tokens: 400,
          temperature: 0.2
        });

        const rawText = chatCompletion.choices[0].message.content.trim();
        triageResult = JSON.parse(rawText);
      } catch (err) {
        console.error("❌ Groq Dispatch completion failure. Triggering local fallback triage. Error:", err.message || err);
        triageResult = getLocalTriageFallback(incident);
      }
    } else {
      console.log("ℹ️ Operating Triage Advisor in local fallback mode.");
      triageResult = getLocalTriageFallback(incident);
    }

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
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🏆 VANGUARD26 CORE KERNEL ONLINE`);
  console.log(`🔒 Security Matrix: Helmet CSP & CORS Bound`);
  console.log(`⚡ Inference: Groq SDK Llama3 Pipeline Primed`);
  console.log(`🌐 Live Link: Operating securely on port ${PORT}`);
  console.log(`=================================================`);
});

export default app;
