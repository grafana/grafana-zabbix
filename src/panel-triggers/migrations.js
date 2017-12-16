import _ from 'lodash';
import {DEFAULT_TARGET} from './triggers_panel_ctrl';

// Actual schema version
export const CURRENT_SCHEMA_VERSION = 4;

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
    delete panel.hideHostsInMaintenance;
  }

  if (schemaVersion < 4) {
    if (panel.targets && !_.isEmpty(panel.targets)) {
      _.each(panel.targets, (target) => {
        _.defaultsDeep(target, DEFAULT_TARGET);
      });
    }
  }

  return panel;
}

function getSchemaVersion(panel) {
  return panel.schemaVersion || 1;
}

function isEmptyPanel(panel) {
  return !panel.datasource && !panel.datasources && !panel.triggers && !panel.targets;
}
