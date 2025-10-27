"use strict";

const path = require("path");
const fs = require("fs");
const testRunner = require("../test-runner.js");

module.exports = function (app) {
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

  app.route("/_api/get-tests").get(function (req, res) {
    if (Array.isArray(testRunner.report) && testRunner.report.length > 0) {
      return res.json(testRunner.report);
    } else {
      return res.json(testRunner.report || []);
    }
  });
};
