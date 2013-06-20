var FunctionCallStats = require('./lib/FunctionCallStats');
var fnStats = new FunctionCallStats();

function roundToNearest (n, k) {
  if (0 === n % k)
    return n;

  return (Math.round(n) - (Math.round(n) % k)) + k;
}

function randomInBenfordDist (maxInt) {
  return Math.floor(Math.exp(Math.log(maxInt) * Math.random()));
}

// Register the function
fnStats.registerFunction('getMemberFeed', [
  { name: 'memberId', track: false },
  { name: 'limit', track: true },
  { name: 'offset', track: true }
  ]);

// Generate some test data (90% of calls are offsets in range [0, 90])
for (var ii = 0; ii < 9000; ++ii) {
  var offset = (roundToNearest(randomInBenfordDist(100), 10) - 10);
  fnStats.recordFunctionCall('getMemberFeed', [10301212, 10, offset]);
}

// Generate some test data (10% of calls are offsets in range [0, 990])
for (var ii = 0; ii < 1000; ++ii) {
  var offset = (roundToNearest(randomInBenfordDist(1000), 10) - 10);
  fnStats.recordFunctionCall('getMemberFeed', [10301212, 10, offset]);
}

// Get the variants
var variants = fnStats.getFunctionCallVariants('getMemberFeed', 10301212);

// Build the calls for clearing keys up to the 95th percentile
for (var ii in variants) {
  console.log('getMemberFeed(' + variants[ii].join(', ') + ');');
}

