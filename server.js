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
 * SECURITY / CSP
 *
 * FCC expects a Content-Security-Policy that only allows scripts and styles
 * to load from 'self'. The standard FCC solution is to use Helmet exactly
 * like this, and *not* add custom CSP headers.
 *
 * We put this FIRST so it applies to all routes.
 *
 * NOTE: We intentionally only define scriptSrc and styleSrc here because
 * that's what FCC checks for: no external scripts or styles.
 */
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
    },
  })
);

// FCC tests assume permissive CORS for their runner
app.use(cors({ origin: "*" }));

// So req.ip is stable behind sandbox / proxy
app.enable("trust proxy");

// Static assets
app.use("/public", express.static(path.join(process.cwd(), "public")));

// Body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Index page
app.get("/", function (req, res) {
  res.sendFile(path.join(process.cwd(), "views", "index.html"));
});

// FCC testing helper routes (/_api/get-tests etc.)
fccTestingRoutes(app);

// Our API route (/api/stock-prices)
apiRoutes(app);

// 404 handler
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

/*
 * TEST RUNNER INTEGRATION
 *
 * FCC's final test (#7) will GET /_api/get-tests from your live URL and expects
 * to see all functional tests passing.
 *
 * We:
 *  - ensure NODE_ENV='test' so we always actually run the tests
 *  - run mocha once right after the server starts listening
 *  - expose the results via /_api/get-tests (see routes/fcctesting.js)
 */
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

// Start server
const listener = app.listen(process.env.PORT || 3000, function () {
  const port = listener.address() && listener.address().port;
  console.log("Listening on port " + (port || process.env.PORT));

  // Run tests immediately once the server is live.
  // This allows chai-http in the tests to hit our running app.
  console.log("Running Tests...");
  try {
    runner.run();
  } catch (e) {
    console.log("Tests are not valid:");
    console.log(e);
  }
});

module.exports = app;
