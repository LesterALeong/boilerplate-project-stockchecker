'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');

const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const path = require('path');

const app = express();

/**
 * Security middleware
 * Only allow scripts and styles from same origin
 */
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"]
    }
  })
);

// FCC requires cors to be open in tests
app.use(cors({ origin: '*' }));

// trust proxy so req.ip is the real client IP in FCC env
app.enable('trust proxy');

app.use('/public', express.static(path.join(process.cwd(), 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Index page (static HTML)
app.get('/', function (req, res) {
  res.sendFile(path.join(process.cwd(), 'views', 'index.html'));
});

// For FCC testing (the hidden tests ping these endpoints)
fccTestingRoutes(app);

// Routing for API
apiRoutes(app);

// 404 middleware
app.use(function (req, res, next) {
  res.status(404).type('text').send('Not Found');
});

// Start server + optionally run the tests
const listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Listening on port ' + listener.address().port);
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.log('Tests are not valid:');
        console.log(e);
      }
    }, 500); // slight delay so server is ready
  }
});

module.exports = app; // for testing
