export function migratePanelSchema(panel) {
  const schemaVersion = getSchemaVersion(panel);
  switch (schemaVersion) {
    case 1:
      panel.datasources = [panel.datasource];
      panel.targets[panel.datasources[0]] = panel.triggers;
      break;
  }

  return panel;
}

function getSchemaVersion(panel) {
  return panel.schemaVersion || 1;
}
