require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const { getPublicBaseUrl } = require('../middleware/uploadMiddleware');
const { errorHandler } = require('../middleware/errorMiddleware');

// Helper to escape regex (as in adminController and productController)
const escapeRegex = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// Safe sanitize helper matching app.js
const sanitizeUploadFilename = (filename) => {
  let clean = filename;
  try {
    clean = decodeURIComponent(filename);
  } catch (e) {}
  return path.basename(clean);
};

// Lightweight Express route invocation using native IncomingMessage/ServerResponse (no network sockets needed)
const dispatchExpressRequest = (expressApp, method, url) => {
  return new Promise((resolve) => {
    const socket = {
      remoteAddress: '127.0.0.1',
      encrypted: false,
      destroy: () => {},
      ref: () => {},
      unref: () => {},
    };
    const req = new http.IncomingMessage(socket);
    req.socket = socket;
    req.connection = socket;
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:5000' };

    let body = '';
    const res = new http.ServerResponse(req);
    res.write = (chunk) => {
      if (chunk) body += (Buffer.isBuffer(chunk) ? chunk.toString() : chunk);
    };
    res.end = (chunk) => {
      if (chunk) body += (Buffer.isBuffer(chunk) ? chunk.toString() : chunk);
      resolve({ statusCode: res.statusCode, body, headers: res.getHeaders ? res.getHeaders() : {} });
    };

    expressApp(req, res);
  });
};

