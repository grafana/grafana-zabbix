import { DataFrame, dateTime, Field, FieldType } from '@grafana/data';
import _ from 'lodash';
import { ProblemDTO, ZBXEvent, ZBXProblem, ZBXTrigger } from './types';
import { ZabbixMetricsQuery } from './types/query';
import * as utils from './utils';

export function joinTriggersWithProblems(problems: ZBXProblem[], triggers: ZBXTrigger[]): ProblemDTO[] {
  const problemDTOList: ProblemDTO[] = [];

  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    const triggerId = Number(p.objectid);
    const t = triggers[triggerId];

    if (t) {
      const problemDTO: ProblemDTO = {
        timestamp: Number(p.clock),
        triggerid: p.objectid,
        eventid: p.eventid,
        name: p.name,
        severity: p.severity,
        acknowledged: p.acknowledged,
        acknowledges: p.acknowledges,
        tags: p.tags,
        suppressed: p.suppressed,
        suppression_data: p.suppression_data,
        description: p.name || t.description,
        comments: t.comments,
        value: t.value,
        opdata: p.opdata,
        groups: t.groups,
        hosts: t.hosts,
        items: t.items,
        alerts: t.alerts,
        url: t.url,
        expression: t.expression,
        correlation_mode: t.correlation_mode,
        correlation_tag: t.correlation_tag,
        manual_close: t.manual_close,
        state: t.state,
        error: t.error,
      };

      problemDTOList.push(problemDTO);
    }
  }

  return problemDTOList;
}

interface JoinOptions {
  valueFromEvent?: boolean;
}

export function joinTriggersWithEvents(
  events: ZBXEvent[],
  triggers: ZBXTrigger[],
  options?: JoinOptions
): ProblemDTO[] {
  const { valueFromEvent } = options;
  const problemDTOList: ProblemDTO[] = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const triggerId = Number(e.objectid);
    const t = triggers[triggerId];

    if (t) {
      const problemDTO: ProblemDTO = {
        value: valueFromEvent ? e.value : t.value,
        timestamp: Number(e.clock),
        triggerid: e.objectid,
        eventid: e.eventid,
        name: e.name,
        severity: e.severity,
        acknowledged: e.acknowledged,
        acknowledges: e.acknowledges,
        tags: e.tags,
        suppressed: e.suppressed,
        description: t.description,
        comments: t.comments,
        groups: t.groups,
        hosts: t.hosts,
        items: t.items,
        alerts: t.alerts,
        url: t.url,
        expression: t.expression,
        correlation_mode: t.correlation_mode,
        correlation_tag: t.correlation_tag,
        manual_close: t.manual_close,
        state: t.state,
        error: t.error,
      };

      problemDTOList.push(problemDTO);
    }
  }

  return problemDTOList;
}

export function setMaintenanceStatus(triggers) {
  _.each(triggers, (trigger) => {
    trigger.hostInMaintenance = _.some(trigger.hosts, (host) => host.maintenance_status === '1');
    trigger.maintenance = false;
    if (trigger.suppressed === '1') {
      trigger.maintenance = true;
    }
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
  triggers.forEach((trigger) => {
    if (trigger.hosts && trigger.hosts.length) {
      const host = trigger.hosts[0];
      // Before version 7.0.0 proxy_hostid was used, after - proxyid
      const proxyId = host.proxyid || host.proxy_hostid;
      if (proxyId !== '0') {
        const hostProxy = proxies[proxyId];
        host.proxy = hostProxy ? hostProxy.host : '';
      }
    }
  });
  return triggers;
}

export function formatAcknowledges(triggers, users) {
  if (!users) {
    return;
  }
  triggers.forEach((trigger) => {
    if (trigger.acknowledges?.length) {
      for (let i = 0; i < trigger.acknowledges.length; i++) {
        const ack = trigger.acknowledges[i];
        let userData = users[ack.userid];

        // User with id 1 is Admin
        if (!userData && ack.userid === '1') {
          userData = {
            username: 'Admin',
          };
        }

        ack['user'] = userData?.username || '';
        ack['name'] = userData?.name || '';
        ack['surname'] = userData?.surname || '';

        const ts = Number(ack.clock) * 1000;
        if (!isNaN(ts)) {
          ack['time'] = dateTime(ts).format('YYYY-MM-DD HH:mm:ss');
        }
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

  // Filter by maintenance status
  if (!replacedTarget.options.hostsInMaintenance) {
    triggerList = _.filter(triggerList, (trigger) => !trigger.maintenance);
  }

  return triggerList;
}

function filterTriggers(triggers, triggerFilter) {
  if (utils.isRegex(triggerFilter)) {
    return _.filter(triggers, (trigger) => {
      return utils.buildRegex(triggerFilter).test(trigger.description);
    });
  } else {
    return _.filter(triggers, (trigger) => {
      return trigger.description === triggerFilter;
    });
  }
}

export function sortProblems(problems: ProblemDTO[], target) {
  if (target.options?.sortProblems === 'severity') {
    problems = _.orderBy(problems, ['severity', 'eventid'], ['desc', 'desc']);
  } else if (target.options?.sortProblems === 'lastchange') {
    problems = _.orderBy(problems, ['timestamp', 'eventid'], ['desc', 'desc']);
  }
  return problems;
}

export function toDataFrame(problems: any[], query: ZabbixMetricsQuery): DataFrame {
  const problemsField: Field<any> = {
    name: 'Problems',
    type: FieldType.other,
    values: problems,
    config: {
      custom: {
        type: 'problems',
      },
    },
  };

  const response: DataFrame = {
    name: 'problems',
    refId: query?.refId || 'A',
    fields: [problemsField],
    length: problems.length,
  };

  return response;
}

const problemsHandler = {
  addTriggerDataSource,
  addTriggerHostProxy,
  formatAcknowledges,
  setMaintenanceStatus,
  setAckButtonStatus,
  filterTriggersPre,
  sortProblems,
  toDataFrame,
  joinTriggersWithProblems,
  joinTriggersWithEvents,
};

export default problemsHandler;
