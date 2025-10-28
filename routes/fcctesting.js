'use strict';

const path = require('path');
const fs = require('fs');
const testRunner = require('../test-runner.js');

// cache the last known non-empty mocha report
let lastReport = [];

module.exports = function (app) {
  // Basic info endpoint FCC expects
  app.route('/_api/app-info').get(function (req, res) {
    const packageJson = path.join(process.cwd(), 'package.json');
    fs.readFile(packageJson, 'utf-8', function (err, data) {
      if (err) return res.json({ error: 'package.json not found' });
      const pkg = JSON.parse(data);
      res.json({
        version: pkg.version
      });
    });
  });

  /*
   * FCC calls this to read your functional test results.
   * We always return the last non-empty report once mocha has run.
   */
  app.route('/_api/get-tests').get(function (req, res) {
    if (Array.isArray(testRunner.report) && testRunner.report.length > 0) {
      lastReport = testRunner.report;
    }

    if (Array.isArray(lastReport) && lastReport.length > 0) {
      return res.json(lastReport);
    } else {
      // respond with empty array if mocha TRULY hasn't completed yet,
      // but after first warm boot on Render this should stick.
      return res.json([]);
    }
  });

  /*
   * Extra status endpoint (mainly for debugging yourself, not FCC):
   * shows if we think all tests have passed.
   */
  app.route('/__fcc-status').get(function (req, res) {
    const getAllPassed = app.get('__all_tests_passed_flag__');
    const allPassed = typeof getAllPassed === 'function'
      ? !!getAllPassed()
      : false;

    let computedAllPassed = false;
    if (Array.isArray(testRunner.report) && testRunner.report.length > 0) {
      const anyFail = testRunner.report.some(r => r.state !== 'passed');
      computedAllPassed = !anyFail;
    }

    res.json({
      allTestsPassedFlag: allPassed,
      allTestsPassedComputed: computedAllPassed,
      testCount: Array.isArray(testRunner.report)
        ? testRunner.report.length
        : 0
    });
  });
};
