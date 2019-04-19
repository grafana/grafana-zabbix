import _ from 'lodash';
import * as utils from './utils';
import ts from './timeseries';

let downsampleSeries = ts.downsample;
let groupBy = ts.groupBy_perf;
let groupBy_exported = (interval, groupFunc, datapoints) => groupBy(datapoints, interval, groupFunc);
let sumSeries = ts.sumSeries;
let delta = ts.delta;
let rate = ts.rate;
let scale = (factor, datapoints) => ts.scale_perf(datapoints, factor);
let offset = (delta, datapoints) => ts.offset(datapoints, delta);
let simpleMovingAverage = (n, datapoints) => ts.simpleMovingAverage(datapoints, n);
let expMovingAverage = (a, datapoints) => ts.expMovingAverage(datapoints, a);

let SUM = ts.SUM;
let COUNT = ts.COUNT;
let AVERAGE = ts.AVERAGE;
let MIN = ts.MIN;
let MAX = ts.MAX;
let MEDIAN = ts.MEDIAN;
let PERCENTILE = ts.PERCENTILE;

function limit(order, n, orderByFunc, timeseries) {
  let orderByCallback = aggregationFunctions[orderByFunc];
  let sortByIteratee = (ts) => {
    let values = _.map(ts.datapoints, (point) => {
      return point[0];
    });
    return orderByCallback(values);
  };
  let sortedTimeseries = _.sortBy(timeseries, sortByIteratee);
  if (order === 'bottom') {
    return sortedTimeseries.slice(0, n);
  } else {
    return sortedTimeseries.slice(-n);
  }
}

function removeAboveValue(n, datapoints) {
  return _.map(datapoints, point => {
    return [
      (point[0] > n) ? null : point[0],
      point[1]
    ];
  });
}

function removeBelowValue(n, datapoints) {
  return _.map(datapoints, point => {
    return [
      (point[0] < n) ? null : point[0],
      point[1]
    ];
  });
}

function transformNull(n, datapoints) {
  return _.map(datapoints, point => {
    return [
      (point[0] !== null) ? point[0] : n,
      point[1]
    ];
  });
}

function sortSeries(direction, timeseries) {
  return _.orderBy(timeseries, [function (ts) {
    return ts.target.toLowerCase();
  }], direction);
}

function setAlias(alias, timeseries) {
  timeseries.target = alias;
  return timeseries;
}

function replaceAlias(regexp, newAlias, timeseries) {
  let pattern;
  if (utils.isRegex(regexp)) {
    pattern = utils.buildRegex(regexp);
  } else {
    pattern = regexp;
  }

  let alias = timeseries.target.replace(pattern, newAlias);
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
  const flattenedPoints = ts.flattenDatapoints(datapoints);
  // groupBy_perf works with sorted series only
  const sortedPoints = ts.sortByTime(flattenedPoints);
  let groupByCallback = aggregationFunctions[aggregateFunc];
  return groupBy(sortedPoints, interval, groupByCallback);
}

function aggregateWrapper(groupByCallback, interval, datapoints) {
  var flattenedPoints = ts.flattenDatapoints(datapoints);
  // groupBy_perf works with sorted series only
  const sortedPoints = ts.sortByTime(flattenedPoints);
  return groupBy(sortedPoints, interval, groupByCallback);
}

function percentile(interval, n, datapoints) {
  var flattenedPoints = ts.flattenDatapoints(datapoints);
  var groupByCallback = _.partial(PERCENTILE, n);
  return groupBy(flattenedPoints, interval, groupByCallback);
}

function timeShift(interval, range) {
  let shift = utils.parseTimeShiftInterval(interval) / 1000;
  return _.map(range, time => {
    return time - shift;
  });
}

function unShiftTimeSeries(interval, datapoints) {
  let unshift = utils.parseTimeShiftInterval(interval);
  return _.map(datapoints, dp => {
    return [
      dp[0],
      dp[1] + unshift
    ];
  });
}

let metricFunctions = {
  groupBy: groupByWrapper,
  scale: scale,
  offset: offset,
  delta: delta,
  rate: rate,
  movingAverage: simpleMovingAverage,
  exponentialMovingAverage: expMovingAverage,
  transformNull: transformNull,
  aggregateBy: aggregateByWrapper,
  // Predefined aggs
  percentile: percentile,
  average: _.partial(aggregateWrapper, AVERAGE),
  min: _.partial(aggregateWrapper, MIN),
  max: _.partial(aggregateWrapper, MAX),
  median: _.partial(aggregateWrapper, MEDIAN),
  sum: _.partial(aggregateWrapper, SUM),
  count: _.partial(aggregateWrapper, COUNT),
  sumSeries: sumSeries,
  removeAboveValue: removeAboveValue,
  removeBelowValue: removeBelowValue,
  top: _.partial(limit, 'top'),
  bottom: _.partial(limit, 'bottom'),
  sortSeries: sortSeries,
  timeShift: timeShift,
  setAlias: setAlias,
  setAliasByRegex: setAliasByRegex,
  replaceAlias: replaceAlias
};

let aggregationFunctions = {
  avg: AVERAGE,
  min: MIN,
  max: MAX,
  median: MEDIAN,
  sum: SUM,
  count: COUNT
};

export default {
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
