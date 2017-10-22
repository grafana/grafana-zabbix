'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
  var grouped_history = _lodash2.default.groupBy(history, 'itemid');
  var hosts = _lodash2.default.uniqBy(_lodash2.default.flatten(_lodash2.default.map(items, 'hosts')), 'hostid'); //uniqBy is needed to deduplicate

  return _lodash2.default.map(grouped_history, function (hist, itemid) {
    var item = _lodash2.default.find(items, { 'itemid': itemid });
    var alias = item.name;
    if (_lodash2.default.keys(hosts).length > 1 && addHostName) {
      //only when actual multi hosts selected
      var host = _lodash2.default.find(hosts, { 'hostid': item.hostid });
      alias = host.name + ": " + alias;
    }
    return {
      target: alias,
      datapoints: _lodash2.default.map(hist, convertPointCallback)
    };
  });
}

function handleHistory(history, items) {
  var addHostName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

  return convertHistory(history, items, addHostName, convertHistoryPoint);
}

function handleTrends(history, items, valueType) {
  var addHostName = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

  var convertPointCallback = _lodash2.default.partial(convertTrendPoint, valueType);
  return convertHistory(history, items, addHostName, convertPointCallback);
}

function handleText(history, items, target) {
  var addHostName = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

  var convertTextCallback = _lodash2.default.partial(convertText, target);
  return convertHistory(history, items, addHostName, convertTextCallback);
}

function convertText(target, point) {
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
}

function handleTriggersResponse(triggers, timeRange) {
  if (_lodash2.default.isNumber(triggers)) {
    return {
      target: "triggers count",
      datapoints: [[triggers, timeRange[1]]]
    };
  } else {
    return triggers;
  }
}

function convertHistoryPoint(point) {
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
}

exports.default = {
  handleHistory: handleHistory,
  convertHistory: convertHistory,
  handleTrends: handleTrends,
  handleText: handleText,
  handleSLAResponse: handleSLAResponse,
  handleTriggersResponse: handleTriggersResponse
};

// Fix for backward compatibility with lodash 2.4

if (!_lodash2.default.uniqBy) {
  _lodash2.default.uniqBy = _lodash2.default.uniq;
}
