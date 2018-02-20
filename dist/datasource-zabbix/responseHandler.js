'use strict';

System.register(['lodash', 'app/core/table_model', './constants'], function (_export, _context) {
  "use strict";

  var _, TableModel, c;

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  /**
   * Convert Zabbix API history.get response to Grafana format
   *
   * @return {Array}            Array of timeseries in Grafana format
   *                            {
   *                               target: "Metric name",
   *                               datapoints: [[<value>, <unixtime>], ...]
   *                            }
   */
  function convertHistory(history, items, addHostName, convertPointCallback) {
    /**
     * Response should be in the format:
     * data: [
     *          {
     *             target: "Metric name",
     *             datapoints: [[<value>, <unixtime>], ...]
     *          }, ...
     *       ]
     */

    // Group history by itemid
    var grouped_history = _.groupBy(history, 'itemid');
    var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid'); //uniqBy is needed to deduplicate

    return _.map(grouped_history, function (hist, itemid) {
      var item = _.find(items, { 'itemid': itemid });
      var alias = item.name;
      if (_.keys(hosts).length > 1 && addHostName) {
        //only when actual multi hosts selected
        var host = _.find(hosts, { 'hostid': item.hostid });
        alias = host.name + ": " + alias;
      }
      return {
        target: alias,
        datapoints: _.map(hist, convertPointCallback)
      };
    });
  }

  function handleHistory(history, items) {
    var addHostName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    return convertHistory(history, items, addHostName, convertHistoryPoint);
  }function handleTrends(history, items, valueType) {
    var addHostName = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

    var convertPointCallback = _.partial(convertTrendPoint, valueType);
    return convertHistory(history, items, addHostName, convertPointCallback);
  }

  function handleText(history, items, target) {
    var addHostName = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

    var convertTextCallback = _.partial(convertText, target);
    return convertHistory(history, items, addHostName, convertTextCallback);
  }function handleHistoryAsTable(history, items, target) {
    var table = new TableModel();
    table.addColumn({ text: 'Host' });
    table.addColumn({ text: 'Item' });
    table.addColumn({ text: 'Key' });
    table.addColumn({ text: 'Last value' });

    var grouped_history = _.groupBy(history, 'itemid');
    _.each(items, function (item) {
      var itemHistory = grouped_history[item.itemid] || [];
      var lastPoint = _.last(itemHistory);
      var lastValue = lastPoint ? lastPoint.value : null;

      if (target.options.skipEmptyValues && (!lastValue || lastValue === '')) {
        return;
      }

      // Regex-based extractor
      if (target.textFilter) {
        lastValue = extractText(lastValue, target.textFilter, target.useCaptureGroups);
      }

      var host = _.first(item.hosts);
      host = host ? host.name : "";

      table.rows.push([host, item.name, item.key_, lastValue]);
    });

    return table;
  }

  function convertText(target, point) {
    var value = point.value;

    // Regex-based extractor
    if (target.textFilter) {
      value = extractText(point.value, target.textFilter, target.useCaptureGroups);
    }

    return [value, point.clock * 1000 + Math.round(point.ns / 1000000)];
  }function extractText(str, pattern, useCaptureGroups) {
    var extractPattern = new RegExp(pattern);
    var extractedValue = extractPattern.exec(str);
    if (extractedValue) {
      if (useCaptureGroups) {
        extractedValue = extractedValue[1];
      } else {
        extractedValue = extractedValue[0];
      }
    }
    return extractedValue;
  }

  function handleSLAResponse(itservice, slaProperty, slaObject) {
    var targetSLA = slaObject[itservice.serviceid].sla[0];
    if (slaProperty.property === 'status') {
      var targetStatus = parseInt(slaObject[itservice.serviceid].status);
      return {
        target: itservice.name + ' ' + slaProperty.name,
        datapoints: [[targetStatus, targetSLA.to * 1000]]
      };
    } else {
      return {
        target: itservice.name + ' ' + slaProperty.name,
        datapoints: [[targetSLA[slaProperty.property], targetSLA.from * 1000], [targetSLA[slaProperty.property], targetSLA.to * 1000]]
      };
    }
  }function handleTriggersResponse(triggers, timeRange) {
    if (_.isNumber(triggers)) {
      return {
        target: "triggers count",
        datapoints: [[triggers, timeRange[1] * 1000]]
      };
    } else {
      var stats = getTriggerStats(triggers);
      var table = new TableModel();
      table.addColumn({ text: 'Host group' });
      _.each(_.orderBy(c.TRIGGER_SEVERITY, ['val'], ['desc']), function (severity) {
        table.addColumn({ text: severity.text });
      });
      _.each(stats, function (severity_stats, group) {
        var row = _.map(_.orderBy(_.toPairs(severity_stats), function (s) {
          return s[0];
        }, ['desc']), function (s) {
          return s[1];
        });
        row = _.concat.apply(_, [[group]].concat(_toConsumableArray(row)));
        table.rows.push(row);
      });
      return table;
    }
  }

  function getTriggerStats(triggers) {
    var groups = _.uniq(_.flattenDeep(_.map(triggers, function (trigger) {
      return _.map(trigger.groups, 'name');
    })));
    // let severity = _.map(c.TRIGGER_SEVERITY, 'text');
    var stats = {};
    _.each(groups, function (group) {
      stats[group] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; // severity:count
    });
    _.each(triggers, function (trigger) {
      _.each(trigger.groups, function (group) {
        stats[group.name][trigger.priority]++;
      });
    });
    return stats;
  }function convertHistoryPoint(point) {
    // Value must be a number for properly work
    return [Number(point.value), point.clock * 1000 + Math.round(point.ns / 1000000)];
  }

  function convertTrendPoint(valueType, point) {
    var value;
    switch (valueType) {
      case "min":
        value = point.value_min;
        break;
      case "max":
        value = point.value_max;
        break;
      case "avg":
        value = point.value_avg;
        break;
      case "sum":
        value = point.value_sum;
        break;
      case "count":
        value = point.value_count;
        break;
      default:
        value = point.value_avg;
    }

    return [Number(value), point.clock * 1000];
  }return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreTable_model) {
      TableModel = _appCoreTable_model.default;
    }, function (_constants) {
      c = _constants;
    }],
    execute: function () {
      _export('default', {
        handleHistory: handleHistory,
        convertHistory: convertHistory,
        handleTrends: handleTrends,
        handleText: handleText,
        handleHistoryAsTable: handleHistoryAsTable,
        handleSLAResponse: handleSLAResponse,
        handleTriggersResponse: handleTriggersResponse
      });

      // Fix for backward compatibility with lodash 2.4
      if (!_.uniqBy) {
        _.uniqBy = _.uniq;
      }
    }
  };
});
//# sourceMappingURL=responseHandler.js.map
