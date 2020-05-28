import _ from 'lodash';
// Available in 7.0
// import { getTemplateSrv } from '@grafana/runtime';
import * as utils from './utils';
import ts, { groupBy_perf as groupBy } from './timeseries';

const SUM = ts.SUM;
const COUNT = ts.COUNT;
const AVERAGE = ts.AVERAGE;
const MIN = ts.MIN;
const MAX = ts.MAX;
const MEDIAN = ts.MEDIAN;
const PERCENTILE = ts.PERCENTILE;

const downsampleSeries = ts.downsample;
const groupBy_exported = (interval, groupFunc, datapoints) => groupBy(datapoints, interval, groupFunc);
const sumSeries = ts.sumSeries;
const delta = ts.delta;
const rate = ts.rate;
const scale = (factor, datapoints) => ts.scale_perf(datapoints, factor);
const offset = (delta, datapoints) => ts.offset(datapoints, delta);
const simpleMovingAverage = (n, datapoints) => ts.simpleMovingAverage(datapoints, n);
const expMovingAverage = (a, datapoints) => ts.expMovingAverage(datapoints, a);
const percentile = (interval, n, datapoints) => groupBy(datapoints, interval, _.partial(PERCENTILE, n));

function limit(order, n, orderByFunc, timeseries) {
  const orderByCallback = aggregationFunctions[orderByFunc];
  const sortByIteratee = (ts) => {
    const values = _.map(ts.datapoints, (point) => {
      return point[0];
    });
    return orderByCallback(values);
  };
  const sortedTimeseries = _.sortBy(timeseries, sortByIteratee);
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

function sortSeries(direction, timeseries: any[]) {
  return _.orderBy(timeseries, [ts => {
    return ts.target.toLowerCase();
  }], direction);
}

function setAlias(alias, timeseries) {
  // TODO: use getTemplateSrv() when available (since 7.0)
  if (this.templateSrv && timeseries && timeseries.scopedVars) {
    alias = this.templateSrv.replace(alias, timeseries.scopedVars);
  }
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
  // TODO: use getTemplateSrv() when available (since 7.0)
  if (this.templateSrv && timeseries && timeseries.scopedVars) {
    alias = this.templateSrv.replace(alias, timeseries.scopedVars);
  }
  timeseries.target = alias;
  return timeseries;
}

function setAliasByRegex(alias, timeseries) {
  timeseries.target = extractText(timeseries.target, alias);
  return timeseries;
}

function extractText(str, pattern) {
  const extractPattern = new RegExp(pattern);
  const extractedValue = extractPattern.exec(str);
  return extractedValue[0];
}

function groupByWrapper(interval, groupFunc, datapoints) {
  const groupByCallback = aggregationFunctions[groupFunc];
  return groupBy(datapoints, interval, groupByCallback);
}

function aggregateByWrapper(interval, aggregateFunc, datapoints) {
  // Flatten all points in frame and then just use groupBy()
  const flattenedPoints = ts.flattenDatapoints(datapoints);
  // groupBy_perf works with sorted series only
  const sortedPoints = ts.sortByTime(flattenedPoints);
  const groupByCallback = aggregationFunctions[aggregateFunc];
  return groupBy(sortedPoints, interval, groupByCallback);
}

function aggregateWrapper(groupByCallback, interval, datapoints) {
  const flattenedPoints = ts.flattenDatapoints(datapoints);
  // groupBy_perf works with sorted series only
  const sortedPoints = ts.sortByTime(flattenedPoints);
  return groupBy(sortedPoints, interval, groupByCallback);
}

function percentileAgg(interval, n, datapoints) {
  const flattenedPoints = ts.flattenDatapoints(datapoints);
  // groupBy_perf works with sorted series only
  const sortedPoints = ts.sortByTime(flattenedPoints);
  const groupByCallback = _.partial(PERCENTILE, n);
  return groupBy(sortedPoints, interval, groupByCallback);
}

function timeShift(interval, range) {
  const shift = utils.parseTimeShiftInterval(interval) / 1000;
  return _.map(range, time => {
    return time - shift;
  });
}

function unShiftTimeSeries(interval, datapoints) {
  const unshift = utils.parseTimeShiftInterval(interval);
  return _.map(datapoints, dp => {
    return [
      dp[0],
      dp[1] + unshift
    ];
  });
}

const metricFunctions = {
  groupBy: groupByWrapper,
  scale: scale,
  offset: offset,
  delta: delta,
  rate: rate,
  movingAverage: simpleMovingAverage,
  exponentialMovingAverage: expMovingAverage,
  percentile: percentile,
  transformNull: transformNull,
  aggregateBy: aggregateByWrapper,
  // Predefined aggs
  percentileAgg: percentileAgg,
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

const aggregationFunctions = {
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
