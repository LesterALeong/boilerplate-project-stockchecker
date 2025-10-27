"use strict";

const path = require("path");
const fs = require("fs");
const testRunner = require("../test-runner.js");

// We'll keep a cached copy of the last non-empty report
let lastReport = [];

module.exports = function (app) {
  // basic info for FCC
  app.route("/_api/app-info").get(function (req, res) {
    const packageJson = path.join(process.cwd(), "package.json");
    fs.readFile(packageJson, "utf-8", function (err, data) {
      if (err) return res.json({ error: "package.json not found" });
      const pkg = JSON.parse(data);
      res.json({
        version: pkg.version,
      });
    });
  });

  // expose mocha results
  app.route("/_api/get-tests").get(function (req, res) {
    // If testRunner.report has data, refresh cache
    if (Array.isArray(testRunner.report) && testRunner.report.length > 0) {
      lastReport = testRunner.report;
    }

    // Serve whichever we have: current report (preferred) or cached
    if (Array.isArray(lastReport) && lastReport.length > 0) {
      return res.json(lastReport);
    } else {
      // nothing yet, so respond with empty array (still valid JSON)
      return res.json([]);
    }
  });
};
