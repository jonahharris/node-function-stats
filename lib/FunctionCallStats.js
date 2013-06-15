var Stats = new require('fast-stats').Stats;

var FunctionCallStats = function (options) {
  this.options = PerformRecursiveMerge({
      usePercentileMethod: true,
      histogramBucketPrecision: 10,
      commonSequenceCalculationFrequency: 1000
    }, options || {});
  this.usePercentileMethod = this.options.usePercentileMethod;
  this.histogramBucketPrecision = this.options.histogramBucketPrecision;
  this.commonSequenceCalculationFrequency = this.options.commonSequenceCalculationFrequency;
  this.halfCommonSequenceCalculationFrequency = Math.floor(this.commonSequenceCalculationFrequency * 0.5);
  this.functions = {}
};

FunctionCallStats.prototype.registerFunction = function registerFunction (
  functionName, argInfo) {
  // TODO: add check to see whether it exists first
  this.functions[functionName] = { name: functionName, calls: 0, args: {} };

  for (var ii in argInfo) {
    this.functions[functionName].args[ii] = {
        name: argInfo[ii].name,
        track: argInfo[ii].track
      };
    if (true === argInfo[ii].track) {
      this.functions[functionName].args[ii]['stats'] = new Stats({bucket_precision: 10, store_data: false});
      this.functions[functionName].args[ii]['lastValues'] = [];
      this.functions[functionName].args[ii]['commonSequenceDifference'] = null;
    }
  }
};

FunctionCallStats.prototype.recordFunctionCall = function recordFunctionCall (
  functionName, argv) {
  // Right now, we can only track stats for numeric values, add type checking
  if (this.functions[functionName]) {
    var tFunction = this.functions[functionName].args;
    var performCommonSequenceDifferenceCalculation = false;
    if (0 === (++this.functions[functionName].calls % this.commonSequenceCalculationFrequency)) {
      this.calculateCommonSequenceDifferencesOfFunction(functionName);
    }

    for (var ii in tFunction) {
      if (true === tFunction[ii].track) {
        tFunction[ii].stats.push(argv[parseInt(ii)]);
        tFunction[ii].lastValues.push(argv[parseInt(ii)]);
      }
    }
  }
};

FunctionCallStats.prototype.getFunctionStats = function getFunctionStats (functionName) {
  var callStats = {};
  if (this.functions[functionName]) {
    var tFunction = this.functions[functionName].args;
    callStats = {
      name: functionName,
      calls: 1,
      args: {}
    };
    for (var ii in tFunction) {
      callStats.args[ii] = {
        name: tFunction[ii].name,
        stats: null
      }
      if (true === tFunction[ii].track) {
        var r = tFunction[ii].stats.range();
        callStats.args[ii].stats = {};
        callStats.args[ii].stats['min'] = Math.floor(r[0]);
        callStats.args[ii].stats['max'] = Math.ceil(r[1]);
        callStats.args[ii].stats['percentiles'] = [];
        if (true === this.usePercentileMethod) {
          for (var jj = 5; jj <= 100; jj += 5) {
            callStats.args[ii].stats['percentiles'].push(Math.ceil(tFunction[ii].stats.percentile(jj)));
          }
        }
        callStats.args[ii].stats['commonSequenceDifference'] = tFunction[ii].commonSequenceDifference;
      }
    }
  }
  return callStats;
};

FunctionCallStats.prototype.getFunctionCallVariants = function getFunctionCallVariants (functionName) {
  this.calculateCommonSequenceDifferencesOfFunction(functionName, true);
  var fnStats = this.getFunctionStats(functionName);
  var calls = [];
  var argVariants = {};
  for (var ii in fnStats.args) {
    argVariants[ii] = [];
    if (null !== fnStats.args[ii].stats) {
      var jj = parseInt(fnStats.args[ii].stats['min']);
      var jjInc = fnStats.args[ii].stats['commonSequenceDifference'];
      var jjMax = roundToNearest(parseInt(fnStats.args[ii].stats['max']), jjInc);
      if (true === this.usePercentileMethod) {
        jjMax = roundToNearest(parseInt(fnStats.args[ii].stats['percentiles'][18]), jjInc);
      }
      for (; jj <= jjMax; jj += jjInc) {
        argVariants[ii].push(parseInt(jj));
      }
    } else {
      argVariants[ii].push(arguments[1]);
    }
  }

  var argArray = [];
  for (var ii in argVariants) {
    argArray.push(argVariants[ii]);
  }

  return PerformCartesianJoin(argArray);
};

FunctionCallStats.prototype.calculateCommonSequenceDifferencesOfFunction = function (functionName, force) {
  if (this.functions[functionName]) {
    var tFunction = this.functions[functionName].args;
    var performCommonSequenceDifferenceCalculation = false;
    if (!(0 === (tFunction.calls % this.commonSequenceCalculationFrequency)
      || true === force)) {
      return;
    }

    for (var ii in tFunction) {
      if (true === tFunction[ii].track) {
        if (tFunction[ii].lastValues.length > this.halfCommonSequenceCalculationFrequency) {
          tFunction[ii].lastValues = UniquifyArray(tFunction[ii].lastValues);
          var diffFreq = {};
          var start = 0;
          var lastDiff = 0;
          for (var jj = 0; jj < tFunction[ii].lastValues.length; ++jj) {
            var diff = Math.abs(tFunction[ii].lastValues[jj] - start);
            start = tFunction[ii].lastValues[jj];
            if (0 === diff) {
              diff = lastDiff;
            } else {
              lastDiff = diff;
            }

            if (diffFreq[diff]) {
              ++diffFreq[diff];
            } else {
              diffFreq[diff] = 1;
            }
          }

          var sortedFreqs = [];
          for (var freq in diffFreq) {
            sortedFreqs.push(freq);
          }
          sortedFreqs.sort(function (a, b) {
              return (diffFreq[b] - diffFreq[a]);
          });
          tFunction[ii].lastValues = [];
          if (0 !== parseInt(sortedFreqs[0])) {
            tFunction[ii].commonSequenceDifference = parseInt(sortedFreqs[0]);
          }
        } else if (null === tFunction[ii].commonSequenceDifference) {
          tFunction[ii].commonSequenceDifference = 1;
        }
      }
    }
  }
};

function roundToNearest (n, k) {
  if (0 === n % k)
    return n;

  return (Math.round(n) - (Math.round(n) % k)) + k;
}

function UniquifyArray (arr) {
  arr = arr.sort(function (a, b) { return a*1 - b*1; });
  var ret = [arr[0]];
  for (var i = 1; i < arr.length; i++) {
    if (arr[i-1] !== arr[i]) {
        ret.push(arr[i]);
    }
  }
  return ret;
}

function PerformCartesianJoin (arrayOfArrays) {
  var r = [], arg = arrayOfArrays, max = arg.length-1;
  function helper(arr, i) {
    for (var j = 0, l = arg[i].length; j < l; ++j) {
      var a = arr.slice(0);
      a.push(arg[i][j])
      if (i == max) {
        r.push(a);
      } else {
        helper(a, i+1);
      }
    }
  }
  helper([], 0);
  return r;
};

function PerformRecursiveMerge (obj1, obj2) {
  for (var p in obj2) {
    try {
      if (Object === obj2[p].constructor) {
        obj1[p] = PerformRecursiveMerge(obj1[p], obj2[p]);
      } else {
        obj1[p] = obj2[p];
      }
    } catch (e) {
      obj1[p] = obj2[p];
    }
  }

  return obj1;
}

module.exports = FunctionCallStats;

