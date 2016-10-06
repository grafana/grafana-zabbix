import angular from 'angular';
import _ from 'lodash';
import * as utils from './utils';

/** @ngInject */
angular.module('grafana.services').factory('QueryProcessor', function($q) {

  class QueryProcessor {
    constructor(zabbixCacheInstance) {
      this.cache = zabbixCacheInstance;
      this.$q = $q;
    }

    /**
     * Build query in asynchronous manner
     */
    build(groupFilter, hostFilter, appFilter, itemFilter, itemtype) {
      var self = this;
      if (this.cache._initialized) {
        return this.$q.when(self.buildFromCache(groupFilter, hostFilter, appFilter, itemFilter, itemtype));
      } else {
        return this.cache.refresh().then(function() {
          return self.buildFromCache(groupFilter, hostFilter, appFilter, itemFilter, itemtype);
        });
      }
    }

    /**
     * Build trigger query in asynchronous manner
     */
    buildTriggerQuery(groupFilter, hostFilter, appFilter) {
      var self = this;
      if (this.cache._initialized) {
        return this.$q.when(self.buildTriggerQueryFromCache(groupFilter, hostFilter, appFilter));
      } else {
        return this.cache.refresh().then(function() {
          return self.buildTriggerQueryFromCache(groupFilter, hostFilter, appFilter);
        });
      }
    }

    filterGroups(groups, groupFilter) {
      return this.$q.when(
        findByFilter(groups, groupFilter)
      );
    }

    /**
     * Get list of host belonging to given groups.
     * @return list of hosts
     */
    filterHosts(hosts, hostFilter) {
      return this.$q.when(
        findByFilter(hosts, hostFilter)
      );
    }

    filterApps(apps, appFilter) {
      return this.$q.when(
        findByFilter(apps, appFilter)
      );
    }

    /**
     * Build query - convert target filters to array of Zabbix items
     */
    buildFromCache(groupFilter, hostFilter, appFilter, itemFilter, itemtype, showDisabledItems) {
      return this.getItems(groupFilter, hostFilter, appFilter, itemtype, showDisabledItems)
        .then(items => {
          return getByFilter(items, itemFilter);
        });
    }

    getGroups() {
      return this.cache.getGroups();
    }

    /**
     * Get list of host belonging to given groups.
     * @return list of hosts
     */
    getHosts(groupFilter) {
      var self = this;
      return this.cache
        .getGroups()
        .then(groups => {
          return findByFilter(groups, groupFilter);
        })
        .then(groups => {
          var groupids = _.map(groups, 'groupid');
          return self.cache.getHosts(groupids);
        });
    }

    /**
     * Get list of applications belonging to given groups and hosts.
     * @return  list of applications belonging to given hosts
     */
    getApps(groupFilter, hostFilter) {
      var self = this;
      return this.getHosts(groupFilter)
        .then(hosts => {
          return findByFilter(hosts, hostFilter);
        })
        .then(hosts => {
          var hostids = _.map(hosts, 'hostid');
          return self.cache.getApps(hostids);
        });
    }

    getItems(groupFilter, hostFilter, appFilter, itemtype, showDisabledItems) {
      var self = this;
      return this.getHosts(groupFilter)
        .then(hosts => {
          return findByFilter(hosts, hostFilter);
        })
        .then(hosts => {
          var hostids = _.map(hosts, 'hostid');
          if (appFilter) {
            return self.cache
              .getApps(hostids)
              .then(apps => {
                // Use getByFilter for proper item filtering
                return getByFilter(apps, appFilter);
              });
          } else {
            return {
              appFilterEmpty: true,
              hostids: hostids
            };
          }
        })
        .then(apps => {
          if (apps.appFilterEmpty) {
            return self.cache
              .getItems(apps.hostids, undefined, itemtype)
              .then(items => {
                if (showDisabledItems) {
                  items = _.filter(items, {'status': '0'});
                }
                return items;
              });
          } else {
            var appids = _.map(apps, 'applicationid');
            return self.cache
              .getItems(undefined, appids, itemtype)
              .then(items => {
                if (showDisabledItems) {
                  items = _.filter(items, {'status': '0'});
                }
                return items;
              });
          }
        });
    }

    /**
     * Build query - convert target filters to array of Zabbix items
     */
    buildTriggerQueryFromCache(groupFilter, hostFilter, appFilter) {
      var promises = [
        this.cache.getGroups().then(function(groups) {
          return _.filter(groups, function(group) {
            if (utils.isRegex(groupFilter)) {
              return utils.buildRegex(groupFilter).test(group.name);
            } else {
              return group.name === groupFilter;
            }
          });
        }),
        this.getHosts(groupFilter).then(function(hosts) {
          return _.filter(hosts, function(host) {
            if (utils.isRegex(hostFilter)) {
              return utils.buildRegex(hostFilter).test(host.name);
            } else {
              return host.name === hostFilter;
            }
          });
        }),
        this.getApps(groupFilter, hostFilter).then(function(apps) {
          return _.filter(apps, function(app) {
            if (utils.isRegex(appFilter)) {
              return utils.buildRegex(appFilter).test(app.name);
            } else {
              return app.name === appFilter;
            }
          });
        })
      ];

      return this.$q.all(promises).then(function(results) {
        var filteredGroups = results[0];
        var filteredHosts = results[1];
        var filteredApps = results[2];
        var query = {};

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
});

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

function findByRegex(list, regex) {
  var filterPattern = utils.buildRegex(regex);
  return _.filter(list, function (zbx_obj) {
    return filterPattern.test(zbx_obj.name);
  });
}

function findByFilter(list, filter) {
  if (utils.isRegex(filter)) {
    return findByRegex(list, filter);
  } else {
    return findByName(list, filter);
  }
}

function getByFilter(list, filter) {
  if (utils.isRegex(filter)) {
    return findByRegex(list, filter);
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
