import _ from 'lodash';
import moment from 'moment';
import TableModel from 'grafana/app/core/table_model';
import * as utils from '../datasource-zabbix/utils';
import * as c from './constants';
import { DataFrame, Field, FieldType, ArrayVector } from '@grafana/data';

export function addEventTags(events, triggers) {
  _.each(triggers, trigger => {
    const event = _.find(events, event => {
      return event.eventid === trigger.lastEvent.eventid;
    });
    if (event && event.tags && event.tags.length) {
      trigger.tags = event.tags;
    }
  });
  return triggers;
}

export function addAcknowledges(events, triggers) {
  // Map events to triggers
  _.each(triggers, trigger => {
    const event = _.find(events, event => {
      return event.eventid === trigger.lastEvent.eventid;
    });

    if (event) {
      trigger.acknowledges = event.acknowledges;
    }

    if (!trigger.lastEvent.eventid) {
      trigger.lastEvent = null;
    }
  });

  return triggers;
}

export function setMaintenanceStatus(triggers) {
  _.each(triggers, (trigger) => {
    const maintenance_status = _.some(trigger.hosts, (host) => host.maintenance_status === '1');
    trigger.maintenance = maintenance_status;
  });
  return triggers;
}

export function setAckButtonStatus(triggers, showAckButton) {
  _.each(triggers, (trigger) => {
    trigger.showAckButton = showAckButton;
  });
  return triggers;
}

export function addTriggerDataSource(triggers, target) {
  _.each(triggers, (trigger) => {
    trigger.datasource = target.datasource;
  });
  return triggers;
}

export function addTriggerHostProxy(triggers, proxies) {
  triggers.forEach(trigger => {
    if (trigger.hosts && trigger.hosts.length) {
      const host = trigger.hosts[0];
      if (host.proxy_hostid !== '0') {
        const hostProxy = proxies[host.proxy_hostid];
        host.proxy = hostProxy ? hostProxy.host : '';
      }
    }
  });
  return triggers;
}

export function filterTriggersPre(triggerList, replacedTarget) {
  // Filter triggers by description
  const triggerFilter = replacedTarget.trigger.filter;
  if (triggerFilter) {
    triggerList = filterTriggers(triggerList, triggerFilter);
  }

  // Filter by tags
  if (replacedTarget.tags.filter) {
    let tagsFilter = replacedTarget.tags.filter;
    // replaceTemplateVars() builds regex-like string, so we should trim it.
    tagsFilter = tagsFilter.replace('/^', '').replace('$/', '');
    const tags = utils.parseTags(tagsFilter);
    triggerList = _.filter(triggerList, trigger => {
      return _.every(tags, tag => {
        return _.find(trigger.tags, t => t.tag === tag.tag && (!tag.value || t.value === tag.value));
      });
    });
  }

  return triggerList;
}

function filterTriggers(triggers, triggerFilter) {
  if (utils.isRegex(triggerFilter)) {
    return _.filter(triggers, trigger => {
      return utils.buildRegex(triggerFilter).test(trigger.description);
    });
  } else {
    return _.filter(triggers, trigger => {
      return trigger.description === triggerFilter;
    });
  }
}

export function toDataFrame(problems: any[]): DataFrame {
  const problemsField: Field<any> = {
    name: 'Problems',
    type: FieldType.other,
    values: new ArrayVector(problems),
    config: {},
  };

  const response: DataFrame = {
    name: 'problems',
    fields: [problemsField],
    length: problems.length,
  };

  return response;
}

const problemsHandler = {
  addEventTags,
  addAcknowledges,
  addTriggerDataSource,
  addTriggerHostProxy,
  setMaintenanceStatus,
  setAckButtonStatus,
  filterTriggersPre,
  toDataFrame,
};

export default problemsHandler;
