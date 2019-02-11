import _ from 'lodash';
import { getDefaultTarget } from './triggers_panel_ctrl';

// Actual schema version
export const CURRENT_SCHEMA_VERSION = 6;

export function migratePanelSchema(panel) {
  if (isEmptyPanel(panel)) {
    delete panel.targets;
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
    delete panel.infoField;
    delete panel.scroll;
    delete panel.hideHostsInMaintenance;
  }

  if (schemaVersion < 5) {
    if (panel.targets && !_.isEmpty(panel.targets)) {
      _.each(panel.targets, (target) => {
        _.defaultsDeep(target, getDefaultTarget());
      });
    }
  }

  if (schemaVersion < 6) {
    if (panel.showEvents && panel.showEvents.value === '1') {
      panel.showEvents.value = 1;
    }
  }

  return panel;
}

function getSchemaVersion(panel) {
  return panel.schemaVersion || 1;
}

function isEmptyPanel(panel) {
  return !panel.datasource && !panel.datasources && !panel.triggers && isEmptyTargets(panel.targets);
}

function isEmptyTargets(targets) {
  return !targets || (_.isArray(targets) && (targets.length === 0 || targets.length === 1 && _.isEmpty(targets[0])));
}
