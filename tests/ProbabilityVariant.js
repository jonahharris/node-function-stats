var FunctionCallStats = require('../lib/FunctionCallStats');

function roundToNearest (n, k) {
  if (0 === n % k)
    return n;

  return (Math.round(n) - (Math.round(n) % k)) + k;
}

function randomInBenfordDist (stop) {
  return Math.floor(Math.exp(Math.log(stop) * Math.random()));
}

module.exports = {
  setUp: function (callback) {
    this.fnStats = new FunctionCallStats();

    this.fnStats.registerFunction('getMemberFeed', [
      { name: 'memberId', track: false },
      { name: 'limit', track: true },
      { name: 'offset', track: true }
      ]);

    callback();
  },
  test1: function (test) {
    for (var ii = 0; ii < 9500; ++ii) {
      var offset = (roundToNearest(randomInBenfordDist(100), 10) - 10);
      this.fnStats.recordFunctionCall('getMemberFeed', [10301212, 10, offset]);
    }

    for (var ii = 0; ii < 500; ++ii) {
      var offset = (roundToNearest(randomInBenfordDist(1000), 10) - 10);
      this.fnStats.recordFunctionCall('getMemberFeed', [10301212, 10, offset]);
    }

    var variants = this.fnStats.getFunctionCallVariants('getMemberFeed', 10301212);
    test.deepEqual(variants, [
        [10301212, 10, 0],
        [10301212, 10, 10],
        [10301212, 10, 20],
        [10301212, 10, 30],
        [10301212, 10, 40],
        [10301212, 10, 50],
        [10301212, 10, 60],
        [10301212, 10, 70],
        [10301212, 10, 80],
        [10301212, 10, 90]
      ]);
    test.done();
  }
};

