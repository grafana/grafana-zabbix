'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Downsample datapoints series
 */
function downsampleSeries(datapoints, time_to, ms_interval, func) {
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
    } else {
      value_avg = points_num ? points_sum / points_num : 0;

      if (func === "max") {
        downsampledSeries.push([_lodash2.default.max(frame), timeWindow.to]);
      } else if (func === "min") {
        downsampledSeries.push([_lodash2.default.min(frame), timeWindow.to]);
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
function groupBy(interval, groupByCallback, datapoints) {
  var ms_interval = utils.parseInterval(interval);

  // Calculate frame timestamps
  var frames = _lodash2.default.groupBy(datapoints, function (point) {
    // Calculate time for group of points
    return Math.floor(point[1] / ms_interval) * ms_interval;
  });

  // frame: { '<unixtime>': [[<value>, <unixtime>], ...] }
  // return [{ '<unixtime>': <value> }, { '<unixtime>': <value> }, ...]
  var grouped = _lodash2.default.mapValues(frames, function (frame) {
    var points = _lodash2.default.map(frame, function (point) {
      return point[0];
    });
    return groupByCallback(points);
  });

  // Convert points to Grafana format
  return sortByTime(_lodash2.default.map(grouped, function (value, timestamp) {
    return [Number(value), Number(timestamp)];
  }));
}

function sumSeries(timeseries) {

  // Calculate new points for interpolation
  var new_timestamps = _lodash2.default.uniq(_lodash2.default.map(_lodash2.default.flatten(timeseries, true), function (point) {
    return point[1];
  }));
  new_timestamps = _lodash2.default.sortBy(new_timestamps);

  var interpolated_timeseries = _lodash2.default.map(timeseries, function (series) {
    var timestamps = _lodash2.default.map(series, function (point) {
      return point[1];
    });
    var new_points = _lodash2.default.map(_lodash2.default.difference(new_timestamps, timestamps), function (timestamp) {
      return [null, timestamp];
    });
    var new_series = series.concat(new_points);
    return sortByTime(new_series);
  });

  _lodash2.default.each(interpolated_timeseries, interpolateSeries);

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

function SUM(values) {
  var sum = 0;
  _lodash2.default.each(values, function (value) {
    sum += value;
  });
  return sum;
}

function COUNT(values) {
  return values.length;
}

function AVERAGE(values) {
  var sum = 0;
  _lodash2.default.each(values, function (value) {
    sum += value;
  });
  return sum / values.length;
}

function MIN(values) {
  return _lodash2.default.min(values);
}

function MAX(values) {
  return _lodash2.default.max(values);
}

function MEDIAN(values) {
  var sorted = _lodash2.default.sortBy(values);
  return sorted[Math.floor(sorted.length / 2)];
}

function setAlias(alias, timeseries) {
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

function scale(factor, datapoints) {
  return _lodash2.default.map(datapoints, function (point) {
    return [point[0] * factor, point[1]];
  });
}

function delta(datapoints) {
  var newSeries = [];
  var deltaValue = void 0;
  for (var i = 1; i < datapoints.length; i++) {
    deltaValue = datapoints[i][0] - datapoints[i - 1][0];
    newSeries.push([deltaValue, datapoints[i][1]]);
  }
  return newSeries;
}

function groupByWrapper(interval, groupFunc, datapoints) {
  var groupByCallback = aggregationFunctions[groupFunc];
  return groupBy(interval, groupByCallback, datapoints);
}

function aggregateByWrapper(interval, aggregateFunc, datapoints) {
  // Flatten all points in frame and then just use groupBy()
  var flattenedPoints = _lodash2.default.flatten(datapoints, true);
  var groupByCallback = aggregationFunctions[aggregateFunc];
  return groupBy(interval, groupByCallback, flattenedPoints);
}

function aggregateWrapper(groupByCallback, interval, datapoints) {
  var flattenedPoints = _lodash2.default.flatten(datapoints, true);
  return groupBy(interval, groupByCallback, flattenedPoints);
}

function sortByTime(series) {
  return _lodash2.default.sortBy(series, function (point) {
    return point[1];
  });
}

/**
 * Interpolate series with gaps
 */
function interpolateSeries(series) {
  var left, right;

  // Interpolate series
  for (var i = series.length - 1; i >= 0; i--) {
    if (!series[i][0]) {
      left = findNearestLeft(series, series[i]);
      right = findNearestRight(series, series[i]);
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
    return left[0] + (right[0] - left[0]) / (right[1] - left[1]) * (timestamp - left[1]);
  }
}

function findNearestRight(series, point) {
  var point_index = _lodash2.default.indexOf(series, point);
  var nearestRight;
  for (var i = point_index; i < series.length; i++) {
    if (series[i][0] !== null) {
      return series[i];
    }
  }
  return nearestRight;
}

function findNearestLeft(series, point) {
  var point_index = _lodash2.default.indexOf(series, point);
  var nearestLeft;
  for (var i = point_index; i > 0; i--) {
    if (series[i][0] !== null) {
      return series[i];
    }
  }
  return nearestLeft;
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
  aggregateBy: aggregateByWrapper,
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
  setAliasByRegex: setAliasByRegex
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
  groupBy: groupBy,
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
