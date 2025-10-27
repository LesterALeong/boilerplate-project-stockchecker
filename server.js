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
 * SECURITY HEADERS / CSP
 */
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
    },
  })
);

// Explicitly set CSP header (some hosts/proxies strip Helmet headers)
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'"
  );
  next();
});

// CORS (FCC tests assume permissive CORS is OK)
app.use(cors({ origin: "*" }));

// so req.ip is stable behind proxy
app.enable("trust proxy");

// static assets
app.use("/public", express.static(path.join(process.cwd(), "public")));

// body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// index page
app.get("/", function (req, res) {
  res.sendFile(path.join(process.cwd(), "views", "index.html"));
});

// FCC helper routes (/ _api/get-tests, etc.)
fccTestingRoutes(app);

// API
apiRoutes(app);

// 404
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

// Force NODE_ENV to 'test' so mocha runs even in hosted preview
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

// start server
const listener = app.listen(process.env.PORT || 3000, function () {
  const port = listener.address() && listener.address().port;
  console.log("Listening on port " + (port || process.env.PORT));

  // Immediately run tests now that server is listening.
  // No timeout, so /_api/get-tests will have data ASAP.
  try {
    console.log("Running Tests...");
    runner.run();
  } catch (e) {
    console.log("Tests are not valid:");
    console.log(e);
  }
});

module.exports = app;
