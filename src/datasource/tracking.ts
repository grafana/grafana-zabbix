import { DataQueryRequest } from '@grafana/data';
import { ZabbixMetricsQuery } from './types';
import { reportInteraction } from '@grafana/runtime';
import {
  MODE_ITEMID,
  MODE_ITSERVICE,
  MODE_MACROS,
  MODE_METRICS,
  MODE_PROBLEMS,
  MODE_TEXT,
  MODE_TRIGGERS,
} from './constants';

export const trackRequest = (request: DataQueryRequest<ZabbixMetricsQuery>): void => {
  request.targets.forEach((target) => {
    const properties: any = {
      app: request.app,
    };

    switch (target.queryType) {
      case MODE_METRICS:
        properties.queryType = 'Metrics';
        break;
      case MODE_ITSERVICE:
        properties.queryType = 'Services';
        break;
      case MODE_TEXT:
        properties.queryType = 'Text';
        break;
      case MODE_ITEMID:
        properties.queryType = 'Item Id';
        break;
      case MODE_TRIGGERS:
        properties.queryType = 'Triggers';
        break;
      case MODE_PROBLEMS:
        properties.queryType = 'Problems';
        break;
      case MODE_MACROS:
        properties.queryType = 'Macros';
        break;
    }

    reportInteraction('grafana_zabbix_query_executed', properties);
  });
};
