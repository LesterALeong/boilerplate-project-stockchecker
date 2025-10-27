const Mocha = require("mocha");

let report = [];

// fresh run each time
function run() {
  report = []; // reset so we don't accumulate on restart

  // IMPORTANT: use 'tdd' so `suite` / `test` are defined
  const mocha = new Mocha({
    timeout: 5000,
    ui: "tdd",
  });

  // add our functional test file
  mocha.addFile("./tests/2_functional-tests.js");

  const runner = mocha.run(function () {
    // mocha finished
  });

  // collect results for /_api/get-tests
  runner.on("test end", function (test) {
    report.push({
      title: test.title,
      fullTitle: test.fullTitle(),
      duration: test.duration,
      state: test.state,
    });
  });

  runner.on("end", function () {
    // all tests complete
  });

  return runner;
}

module.exports = {
  run,
  report,
};
