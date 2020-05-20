import _ from 'lodash';
import moment from 'moment';
import { DataQuery } from '@grafana/data';
import * as utils from '../datasource-zabbix/utils';
import { ProblemDTO } from 'datasource-zabbix/types';

export function isNewProblem(problem: ProblemDTO, highlightNewerThan: string): boolean {
  try {
    const highlightIntervalMs = utils.parseInterval(highlightNewerThan);
    const durationSec = (Date.now() - problem.timestamp * 1000);
    return durationSec < highlightIntervalMs;
  } catch (e) {
    return false;
  }
}

const DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";

export function formatLastChange(lastchangeUnix: number, customFormat?: string) {
  const timestamp = moment.unix(lastchangeUnix);
  const format = customFormat || DEFAULT_TIME_FORMAT;
  const lastchange = timestamp.format(format);
  return lastchange;
}

export const getNextRefIdChar = (queries: DataQuery[]): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return _.find(letters, refId => {
    return _.every(queries, other => {
      return other.refId !== refId;
    });
  });
};

export type UrlQueryMap = Record<string, any>;

export function renderUrl(path: string, query: UrlQueryMap | undefined): string {
  if (query && Object.keys(query).length > 0) {
    path += '?' + toUrlParams(query);
  }
  return path;
}

function encodeURIComponentAsAngularJS(val: string, pctEncodeSpaces?: boolean) {
  return encodeURIComponent(val)
    .replace(/%25/gi, '%2525') // Double-encode % symbol to make it properly decoded in Explore
    .replace(/%40/gi, '@')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';')
    .replace(/%20/g, pctEncodeSpaces ? '%20' : '+');
}

function toUrlParams(a: any) {
  const s: any[] = [];
  const rbracket = /\[\]$/;

  const isArray = (obj: any) => {
    return Object.prototype.toString.call(obj) === '[object Array]';
  };

  const add = (k: string, v: any) => {
    v = typeof v === 'function' ? v() : v === null ? '' : v === undefined ? '' : v;
    if (typeof v !== 'boolean') {
      s[s.length] = encodeURIComponentAsAngularJS(k, true) + '=' + encodeURIComponentAsAngularJS(v, true);
    } else {
      s[s.length] = encodeURIComponentAsAngularJS(k, true);
    }
  };

  const buildParams = (prefix: string, obj: any) => {
    let i, len, key;

    if (prefix) {
      if (isArray(obj)) {
        for (i = 0, len = obj.length; i < len; i++) {
          if (rbracket.test(prefix)) {
            add(prefix, obj[i]);
          } else {
            buildParams(prefix, obj[i]);
          }
        }
      } else if (obj && String(obj) === '[object Object]') {
        for (key in obj) {
          buildParams(prefix + '[' + key + ']', obj[key]);
        }
      } else {
        add(prefix, obj);
      }
    } else if (isArray(obj)) {
      for (i = 0, len = obj.length; i < len; i++) {
        add(obj[i].name, obj[i].value);
      }
    } else {
      for (key in obj) {
        buildParams(key, obj[key]);
      }
    }
    return s;
  };

  return buildParams('', a).join('&');
}
