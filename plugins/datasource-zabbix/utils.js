define([
  'lodash',
  'moment'
],
function (_, moment) {
  'use strict';

  function Utils() {

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

    // Pattern for testing regex
    var regexPattern = /^\/(.*)\/([gmi]*)$/m;

    this.isRegex = function (str) {
      return regexPattern.test(str);
    };

    this.buildRegex = function (str) {
      var matches = str.match(regexPattern);
      var pattern = matches[1];
      var flags = matches[2] !== "" ? matches[2] : undefined;
      return new RegExp(pattern, flags);
    };

    this.parseInterval = function(interval) {
      var intervalPattern = /(^[\d]+)(y|M|w|d|h|m|s)/g;
      var momentInterval = intervalPattern.exec(interval);
      return moment.duration(Number(momentInterval[1]), momentInterval[2]).valueOf();
    };

  }

  return new Utils();
});