/**
 * Vanguard26 Main Frontend Application Controller
 * Handles UI interactions, accessibility compliance, and state updates.
 */

// Global state variables
let opsPasscode = '';
let selectedIncidentId = null;
let queueIntervalId = null;

/**
 * Initializes the application lifecycle.
 */
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupLanguageSelector();
  setupChat();
  setupOpsLock();
  setupIncidentForm();
  setupTriageFilters();
  startQueueSimulations();
});

/**
 * Sets up accessible tab switching navigation between Fan and Ops consoles.
 */
function setupTabs() {
  const tabFan = document.getElementById('tab-fan');
  const tabOps = document.getElementById('tab-ops');
  const panelFan = document.getElementById('panel-fan');
  const panelOps = document.getElementById('panel-ops');

  const switchTab = (activeTab, inactiveTab, activePanel, inactivePanel) => {
    activeTab.classList.add('active');
    activeTab.setAttribute('aria-selected', 'true');
    activeTab.setAttribute('tabindex', '0');

    inactiveTab.classList.remove('active');
    inactiveTab.setAttribute('aria-selected', 'false');
    inactiveTab.setAttribute('tabindex', '-1');

    activePanel.classList.add('active');
    activePanel.removeAttribute('aria-hidden');
    activePanel.removeAttribute('tabindex');

    inactivePanel.classList.remove('active');
    inactivePanel.setAttribute('aria-hidden', 'true');
    inactivePanel.setAttribute('tabindex', '-1');
    
    // Auto-focus panel top for keyboard navigation readability
    activePanel.focus();
  };

  tabFan.addEventListener('click', () => {
    switchTab(tabFan, tabOps, panelFan, panelOps);
  });

  tabOps.addEventListener('click', () => {
    switchTab(tabOps, tabFan, panelOps, panelFan);
  });

  // Support left/right arrow keys inside tablist
  const tabs = [tabFan, tabOps];
  tabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const nextIndex = (index === 0) ? 1 : 0;
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
      }
    });
  });
}

/**
 * Attaches the change listener to translate language settings.
 * Updates the HTML lang attribute, welcome message, and suggested prompts.
 */
