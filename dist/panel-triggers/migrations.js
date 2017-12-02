"use strict";

System.register([], function (_export, _context) {
  "use strict";

  function migratePanelSchema(panel) {
    var schemaVersion = getSchemaVersion(panel);
    switch (schemaVersion) {
      case 1:
        panel.datasources = [panel.datasource];
        panel.targets[panel.datasources[0]] = panel.triggers;
        break;
    }

    return panel;
  }

  _export("migratePanelSchema", migratePanelSchema);

  function getSchemaVersion(panel) {
    return panel.schemaVersion || 1;
  }
  return {
    setters: [],
    execute: function () {}
  };
});
//# sourceMappingURL=migrations.js.map
