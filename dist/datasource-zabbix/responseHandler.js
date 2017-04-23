'use strict';

System.register(['lodash', 'app/core/table_model'], function (_export, _context) {
  "use strict";

  var _, TableModel;

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
  }function convertText(target, point) {
    var value = point.value;

    // Regex-based extractor
    if (target.textFilter) {
      value = extractText(point.value, target.textFilter, target.useCaptureGroups);
    }

    return [value, point.clock * 1000 + Math.round(point.ns / 1000000)];
  }

  function extractText(str, pattern, useCaptureGroups) {
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
  }function handleItemsAsTable(items) {
    var table = new TableModel();
    var columns = [];

    _.forEach(_.keys(_.head(items)), function (key) {
      columns.push(key);
    });
    table.columns = _.map(columns, function (col) {
      return { "text": col };
    });

    _.forEach(items, function (item) {
      var row = [];
      _.forEach(columns, function (key) {
        row.push(item[key]);
      });
      table.rows.push(row);
    });

    return table;
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
    }],
    execute: function () {
      _export('default', {
        handleHistory: handleHistory,
        convertHistory: convertHistory,
        handleTrends: handleTrends,
        handleText: handleText,
        handleSLAResponse: handleSLAResponse,
        handleItemsAsTable: handleItemsAsTable
      });

      // Fix for backward compatibility with lodash 2.4
      if (!_.uniqBy) {
        _.uniqBy = _.uniq;
      }
    }
  };
});
//# sourceMappingURL=responseHandler.js.map
