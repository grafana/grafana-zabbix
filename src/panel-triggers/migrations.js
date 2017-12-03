export function migratePanelSchema(panel) {
  if (isEmptyPanel(panel)) {
    return panel;
  }

  const schemaVersion = getSchemaVersion(panel);
  switch (schemaVersion) {
    case 1:
      panel.datasources = [panel.datasource];
      panel.targets = {};
      panel.targets[panel.datasources[0]] = panel.triggers;

      // delete old props
      delete panel.triggers;
      delete panel.datasource;
      break;
  }

  return panel;
}

function getSchemaVersion(panel) {
  return panel.schemaVersion || 1;
}

function isEmptyPanel(panel) {
  return !panel.datasource && !panel.datasources && !panel.triggers && !panel.targets;
}
