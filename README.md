# Vanguard26 — FIFA World Cup 2026 Smart Stadium Command & Fan Co-Pilot

## 🎯 Chosen Vertical
**Smart Venue Operations & Fan Experience (FIFA World Cup 2026):**
The FIFA World Cup 2026 will present unprecedented logistics challenges due to massive, diverse, and multilingual spectator volumes. Vanguard26 addresses this by unifying fan assistance and operational incident triaging into a secure, accessible, and high-performance bento interface.

---

## 📖 What It Does
Vanguard26 is an intelligent operations and spectator support platform for MetLife Stadium during the FIFA World Cup 2026. For fans, it provides a real-time, multilingual, and keyboard-navigable AI assistant that gives custom directions, line estimates, and accessibility routes. For stadium staff and volunteers, it provides a secure dashboard to log incidents, evaluate safety priorities, and generate deployment instructions.

---

## 🧠 Approach & Logic
We prioritized system performance, absolute accessibility, and high security:
1. **Security-First Architecture:** Whitelisted CORS controls, strict rate limit caps (preventing DoS and LLM budget exhaustion), and parameterized in-memory data tables.
2. **Zero-Dependency Frontend:** Avoided heavy bundlers, JavaScript frameworks, or heavy styles to keep client assets under 100KB, speeding up load times for users at high-density stadium locations.
3. **Accessibility Integration:** Explicit ARIA attributes, semantic markup, skip-links, and keyboard focus routing ensure compliance with WCAG 2.1 AA guidelines.

---

## 🤖 How Gen AI Is Used
- **Fan Smart Assistant:** Built using `llama3-8b-8192` via the Groq SDK, it merges user chat messages with real-time stadium metrics (transit shuttle frequency, wait times at gates A and B, weather) to answer complex navigation or service questions in English, Spanish, or French.
- **Incident dispatch plans:** It dynamically triages logged incidents (e.g. spectator issues, crowd blockages) to determine severity levels and suggest deployment steps for local staff and volunteers.
- **Why Groq?** Low request latency, fast token generations, excellent multilingual capabilities, and low execution overhead.
- **Secure Fallbacks:** If the API key is not set or network issues arise, the server gracefully runs localized mock rule engines so the platform remains fully functional.

---

## 🔧 How to Run Locally

### Prerequisites
- Node.js v18.0.0 or later
- A Groq API Key (Obtain from [Groq Console](https://console.groq.com/))

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vanguard26.git
   cd vanguard26
   ```
2. Install pinned dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file to add your `GROQ_API_KEY` (if left blank, the app runs in fallback mode).
4. Start the application:
   ```bash
   npm start
   ```
   Open `http://localhost:3000` in your web browser.

---

## ✅ Features
- **Intelligent Fan Chat Co-Pilot:** Real-time, multilingual responses for navigation, gates, and transit support.
- **Accessible Path Locator:** Highlights elevator paths, ramp details, and low-wait entrances for spectators with mobility needs.
- **Operations Incident Board:** Real-time report form and severity categorization dashboard.
- **AI Triage Advisor:** Generates step-by-step dispatch guidelines for venue volunteers.
- **Live Stadium Status Widgets:** Simulates micro-interaction updates for gates and queue transit.

---

## 🏗️ Architecture
The file structure is designed to keep the repository lightweight (under 10 MB total size):

```
vanguard26/
├── index.html                  # Main Web UI
├── styles/
│   ├── base.css                # Fluid variable tokens and resets
│   └── dashboard.css           # Bento cards and chat elements
├── scripts/
│   ├── app.js                  # UI controllers and accessibility setups
│   ├── api.js                  # Client fetch calls and error handling
│   ├── utils.js                # DOMPurify-based XSS parser and debouncers
│   └── config.js               # Frontend static configurations
├── tests/
│   ├── run_tests.js            # Automated backend unit & security tests
│   └── test_suite.html         # Frontend browser test page
├── server.js                   # Node Express backend routes
├── server_helpers.js           # Server schemas, DB store, and fallback engines
├── package.json                # Pinned dependencies
├── .env.example                # Sample environment template
├── .gitignore                  # Git exclusions
├── README.md                   # User documentation
├── LICENSE                     # MIT License
├── BLUEPRINT.md                # Architecture Blueprint
├── CODE_REVIEW_REPORT.md       # Quality code audit results
├── SECURITY_AUDIT.md           # Security audit compliance log
└── TEST_REPORT.md              # Test execution log
```

---

## ♿ Accessibility
- **WCAG 2.1 AA Compliance:** High color contrast ratio (>= 4.5:1), legible Outfitters font.
- **Keyboard Navigation:** Native button/anchor focus states. Focus indicator outline is always visible. Tabs navigate logically with arrow keys.
- **Skip Link:** "Skip to main content" link is the first focusable element.
- **Screen Reader Support:** Semantic layouts (`<header>`, `<main>`, `<nav>`) and associated form labels.
- **Motion Reduction:** Media queries for `prefers-reduced-motion` disable custom screen animations.

---

## 🧪 Testing
Run the automated backend and security test suite:
```bash
npm test
```
To run frontend tests, open `tests/test_suite.html` in any web browser.

- **13/13 backend tests** verify security headers, Zod schemas, auth access codes, and rate limits.
- **4/4 frontend tests** verify markdown parsing, HTML sanitization, and input debouncing.

---

## 🔒 Security
- Fully compliant with Taha Jaffri's 13-Rule Security constitution.
- **Secrets Management:** Kept in `.env` (ignored by Git). Public config is separated.
- **Rate Limiters:** Express rate limiters guard API endpoints (5/15m for auth, 10/m for AI proxy, 30/m for incident logger).
- **HTTP Security Headers:** Helmet.js enforces CSP, clickjacking checks, and MIME protections.
- **CORS Configuration:** Rejects requests outside whitelisted localhost or specified allowed origin.
- **Input Validation:** Zod schemas parse parameters server-side.
- **XSS Prevention:** Outputs are passed through client-side `sanitizeHtml` to scrub scripts before rendering.
- **LLM Safety:** System instructions prepended on the server; session budgets prevent billing spikes.

---

## ⚠️ Assumptions Made
- The deployment environment supports Node.js >= 18.0.0.
- Users access the application with a modern browser supporting CSS grid and ES6 modules.

---

## 📄 License
This project is licensed under the MIT License - see the `LICENSE` file for details.
