'use strict';

System.register(['lodash', 'moment'], function (_export, _context) {
  "use strict";

  var _, moment, regexPattern;

  /**
   * Expand Zabbix item name
   *
   * @param  {string} name item name, ie "CPU $2 time"
   * @param  {string} key  item key, ie system.cpu.util[,system,avg1]
   * @return {string}      expanded name, ie "CPU system time"
   */
  function expandItemName(name, key) {

    // extract params from key:
    // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
    var key_params = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']')).split(',');

    // replace item parameters
    for (var i = key_params.length; i >= 1; i--) {
      name = name.replace('$' + i, key_params[i - 1]);
    }
    return name;
  }

  // Pattern for testing regex

  _export('expandItemName', expandItemName);

  function isRegex(str) {
    return regexPattern.test(str);
  }

  _export('isRegex', isRegex);

  function isTemplateVariable(str, templateVariables) {
    var variablePattern = /^\$\w+/;
    if (variablePattern.test(str)) {
      var variables = _.map(templateVariables, function (variable) {
        return '$' + variable.name;
      });
      return _.includes(variables, str);
    } else {
      return false;
    }
  }

  _export('isTemplateVariable', isTemplateVariable);

  function buildRegex(str) {
    var matches = str.match(regexPattern);
    var pattern = matches[1];
    var flags = matches[2] !== "" ? matches[2] : undefined;
    return new RegExp(pattern, flags);
  }

  // Need for template variables replace
  // From Grafana's templateSrv.js

  _export('buildRegex', buildRegex);

  function escapeRegex(value) {
    return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&');
  }

  _export('escapeRegex', escapeRegex);

  function parseInterval(interval) {
    var intervalPattern = /(^[\d]+)(y|M|w|d|h|m|s)/g;
    var momentInterval = intervalPattern.exec(interval);
    return moment.duration(Number(momentInterval[1]), momentInterval[2]).valueOf();
  }

  _export('parseInterval', parseInterval);

  function parseTimeShiftInterval(interval) {
    var intervalPattern = /^([\+\-]*)([\d]+)(y|M|w|d|h|m|s)/g;
    var momentInterval = intervalPattern.exec(interval);
    var duration = 0;

    if (momentInterval[1] === '+') {
      duration = 0 - moment.duration(Number(momentInterval[2]), momentInterval[3]).valueOf();
    } else {
      duration = moment.duration(Number(momentInterval[2]), momentInterval[3]).valueOf();
    }

    return duration;
  }

  /**
   * Format acknowledges.
   *
   * @param  {array} acknowledges array of Zabbix acknowledge objects
   * @return {string} HTML-formatted table
   */

  _export('parseTimeShiftInterval', parseTimeShiftInterval);

  function formatAcknowledges(acknowledges) {
    if (acknowledges.length) {
      var formatted_acknowledges = '<br><br>Acknowledges:<br><table><tr><td><b>Time</b></td>' + '<td><b>User</b></td><td><b>Comments</b></td></tr>';
      _.each(_.map(acknowledges, function (ack) {
        var timestamp = moment.unix(ack.clock);
        return '<tr><td><i>' + timestamp.format("DD MMM YYYY HH:mm:ss") + '</i></td><td>' + ack.alias + ' (' + ack.name + ' ' + ack.surname + ')' + '</td><td>' + ack.message + '</td></tr>';
      }), function (ack) {
        formatted_acknowledges = formatted_acknowledges.concat(ack);
      });
      formatted_acknowledges = formatted_acknowledges.concat('</table>');
      return formatted_acknowledges;
    } else {
      return '';
    }
  }

  _export('formatAcknowledges', formatAcknowledges);

  function convertToZabbixAPIUrl(url) {
    var zabbixAPIUrlPattern = /.*api_jsonrpc.php$/;
    var trimSlashPattern = /(.*?)[\/]*$/;
    if (url.match(zabbixAPIUrlPattern)) {
      return url;
    } else {
      return url.replace(trimSlashPattern, "$1");
    }
  }

  /**
   * Wrap function to prevent multiple calls
   * when waiting for result.
   */

  _export('convertToZabbixAPIUrl', convertToZabbixAPIUrl);

  function callOnce(func, promiseKeeper) {
    return function () {
      if (!promiseKeeper) {
        promiseKeeper = Promise.resolve(func.apply(this, arguments).then(function (result) {
          promiseKeeper = null;
          return result;
        }));
      }
      return promiseKeeper;
    };
  }

  // Fix for backward compatibility with lodash 2.4

  _export('callOnce', callOnce);

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_moment) {
      moment = _moment.default;
    }],
    execute: function () {
      _export('regexPattern', regexPattern = /^\/(.*)\/([gmi]*)$/m);

      _export('regexPattern', regexPattern);

      if (!_.includes) {
        _.includes = _.contains;
      }
    }
  };
});
//# sourceMappingURL=utils.js.map
