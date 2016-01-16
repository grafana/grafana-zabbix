define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixCache', function($q) {

    function ZabbixCache(zabbixAPI, lifetime) {
      this.zabbixAPI = zabbixAPI;
      this.lifetime = lifetime;

      this._groups        = [];
      this._hosts         = [];
      this._applications  = [];
      this._items         = [];

      this.refresh();
    }

    var p = ZabbixCache.prototype;

    p.refresh = function () {
      var self = this;
      var promises = [
        this.zabbixAPI.getGroups(),
        this.zabbixAPI.getHosts(),
        this.zabbixAPI.getApplications(),
        this.zabbixAPI.getItems()
      ];

      $q.all(promises).then(function (results) {
        if (results.length) {
          self._groups = results[0];

          self._hosts = _.forEach(results[1], function(host) {
            host.groups = _.map(host.groups, 'groupid');
            return host;
          });

          self._applications = groupApplications(results[2]);

          self._items = _.forEach(results[3], function(item) {
            item.applications = _.map(item.applications, 'applicationid');
            return item;
          });
        }
      });
    };

    p.getGroups = function() {
      return this._groups;
    };

    p.getHosts = function() {
      return this._hosts;
    };

    p.getApplications = function() {
      return this._applications;
    };

    p.getItems = function() {
      return this._items;
    };

    /**
     * Group Zabbix applications by name
     */
    function groupApplications(applications) {
      return _.map(_.groupBy(applications, 'name'), function (value, key) {
        return {
          name: key,
          applicationids: _.map(value, 'applicationid'),
          hostids: _.uniq(_.map(_.flatten(value, 'hosts'), 'hostid'))
        };
      });
    }

    return ZabbixCache;

  });

});
