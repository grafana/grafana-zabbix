define([
  'angular',
  'lodash'
  ],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixCache', function($q, backendSrv) {

    function ZabbixCache(zabbixAPI, lifetime) {
      var self = this;
      this.zabbixAPI = zabbixAPI;
      this.lifetime = lifetime;

      var promises = [
        this.zabbixAPI.getGroups(),
        this.zabbixAPI.getHosts(),
        this.zabbixAPI.getApplications(),
        this.zabbixAPI.getItems()
      ];

      $q.all(promises).then(function (results) {
        console.log(results);
        if (results.length) {
          self._groups = results[0];
          self._hosts = results[1];
          self._applications = groupApplications(results[2]);
          self._items = results[3];
        }
      });
    }

    var p = ZabbixCache.prototype;

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
     * @param  {[type]} applications [description]
     * @return {[type]}              [description]
     */
    function groupApplications(applications) {
      return _.map(_.groupBy(applications, 'name'), function (value, key) {
        return {
          name: key,
          ids: _.map(value, 'applicationid')
        };
      });
    }

    return ZabbixCache;

  });

});
