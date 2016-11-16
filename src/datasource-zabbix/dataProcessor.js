import _ from 'lodash';
import * as utils from './utils';

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
function groupBy(interval, groupByCallback, datapoints) {
  var ms_interval = utils.parseInterval(interval);

  // Calculate frame timestamps
  var frames = _.groupBy(datapoints, function(point) {
    // Calculate time for group of points
    return Math.floor(point[1] / ms_interval) * ms_interval;
  });

  // frame: { '<unixtime>': [[<value>, <unixtime>], ...] }
  // return [{ '<unixtime>': <value> }, { '<unixtime>': <value> }, ...]
  var grouped = _.mapValues(frames, function(frame) {
    var points = _.map(frame, function(point) {
      return point[0];
    });
    return groupByCallback(points);
  });

  // Convert points to Grafana format
  return sortByTime(_.map(grouped, function(value, timestamp) {
    return [Number(value), Number(timestamp)];
  }));
}

function sumSeries(timeseries) {

  // Calculate new points for interpolation
  var new_timestamps = _.uniq(_.map(_.flatten(timeseries, true), function(point) {
    return point[1];
  }));
  new_timestamps = _.sortBy(new_timestamps);

  var interpolated_timeseries = _.map(timeseries, function(series) {
    var timestamps = _.map(series, function(point) {
      return point[1];
    });
    var new_points = _.map(_.difference(new_timestamps, timestamps), function(timestamp) {
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

function AVERAGE(values) {
  var sum = 0;
  _.each(values, function(value) {
    sum += value;
  });
  return sum / values.length;
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

function setAlias(alias, timeseries) {
  timeseries.target = alias;
  return timeseries;
}

function scale(factor, datapoints) {
  return _.map(datapoints, point => {
    return [
      point[0] * factor,
      point[1]
    ];
  });
}

function delta(datapoints) {
  let newSeries = [];
  let deltaValue;
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
  var flattenedPoints = _.flatten(datapoints, true);
  var groupByCallback = aggregationFunctions[aggregateFunc];
  return groupBy(interval, groupByCallback, flattenedPoints);
}

function aggregateWrapper(groupByCallback, interval, datapoints) {
  var flattenedPoints = _.flatten(datapoints, true);
  return groupBy(interval, groupByCallback, flattenedPoints);
}

function sortByTime(series) {
  return _.sortBy(series, function(point) {
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
    return (left[0] + (right[0] - left[0]) / (right[1] - left[1]) * (timestamp - left[1]));
  }
}

function findNearestRight(series, point) {
  var point_index = _.indexOf(series, point);
  var nearestRight;
  for (var i = point_index; i < series.length; i++) {
    if (series[i][0] !== null) {
      return series[i];
    }
  }
  return nearestRight;
}

function findNearestLeft(series, point) {
  var point_index = _.indexOf(series, point);
  var nearestLeft;
  for (var i = point_index; i > 0; i--) {
    if (series[i][0] !== null) {
      return series[i];
    }
  }
  return nearestLeft;
}

let metricFunctions = {
  groupBy: groupByWrapper,
  scale: scale,
  delta: delta,
  aggregateBy: aggregateByWrapper,
  average: _.partial(aggregateWrapper, AVERAGE),
  min: _.partial(aggregateWrapper, MIN),
  max: _.partial(aggregateWrapper, MAX),
  median: _.partial(aggregateWrapper, MEDIAN),
  sumSeries: sumSeries,
  top: _.partial(limit, 'top'),
  bottom: _.partial(limit, 'bottom'),
  setAlias: setAlias
};

let aggregationFunctions = {
  avg: AVERAGE,
  min: MIN,
  max: MAX,
  median: MEDIAN
};

export default {
  downsampleSeries: downsampleSeries,
  groupBy: groupBy,
  AVERAGE: AVERAGE,
  MIN: MIN,
  MAX: MAX,
  MEDIAN: MEDIAN,

  get aggregationFunctions() {
    return aggregationFunctions;
  },

  get metricFunctions() {
    return metricFunctions;
  }
};
