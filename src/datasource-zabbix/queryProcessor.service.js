define([
  'angular',
  'lodash',
  './utils'
],
function (angular, _, utils) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('QueryProcessor', function($q) {

    function QueryProcessor(zabbixCacheInstance) {
      var self = this;

      this.cache = zabbixCacheInstance;

      /**
       * Build query in asynchronous manner
       */
      this.build = function (groupFilter, hostFilter, appFilter, itemFilter) {
        if (this.cache._initialized) {
          return $q.when(self.buildFromCache(groupFilter, hostFilter, appFilter, itemFilter));
        } else {
          return this.cache.refresh().then(function() {
            return self.buildFromCache(groupFilter, hostFilter, appFilter, itemFilter);
          });
        }
      };

      /**
       * Build trigger query in asynchronous manner
       */
      this.buildTriggerQuery = function (groupFilter, hostFilter, appFilter) {
        if (this.cache._initialized) {
          return $q.when(self.buildTriggerQueryFromCache(groupFilter, hostFilter, appFilter));
        } else {
          return this.cache.refresh().then(function() {
            return self.buildTriggerQueryFromCache(groupFilter, hostFilter, appFilter);
          });
        }
      };

      this.filterGroups = function(groupFilter) {
        return this.cache.getGroups().then(function(groupList) {
          return groupList;
        });
      };

      /**
       * Get list of host belonging to given groups.
       * @return list of hosts
       */
      this.filterHosts = function(groupFilter) {
        return this.cache.getGroups().then(function(groups) {
          groups = findByFilter(groups, groupFilter);
          var hostids = _.flatten(_.map(groups, 'hosts'));
          if (hostids.length) {
            return self.cache.getIndexedHosts().then(function(hosts) {
              return _.map(hostids, function(hostid) {
                return hosts[hostid];
              });
            });
          } else {
            return [];
          }
        });
      };

      /**
       * Get list of applications belonging to given groups and hosts.
       * @return  list of applications belonging to given hosts
       */
      this.filterApplications = function(groupFilter, hostFilter) {
        var promises = [
          this.filterHosts(groupFilter),
          this.cache.getApplications()
        ];

        return $q.all(promises).then(function(results) {
          var hostList = results[0];
          var applicationList = results[1];

          var hosts = findByFilter(hostList, hostFilter);
          if (hosts) {
            var hostsids = _.map(hosts, 'hostid');
            return _.filter(applicationList, function (appObj) {
              return _.intersection(hostsids, appObj.hosts).length;
            });
          } else {
            return [];
          }
        });
      };

      this.filterItems = function (groupFilter, hostFilter, appFilter, itemType, showDisabledItems) {
        var hosts;
        var apps;
        var items;

        var promises = [
          this.filterHosts(groupFilter),
          this.filterApplications(groupFilter, hostFilter),
          this.cache.getIndexedHosts(),
          this.cache.getIndexedApplications()
        ];

        return $q.all(promises).then(function(results) {
          var hostList = results[0];
          var applicationList = results[1];
          var idx_hosts = results[2];
          var idx_apps = results[3];

          // Filter hosts
          hosts = findByFilter(hostList, hostFilter);
          idx_hosts = getFromIndex(idx_hosts, _.map(hosts, 'hostid'));

          // Filter applications
          if (appFilter === "") {
            // Get all items
            apps = undefined;
            if (hosts) {
              // Get all items in given hosts
              items = _.flatten(_.map(idx_hosts, function(host) {
                return _.values(host.idx_items);
              }), true);
            }
          } else {
            apps = findByFilter(applicationList, appFilter);
          }

          if (apps) {
            // Get ids for finded applications
            var appids = _.flatten(_.map(apps, 'applicationids'));
            appids = _.flatten(_.map(_.map(hosts, 'applications'), function(apps) {
              return _.intersection(apps, appids);
            }));

            // For each finded host get list of items in finded applications
            items = _.flatten(_.map(idx_hosts, function(host) {
              var host_apps = _.intersection(appids, host.applications);
              var host_itemids = _.flatten(_.map(getFromIndex(idx_apps, host_apps), 'itemids'));
              return _.values(getFromIndex(host.idx_items, host_itemids));
            }), true);
          }

          if (!showDisabledItems) {
            items = _.filter(items, {'status': '0'});
          }

          return items;
        });
      };

      /**
       * Build query - convert target filters to array of Zabbix items
       */
      this.buildFromCache = function (groupFilter, hostFilter, appFilter, itemFilter) {
        return this.filterItems(groupFilter, hostFilter, appFilter).then(function(items) {
          if (items.length) {
            if (utils.isRegex(itemFilter)) {
              return findByFilter(items, itemFilter);
            } else {
              return _.filter(items, {'name': itemFilter});
            }
          } else {
            return [];
          }
        });
      };

      /**
       * Build query - convert target filters to array of Zabbix items
       */
      this.buildTriggerQueryFromCache = function (groupFilter, hostFilter, appFilter) {
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
          this.filterHosts(groupFilter).then(function(hosts) {
            return _.filter(hosts, function(host) {
              if (utils.isRegex(hostFilter)) {
                return utils.buildRegex(hostFilter).test(host.name);
              } else {
                return host.name === hostFilter;
              }
            });
          }),
          this.filterApplications(groupFilter, hostFilter).then(function(apps) {
            return _.filter(apps, function(app) {
              if (utils.isRegex(appFilter)) {
                return utils.buildRegex(appFilter).test(app.name);
              } else {
                return app.name === appFilter;
              }
            });
          })
        ];

        return $q.all(promises).then(function(results) {
          var filteredGroups = results[0];
          var filteredHosts = results[1];
          var filteredApps = results[2];
          var query = {};

          if (appFilter) {
            query.applicationids = _.flatten(_.map(filteredApps, 'applicationids'));
          }
          if (hostFilter) {
            query.hostids = _.map(filteredHosts, 'hostid');
          }
          if (groupFilter) {
            query.groupids = _.map(filteredGroups, 'groupid');
          }

          return query;
        });
      };

      /**
       * Convert Zabbix API history.get response to Grafana format
       *
       * @return {Array}            Array of timeseries in Grafana format
       *                            {
       *                               target: "Metric name",
       *                               datapoints: [[<value>, <unixtime>], ...]
       *                            }
       */
      this.convertHistory = function(history, addHostName, convertPointCallback) {
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

        return _.map(grouped_history, function(hist, itemid) {
          var item = self.cache.getItem(itemid);
          var alias = item.name;
          if (addHostName) {
            var host = self.cache.getHost(item.hostid);
            alias = host.name + ": " + alias;
          }
          return {
            target: alias,
            datapoints: _.map(hist, convertPointCallback)
          };
        });
      };

      this.handleHistory = function(history, addHostName) {
        return this.convertHistory(history, addHostName, convertHistoryPoint);
      };

      this.handleTrends = function(history, addHostName, valueType) {
        var convertPointCallback = _.partial(convertTrendPoint, valueType);
        return this.convertHistory(history, addHostName, convertPointCallback);
      };

      this.handleSLAResponse = function (itservice, slaProperty, slaObject) {
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
      };
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

  function getFromIndex(index, objids) {
    return _.map(objids, function(id) {
      return index[id];
    });
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

});
