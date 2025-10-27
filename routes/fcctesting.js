"use strict";

const path = require("path");
const fs = require("fs");
const testRunner = require("../test-runner.js");

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

  // report test results
  app.route("/_api/get-tests").get(function (req, res) {
    // With our server.js changes, runner.report will always be there
    if (Array.isArray(testRunner.report) && testRunner.report.length > 0) {
      return res.json(testRunner.report);
    } else {
      // still return something predictable
      return res.json(testRunner.report || []);
    }
  });
};
