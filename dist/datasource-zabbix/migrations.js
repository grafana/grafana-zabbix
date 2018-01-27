"use strict";

System.register([], function (_export, _context) {
  "use strict";

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
  }return {
    setters: [],
    execute: function () {}
  };
});
//# sourceMappingURL=migrations.js.map
