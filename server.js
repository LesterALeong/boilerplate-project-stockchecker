'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');
const path = require('path');

const app = express();

/*
 * === CSP MIDDLEWARE FOR FCC TEST #2 ===
 *
 * FCC wants "only allow loading of scripts and CSS from your server".
 * We'll enforce:
 *   default-src 'self'; script-src 'self'; style-src 'self'
 *
 * We will:
 *  - NOT use helmet.contentSecurityPolicy anymore
 *  - Manually set the header on *every* response
 *  - Set it twice: once as `Content-Security-Policy`, once as `content-security-policy`
 *
 * This is intentionally redundant because FCC's test runner is looking
 * for `content-security-policy` in lowercase and was not seeing the
 * header set by Helmet in prior attempts.
 */
const CSP_VALUE = "default-src 'self'; script-src 'self'; style-src 'self'";

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP_VALUE);
  res.setHeader('content-security-policy', CSP_VALUE);
  next();
});

// allow FCC's test runner to hit us from anywhere
app.use(cors({ origin: '*' }));

// so req.ip is meaningful behind proxy (Render sets X-Forwarded-For)
app.enable('trust proxy');

// static assets
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// index page
app.get('/', function (req, res) {
  res.sendFile(path.join(process.cwd(), 'views', 'index.html'));
});

// FCC testing helper routes (/_api/get-tests etc.)
fccTestingRoutes(app);

// API route for /api/stock-prices
apiRoutes(app);

// 404 handler
app.use(function (req, res, next) {
  res.status(404).type('text').send('Not Found');
});

/*
 * === TEST RUNNER FOR FCC TEST #7 ===
 *
 * We force NODE_ENV='test' so the functional tests run automatically
 * every time the server boots on Render. We then expose those results
 * through /_api/get-tests.
 *
 * Important: FCC sometimes hits your URL immediately after boot.
 * We capture the mocha results in memory so that after the first run
 * they are always available.
 */

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// we'll flip this to true once mocha finishes AND everything is passed
let allPassedFlag = false;

const listener = app.listen(process.env.PORT || 3000, function () {
  const port = listener.address() && listener.address().port;
  console.log('Listening on port ' + (port || process.env.PORT));
  console.log('Running Tests...');

  try {
    const mochaRunner = runner.run();

    mochaRunner.on('end', function () {
      // If any test failed, state will not be 'passed'
      const anyFailed = runner.report.some(r => r.state !== 'passed');
      if (!anyFailed && runner.report.length > 0) {
        allPassedFlag = true;
      }
      console.log('Mocha finished. allPassedFlag=', allPassedFlag);
    });
  } catch (e) {
    console.log('Tests are not valid:');
    console.log(e);
  }
});

// make that status visible to fcctesting.js
app.set('__all_tests_passed_flag__', () => allPassedFlag);

module.exports = app;
