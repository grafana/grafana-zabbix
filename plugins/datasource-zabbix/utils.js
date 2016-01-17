define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('Utils', function() {

    /**
     * Expand Zabbix item name
     *
     * @param  {string} name item name, ie "CPU $2 time"
     * @param  {string} key  item key, ie system.cpu.util[,system,avg1]
     * @return {string}      expanded name, ie "CPU system time"
     */
    this.expandItemName = function(name, key) {

      // extract params from key:
      // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
      var key_params = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']')).split(',');

      // replace item parameters
      for (var i = key_params.length; i >= 1; i--) {
        name = name.replace('$' + i, key_params[i - 1]);
      }
      return name;
    };
  });
});