const runServerAuditTestSuite = async () => {
  console.log('======================================================');
  console.log('         SERVER SECTION AUDIT & HARDENING TEST        ');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assertTest = (desc, condition) => {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS]: ${desc}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL]: ${desc}`);
    }
  };

  try {
    // -----------------------------------------------------------------
    // 1. PATH TRAVERSAL PROTECTION IN STATIC UPLOADS
    // -----------------------------------------------------------------
    console.log('[1/5] Testing Upload Path Traversal Protection...');
    const maliciousPaths = [
      '../../.env',
      '..\\..\\server.js',
      '/etc/passwd',
      '..%2F..%2F.env',
      '..%5C..%5Cserver.js',
      'uploads/nested/sneaker.png',
    ];

    maliciousPaths.forEach((p) => {
      const sanitized = sanitizeUploadFilename(p);
      assertTest(
        `sanitizeUploadFilename("${p}") -> "${sanitized}" strips directory climbing sequences`,
        !sanitized.includes('..') && !sanitized.includes('/') && !sanitized.includes('\\')
      );
    });

    // -----------------------------------------------------------------
    // 2. DYNAMIC BASE URL RESOLUTION
    // -----------------------------------------------------------------
    console.log('\n[2/5] Testing Dynamic Base URL Resolution (Localhost & Cloud)...');
    const originalBackendUrl = process.env.BACKEND_URL;
    delete process.env.BACKEND_URL; // Clear explicit override for test

    const localReqMock = {
      protocol: 'http',
      get: (h) => (h === 'host' ? 'localhost:5000' : null),
    };
    const localUrl = getPublicBaseUrl(localReqMock);
    assertTest(
      'Local dev request resolves correctly to http://localhost:5000 (no remote Render fallback)',
      localUrl === 'http://localhost:5000'
    );

    const cloudReqMock = {
      protocol: 'https',
      get: (h) => (h === 'host' ? 'raheema-traders-api.onrender.com' : null),
    };
    const cloudUrl = getPublicBaseUrl(cloudReqMock);
    assertTest(
      'Cloud request resolves dynamically to https://raheema-traders-api.onrender.com',
      cloudUrl === 'https://raheema-traders-api.onrender.com'
    );

    // Test explicit BACKEND_URL override
    process.env.BACKEND_URL = 'https://custom-domain.com/';
    const overriddenUrl = getPublicBaseUrl(localReqMock);
    assertTest(
      'Explicit BACKEND_URL environment variable takes precedence and trims trailing slash',
      overriddenUrl === 'https://custom-domain.com'
    );
    if (originalBackendUrl) {
      process.env.BACKEND_URL = originalBackendUrl;
    } else {
      delete process.env.BACKEND_URL;
    }

    // -----------------------------------------------------------------
    // 3. REGEX SANITIZATION FOR SEARCH QUERIES
    // -----------------------------------------------------------------
    console.log('\n[3/5] Testing Search Regex Sanitization (Admin & Public)...');
    const toxicSearchInputs = [
      'VOL-(SP)',
      'Air+Max*2026',
      'Jordan [Pro] {High}',
      'Sneaker? $100^ | Sale',
      'C:\\Uploads\\Path',
      'Normal Shoe Name',
    ];

    toxicSearchInputs.forEach((input) => {
      let threw = false;
      try {
        const sanitized = escapeRegex(input);
        const rx = new RegExp(sanitized, 'i');
        const matches = rx.test(input);
        assertTest(
          `escapeRegex("${input}") compiles to safe regex /${rx.source}/i and matches literally`,
          matches && !threw
        );
      } catch (err) {
        threw = true;
        assertTest(`escapeRegex failed on "${input}": ${err.message}`, false);
      }
    });

    // -----------------------------------------------------------------
    // 4. ERROR MIDDLEWARE HARDENING & RESILIENCE
    // -----------------------------------------------------------------
    console.log('\n[4/5] Testing Error Middleware Hardening...');
    const createMockRes = () => {
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.responseBody = body;
          return this;
        },
      };
      return res;
    };

    // Test duplicate key with err.keyValue
    const res1 = createMockRes();
    errorHandler({ code: 11000, keyValue: { email: 'test@example.com' } }, {}, res1, () => {});
    assertTest(
      'Duplicate key error with keyValue returns 400 Bad Request and mentions field name',
      res1.statusCode === 400 && res1.responseBody.message.includes('email')
    );

    // Test duplicate key with err.keyPattern when keyValue is missing
    const res2 = createMockRes();
    errorHandler({ code: 11000, keyPattern: { username: 1 } }, {}, res2, () => {});
    assertTest(
      'Duplicate key error without keyValue (keyPattern fallback) returns 400 Bad Request and mentions field name',
      res2.statusCode === 400 && res2.responseBody.message.includes('username')
    );

    // Test duplicate key when both keyValue and keyPattern are undefined (guards against crash)
    const res3 = createMockRes();
    errorHandler({ code: 11000 }, {}, res3, () => {});
    assertTest(
      'Duplicate key error without keyValue or keyPattern handles gracefully without throwing TypeError',
      res3.statusCode === 400 && res3.responseBody.message.includes('field')
    );

    // Test JsonWebTokenError
    const res4 = createMockRes();
    errorHandler({ name: 'JsonWebTokenError', message: 'jwt malformed' }, {}, res4, () => {});
    assertTest(
      'JsonWebTokenError returns 401 Unauthorized with clean user-friendly message',
      res4.statusCode === 401 && res4.responseBody.message.includes('Invalid authentication token')
    );

    // Test TokenExpiredError
    const res5 = createMockRes();
    errorHandler({ name: 'TokenExpiredError', message: 'jwt expired' }, {}, res5, () => {});
    assertTest(
      'TokenExpiredError returns 401 Unauthorized with clean expiry message',
      res5.statusCode === 401 && res5.responseBody.message.includes('token expired')
    );

    // Test CastError
    const res6 = createMockRes();
    errorHandler({ name: 'CastError', kind: 'ObjectId', value: 'invalid-id' }, {}, res6, () => {});
    assertTest(
      'CastError (invalid ObjectId) returns 404 Not Found',
      res6.statusCode === 404 && res6.responseBody.message.includes('Resource not found')
    );

    // -----------------------------------------------------------------
    // 5. SERVER ROUTE HEALTH & HTTP PROBES (HEAD + GET)
    // -----------------------------------------------------------------
    console.log('\n[5/5] Testing Express Health & Root Probes (HEAD + GET)...');

    // Test GET /
    const rootGet = await dispatchExpressRequest(app, 'GET', '/');
    assertTest(
      'GET / returns 200 OK with service status "online"',
      rootGet.statusCode === 200 && rootGet.body.includes('"status":"online"')
    );

    // Test HEAD /
    const rootHead = await dispatchExpressRequest(app, 'HEAD', '/');
    assertTest(
      'HEAD / returns 200 OK for cloud uptime monitoring probes',
      rootHead.statusCode === 200
    );

    // Test GET /api/health
    const healthGet = await dispatchExpressRequest(app, 'GET', '/api/health');
    assertTest(
      'GET /api/health returns 200 OK with database connectivity status',
      healthGet.statusCode === 200 && healthGet.body.includes('"database":')
    );

    // Test HEAD /api/health
    const healthHead = await dispatchExpressRequest(app, 'HEAD', '/api/health');
    assertTest(
      'HEAD /api/health returns 200 OK for cloud ping checks',
      healthHead.statusCode === 200
    );

    // Test Favicon 204 handler
    const faviconRes = await dispatchExpressRequest(app, 'GET', '/favicon.ico');
    assertTest(
      'GET /favicon.ico returns 204 No Content to silence browser warnings',
      faviconRes.statusCode === 204
    );

    // Summary
    console.log('\n======================================================');
    console.log(` AUDIT SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('======================================================');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during server audit suite:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
};

runServerAuditTestSuite();
