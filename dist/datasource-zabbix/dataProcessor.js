'use strict';

System.register(['lodash', './utils', './timeseries'], function (_export, _context) {
  "use strict";

  var _, utils, ts, downsampleSeries, groupBy, groupBy_exported, sumSeries, delta, rate, scale, simpleMovingAverage, expMovingAverage, SUM, COUNT, AVERAGE, MIN, MAX, MEDIAN, PERCENTIL, metricFunctions, aggregationFunctions;

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
    var flattenedPoints = _.flatten(datapoints, true);
    // groupBy_perf works with sorted series only
    var sortedPoints = ts.sortByTime(flattenedPoints);
    var groupByCallback = aggregationFunctions[aggregateFunc];
    return groupBy(sortedPoints, interval, groupByCallback);
  }

  function aggregateWrapper(groupByCallback, interval, datapoints) {
    var flattenedPoints = _.flatten(datapoints, true);
    return groupBy(flattenedPoints, interval, groupByCallback);
  }

  function percentil(interval, n, datapoints) {
    var flattenedPoints = _.flatten(datapoints, true);
    var groupByCallback = _.partial(PERCENTIL, n);
    return groupBy(flattenedPoints, interval, groupByCallback);
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
      groupBy = ts.groupBy_perf;

      groupBy_exported = function groupBy_exported(interval, groupFunc, datapoints) {
        return groupBy(datapoints, interval, groupFunc);
      };

      sumSeries = ts.sumSeries;
      delta = ts.delta;
      rate = ts.rate;

      scale = function scale(factor, datapoints) {
        return ts.scale_perf(datapoints, factor);
      };

      simpleMovingAverage = function simpleMovingAverage(n, datapoints) {
        return ts.simpleMovingAverage(datapoints, n);
      };

      expMovingAverage = function expMovingAverage(a, datapoints) {
        return ts.expMovingAverage(datapoints, a);
      };

      SUM = ts.SUM;
      COUNT = ts.COUNT;
      AVERAGE = ts.AVERAGE;
      MIN = ts.MIN;
      MAX = ts.MAX;
      MEDIAN = ts.MEDIAN;
      PERCENTIL = ts.PERCENTIL;
      metricFunctions = {
        groupBy: groupByWrapper,
        scale: scale,
        delta: delta,
        rate: rate,
        movingAverage: simpleMovingAverage,
        exponentialMovingAverage: expMovingAverage,
        aggregateBy: aggregateByWrapper,
        // Predefined aggs
        percentil: percentil,
        average: _.partial(aggregateWrapper, AVERAGE),
        min: _.partial(aggregateWrapper, MIN),
        max: _.partial(aggregateWrapper, MAX),
        median: _.partial(aggregateWrapper, MEDIAN),
        sum: _.partial(aggregateWrapper, SUM),
        count: _.partial(aggregateWrapper, COUNT),
        sumSeries: sumSeries,
        top: _.partial(limit, 'top'),
        bottom: _.partial(limit, 'bottom'),
        sortSeries: sortSeries,
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
      });
    }
  };
});
//# sourceMappingURL=dataProcessor.js.map
