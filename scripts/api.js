/**
 * Vanguard26 API Client Wrapper
 * Handles network calls, rate limit feedback, and safe responses.
 */

const API = {
  /**
   * Helper method to perform a POST request.
   * @param {string} endpoint - API path (relative to BASE_URL)
   * @param {Object} data - Request body object
   * @param {string} [passcode] - Optional authorization header passcode
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data, passcode = '') {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (passcode) {
      headers['X-Ops-Pin'] = passcode;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      // Handle HTTP status code cases
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        return {
          success: false,
          error: `Too many requests. Please try again in ${retryAfter} seconds.`
        };
      }

      const result = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'A network error occurred. Please verify your entries.'
        };
      }

      return {
        success: true,
        data: result
      };
    } catch (err) {
      return {
        success: false,
        error: 'Unable to connect to operations server. Please check your internet connection.'
      };
    }
  },

  /**
   * Helper method to perform a GET request.
   * @param {string} endpoint - API path
   * @param {string} [passcode] - Optional authorization pin
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, passcode = '') {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const headers = {};
    if (passcode) {
      headers['X-Ops-Pin'] = passcode;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (response.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait a moment.'
        };
      }

      const result = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve records.'
        };
      }

      return {
        success: true,
        data: result
      };
    } catch (err) {
      return {
        success: false,
        error: 'Unable to connect to operations server.'
      };
    }
  },

  /**
   * Sends a message to the AI Fan Co-Pilot proxy.
   * @param {string} message - User message
   * @param {string} lang - ISO language code
   * @returns {Promise<Object>} AI response content
   */
  async queryCoPilot(message, lang) {
    return this.post('/api/co-pilot', { message, lang });
  },

  /**
   * Submits a newly reported incident.
   * @param {Object} incident - Incident fields
   * @param {string} passcode - Authentication pin
   * @returns {Promise<Object>} Submission outcome
   */
  async reportIncident(incident, passcode) {
    return this.post('/api/incidents', incident, passcode);
  },

  /**
   * Fetches all active incidents.
   * @param {string} passcode - Authentication pin
   * @returns {Promise<Object>} Incident list
   */
  async fetchIncidents(passcode) {
    return this.get('/api/incidents', passcode);
  },

  /**
   * Generates AI volunteer dispatch guidelines for an incident.
   * @param {string} incidentId - Target incident ID
   * @param {string} passcode - Authentication pin
   * @returns {Promise<Object>} AI generated plan
   */
  async getDispatchPlan(incidentId, passcode) {
    return this.post('/api/dispatch', { id: incidentId }, passcode);
  },

  /**
   * Validates if the operations console passcode is correct.
   * @param {string} pin - Access code
   * @returns {Promise<Object>} Lock validation result
   */
  async verifyOpsAccess(pin) {
    return this.post('/api/verify-pin', { pin });
  }
};

// Freeze the object
Object.freeze(API);
