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

// Manually assert CSP header for FCC tests
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'"
  );
  next();
});

// CORS for FCC tests
app.use(cors({ origin: "*" }));

// So req.ip is correct behind proxy/sandbox
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

// FCC testing helper routes
fccTestingRoutes(app);

// Our API
apiRoutes(app);

// 404
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

// Ensure tests always run so /_api/get-tests returns data
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

const listener = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port " + listener.address().port);
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

module.exports = app;
