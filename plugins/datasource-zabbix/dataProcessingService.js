define([
  'angular',
  'lodash',
  'moment'
],
function (angular, _, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('DataProcessingService', function() {

    /**
     * Downsample datapoints series
     */
    this.downsampleSeries = function(datapoints, time_to, ms_interval, func) {
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
    };

    /**
     * Group points by given time interval
     * datapoints: [[<value>, <unixtime>], ...]
     */
    this.groupBy = function(datapoints, ms_interval, groupByCallback) {
      var frames = _.groupBy(datapoints, function(point) {
        var group_time = Number(moment.utc(point[1]).startOf('minute').valueOf());
        group_time = Math.ceil(point[1] / ms_interval) * ms_interval;
        return group_time;
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
      return _.map(grouped, function(value, timestamp) {
        return [Number(value), Number(timestamp)];
      });
    };

    this.AVERAGE = function(values) {
      var sum = 0;
      _.each(values, function(value) {
        sum += value;
      });
      return sum / values.length;
    };

    this.MIN = function(values) {
      return _.min(values);
    };

    this.MAX = function(values) {
      return _.max(values);
    };

  });
});