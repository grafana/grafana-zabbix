/**
 * Query format migration.
 * This module can detect query format version and make migration.
 */

import * as utils from './utils';

export function isGrafana2target(target) {
  if ((target.hostFilter || target.itemFilter || target.downsampleFunction ||  target.host.host) &&
      (!target.functions && !target.host.filter)) {
    return true;
  } else {
    return false;
  }
}

export function migrateFrom2To3version(target) {
  utils.isRegex(target.host.name);
  var newTarget = {
    group: {
      filter: target.group.name === "*" ? "/.*/" : target.group.name,
      isRegex: target.group.name === "*"
    },
    host: {
      filter: target.host.name === "*" ? convertToRegex(target.hostFilter) : target.host.name,
      isRegex: target.host.name === "*"
    },
    application: {
      filter: target.application.name === "*" ? "" : target.application.name,
      isRegex: target.application.name === "*"
    },
    item: {
      filter: target.item.name === "All" ? convertToRegex(target.itemFilter) : target.item.name,
      isRegex: target.item.name === "All"
    },
    functions: [],
    mode: target.mode,
    hide: target.hide,
  };
  return newTarget;
}

export function migrate(target) {
  if (isGrafana2target(target)) {
    return migrateFrom2To3version(target);
  } else {
    return target;
  }
}

function convertToRegex(str) {
  return '/' + str + '/';
}
