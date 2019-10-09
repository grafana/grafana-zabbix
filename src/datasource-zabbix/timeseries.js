/**
 * timeseries.js
 *
 * This module contains functions for working with time series.
 *
 * datapoints - array of points where point is [value, timestamp]. In almost all cases (if other wasn't
 * explicitly said) we assume datapoints are sorted by timestamp. Timestamp is the number of milliseconds
 * since 1 January 1970 00:00:00 UTC.
 *
 */

import _ from 'lodash';
import * as utils from './utils';
import * as c from './constants';

const POINT_VALUE = 0;
const POINT_TIMESTAMP = 1;

/**
 * Downsample time series by using given function (avg, min, max).
 */
function downsample(datapoints, time_to, ms_interval, func) {
  var downsampledSeries = [];
  var timeWindow = {
    from: time_to * 1000 - ms_interval,
    to: time_to * 1000
  };

  var points_sum = 0;
  var points_num = 0;
  var value_avg = 0;
  var frame = [];

  for (var i = datapoints.length - 1; i >= 0; i -= 1) {
    if (timeWindow.from < datapoints[i][1] && datapoints[i][1] <= timeWindow.to) {
      points_sum += datapoints[i][0];
      points_num++;
      frame.push(datapoints[i][0]);
    }
    else {
      value_avg = points_num ? points_sum / points_num : 0;

      if (func === "max") {
        downsampledSeries.push([_.max(frame), timeWindow.to]);
      }
      else if (func === "min") {
        downsampledSeries.push([_.min(frame), timeWindow.to]);
      }

      // avg by default
      else {
        downsampledSeries.push([value_avg, timeWindow.to]);
      }

      // Shift time window
      timeWindow.to = timeWindow.from;
      timeWindow.from -= ms_interval;

      points_sum = 0;
      points_num = 0;
      frame = [];

      // Process point again
      i++;
    }
  }
  return downsampledSeries.reverse();
}

/**
 * Group points by given time interval
 * datapoints: [[<value>, <unixtime>], ...]
 */
function groupBy(datapoints, interval, groupByCallback) {
  var ms_interval = utils.parseInterval(interval);

  // Calculate frame timestamps
  var frames = _.groupBy(datapoints, function (point) {
    // Calculate time for group of points
    return Math.floor(point[1] / ms_interval) * ms_interval;
  });

  // frame: { '<unixtime>': [[<value>, <unixtime>], ...] }
  // return [{ '<unixtime>': <value> }, { '<unixtime>': <value> }, ...]
  var grouped = _.mapValues(frames, function (frame) {
    var points = _.map(frame, function (point) {
      return point[0];
    });
    return groupByCallback(points);
  });

  // Convert points to Grafana format
  return sortByTime(_.map(grouped, function (value, timestamp) {
    return [Number(value), Number(timestamp)];
  }));
}

export function groupBy_perf(datapoints, interval, groupByCallback) {
  if (datapoints.length === 0) {
    return [];
  }

  if (interval === c.RANGE_VARIABLE_VALUE) {
    return groupByRange(datapoints, groupByCallback);
  }

  let ms_interval = utils.parseInterval(interval);
  let grouped_series = [];
  let frame_values = [];
  let frame_value;
  let frame_ts = datapoints.length ? getPointTimeFrame(datapoints[0][POINT_TIMESTAMP], ms_interval) : 0;
  let point_frame_ts = frame_ts;
  let point;

  for (let i=0; i < datapoints.length; i++) {
    point = datapoints[i];
    point_frame_ts = getPointTimeFrame(point[POINT_TIMESTAMP], ms_interval);
    if (point_frame_ts === frame_ts) {
      frame_values.push(point[POINT_VALUE]);
    } else if (point_frame_ts > frame_ts) {
      frame_value = groupByCallback(frame_values);
      grouped_series.push([frame_value, frame_ts]);

      // Move frame window to next non-empty interval and fill empty by null
      frame_ts += ms_interval;
      while (frame_ts < point_frame_ts) {
        grouped_series.push([null, frame_ts]);
        frame_ts += ms_interval;
      }
      frame_values = [point[POINT_VALUE]];
    }
  }

  frame_value = groupByCallback(frame_values);
  grouped_series.push([frame_value, frame_ts]);

  return grouped_series;
}

export function groupByRange(datapoints, groupByCallback) {
  const frame_values = [];
  const frame_start = datapoints[0][POINT_TIMESTAMP];
  const frame_end = datapoints[datapoints.length - 1][POINT_TIMESTAMP];
  let point;
  for (let i=0; i < datapoints.length; i++) {
    point = datapoints[i];
    frame_values.push(point[POINT_VALUE]);
  }
  const frame_value = groupByCallback(frame_values);
  return [[frame_value, frame_start], [frame_value, frame_end]];
}

/**
 * Summarize set of time series into one.
 * @param {datapoints[]} timeseries array of time series
 */
