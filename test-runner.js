const Mocha = require('mocha');

let mocha = new Mocha({
  timeout: 5000
});

// Add our functional tests file
mocha.addFile('./tests/2_functional-tests.js');

let report = [];

function run() {
  const runner = mocha.run(function () {
    // no-op
  });

  runner.on('test end', function (test) {
    // push test results so /_api/get-tests can see them
    report.push({
      title: test.title,
      fullTitle: test.fullTitle(),
      duration: test.duration,
      state: test.state
    });
  });

  runner.on('end', function () {
    // done
  });

  return runner;
}

module.exports = {
  run,
  report
};
