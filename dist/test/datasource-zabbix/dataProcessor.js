'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

var _timeseries = require('./timeseries');

var _timeseries2 = _interopRequireDefault(_timeseries);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var downsampleSeries = _timeseries2.default.downsample;
var groupBy = _timeseries2.default.groupBy_perf;
var groupBy_exported = function groupBy_exported(interval, groupFunc, datapoints) {
  return groupBy(datapoints, interval, groupFunc);
};
var sumSeries = _timeseries2.default.sumSeries;
var delta = _timeseries2.default.delta;
var rate = _timeseries2.default.rate;
var scale = function scale(factor, datapoints) {
  return _timeseries2.default.scale_perf(datapoints, factor);
};
var simpleMovingAverage = function simpleMovingAverage(n, datapoints) {
  return _timeseries2.default.simpleMovingAverage(datapoints, n);
};
var expMovingAverage = function expMovingAverage(a, datapoints) {
  return _timeseries2.default.expMovingAverage(datapoints, a);
};

var SUM = _timeseries2.default.SUM;
var COUNT = _timeseries2.default.COUNT;
var AVERAGE = _timeseries2.default.AVERAGE;
var MIN = _timeseries2.default.MIN;
var MAX = _timeseries2.default.MAX;
var MEDIAN = _timeseries2.default.MEDIAN;
var PERCENTIL = _timeseries2.default.PERCENTIL;

function limit(order, n, orderByFunc, timeseries) {
  var orderByCallback = aggregationFunctions[orderByFunc];
  var sortByIteratee = function sortByIteratee(ts) {
    var values = _lodash2.default.map(ts.datapoints, function (point) {
      return point[0];
    });
    return orderByCallback(values);
  };
  var sortedTimeseries = _lodash2.default.sortBy(timeseries, sortByIteratee);
  if (order === 'bottom') {
    return sortedTimeseries.slice(0, n);
  } else {
    return sortedTimeseries.slice(-n);
  }
}

function setAlias(alias, timeseries) {
  timeseries.target = alias;
  return timeseries;
}

function replaceAlias(regexp, newAlias, timeseries) {
  var pattern = void 0;
  if (utils.isRegex(regexp)) {
    pattern = utils.buildRegex(regexp);
  } else {
    pattern = regexp;
  }

  var alias = timeseries.target.replace(pattern, newAlias);
  timeseries.target = alias;
  return timeseries;
}

function setAliasByRegex(alias, timeseries) {
  timeseries.target = extractText(timeseries.target, alias);
  return timeseries;
}

function extractText(str, pattern) {
  var extractPattern = new RegExp(pattern);
  var extractedValue = extractPattern.exec(str);
  extractedValue = extractedValue[0];
  return extractedValue;
}

function groupByWrapper(interval, groupFunc, datapoints) {
  var groupByCallback = aggregationFunctions[groupFunc];
  return groupBy(datapoints, interval, groupByCallback);
}

function aggregateByWrapper(interval, aggregateFunc, datapoints) {
  // Flatten all points in frame and then just use groupBy()
  var flattenedPoints = _lodash2.default.flatten(datapoints, true);
  var groupByCallback = aggregationFunctions[aggregateFunc];
  return groupBy(flattenedPoints, interval, groupByCallback);
}

function aggregateWrapper(groupByCallback, interval, datapoints) {
  var flattenedPoints = _lodash2.default.flatten(datapoints, true);
  return groupBy(flattenedPoints, interval, groupByCallback);
}

function percentil(interval, n, datapoints) {
  var flattenedPoints = _lodash2.default.flatten(datapoints, true);
  var groupByCallback = _lodash2.default.partial(PERCENTIL, n);
  return groupBy(flattenedPoints, interval, groupByCallback);
}

function timeShift(interval, range) {
  var shift = utils.parseTimeShiftInterval(interval) / 1000;
  return _lodash2.default.map(range, function (time) {
    return time - shift;
  });
}

function unShiftTimeSeries(interval, datapoints) {
  var unshift = utils.parseTimeShiftInterval(interval);
  return _lodash2.default.map(datapoints, function (dp) {
    return [dp[0], dp[1] + unshift];
  });
}

var metricFunctions = {
  groupBy: groupByWrapper,
  scale: scale,
  delta: delta,
  rate: rate,
  movingAverage: simpleMovingAverage,
  exponentialMovingAverage: expMovingAverage,
  aggregateBy: aggregateByWrapper,
  // Predefined aggs
  percentil: percentil,
  average: _lodash2.default.partial(aggregateWrapper, AVERAGE),
  min: _lodash2.default.partial(aggregateWrapper, MIN),
  max: _lodash2.default.partial(aggregateWrapper, MAX),
  median: _lodash2.default.partial(aggregateWrapper, MEDIAN),
  sum: _lodash2.default.partial(aggregateWrapper, SUM),
  count: _lodash2.default.partial(aggregateWrapper, COUNT),
  sumSeries: sumSeries,
  top: _lodash2.default.partial(limit, 'top'),
  bottom: _lodash2.default.partial(limit, 'bottom'),
  timeShift: timeShift,
  setAlias: setAlias,
  setAliasByRegex: setAliasByRegex,
  replaceAlias: replaceAlias
};

var aggregationFunctions = {
  avg: AVERAGE,
  min: MIN,
  max: MAX,
  median: MEDIAN,
  sum: SUM,
  count: COUNT
};

exports.default = {
  downsampleSeries: downsampleSeries,
  groupBy: groupBy_exported,
  AVERAGE: AVERAGE,
  MIN: MIN,
  MAX: MAX,
  MEDIAN: MEDIAN,
  SUM: SUM,
  COUNT: COUNT,
  unShiftTimeSeries: unShiftTimeSeries,

  get aggregationFunctions() {
    return aggregationFunctions;
  },

  get metricFunctions() {
    return metricFunctions;
  }
};