function setupLanguageSelector() {
  const selector = document.getElementById('lang-selector');

  const translations = {
    en: {
      welcome: 'Welcome to MetLife Stadium! I am your Intelligent Co-Pilot for the FIFA World Cup 2026. How can I help you navigate the stadium today?',
      placeholder: 'Type your query here...',
      sendBtn: 'Send ➔',
      prompts: [
        { text: '♿ Accessible Elevators', query: 'Where is the closest accessible elevator?' },
        { text: '⏱️ Shortest Entry Gate', query: 'Which gate has the shortest queue right now?' },
        { text: '🚇 Transit Information', query: 'How do I get to public transit after the match?' }
      ],
      statusLabels: { weather: 'Weather', gateA: 'Gate A Queue', gateB: 'Gate B Queue', access: 'Accessibility Lanes', transit: 'Train Transit' }
    },
    es: {
      welcome: '¡Bienvenido al MetLife Stadium! Soy su Co-Piloto Inteligente para la Copa Mundial de la FIFA 2026. ¿Cómo puedo ayudarle a navegar por el estadio hoy?',
      placeholder: 'Escriba su consulta aquí...',
      sendBtn: 'Enviar ➔',
      prompts: [
        { text: '♿ Ascensores Accesibles', query: '¿Dónde está el ascensor accesible más cercano?' },
        { text: '⏱️ Puerta más Rápida', query: '¿Qué puerta tiene la fila más corta?' },
        { text: '🚇 Información de Transporte', query: '¿Cómo llego al transporte público después del partido?' }
      ],
      statusLabels: { weather: 'Clima', gateA: 'Cola Puerta A', gateB: 'Cola Puerta B', access: 'Accesibilidad', transit: 'Tren' }
    },
    fr: {
      welcome: 'Bienvenue au MetLife Stadium ! Je suis votre Co-Pilote Intelligent pour la Coupe du Monde de la FIFA 2026. Comment puis-je vous aider à naviguer dans le stade aujourd\'hui ?',
      placeholder: 'Tapez votre question ici...',
      sendBtn: 'Envoyer ➔',
      prompts: [
        { text: '♿ Ascenseurs Accessibles', query: 'Où se trouve l\'ascenseur accessible le plus proche ?' },
        { text: '⏱️ Porte la plus Rapide', query: 'Quelle porte a la file d\'attente la plus courte ?' },
        { text: '🚇 Informations Transport', query: 'Comment accéder aux transports en commun après le match ?' }
      ],
      statusLabels: { weather: 'Météo', gateA: 'File Porte A', gateB: 'File Porte B', access: 'Accessibilité', transit: 'Train' }
    }
  };

  selector.addEventListener('change', () => {
    const lang = selector.value;
    const t = translations[lang] || translations.en;

    // Update document language for screen readers
    document.documentElement.setAttribute('lang', lang);

    // Update chat welcome message
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'msg ai-msg';
    wrapper.innerHTML = `<div class="msg-content">${escapeHtml(t.welcome)}</div><span class="msg-time">Just now</span>`;
    messagesContainer.appendChild(wrapper);

    // Update input placeholder and send button
    document.getElementById('chat-input').placeholder = t.placeholder;
    document.querySelector('#chat-form .submit-btn').textContent = t.sendBtn;

    // Update suggested prompts
    const helperBtns = document.querySelectorAll('.helper-btn');
    t.prompts.forEach((p, i) => {
      if (helperBtns[i]) {
        helperBtns[i].textContent = p.text;
        helperBtns[i].setAttribute('data-prompt', p.query);
      }
    });

    // Update sidebar status labels
    const labels = document.querySelectorAll('.status-item .label');
    const labelKeys = ['weather', 'gateA', 'gateB', 'access', 'transit'];
    labelKeys.forEach((key, i) => {
      if (labels[i]) labels[i].textContent = t.statusLabels[key];
    });

    appendSystemMessage(`Language context updated to: ${selector.options[selector.selectedIndex].text}`);
  });
}

/**
 * Handles the Fan AI Chat assistant input, submissions, and prompt suggestions.
 */
function setupChat() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const messagesContainer = document.getElementById('chat-messages');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const queryText = input.value.trim();
    if (!queryText) return;

    // 1. Add user message to UI
    appendUserMessage(queryText);
    input.value = '';

    // 2. Trigger loading spinner
    toggleChatLoading(true);

    // 3. Perform backend API fetch
    const lang = document.getElementById('lang-selector').value;
    const response = await API.queryCoPilot(queryText, lang);

    toggleChatLoading(false);

    // 4. Append output sanitized HTML
    if (response.success) {
      const parsedText = parseMarkdown(response.data.reply);
      appendAiMessage(parsedText, true);
    } else {
      appendAiMessage(escapeHtml(response.error), false);
    }
  });

  // Suggested Prompts event handler delegation
  const helperBtns = document.querySelectorAll('.helper-btn');
  helperBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.getAttribute('data-prompt');
      form.dispatchEvent(new Event('submit'));
    });
  });
}

/**
 * Toggles the visibility state of the chat AI loading indicator.
 * @param {boolean} show - True if loading should display
 */
