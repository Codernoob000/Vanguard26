/**
 * Vanguard26 Frontend Configuration
 * Contains only public endpoints and constants.
 * Absolutely no secret keys belong here.
 */

const CONFIG = {
  API_BASE_URL: window.location.origin, // Dynamic URL routing to current domain
  DEFAULT_LANG: 'en',
  STADIUM_NAME: 'MetLife Stadium'
};

// Freeze the object to prevent runtime modification
Object.freeze(CONFIG);
