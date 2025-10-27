"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");

const apiRoutes = require("./routes/api.js");
const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner.js");

const path = require("path");

const app = express();

/*
 * --- SECURITY / CSP ---
 * Helmet sets CSP, BUT some hosting layers strip or mangle headers.
 * FCC test #2 expects a `content-security-policy` header that explicitly
 * limits script-src and style-src to 'self'.
 *
 * We'll (1) use helmet, and (2) force-set our own CSP header manually.
 */

// Helmet CSP
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
    },
  })
);

// Manually assert CSP header for FCC tests / sandbox proxies
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'"
  );
  next();
});

// FCC requires cors to be open in tests
app.use(cors({ origin: "*" }));

// trust proxy so req.ip is the real client IP in FCC env
app.enable("trust proxy");

app.use("/public", express.static(path.join(process.cwd(), "public")));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Index page (static HTML)
app.get("/", function (req, res) {
  res.sendFile(path.join(process.cwd(), "views", "index.html"));
});

// For FCC testing endpoints
fccTestingRoutes(app);

// Routing for API
apiRoutes(app);

// 404 middleware
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

/*
 * --- TEST RUNNER STARTUP ---
 * FCC test #7 ("All 5 functional tests are complete and passing")
 * pings /_api/get-tests and expects to see passing test results.
 *
 * On CodeSandbox / Replit, NODE_ENV may NOT be "test" during that ping,
 * so your app never ran the tests and /_api/get-tests just says
 * { status: 'not in test env' } → FAIL.
 *
 * We'll force NODE_ENV='test' at boot if it's not already,
 * and always run mocha so we always populate runner.report.
 */
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

const listener = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port " + listener.address().port);

  // Always run tests on boot so runner.report is populated
  console.log("Running Tests...");
  setTimeout(function () {
    try {
      runner.run();
    } catch (e) {
      console.log("Tests are not valid:");
      console.log(e);
    }
  }, 500);
});

module.exports = app; // for testing
