"use strict";

System.register([], function (_export, _context) {
  "use strict";

  var DS_CONFIG_SCHEMA;
  /**
   * Query format migration.
   * This module can detect query format version and make migration.
   */

  function isGrafana2target(target) {
    if (!target.mode || target.mode === 0 || target.mode === 2) {
      if ((target.hostFilter || target.itemFilter || target.downsampleFunction || target.host && target.host.host) && target.item.filter === undefined && target.host.filter === undefined) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  _export("isGrafana2target", isGrafana2target);

  function migrateFrom2To3version(target) {
    target.group.filter = target.group.name === "*" ? "/.*/" : target.group.name;
    target.host.filter = target.host.name === "*" ? convertToRegex(target.hostFilter) : target.host.name;
    target.application.filter = target.application.name === "*" ? "" : target.application.name;
    target.item.filter = target.item.name === "All" ? convertToRegex(target.itemFilter) : target.item.name;
    return target;
  }
  _export("migrateFrom2To3version", migrateFrom2To3version);

  function migrate(target) {
    target.resultFormat = target.resultFormat || 'time_series';
    if (isGrafana2target(target)) {
      return migrateFrom2To3version(target);
    } else {
      return target;
    }
  }

  _export("migrate", migrate);

  function convertToRegex(str) {
    if (str) {
      return '/' + str + '/';
    } else {
      return '/.*/';
    }
  }function migrateDSConfig(jsonData) {
    if (!jsonData) {
      jsonData = {};
    }
    var oldVersion = jsonData.schema || 1;
    jsonData.schema = DS_CONFIG_SCHEMA;

    if (oldVersion === DS_CONFIG_SCHEMA) {
      return jsonData;
    }

    if (oldVersion < 2) {
      var dbConnectionOptions = jsonData.dbConnection || {};
      jsonData.dbConnectionEnable = dbConnectionOptions.enable || false;
      jsonData.dbConnectionDatasourceId = dbConnectionOptions.datasourceId || null;
      delete jsonData.dbConnection;
    }

    return jsonData;
  }

  _export("migrateDSConfig", migrateDSConfig);

  return {
    setters: [],
    execute: function () {
      _export("DS_CONFIG_SCHEMA", DS_CONFIG_SCHEMA = 2);

      _export("DS_CONFIG_SCHEMA", DS_CONFIG_SCHEMA);
    }
  };
});
//# sourceMappingURL=migrations.js.map
