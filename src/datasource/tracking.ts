import { DataQueryRequest } from '@grafana/data';
import { ZabbixMetricsQuery } from './types';
import { reportInteraction } from '@grafana/runtime';

export const trackRequest = (request: DataQueryRequest<ZabbixMetricsQuery>): void => {
  request.targets.forEach((target) => {
    const properties: any = {
      app: request.app,
    };

    switch (target.queryType) {
      case '0':
      case '1':
      case '3':
        if (target.queryType === '0') {
          properties.queryType = 'Metrics';
        } else if (target.queryType === '1') {
          properties.queryType = 'Services';
        } else if (target.queryType === '3') {
          properties.queryType = 'Item Id';
        }
        properties.trends = target.options.useTrends;
        properties.showDisabledItems = target.options.showDisabledItems;
        properties.useZabbixValueMapping = target.options.useZabbixValueMapping;
        properties.disableDataAlignment = target.options.disableDataAlignment;
        break;
      case '2':
        properties.queryType = 'Text';
        properties.showDisabledItems = target.options.showDisabledItems;
        break;
      case '4':
        properties.queryType = 'Triggers';

        if (target.options.acknowledged === 0) {
          properties.acknowledged = 'unacknowledged';
        } else if (target.options.acknowledged === 1) {
          properties.acknowledged = 'acknowledged';
        } else if (target.options.acknowledged === 2) {
          properties.acknowledged = 'all triggers';
        }

        properties.useTimeRange = target.options.useTimeRange ?? false;
        break;
      case '5':
        properties.queryType = 'Problems';

        if (target.options.acknowledged === 0) {
          properties.acknowledged = 'unacknowledged';
        } else if (target.options.acknowledged === 1) {
          properties.acknowledged = 'acknowledged';
        } else if (target.options.acknowledged === 2) {
          properties.acknowledged = 'all triggers';
        }

        properties.sortProblems = target.options.sortProblems;
        properties.useTimeRange = target.options.useTimeRange;
        properties.hostsInMaintenance = target.options.hostsInMaintenance;
        properties.hostProxy = target.options.hostProxy;
        properties.limit = target.options.limit;
        break;
    }

    reportInteraction('grafana_zabbix_query_executed', properties);
  });
};
