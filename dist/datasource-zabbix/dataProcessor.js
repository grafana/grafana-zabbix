'use strict';

System.register(['lodash', './utils', './timeseries'], function (_export, _context) {
  "use strict";

  var _, utils, ts, downsampleSeries, groupBy, sumSeries, scale, delta, SUM, COUNT, AVERAGE, MIN, MAX, MEDIAN, metricFunctions, aggregationFunctions;

  function limit(order, n, orderByFunc, timeseries) {
    var orderByCallback = aggregationFunctions[orderByFunc];
    var sortByIteratee = function sortByIteratee(ts) {
      var values = _.map(ts.datapoints, function (point) {
        return point[0];
      });
      return orderByCallback(values);
    };
    var sortedTimeseries = _.sortBy(timeseries, sortByIteratee);
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

  function timeShift(interval, range) {
    var shift = utils.parseTimeShiftInterval(interval) / 1000;
    return _.map(range, function (time) {
      return time - shift;
    });
  }

  function unShiftTimeSeries(interval, datapoints) {
    var unshift = utils.parseTimeShiftInterval(interval);
    return _.map(datapoints, function (dp) {
      return [dp[0], dp[1] + unshift];
    });
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_utils) {
      utils = _utils;
    }, function (_timeseries) {
      ts = _timeseries.default;
    }],
    execute: function () {
      downsampleSeries = ts.downsample;
      groupBy = ts.groupBy;
      sumSeries = ts.sumSeries;
      scale = ts.scale;
      delta = ts.delta;
      SUM = ts.SUM;
      COUNT = ts.COUNT;
      AVERAGE = ts.AVERAGE;
      MIN = ts.MIN;
      MAX = ts.MAX;
      MEDIAN = ts.MEDIAN;
      metricFunctions = {
        groupBy: groupByWrapper,
        scale: scale,
        delta: delta,
        aggregateBy: aggregateByWrapper,
        average: _.partial(aggregateWrapper, AVERAGE),
        min: _.partial(aggregateWrapper, MIN),
        max: _.partial(aggregateWrapper, MAX),
        median: _.partial(aggregateWrapper, MEDIAN),
        sum: _.partial(aggregateWrapper, SUM),
        count: _.partial(aggregateWrapper, COUNT),
        sumSeries: sumSeries,
        top: _.partial(limit, 'top'),
        bottom: _.partial(limit, 'bottom'),
        timeShift: timeShift,
        setAlias: setAlias,
        setAliasByRegex: setAliasByRegex,
        replaceAlias: replaceAlias
      };
      aggregationFunctions = {
        avg: AVERAGE,
        min: MIN,
        max: MAX,
        median: MEDIAN,
        sum: SUM,
        count: COUNT
      };

      _export('default', {
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
      });
    }
  };
});
//# sourceMappingURL=dataProcessor.js.map