function toggleChatLoading(show) {
  const loader = document.getElementById('chat-loading');
  if (show) {
    loader.classList.remove('hidden');
    loader.setAttribute('aria-hidden', 'false');
  } else {
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Appends a User Message card block inside the Chat view.
 * @param {string} text - Raw input text
 */
function appendUserMessage(text) {
  const container = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg user-msg';
  
  const content = document.createElement('div');
  content.className = 'msg-content';
  content.textContent = text; // Secure text assignment
  
  const timestamp = document.createElement('span');
  timestamp.className = 'msg-time';
  timestamp.textContent = 'Just now';

  wrapper.appendChild(content);
  wrapper.appendChild(timestamp);
  container.appendChild(wrapper);
  scrollChatToBottom();
}

/**
 * Appends an AI Response card block inside the Chat view.
 * @param {string} htmlContent - Sanitized HTML string
 * @param {boolean} isHtml - True if parsing is complete
 */
function appendAiMessage(htmlContent, isHtml) {
  const container = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ai-msg';
  
  const content = document.createElement('div');
  content.className = 'msg-content';
  if (isHtml) {
    content.innerHTML = htmlContent; // Safe after sanitizeHtml parse
  } else {
    content.textContent = htmlContent;
  }
  
  const timestamp = document.createElement('span');
  timestamp.className = 'msg-time';
  timestamp.textContent = 'Just now';

  wrapper.appendChild(content);
  wrapper.appendChild(timestamp);
  container.appendChild(wrapper);
  scrollChatToBottom();
}

/**
 * Appends a generic system status update text in the chat pane.
 * @param {string} text - System update text
 */
function appendSystemMessage(text) {
  const container = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ai-msg';
  wrapper.style.opacity = '0.7';
  
  const content = document.createElement('div');
  content.className = 'msg-content';
  content.style.fontStyle = 'italic';
  content.textContent = text;
  
  wrapper.appendChild(content);
  container.appendChild(wrapper);
  scrollChatToBottom();
}

/**
 * Scrolls the chat area viewport to bottom.
 */
function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

/**
 * Handles operations passcode submission and validation.
 */
function setupOpsLock() {
  const form = document.getElementById('lock-form');
  const input = document.getElementById('lock-pin');
  const errorMsg = document.getElementById('lock-error');
  const lockScreen = document.getElementById('ops-lock-screen');
  const dashboard = document.getElementById('ops-dashboard-content');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = input.value;
    errorMsg.classList.add('hidden');

    const result = await API.verifyOpsAccess(pin);
    if (result.success && result.data.verified) {
      opsPasscode = pin;
      lockScreen.classList.add('hidden');
      dashboard.classList.remove('hidden');
      dashboard.setAttribute('aria-hidden', 'false');
      loadIncidents();
    } else {
      errorMsg.textContent = result.error || 'Incorrect Operations access PIN code. Please retry.';
      errorMsg.classList.remove('hidden');
      input.value = '';
    }
  });
}

/**
 * Handles incident form submit and reporting.
 */
function setupIncidentForm() {
  const form = document.getElementById('incident-form');
  const typeSelect = document.getElementById('inc-type');
  const locSelect = document.getElementById('inc-location');
  const detailsArea = document.getElementById('inc-details');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = typeSelect.value;
    const location = locSelect.value;
    const details = detailsArea.value.trim();

    if (!details) return;

    const res = await API.reportIncident({ type, location, details }, opsPasscode);
    if (res.success) {
      detailsArea.value = '';
      loadIncidents();
    } else {
      alert(`Incident report failure: ${res.error}`);
    }
  });
}

/**
 * Loads and renders the active incident board database metrics.
 */
async function loadIncidents() {
  const board = document.getElementById('incident-list');
  const res = await API.fetchIncidents(opsPasscode);

  if (!res.success) {
    board.innerHTML = `<div class="error-msg">${escapeHtml(res.error)}</div>`;
    return;
  }

  const incidents = res.data.incidents;
  if (incidents.length === 0) {
    board.innerHTML = '<div class="no-incidents">No active incidents reported.</div>';
    return;
  }

  board.innerHTML = '';
  incidents.forEach(inc => {
    const card = document.createElement('div');
    card.className = `incident-card ${selectedIncidentId === inc.id ? 'active-card' : ''}`;
    card.setAttribute('data-id', inc.id);
    card.setAttribute('data-severity', inc.severity);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    
    // Create inner structure
    card.innerHTML = `
      <div class="incident-header">
        <span class="incident-badge badge-${inc.severity}">${escapeHtml(inc.severity)}</span>
        <span class="incident-loc">${escapeHtml(inc.location)}</span>
      </div>
      <div class="incident-desc">${escapeHtml(inc.details)}</div>
    `;

    card.addEventListener('click', () => selectIncident(inc.id, card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectIncident(inc.id, card);
      }
    });

    board.appendChild(card);
  });
}

