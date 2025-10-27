const Mocha = require("mocha");

let report = [];

// We will create a fresh Mocha instance each time run() is called.
function run() {
  report = []; // reset between runs

  const mocha = new Mocha({
    timeout: 5000,
    ui: "bdd", // <-- this is critical so `suite`, `test`, etc. are defined
  });

  // Add our functional tests
  mocha.addFile("./tests/2_functional-tests.js");

  const runner = mocha.run(function () {
    // done callback (we don't need to do anything here)
  });

  // As each test ends, push results so FCC can read them later
  runner.on("test end", function (test) {
    report.push({
      title: test.title,
      fullTitle: test.fullTitle(),
      duration: test.duration,
      state: test.state,
    });
  });

  runner.on("end", function () {
    // all tests finished
    // we don't need to do anything else here
  });

  return runner;
}

module.exports = {
  run,
  report,
};
