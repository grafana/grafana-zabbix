'use strict';

System.register(['lodash', './utils'], function (_export, _context) {
  "use strict";

  var _, utils, POINT_VALUE, POINT_TIMESTAMP, exportedFunctions;

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
      } else {
        value_avg = points_num ? points_sum / points_num : 0;

        if (func === "max") {
          downsampledSeries.push([_.max(frame), timeWindow.to]);
        } else if (func === "min") {
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

  function groupBy_perf(datapoints, interval, groupByCallback) {
    var ms_interval = utils.parseInterval(interval);
    var grouped_series = [];
    var frame_values = [];
    var frame_value = void 0;
    var frame_ts = datapoints.length ? getPointTimeFrame(datapoints[0][POINT_TIMESTAMP], ms_interval) : 0;
    var point_frame_ts = frame_ts;
    var point = void 0;

    for (var i = 0; i < datapoints.length; i++) {
      point = datapoints[i];
      point_frame_ts = getPointTimeFrame(point[POINT_TIMESTAMP], ms_interval);
      if (point_frame_ts === frame_ts) {
        frame_values.push(point[POINT_VALUE]);
      } else {
        frame_value = groupByCallback(frame_values);
        grouped_series.push([frame_value, frame_ts]);
        frame_ts = point_frame_ts;
        frame_values = [point[POINT_VALUE]];
      }
    }

    frame_value = groupByCallback(frame_values);
    grouped_series.push([frame_value, frame_ts]);

    return grouped_series;
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
    return _.map(datapoints, function (point) {
      return [point[0] * factor, point[1]];
    });
  }

  /**
   * Simple delta. Calculate value delta between points.
   * @param {*} datapoints
   */
  function delta(datapoints) {
    var newSeries = [];
    var deltaValue = void 0;
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
    var newSeries = [];
    var point = void 0,
        point_prev = void 0;
    var valueDelta = 0;
    var timeDelta = 0;
    for (var i = 1; i < datapoints.length; i++) {
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

  function SUM(values) {
    var sum = 0;
    _.each(values, function (value) {
      sum += value;
    });
    return sum;
  }

  function COUNT(values) {
    return values.length;
  }

  function AVERAGE(values) {
    var sum = 0;
    _.each(values, function (value) {
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

  ////////////
  // Export //
  ////////////

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_utils) {
      utils = _utils;
    }],
    execute: function () {
      POINT_VALUE = 0;
      POINT_TIMESTAMP = 1;
      exportedFunctions = {
        downsample: downsample,
        groupBy: groupBy,
        groupBy_perf: groupBy_perf,
        sumSeries: sumSeries,
        scale: scale,
        delta: delta,
        rate: rate,
        SUM: SUM,
        COUNT: COUNT,
        AVERAGE: AVERAGE,
        MIN: MIN,
        MAX: MAX,
        MEDIAN: MEDIAN
      };

      _export('default', exportedFunctions);
    }
  };
});
//# sourceMappingURL=timeseries.js.map