/**
 * Handles selecting an incident from the triage board and loading dynamic dispatch data.
 * @param {string} id - Incident ID
 * @param {HTMLElement} cardElement - Selected card node
 */
async function selectIncident(id, cardElement) {
  selectedIncidentId = id;
  
  // Highlight active card
  document.querySelectorAll('.incident-card').forEach(el => el.classList.remove('active-card'));
  cardElement.classList.add('active-card');

  // Trigger loading spinner
  const advisor = document.getElementById('dispatch-details');
  const loader = document.getElementById('dispatch-loading');
  advisor.innerHTML = '';
  loader.classList.remove('hidden');

  const res = await API.getDispatchPlan(id, opsPasscode);
  loader.classList.add('hidden');

  if (res.success) {
    const plan = res.data.plan;
    renderDispatchPlan(plan);
  } else {
    advisor.innerHTML = `<div class="error-msg">${escapeHtml(res.error)}</div>`;
  }
}

/**
 * Renders the generated AI response template structure inside the Dispatch Panel.
 * @param {Object} plan - The dispatch plan object
 */
function renderDispatchPlan(plan) {
  const container = document.getElementById('dispatch-details');
  
  // Clean markdown format
  const sanitizedAnalysis = parseMarkdown(plan.analysis);
  const sanitizedDeployment = parseMarkdown(plan.instructions);

  container.innerHTML = `
    <div class="dispatch-content">
      <div class="dispatch-header">
        <h3>AI Incident Dispatch Plan</h3>
        <div class="severity-meter">
          <span>Assessed Priority:</span>
          <span class="incident-badge badge-${plan.severity.toLowerCase()}">${escapeHtml(plan.severity)}</span>
        </div>
      </div>

      <div class="plan-section">
        <h4>Triage Assessment</h4>
        <p>${sanitizedAnalysis}</p>
      </div>

      <div class="plan-section">
        <h4>Deployment Directives</h4>
        <p>${sanitizedDeployment}</p>
      </div>

      <div class="dispatch-actions">
        <button class="sec-btn" onclick="clearDispatchSelection()">Cancel</button>
        <button class="submit-btn" onclick="executeDeploymentDirective('${escapeHtml(plan.id)}')">Deploy Dispatch Directive ➔</button>
      </div>
    </div>
  `;
}

/**
 * Clears the dispatch details frame back to empty state.
 */
window.clearDispatchSelection = function () {
  selectedIncidentId = null;
  document.querySelectorAll('.incident-card').forEach(el => el.classList.remove('active-card'));
  const container = document.getElementById('dispatch-details');
  container.innerHTML = `
    <div class="empty-state">
      <p>Select an incident from the Live Triage Board to generate automated triage classifications and resource dispatch recommendations.</p>
    </div>
  `;
};

/**
 * Simulates deployment approval step.
 * @param {string} id - Incident ID
 */
window.executeDeploymentDirective = function (id) {
  alert(`Dispatch directive executed for Incident reference: ${id}. Emergency units routed.`);
  clearDispatchSelection();
  loadIncidents();
};

/**
 * Sets up filtering controls for incident board lists.
 */
function setupTriageFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterVal = btn.getAttribute('data-filter');
      const cards = document.querySelectorAll('.incident-card');

      cards.forEach(card => {
        const severity = card.getAttribute('data-severity');
        if (filterVal === 'all' || severity === filterVal) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
}

/**
 * Starts background simulated micro-interactions on the live stats widget.
 */
function startQueueSimulations() {
  const gateA = document.getElementById('queue-gate-a');
  const gateB = document.getElementById('queue-gate-b');

  if (queueIntervalId) clearInterval(queueIntervalId);

  queueIntervalId = setInterval(() => {
    // Generate slight shifts to keep user engaged (micro-animations placeholder)
    const randomShiftA = Math.floor(Math.random() * 5) + 3; // 3 to 7
    const randomShiftB = Math.floor(Math.random() * 15) + 20; // 20 to 35
    
    if (gateA) gateA.textContent = `${randomShiftA} mins wait`;
    if (gateB) gateB.textContent = `${randomShiftB} mins wait`;
  }, 30000); // Trigger every 30 seconds
}
