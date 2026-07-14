/**
 * Vanguard26 Automated Security & API Test Runner
 * Zero-dependency Node.js test script using built-in assert and http modules.
 */

import http from 'http';
import assert from 'assert';
import serverApp from '../server.js';

const TEST_PORT = 3001;
let serverInstance;

/**
 * Helper to make HTTP requests during tests.
 */
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const requestHeaders = { ...headers };

    if (body) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: requestHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let bodyParsed = null;
        if (data) {
          try {
            bodyParsed = JSON.parse(data);
          } catch (e) {
            bodyParsed = data;
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyParsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

// Keep track of test success counts
const results = {
  total: 0,
  passed: 0,
  failed: []
};

/**
 * Runs a single test case block.
 */
async function runTest(name, fn) {
  results.total++;
  try {
    await fn();
    results.passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    results.failed.push({ name, error: err.message });
  }
}

/**
 * Main test suite execution
 */
async function runAllTests() {
  console.log('\n================================================');
  console.log('STARTING VANGUARD26 BACKEND & SECURITY TEST SUITE');
  console.log('================================================\n');

  // Start the server
  serverInstance = serverApp.listen(TEST_PORT, async () => {
    try {
      // 1. HTTP Security Headers Tests (Rule 7)
      await runTest('Security Headers: Helmet policies present', async () => {
        const res = await makeRequest('GET', '/');
        assert.ok(res.headers['content-security-policy'], 'CSP should be set');
        assert.strictEqual(res.headers['x-frame-options'], 'DENY', 'Clickjacking header check failed');
        assert.strictEqual(res.headers['x-content-type-options'], 'nosniff', 'MIME sniffing header check failed');
        assert.ok(!res.headers['x-powered-by'], 'Powered-by header should be hidden');
      });

      // 2. Auth Access Validation (Rule 4)
      await runTest('Auth Check: Endpoint verification rejects empty PIN', async () => {
        const res = await makeRequest('POST', '/api/verify-pin', {});
        assert.strictEqual(res.statusCode, 400, 'Expected Bad Request status');
      });

      await runTest('Auth Check: Verify correct default PIN', async () => {
        const res = await makeRequest('POST', '/api/verify-pin', { pin: '2026' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.verified, true);
      });

      await runTest('Auth Check: Verify invalid PIN rejects', async () => {
        const res = await makeRequest('POST', '/api/verify-pin', { pin: '9999' });
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.verified, false);
      });

      // 3. Endpoint Zod Validation (Rule 3)
      await runTest('Validation Check: Co-pilot rejects empty message body', async () => {
        const res = await makeRequest('POST', '/api/co-pilot', { message: '', lang: 'en' });
        assert.strictEqual(res.statusCode, 400, 'Rejects zero-length strings');
      });

      await runTest('Validation Check: Co-pilot rejects unsupported language codes', async () => {
        const res = await makeRequest('POST', '/api/co-pilot', { message: 'Hello', lang: 'de' });
        assert.strictEqual(res.statusCode, 400, 'German not listed in schema enums');
      });

      await runTest('Validation Check: Co-pilot allows English requests', async () => {
        const res = await makeRequest('POST', '/api/co-pilot', { message: 'How to enter MetLife?', lang: 'en' });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.reply, 'Should return fallback response reply');
      });

      // 4. Operations console security checks (Rule 4 Authorization Checks)
      await runTest('Authorization Check: Fetching incidents without pin header fails', async () => {
        const res = await makeRequest('GET', '/api/incidents');
        assert.strictEqual(res.statusCode, 403, 'Should restrict unauthorized access');
      });

      await runTest('Authorization Check: Fetching incidents with valid PIN header succeeds', async () => {
        const res = await makeRequest('GET', '/api/incidents', null, { 'X-Ops-Pin': '2026' });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(Array.isArray(res.body.incidents));
      });

      // 5. Incident Reporting Zod schema constraints (Rule 3)
      await runTest('Incident Validation: Fails on invalid sector locations', async () => {
        const res = await makeRequest('POST', '/api/incidents', {
          type: 'medical',
          location: 'Invalid Sector 999',
          details: 'Spectator heat issue.'
        }, { 'X-Ops-Pin': '2026' });
        assert.strictEqual(res.statusCode, 400, 'Should reject invalid sector values');
      });

      await runTest('Incident Validation: Fails on invalid incident types', async () => {
        const res = await makeRequest('POST', '/api/incidents', {
          type: 'fire',
          location: 'Sector 101',
          details: 'Fire safety check.'
        }, { 'X-Ops-Pin': '2026' });
        assert.strictEqual(res.statusCode, 400, 'Type "fire" is not in schema enum list');
      });

      await runTest('Incident Validation: Succeeds with correct payload schema', async () => {
        const res = await makeRequest('POST', '/api/incidents', {
          type: 'medical',
          location: 'Sector 101',
          details: 'Volunteer team requested for minor ankle sprain.'
        }, { 'X-Ops-Pin': '2026' });
        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.incident.severity, 'high', 'Sprain alert sets elevated medical severity');
      });

      // 6. Rate Limiting verification (Rule 2)
      await runTest('Rate Limiting: Verify LLM endpoint blocks at limit threshold', async () => {
        // Trigger rapid parallel calls
        const requests = [];
        for (let i = 0; i < 15; i++) {
          requests.push(makeRequest('POST', '/api/co-pilot', { message: 'Line wait?', lang: 'en' }));
        }
        const responses = await Promise.all(requests);
        const rateLimitedCount = responses.filter(r => r.statusCode === 429).length;
        assert.ok(rateLimitedCount > 0, 'At least some rapid queries must hit 429 code');
      });

    } catch (err) {
      console.error('Fatal execution error: ', err);
    } finally {
      // Shutdown test server
      serverInstance.close(() => {
        console.log('\n================================================');
        console.log(`TEST RUN SUMMARY: Passed ${results.passed}/${results.total}`);
        console.log('================================================\n');
        
        if (results.failed.length > 0) {
          process.exit(1);
        } else {
          process.exit(0);
        }
      });
    }
  });
}

runAllTests();
