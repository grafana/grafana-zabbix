import { CoreApp, DataQueryRequest } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ZabbixMetricsQuery } from './types/query';
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
  if (request.app === CoreApp.Dashboard || request.app === CoreApp.PanelViewer) {
    return;
  }

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