function sumSeries(timeseries) {

  // Calculate new points for interpolation
  var new_timestamps = _.uniq(_.map(_.flatten(timeseries, true), function (point) {
    return point[1];
  }));
  new_timestamps = _.sortBy(new_timestamps);

  var interpolated_timeseries = _.map(timeseries, function (series) {
    series = fillZeroes(series, new_timestamps);
    var timestamps = _.map(series, function (point) {
      return point[1];
    });
    var new_points = _.map(_.difference(new_timestamps, timestamps), function (timestamp) {
      return [null, timestamp];
    });
    var new_series = series.concat(new_points);
    return sortByTime(new_series);
  });

  _.each(interpolated_timeseries, interpolateSeries);

  var new_timeseries = [];
  var sum;
  for (var i = new_timestamps.length - 1; i >= 0; i--) {
    sum = 0;
    for (var j = interpolated_timeseries.length - 1; j >= 0; j--) {
      sum += interpolated_timeseries[j][i][0];
    }
    new_timeseries.push([sum, new_timestamps[i]]);
  }

  return sortByTime(new_timeseries);
}

function scale(datapoints, factor) {
  return _.map(datapoints, point => {
    return [
      point[0] * factor,
      point[1]
    ];
  });
}

function scale_perf(datapoints, factor) {
  for (let i = 0; i < datapoints.length; i++) {
    datapoints[i] = [
      datapoints[i][POINT_VALUE] * factor,
      datapoints[i][POINT_TIMESTAMP]
    ];
  }

  return datapoints;
}

function offset(datapoints, delta) {
  for (let i = 0; i < datapoints.length; i++) {
    datapoints[i] = [
      datapoints[i][POINT_VALUE] + delta,
      datapoints[i][POINT_TIMESTAMP]
    ];
  }

  return datapoints;
}

/**
 * Simple delta. Calculate value delta between points.
 * @param {*} datapoints
 */
function delta(datapoints) {
  let newSeries = [];
  let deltaValue;
  for (var i = 1; i < datapoints.length; i++) {
    deltaValue = datapoints[i][0] - datapoints[i - 1][0];
    newSeries.push([deltaValue, datapoints[i][1]]);
  }
  return newSeries;
}

/**
 * Calculates rate per second. Resistant to counter reset.
 * @param {*} datapoints
 */
function rate(datapoints) {
  let newSeries = [];
  let point, point_prev;
  let valueDelta = 0;
  let timeDelta = 0;
  for (let i = 1; i < datapoints.length; i++) {
    point = datapoints[i];
    point_prev = datapoints[i - 1];

    // Convert ms to seconds
    timeDelta = (point[POINT_TIMESTAMP] - point_prev[POINT_TIMESTAMP]) / 1000;

    // Handle counter reset - use previous value
    if (point[POINT_VALUE] >= point_prev[POINT_VALUE]) {
      valueDelta = (point[POINT_VALUE] - point_prev[POINT_VALUE]) / timeDelta;
    }

    newSeries.push([valueDelta, point[POINT_TIMESTAMP]]);
  }
  return newSeries;
}

function simpleMovingAverage(datapoints, n) {
  let sma = [];
  let w_sum;
  let w_avg = null;
  let w_count = 0;

  // Initial window
  for (let j = n; j > 0; j--) {
    if (datapoints[n - j][POINT_VALUE] !== null) {
      w_avg += datapoints[n - j][POINT_VALUE];
      w_count++;
    }
  }
  if (w_count > 0) {
    w_avg = w_avg / w_count;
  } else {
    w_avg = null;
  }
  sma.push([w_avg, datapoints[n - 1][POINT_TIMESTAMP]]);

  for (let i = n; i < datapoints.length; i++) {
    // Insert next value
    if (datapoints[i][POINT_VALUE] !== null) {
      w_sum = w_avg * w_count;
      w_avg = (w_sum + datapoints[i][POINT_VALUE]) / (w_count + 1);
      w_count++;
    }
    // Remove left side point
    if (datapoints[i - n][POINT_VALUE] !== null) {
      w_sum = w_avg * w_count;
      if (w_count > 1) {
        w_avg = (w_sum - datapoints[i - n][POINT_VALUE]) / (w_count - 1);
        w_count--;
      } else {
        w_avg = null;
        w_count = 0;
      }
    }
    sma.push([w_avg, datapoints[i][POINT_TIMESTAMP]]);
  }
  return sma;
}

