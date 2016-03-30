/**
 * Query format migration.
 * This module can detect query format version and make migration.
 */

export function isGrafana2target(target) {
  if (!target.mode || target.mode === 0) {
    if ((target.hostFilter || target.itemFilter || target.downsampleFunction ||  target.host.host) &&
        (target.item.filter === undefined && target.host.filter === undefined)) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function migrateFrom2To3version(target) {
  target.group.filter = target.group.name === "*" ? "/.*/" : target.group.name;
  target.group.isRegex = target.group.name === "*";
  target.host.filter = target.host.name === "*" ? convertToRegex(target.hostFilter) : target.host.name;
  target.host.isRegex = target.host.name === "*";
  target.application.filter = target.application.name === "*" ? "" : target.application.name;
  target.application.isRegex = target.application.name === "*";
  target.item.filter = target.item.name === "All" ? convertToRegex(target.itemFilter) : target.item.name;
  target.item.isRegex = target.item.name === "All";
  return target;
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
