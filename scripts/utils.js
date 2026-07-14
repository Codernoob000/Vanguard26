/**
 * Vanguard26 Shared Utilities & Sanitization
 */

/**
 * Escapes characters to prevent basic HTML injection.
 * @param {string} str - Raw string to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes an HTML string to only allow safe formatting tags.
 * Effectively a micro DOMPurify implementation.
 * @param {string} html - Raw HTML string to sanitize
 * @returns {string} Sanitized safe HTML
 */
function sanitizeHtml(html) {
  if (!html) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // List of tags we explicitly allow for LLM markdown outputs
  const allowedTags = ['P', 'STRONG', 'EM', 'B', 'I', 'UL', 'OL', 'LI', 'BR', 'CODE', 'PRE'];
  
  /**
   * Recursively filters nodes to keep only allowed elements and clean attributes.
   * @param {Node} node - The DOM node to clean
   */
  const clean = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.includes(child.tagName)) {
          // Replace tag with its text content to avoid injection
          const textNode = doc.createTextNode(child.textContent);
          node.replaceChild(textNode, child);
        } else {
          // Remove all attributes to prevent onload/onerror XSS payloads
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            child.removeAttribute(attr.name);
          }
          clean(child);
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        // Safe text node
      } else {
        // Remove comments or other node types
        node.removeChild(child);
      }
    }
  };
  
  clean(doc.body);
  return doc.body.innerHTML;
}

/**
 * Super simple markdown parser supporting bold, italics, lists, and linebreaks.
 * Safely parses markdown into safe HTML tags.
 * @param {string} markdown - Raw markdown text
 * @returns {string} Sanitized HTML string
 */
function parseMarkdown(markdown) {
  if (!markdown) return '';
  
  // 1. Escape the incoming string to prevent structural HTML bypasses
  let text = escapeHtml(markdown);
  
  // 2. Convert markdown syntax to safe HTML placeholders
  // Bold: **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italics: *text*
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Bullet lists: * item or - item (multiline block)
  // Process line by line
  const lines = text.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      let prefix = '';
      if (!inList) {
        inList = true;
        prefix = '<ul>';
      }
      return prefix + '<li>' + content + '</li>';
    } else {
      let suffix = '';
      if (inList) {
        inList = false;
        suffix = '</ul>';
      }
      return suffix + (trimmed ? `<p>${trimmed}</p>` : '');
    }
  });
  
  if (inList) {
    processedLines.push('</ul>');
  }
  
  text = processedLines.join('');
  
  // 3. Final sanitization block to enforce safety constraints
  return sanitizeHtml(text);
}

/**
 * Dynamic input debouncer function to prevent API thrashing.
 * @param {Function} func - Target function
 * @param {number} delay - Throttle wait millisecond
 * @returns {Function} Debounced function
 */
function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}