function expMovingAverage(datapoints, n) {
  let ema = [datapoints[0]];
  let ema_prev = datapoints[0][POINT_VALUE];
  let ema_cur;
  let a;

  if (n > 1) {
    // Calculate a from window size
    a = 2 / (n + 1);

    // Initial window, use simple moving average
    let w_avg = null;
    let w_count = 0;
    for (let j = n; j > 0; j--) {
      if (datapoints[n - j][POINT_VALUE] !== null) {
        w_avg += datapoints[n - j][POINT_VALUE];
        w_count++;
      }
    }
    if (w_count > 0) {
      w_avg = w_avg / w_count;
      // Actually, we should set timestamp from datapoints[n-1] and start calculation of EMA from n.
      // But in order to start EMA from first point (not from Nth) we should expand time range and request N additional
      // points outside left side of range. We can't do that, so this trick is used for pretty view of first N points.
      // We calculate AVG for first N points, but then start from 2nd point, not from Nth. In general, it means we
      // assume that previous N values (0-N, 0-(N-1), ..., 0-1) have the same average value as a first N values.
      ema = [[w_avg, datapoints[0][POINT_TIMESTAMP]]];
      ema_prev = w_avg;
      n = 1;
    }
  } else {
    // Use predefined a and start from 1st point (use it as initial EMA value)
    a = n;
    n = 1;
  }

  for (let i = n; i < datapoints.length; i++) {
    if (datapoints[i][POINT_VALUE] !== null) {
      ema_cur = a * datapoints[i][POINT_VALUE] + (1 - a) * ema_prev;
      ema_prev = ema_cur;
      ema.push([ema_cur, datapoints[i][POINT_TIMESTAMP]]);
    } else {
      ema.push([null, datapoints[i][POINT_TIMESTAMP]]);
    }
  }
  return ema;
}

function PERCENTILE(n, values) {
  var sorted = _.sortBy(values);
  return sorted[Math.floor(sorted.length * n / 100)];
}

function COUNT(values) {
  return values.length;
}

function SUM(values) {
  var sum = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      sum += values[i];
    }
  }
  return sum;
}

function AVERAGE(values) {
  let values_non_null = getNonNullValues(values);
  if (values_non_null.length === 0) {
    return null;
  }
  return SUM(values_non_null) / values_non_null.length;
}

function getNonNullValues(values) {
  let values_non_null = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      values_non_null.push(values[i]);
    }
  }
  return values_non_null;
}

function MIN(values) {
  return _.min(values);
}

function MAX(values) {
  return _.max(values);
}

function MEDIAN(values) {
  var sorted = _.sortBy(values);
  return sorted[Math.floor(sorted.length / 2)];
}

///////////////////////
// Utility functions //
///////////////////////

/**
 * For given point calculate corresponding time frame.
 *
 * |__*_|_*__|___*| -> |*___|*___|*___|
 *
 * @param {*} timestamp
 * @param {*} ms_interval
 */
function getPointTimeFrame(timestamp, ms_interval) {
  return Math.floor(timestamp / ms_interval) * ms_interval;
}

function sortByTime(series) {
  return _.sortBy(series, function (point) {
    return point[1];
  });
}

/**
 * Fill empty front and end of series by zeroes.
 *
 * |   ***   |    |   ***   |
 * |___   ___| -> |***   ***|
 * @param {*} series
 * @param {*} timestamps
 */
function fillZeroes(series, timestamps) {
  let prepend = [];
  let append = [];
  let new_point;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] < series[0][POINT_TIMESTAMP]) {
      new_point = [0, timestamps[i]];
      prepend.push(new_point);
    } else if (timestamps[i] > series[series.length - 1][POINT_TIMESTAMP]) {
      new_point = [0, timestamps[i]];
      append.push(new_point);
    }
  }
  return _.concat(_.concat(prepend, series), append);
}

/**
 * Interpolate series with gaps
 */
function interpolateSeries(series) {
  var left, right;

  // Interpolate series
  for (var i = series.length - 1; i >= 0; i--) {
    if (!series[i][0]) {
      left = findNearestLeft(series, i);
      right = findNearestRight(series, i);
      if (!left) {
        left = right;
      }
      if (!right) {
        right = left;
      }
      series[i][0] = linearInterpolation(series[i][1], left, right);
    }
  }
  return series;
}

function linearInterpolation(timestamp, left, right) {
  if (left[1] === right[1]) {
    return (left[0] + right[0]) / 2;
  } else {
    return (left[0] + (right[0] - left[0]) / (right[1] - left[1]) * (timestamp - left[1]));
  }
}

function findNearestRight(series, pointIndex) {
  for (var i = pointIndex; i < series.length; i++) {
    if (series[i][0] !== null) {
      return series[i];
    }
  }
  return null;
}

function findNearestLeft(series, pointIndex) {
  for (var i = pointIndex; i > 0; i--) {
    if (series[i][0] !== null) {
      return series[i];
    }
  }
  return null;
}

function flattenDatapoints(datapoints) {
  const depth = utils.getArrayDepth(datapoints);
  if (depth <= 2) {
    // Don't process if datapoints already flattened
    return datapoints;
  }
  return _.flatten(datapoints);
}

////////////
// Export //
////////////

const exportedFunctions = {
  downsample,
  groupBy,
  groupBy_perf,
  groupByRange,
  sumSeries,
  scale,
  offset,
  scale_perf,
  delta,
  rate,
  simpleMovingAverage,
  expMovingAverage,
  SUM,
  COUNT,
  AVERAGE,
  MIN,
  MAX,
  MEDIAN,
  PERCENTILE,
  sortByTime,
  flattenDatapoints,
};

export default exportedFunctions;
