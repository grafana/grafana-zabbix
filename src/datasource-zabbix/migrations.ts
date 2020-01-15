import _ from 'lodash';
import { LegacyZabbixMetricsQuery, ZabbixMetricsQuery, ZabbixJsonData, ZabbixJsonDataV1, ConfigController } from './types';
import * as constants from './constants';

/**
 * Query format migration.
 * This module can detect query format version and make migration.
 */

export function isGrafana2target(target: LegacyZabbixMetricsQuery) {
  if (!target.mode || target.mode === 0 || target.mode === 2) {
    if ((target.hostFilter || target.itemFilter || target.downsampleFunction ||
        (target.host && target.host.host)) &&
        (target.item.filter === undefined && target.host.filter === undefined)) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function migrateFrom2To3version(target: LegacyZabbixMetricsQuery) {
  target.group.filter = target.group.name === "*" ? "/.*/" : target.group.name;
  target.host.filter = target.host.name === "*" ? convertToRegex(target.hostFilter) : target.host.name;
  target.application.filter = target.application.name === "*" ? "" : target.application.name;
  target.item.filter = target.item.name === "All" ? convertToRegex(target.itemFilter) : target.item.name;
  return target;
}

export function migrate(target: LegacyZabbixMetricsQuery): ZabbixMetricsQuery {
  target.resultFormat = target.resultFormat || 'time_series';
  target = fixTargetGroup(target);
  if (isGrafana2target(target)) {
    return migrateFrom2To3version(target);
  }
  migratePercentileAgg(target);
  return target;
}

function fixTargetGroup(target: LegacyZabbixMetricsQuery) {
  if (target.group && Array.isArray(target.group)) {
    target.group = { 'filter': "" };
  }
  return target;
}

function convertToRegex(str: string) {
  if (str) {
    return '/' + str + '/';
  } else {
    return '/.*/';
  }
}

function migratePercentileAgg(target: LegacyZabbixMetricsQuery) {
  if (target.functions) {
    for (const f of target.functions) {
      if (f.def && f.def.name === 'percentil') {
        f.def.name = 'percentile';
      }
    }
  }
}

export const DS_CONFIG_SCHEMA = 2;
export function migrateDSConfig(jsonData: ZabbixJsonDataV1): ZabbixJsonData {
  if (jsonData && !shouldMigrateDSConfig(jsonData)) {
    return jsonData;
  }

  let newJsonData: ZabbixJsonData = jsonData || constants.DEFAULT_CONFIG;

  const oldVersion = jsonData.schema || 1;
  jsonData.schema = DS_CONFIG_SCHEMA;

  if (oldVersion < 2) {
    const dbConnectionOptions = jsonData.dbConnection || {};
    newJsonData.dbConnectionEnable = dbConnectionOptions.enable || false;
    newJsonData.dbConnectionDatasourceId = dbConnectionOptions.datasourceId || null;
  }

  return newJsonData;
}

function shouldMigrateDSConfig(jsonData: ZabbixJsonDataV1): boolean {
  if (jsonData.dbConnection && !_.isEmpty(jsonData.dbConnection)) {
    return true;
  }
  if (jsonData.schema && jsonData.schema !== DS_CONFIG_SCHEMA) {
    return true;
  }
  return false;
}
