'use strict';

System.register(['lodash', 'moment'], function (_export, _context) {
  "use strict";

  var _, moment, MACRO_PATTERN, regexPattern;

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
    var key_params_str = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']'));
    var key_params = splitKeyParams(key_params_str);

    // replace item parameters
    for (var i = key_params.length; i >= 1; i--) {
      name = name.replace('$' + i, key_params[i - 1]);
    }
    return name;
  }

  _export('expandItemName', expandItemName);

  function expandItems(items) {
    _.forEach(items, function (item) {
      item.item = item.name;
      item.name = expandItemName(item.item, item.key_);
      return item;
    });
    return items;
  }
  _export('expandItems', expandItems);

  function splitKeyParams(paramStr) {
    var params = [];
    var quoted = false;
    var in_array = false;
    var split_symbol = ',';
    var param = '';

    _.forEach(paramStr, function (symbol) {
      if (symbol === '"' && in_array) {
        param += symbol;
      } else if (symbol === '"' && quoted) {
        quoted = false;
      } else if (symbol === '"' && !quoted) {
        quoted = true;
      } else if (symbol === '[' && !quoted) {
        in_array = true;
      } else if (symbol === ']' && !quoted) {
        in_array = false;
      } else if (symbol === split_symbol && !quoted && !in_array) {
        params.push(param);
        param = '';
      } else {
        param += symbol;
      }
    });

    params.push(param);
    return params;
  }

  function containsMacro(itemName) {
    return MACRO_PATTERN.test(itemName);
  }

  _export('containsMacro', containsMacro);

  function replaceMacro(item, macros) {
    var itemName = item.name;
    var item_macros = itemName.match(MACRO_PATTERN);
    _.forEach(item_macros, function (macro) {
      var host_macros = _.filter(macros, function (m) {
        if (m.hostid) {
          return m.hostid === item.hostid;
        } else {
          // Add global macros
          return true;
        }
      });

      var macro_def = _.find(host_macros, { macro: macro });
      if (macro_def && macro_def.value) {
        var macro_value = macro_def.value;
        var macro_regex = new RegExp(escapeMacro(macro));
        itemName = itemName.replace(macro_regex, macro_value);
      }
    });

    return itemName;
  }

  _export('replaceMacro', replaceMacro);

  function escapeMacro(macro) {
    macro = macro.replace(/\$/, '\\\$');
    return macro;
  }

  /**
   * Split template query to parts of zabbix entities
   * group.host.app.item -> [group, host, app, item]
   * {group}{host.com} -> [group, host.com]
   */
  function splitTemplateQuery(query) {
    var splitPattern = /\{[^\{\}]*\}|\{\/.*\/\}/g;
    var split = void 0;

    if (isContainsBraces(query)) {
      var result = query.match(splitPattern);
      split = _.map(result, function (part) {
        return _.trim(part, '{}');
      });
    } else {
      split = query.split('.');
    }

    return split;
  }

  _export('splitTemplateQuery', splitTemplateQuery);

  function isContainsBraces(query) {
    var bracesPattern = /^\{.+\}$/;
    return bracesPattern.test(query);
  }

  // Pattern for testing regex
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
      MACRO_PATTERN = /{\$[A-Z0-9_\.]+}/g;

      _export('regexPattern', regexPattern = /^\/(.*)\/([gmi]*)$/m);

      _export('regexPattern', regexPattern);

      if (!_.includes) {
        _.includes = _.contains;
      }
    }
  };
});
//# sourceMappingURL=utils.js.map
