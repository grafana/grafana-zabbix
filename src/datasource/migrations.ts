import _ from 'lodash';
import { ZabbixMetricsQuery } from './types/query';
import * as c from './constants';
import { ZabbixDSOptions } from './types/config';
import { GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';

export const DS_QUERY_SCHEMA = 12;
export const DS_CONFIG_SCHEMA = 4;

/**
 * Query format migration.
 * This module can detect query format version and make migration.
 */

export function isGrafana2target(target) {
  if (!target.mode || target.mode === 0 || target.mode === 2) {
    if (
      (target.hostFilter || target.itemFilter || target.downsampleFunction || (target.host && target.host.host)) &&
      target.item.filter === undefined &&
      target.host.filter === undefined
    ) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function migrateFrom2To3version(target: ZabbixMetricsQuery) {
  target.group.filter = target.group.name === '*' ? '/.*/' : target.group.name;
  target.host.filter = target.host.name === '*' ? convertToRegex(target.hostFilter) : target.host.name;
  target.application.filter = target.application.name === '*' ? '' : target.application.name;
  target.item.filter = target.item.name === 'All' ? convertToRegex(target.itemFilter) : target.item.name;
  target.macro.filter = target.macro.macro === '*' ? convertToRegex(target.macroFilter) : target.macro.macro;
  return target;
}

function migratePercentileAgg(target) {
  if (target.functions) {
    for (const f of target.functions) {
      if (f.def && f.def.name === 'percentil') {
        f.def.name = 'percentile';
      }
    }
  }
}

function migrateQueryType(target) {
  if (target.queryType === undefined) {
    if (target.mode === 'Metrics') {
      // Explore mode
      target.queryType = c.MODE_METRICS;
    } else if (target.mode !== undefined) {
      target.queryType = target.mode;
      delete target.mode;
    }
  }

  // queryType is a string in query model
  if (typeof target.queryType === 'number') {
    target.queryType = (target.queryType as number)?.toString();
  }
}

function migrateSLA(target) {
  if (target.queryType === c.MODE_ITSERVICE && !target.slaInterval) {
    target.slaInterval = 'none';
  }
}

function migrateProblemSort(target) {
  if (target.options?.sortProblems === 'priority') {
    target.options.sortProblems = 'severity';
  }
}

function migrateApplications(target) {
  if (!target.itemTag) {
    target.itemTag = { filter: '' };
    if (target.application?.filter) {
      target.itemTag.filter = `Application: ${target.application?.filter}`;
    }
  }
}

function migrateSLAProperty(target) {
  if (target.slaProperty?.property) {
    target.slaProperty = target.slaProperty?.property;
  }
}

function migrateTriggersMode(target: any) {
  if (target.triggers?.minSeverity) {
    target.options.minSeverity = target.triggers?.minSeverity;
    delete target.triggers.minSeverity;
  }
  if (target.triggers?.count) {
    target.options.count = target.triggers?.count;
    delete target.triggers.count;
  }
}

function migrateNewTriggersCountModes(target: any) {
  if (target.schema >= 11) {
    return;
  }
  if (target.queryType === '6') {
    target.queryType = c.MODE_TRIGGERS;
    target.countTriggersBy = 'items';
  } else if (target.queryType === '7') {
    target.queryType = c.MODE_TRIGGERS;
    target.countTriggersBy = 'problems';
  } else if (target.queryType === '8') {
    target.queryType = c.MODE_MACROS;
  }
}

function migrateProblemsSeverity(target: any) {
  if (target.schema >= 12) {
    return;
  }
  if (target?.options?.minSeverity) {
    target.options.severities = [0, 1, 2, 3, 4, 5].filter((v) => v >= target.options.minSeverity);
  }
}

export function migrate(target) {
  target.resultFormat = target.resultFormat || 'time_series';
  target = fixTargetGroup(target);
  if (isGrafana2target(target)) {
    return migrateFrom2To3version(target);
  }
  migratePercentileAgg(target);
  migrateQueryType(target);
  migrateSLA(target);
  migrateProblemSort(target);
  migrateApplications(target);
  migrateSLAProperty(target);
  migrateTriggersMode(target);
  migrateNewTriggersCountModes(target);
  migrateProblemsSeverity(target);

  target.schema = DS_QUERY_SCHEMA;
  return target;
}

function fixTargetGroup(target) {
  if (target.group && Array.isArray(target.group)) {
    target.group = { filter: '' };
  }
  return target;
}

function convertToRegex(str) {
  if (str) {
    return '/' + str + '/';
  } else {
    return '/.*/';
  }
}

export function migrateDSConfig(jsonData: ZabbixDSOptions) {
  if (!jsonData) {
    return jsonData;
  }

  // Migrate nested dbConnection object (schema v1) to flat fields
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (jsonData.dbConnection) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const dbConnectionOptions = jsonData.dbConnection;
    jsonData.dbConnectionEnable = dbConnectionOptions.enable || false;
    if (!jsonData.dbConnectionDatasourceUID && dbConnectionOptions.datasourceId > 0) {
      jsonData.dbConnectionDatasourceUID = getUIDFromID(dbConnectionOptions.datasourceId);
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    delete jsonData.dbConnection;
  }

  // Migrate string timeout to number
  if (typeof jsonData.timeout === 'string') {
    jsonData.timeout = jsonData.timeout === '' ? null : Number(jsonData.timeout);
  }

  // Migrate numeric datasource ID to UID
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (!jsonData.dbConnectionDatasourceUID && jsonData.dbConnectionDatasourceId > 0) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    jsonData.dbConnectionDatasourceUID = getUIDFromID(jsonData.dbConnectionDatasourceId);
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  delete jsonData.dbConnectionDatasourceId;

  jsonData.schema = DS_CONFIG_SCHEMA;
  return jsonData;
}

const getDefaultAnnotationTarget = (json: any) => {
  return {
    group: { filter: json.group ?? '' },
    host: { filter: json.host ?? '' },
    application: { filter: json.application ?? '' },
    trigger: { filter: json.trigger ?? '' },
    options: {
      minSeverity: json.minseverity ?? 0,
      showOkEvents: json.showOkEvents ?? false,
      hideAcknowledged: json.hideAcknowledged ?? false,
      showHostname: json.showHostname ?? false,
    },
  };
};

export const prepareAnnotation = (json: any) => {
  const defaultTarget = getDefaultAnnotationTarget(json);

  json.target = {
    ...defaultTarget,
    ...json.target,
    fromAnnotations: true,
    options: {
      ...defaultTarget.options!,
      ...json.target?.options,
    },
  };

  return json;
};

// exporting for testing purposes only
export function getUIDFromID(id: number): string | undefined {
  const dsFilters: GetDataSourceListFilters = {
    all: true,
  };
  const dsList = getDataSourceSrv().getList(dsFilters);
  const datasource = dsList.find((ds) => ds.id === id);
  return datasource?.uid;
}
