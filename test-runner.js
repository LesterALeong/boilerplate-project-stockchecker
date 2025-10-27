const Mocha = require("mocha");

let report = [];

function run() {
  report = []; // reset on each run

  const mocha = new Mocha({
    timeout: 5000,
    ui: "tdd",
  });

  mocha.addFile("./tests/2_functional-tests.js");

  const runner = mocha.run(function () {
    // done
  });

  runner.on("test end", function (test) {
    report.push({
      title: test.title,
      fullTitle: test.fullTitle(),
      duration: test.duration,
      state: test.state,
    });
  });

  runner.on("end", function () {
    // finished
  });

  return runner;
}

module.exports = {
  run,
  report,
};
