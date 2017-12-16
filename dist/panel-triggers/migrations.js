'use strict';

System.register(['lodash', './triggers_panel_ctrl'], function (_export, _context) {
  "use strict";

  var _, DEFAULT_TARGET, CURRENT_SCHEMA_VERSION;

  function migratePanelSchema(panel) {
    if (isEmptyPanel(panel)) {
      return panel;
    }

    var schemaVersion = getSchemaVersion(panel);
    panel.schemaVersion = CURRENT_SCHEMA_VERSION;

    if (schemaVersion < 2) {
      panel.datasources = [panel.datasource];
      panel.targets = {};
      panel.targets[panel.datasources[0]] = panel.triggers;

      // delete old props
      delete panel.triggers;
      delete panel.datasource;
    }

    if (schemaVersion < 3) {
      // delete old props
      delete panel.lastChangeField;
      delete panel.ageField;
      delete panel.infoField;
      delete panel.scroll;
      delete panel.hideHostsInMaintenance;
    }

    if (schemaVersion < 4) {
      if (panel.targets && !_.isEmpty(panel.targets)) {
        _.each(panel.targets, function (target) {
          _.defaultsDeep(target, DEFAULT_TARGET);
        });
      }
    }

    return panel;
  }

  _export('migratePanelSchema', migratePanelSchema);

  function getSchemaVersion(panel) {
    return panel.schemaVersion || 1;
  }

  function isEmptyPanel(panel) {
    return !panel.datasource && !panel.datasources && !panel.triggers && !panel.targets;
  }
  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_triggers_panel_ctrl) {
      DEFAULT_TARGET = _triggers_panel_ctrl.DEFAULT_TARGET;
    }],
    execute: function () {
      _export('CURRENT_SCHEMA_VERSION', CURRENT_SCHEMA_VERSION = 4);

      _export('CURRENT_SCHEMA_VERSION', CURRENT_SCHEMA_VERSION);
    }
  };
});
//# sourceMappingURL=migrations.js.map
