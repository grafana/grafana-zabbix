import _ from 'lodash';

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
  var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid');  //uniqBy is needed to deduplicate

  return _.map(grouped_history, function(hist, itemid) {
    var item = _.find(items, {'itemid': itemid});
    var alias = item.name;
    if (_.keys(hosts).length > 1 && addHostName) {   //only when actual multi hosts selected
      var host = _.find(hosts, {'hostid': item.hostid});
      alias = host.name + ": " + alias;
    }
    return {
      target: alias,
      datapoints: _.map(hist, convertPointCallback)
    };
  });
}

function handleHistory(history, items, addHostName = true) {
  return convertHistory(history, items, addHostName, convertHistoryPoint);
}

function handleTrends(history, items, valueType, addHostName = true) {
  var convertPointCallback = _.partial(convertTrendPoint, valueType);
  return convertHistory(history, items, addHostName, convertPointCallback);
}

function handleSLAResponse(itservice, slaProperty, slaObject) {
  var targetSLA = slaObject[itservice.serviceid].sla[0];
  if (slaProperty.property === 'status') {
    var targetStatus = parseInt(slaObject[itservice.serviceid].status);
    return {
      target: itservice.name + ' ' + slaProperty.name,
      datapoints: [
        [targetStatus, targetSLA.to * 1000]
      ]
    };
  } else {
    return {
      target: itservice.name + ' ' + slaProperty.name,
      datapoints: [
        [targetSLA[slaProperty.property], targetSLA.from * 1000],
        [targetSLA[slaProperty.property], targetSLA.to * 1000]
      ]
    };
  }
}

function convertHistoryPoint(point) {
  // Value must be a number for properly work
  return [
    Number(point.value),
    point.clock * 1000
  ];
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
    default:
      value = point.value_avg;
  }

  return [
    Number(value),
    point.clock * 1000
  ];
}

export default {
  handleHistory: handleHistory,
  convertHistory: convertHistory,
  handleTrends: handleTrends,
  handleSLAResponse: handleSLAResponse
};
