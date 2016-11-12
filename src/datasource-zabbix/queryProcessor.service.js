import angular from 'angular';
import _ from 'lodash';
import * as utils from './utils';

function QueryProcessorFactory() {

  class QueryProcessor {
    constructor(zabbixCacheInstance) {
      this.cache = zabbixCacheInstance;
    }

    initializeCache() {
      if (this.cache._initialized) {
        return Promise.resolve();
      } else {
        return this.cache.refresh();
      }
    }

    /**
     * Build query - convert target filters to array of Zabbix items
     */
    build(target, options) {
      function getFiltersFromTarget(target) {
        let parts = ['group', 'host', 'application', 'item'];
        return _.map(parts, p => target[p].filter);
      }

      return this.initializeCache()
      .then(() => {
        return this.getItems(...getFiltersFromTarget(target), options);
      });
    }

    /**
     * Build trigger query in asynchronous manner
     */
    buildTriggerQuery(groupFilter, hostFilter, appFilter) {
      return this.initializeCache()
      .then(() => {
        return this.buildTriggerQueryFromCache(groupFilter, hostFilter, appFilter);
      });
    }

    getAllGroups() {
      return this.cache.getGroups();
    }

    getGroups(groupFilter) {
      return this.getAllGroups()
      .then(groups => findByFilter(groups, groupFilter));
    }

    /**
     * Get list of host belonging to given groups.
     */
    getAllHosts(groupFilter) {
      return this.getGroups(groupFilter)
      .then(groups => {
        let groupids = _.map(groups, 'groupid');
        return this.cache.getHosts(groupids);
      });
    }

    getHosts(groupFilter, hostFilter) {
      return this.getAllHosts(groupFilter)
      .then(hosts => findByFilter(hosts, hostFilter));
    }

    /**
     * Get list of applications belonging to given groups and hosts.
     */
    getAllApps(groupFilter, hostFilter) {
      return this.getHosts(groupFilter, hostFilter)
      .then(hosts => {
        let hostids = _.map(hosts, 'hostid');
        return this.cache.getApps(hostids);
      });
    }

    getApps(groupFilter, hostFilter, appFilter) {
      return this.getHosts(groupFilter, hostFilter)
      .then(hosts => {
        let hostids = _.map(hosts, 'hostid');
        if (appFilter) {
          return this.cache.getApps(hostids)
          .then(apps => filterByQuery(apps, appFilter));
        } else {
          return {
            appFilterEmpty: true,
            hostids: hostids
          };
        }
      });
    }

    getAllItems(groupFilter, hostFilter, appFilter, options = {}) {
      return this.getApps(groupFilter, hostFilter, appFilter)
      .then(apps => {
        if (apps.appFilterEmpty) {
          return this.cache.getItems(apps.hostids, undefined, options.itemtype);
        } else {
          let appids = _.map(apps, 'applicationid');
          return this.cache.getItems(undefined, appids, options.itemtype);
        }
      })
      .then(items => {
        if (!options.showDisabledItems) {
          items = _.filter(items, {'status': '0'});
        }
        return items;
      });
    }

    getItems(groupFilter, hostFilter, appFilter, itemFilter, options = {}) {
      return this.getAllItems(groupFilter, hostFilter, appFilter, options)
      .then(items => filterByQuery(items, itemFilter));
    }

    /**
     * Build query - convert target filters to array of Zabbix items
     */
    buildTriggerQueryFromCache(groupFilter, hostFilter, appFilter) {
      let promises = [
        this.getGroups(groupFilter),
        this.getHosts(groupFilter, hostFilter),
        this.getApps(groupFilter, hostFilter, appFilter)
      ];

      return Promise.all(promises)
      .then(results => {
        let filteredGroups = results[0];
        let filteredHosts = results[1];
        let filteredApps = results[2];
        let query = {};

        if (appFilter) {
          query.applicationids = _.flatten(_.map(filteredApps, 'applicationid'));
        }
        if (hostFilter) {
          query.hostids = _.map(filteredHosts, 'hostid');
        }
        if (groupFilter) {
          query.groupids = _.map(filteredGroups, 'groupid');
        }

        return query;
      });
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
    convertHistory(history, items, addHostName, convertPointCallback) {
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
      var hosts = _.uniq(_.flatten(_.map(items, 'hosts')),'hostid');  //uniq is needed to deduplicate

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

    handleHistory(history, items, addHostName) {
      return this.convertHistory(history, items, addHostName, convertHistoryPoint);
    }

    handleTrends(history, items, addHostName, valueType) {
      var convertPointCallback = _.partial(convertTrendPoint, valueType);
      return this.convertHistory(history, items, addHostName, convertPointCallback);
    }

    handleSLAResponse(itservice, slaProperty, slaObject) {
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
  }

  return QueryProcessor;
}

angular
  .module('grafana.services')
  .factory('QueryProcessor', QueryProcessorFactory);

/**
 * Find group, host, app or item by given name.
 * @param  list list of groups, apps or other
 * @param  name visible name
 * @return      array with finded element or undefined
 */
function findByName(list, name) {
  var finded = _.find(list, {'name': name});
  if (finded) {
    return [finded];
  } else {
    return undefined;
  }
}

/**
 * Different hosts can contains applications and items with same name.
 * For this reason use _.filter, which return all elements instead _.find,
 * which return only first finded.
 * @param  {[type]} list list of elements
 * @param  {[type]} name app name
 * @return {[type]}      array with finded element or undefined
 */
function filterByName(list, name) {
  var finded = _.filter(list, {'name': name});
  if (finded) {
    return finded;
  } else {
    return undefined;
  }
}

function filterByRegex(list, regex) {
  var filterPattern = utils.buildRegex(regex);
  return _.filter(list, function (zbx_obj) {
    return filterPattern.test(zbx_obj.name);
  });
}

function findByFilter(list, filter) {
  if (utils.isRegex(filter)) {
    return filterByRegex(list, filter);
  } else {
    return findByName(list, filter);
  }
}

function filterByQuery(list, filter) {
  if (utils.isRegex(filter)) {
    return filterByRegex(list, filter);
  } else {
    return filterByName(list, filter);
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
