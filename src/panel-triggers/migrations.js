// Actual schema version
const CURRENT_SCHEMA_VERSION = 3;

export function migratePanelSchema(panel) {
  if (isEmptyPanel(panel)) {
    return panel;
  }

  const schemaVersion = getSchemaVersion(panel);
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
  }

  return panel;
}

function getSchemaVersion(panel) {
  return panel.schemaVersion || 1;
}

function isEmptyPanel(panel) {
  return !panel.datasource && !panel.datasources && !panel.triggers && !panel.targets;
}
