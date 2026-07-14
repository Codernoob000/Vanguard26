# BLUEPRINT: Vanguard26 - FIFA 2026 Intelligent Stadium Operations & Fan Co-Pilot

## 🎯 Chosen Vertical & User Personas
Vanguard26 targets the **FIFA World Cup 2026** stadium operations environment, focusing on:
1. **Stadium Venue Staff & Volunteers (Operations):** Need real-time incident reporting, crowd management tools, and instant response guidelines to handle high-stress situations.
2. **Fans (Spectators):** Need quick, accessible, and multilingual stadium navigation, transit recommendations, and facility guides.

---

## 📋 Problem ➔ Feature Mapping Table

| FIFA 2026 Problem Area | Vanguard26 Feature | Implemented Logic / AI Integration |
| :--- | :--- | :--- |
| **Crowd Management & Real-time Triage** | Command Control Bento Dashboard | Staff submit incident reports. AI automatically analyzes, sets severity, and drafts emergency dispatch instructions. |
| **Navigation & Wayfinding** | Fan Interactive Wayfinder | Simulated real-time sensor queue times combined with contextual navigation assistance. |
| **Accessibility (WCAG 2.1 AA)** | Accessibility Path Locator | AI isolates wheelchair-friendly entries, ramps, elevators, and low-traffic lanes for users reporting mobility needs. |
| **Multilingual Support** | Multi-lingual Co-Pilot | AI supports dynamic real-time translations for English, Spanish, French, and other tournament languages. |

---

## 🧠 Gen AI Feature: Stadium Co-Pilot & Dispatch Triage
- **Fan Co-Pilot:** Implemented using `llama3-8b-8192` model via Groq's SDK. It takes user input, combines it with real-time simulated stadium stats (queue levels, weather warnings, transit status), and serves a highly personalized context-aware response.
- **Incident Dispatch Planner (Staff):** Classifies dynamic incidents (e.g., medical event at Sector 104, ticket gate block) and drafts a volunteer deployment order immediately.
- **Why Groq?** Low latency, fast token speed, high-speed multilingual comprehension, and low pricing constraints.

---

## 🔧 Tech Stack Selection & Justifications

- **Frontend:** Semantic HTML5, Custom CSS Variables, Vanilla JS.
  - *Justification:* Extremely lightweight (< 100KB total), fast load time (Efficiency 100%), no bundlers/transpilers (reduces complexity and potential vulnerability surface), fully compliant with vanilla layout controls.
- **Backend:** Node.js + Express.
  - *Justification:* Standard enterprise API design. Easily handles custom security middleware.
- **Zod Schema Validator:**
  - *Justification:* Guarantees strict input parsing before operations reach databases or the LLM (Rule 3).
- **Helmet.js & Cors:**
  - *Justification:* Mitigates XSS, clickjacking, and origin sniffing via HTTP headers (Rules 6 & 7).
- **Express Rate Limit:**
  - *Justification:* Defends endpoints against DDoS and brute force costs (Rule 2).

---

## 📁 Repository Structure

```
PW4/
├── index.html                  # Main Web UI
├── styles/
│   └── main.css                # Visual aesthetics and bento layouts
├── scripts/
│   ├── app.js                  # Frontend controllers and tab actions
│   ├── api.js                  # Safe client fetch interfaces
│   ├── utils.js                # DOMPurify-based XSS sanitizers
│   └── config.js               # Frontend config placeholder
├── tests/
│   ├── run_tests.js            # Automated backend unit & security tests
│   └── test_suite.html         # Frontend browser test harness
├── server.js                   # Node Express backend
├── package.json                # Locked versions of npm packages
├── .env.example                # Sample environment template
├── .gitignore                  # Exclusion file
├── README.md                   # Tournament and app documentation
├── LICENSE                     # MIT License
└── BLUEPRINT.md                # System Architect and Threat Model
```

---

## 🔐 Security Threat Model (Rule 1-13)

### 1. Input Surfaces & Protection (Rules 3 & 8)
- **Fan Chat Field:** Protected by a backend Zod schema constraining input length to 500 characters. Cleaned using regular expression trims. All output rendered in HTML is sanitized using DOMPurify patterns on the frontend.
- **Staff Incident Form:** Text areas limited to 1000 characters. Zod validation ensures valid enums for location sectors and report types.
- **SQL / Database:** We use a safe, parameterized in-memory mock repository layer. No raw string evaluation.

### 2. Secrets Management (Rule 1)
- `GROQ_API_KEY` and server port environment variables live in `.env`.
- `.env` is explicitly added to `.gitignore`.
- Only public frontend configurations (like API endpoints) are stored in `scripts/config.js` with placeholders.

### 3. Authentication & Authorization (Rule 4)
- Given the lightweight design for stadium volunteers/fans at the venue, a secure session-based staff passcode verification will protect the operations page. Passcode hashing is handled via standard Node.js crypto functions.

### 4. Rate Limiting Plan (Rule 2)
- `/api/co-pilot` (LLM Proxy): Max 10 requests per minute per IP.
- `/api/incidents` (Data input): Max 30 requests per minute per IP.
- Global routes: Max 60 requests per minute per IP.

### 5. CORS Plan (Rule 6)
- Standard Express CORS middleware configured to reject requests not matching `process.env.ALLOWED_ORIGIN`. Defaults to `http://localhost:3000` locally.

### 6. LLM Security (Rule 13)
- No client-side LLM calls.
- Strict `max_tokens` set to 500.
- System prompt prepended in the backend (acting as an isolation barrier so fans cannot override the system instructions to get the AI to talk about unrelated topics).
- Budget limits: Max 50 API calls per session per hour.

---

## ♿ Accessibility Plan (WCAG 2.1 AA)
- **Tab Layout:** Use `role="tablist"`, `role="tab"`, and `aria-selected` attributes. Focus transitions logically.
- **Contrast:** High contrast layout using a sleek navy and gold design palette (minimum contrast 4.8:1).
- **Labels:** Every form control (Incident type, sector selection, text area) utilizes standard `<label for="...">`.
- **Keyboard Navigation:** Support tab cycling. The modal overlays listen for the `Escape` key to close.

---

## ⚠️ Assumptions & Size Checks
- **Assumptions:** It is assumed the user has a modern web browser supporting ES6 modules and grid layouts.
- **Size Verification:** The total size of the project files will be < 500KB (excluding `node_modules` which will be excluded in `.gitignore`). This safely satisfies the < 10 MB constraint.
