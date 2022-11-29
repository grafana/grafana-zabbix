import React, { useCallback, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { BusEventBase, BusEventWithPayload, dateMath, PanelProps } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { contextSrv } from 'grafana/app/core/core';
import { ProblemsPanelOptions } from './types';
import { ProblemDTO, ZBXTag } from '../datasource-zabbix/types';
import { APIExecuteScriptResponse } from '../datasource-zabbix/zabbix/connectors/zabbix_api/types';
import ProblemList from './components/Problems/Problems';
import { AckProblemData } from './components/AckModal';
import AlertList from './components/AlertList/AlertList';

const PROBLEM_EVENTS_LIMIT = 100;

interface ProblemsPanelProps extends PanelProps<ProblemsPanelOptions> {}

export const ProblemsPanel = (props: ProblemsPanelProps): JSX.Element => {
  const { data, options, timeRange, onOptionsChange } = props;
  const { layout, showTriggers, triggerSeverity, sortProblems } = options;
  const theme = useTheme2();

  const prepareProblems = () => {
    const problems: ProblemDTO[] = [];
    if (!data?.series) {
      return [];
    }

    for (const dataFrame of data.series) {
      try {
        const values = dataFrame.fields[0].values;
        if (values.toArray) {
          problems.push(...values.toArray());
        }
      } catch (error) {
        console.log(error);
        return [];
      }
    }

    let triggers = _.cloneDeep(problems);

    triggers = triggers.map((t) => formatTrigger(t));
    triggers = filterProblems(triggers);
    triggers = sortTriggers(triggers);

    return triggers;
  };

  const filterProblems = (problems: ProblemDTO[]) => {
    let problemsList = _.cloneDeep(problems);

    // Filter acknowledged triggers
    if (showTriggers === 'unacknowledged') {
      problemsList = problemsList.filter((trigger) => {
        return !(trigger.acknowledges && trigger.acknowledges.length);
      });
    } else if (showTriggers === 'acknowledged') {
      problemsList = problemsList.filter((trigger) => {
        return trigger.acknowledges && trigger.acknowledges.length;
      });
    }

    // Filter triggers by severity
    problemsList = problemsList.filter((problem) => {
      if (problem.severity) {
        return triggerSeverity[problem.severity].show;
      } else {
        return triggerSeverity[problem.priority].show;
      }
    });

    return problemsList;
  };

  const sortTriggers = (problems: ProblemDTO[]) => {
    if (sortProblems === 'priority') {
      problems = _.orderBy(problems, ['severity', 'timestamp', 'eventid'], ['desc', 'desc', 'desc']);
    } else if (sortProblems === 'lastchange') {
      problems = _.orderBy(problems, ['timestamp', 'severity', 'eventid'], ['desc', 'desc', 'desc']);
    }
    return problems;
  };

  const formatTrigger = (zabbixTrigger: ProblemDTO) => {
    const trigger = _.cloneDeep(zabbixTrigger);

    // Set host and proxy that the trigger belongs
    if (trigger.hosts && trigger.hosts.length) {
      const host = trigger.hosts[0];
      trigger.host = host.name;
      trigger.hostTechName = host.host;
      if (host.proxy) {
        trigger.proxy = host.proxy;
      }
    }

    // Set tags if present
    if (trigger.tags && trigger.tags.length === 0) {
      trigger.tags = null;
    }

    // Handle multi-line description
    if (trigger.comments) {
      trigger.comments = trigger.comments.replace('\n', '<br>');
    }

    trigger.lastchangeUnix = Number(trigger.lastchange);
    return trigger;
  };

  const getProblemEvents = async (problem: ProblemDTO) => {
    const triggerids = [problem.triggerid];
    const timeFrom = Math.ceil(dateMath.parse(timeRange.from).unix());
    const timeTo = Math.ceil(dateMath.parse(timeRange.to).unix());
    const ds: any = await getDataSourceSrv().get(problem.datasource);
    return ds.zabbix.getEvents(triggerids, timeFrom, timeTo, [0, 1], PROBLEM_EVENTS_LIMIT);
  };

  const getProblemAlerts = async (problem: ProblemDTO) => {
    if (!problem.eventid) {
      return Promise.resolve([]);
    }
    const eventids = [problem.eventid];
    const ds: any = await getDataSourceSrv().get(problem.datasource);
    return ds.zabbix.getEventAlerts(eventids);
  };

  const getScripts = async (problem: ProblemDTO) => {
    const hostid = problem.hosts?.length ? problem.hosts[0].hostid : null;
    const ds: any = await getDataSourceSrv().get(problem.datasource);
    return ds.zabbix.getScripts([hostid]);
  };

  const onExecuteScript = async (problem: ProblemDTO, scriptid: string): Promise<APIExecuteScriptResponse> => {
    const hostid = problem.hosts?.length ? problem.hosts[0].hostid : null;
    const ds: any = await getDataSourceSrv().get(problem.datasource);
    return ds.zabbix.executeScript(hostid, scriptid);
  };

  const onProblemAck = async (problem: ProblemDTO, data: AckProblemData) => {
    const { message, action, severity } = data;
    const eventid = problem.eventid;
    const grafana_user = (contextSrv.user as any).name;
    const ack_message = grafana_user + ' (Grafana): ' + message;
    const ds: any = await getDataSourceSrv().get(problem.datasource);
    const userIsEditor = contextSrv.isEditor || contextSrv.isGrafanaAdmin;
    if (ds.disableReadOnlyUsersAck && !userIsEditor) {
      return { message: 'You have no permissions to acknowledge events.' };
    }
    if (eventid) {
      return ds.zabbix.acknowledgeEvent(eventid, ack_message, action, severity);
    } else {
      return { message: 'Trigger has no events. Nothing to acknowledge.' };
    }
  };

  const onColumnResize = (newResized) => {
    onOptionsChange({ ...options, resizedColumns: newResized });
  };

  const onTagClick = (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => {
    // TODO: handle adding/removing tags with event bus
  };

  const renderList = () => {
    const problems = prepareProblems();
    const fontSize = parseInt(options.fontSize.slice(0, options.fontSize.length - 1), 10);
    const fontSizeProp = fontSize && fontSize !== 100 ? fontSize : null;

    return (
      <AlertList
        problems={problems}
        panelOptions={options}
        pageSize={options.pageSize}
        fontSize={fontSizeProp}
        onProblemAck={onProblemAck}
        onTagClick={onTagClick}
      />
    );
  };

  const renderTable = () => {
    const problems = prepareProblems();
    const fontSize = parseInt(options.fontSize.slice(0, options.fontSize.length - 1), 10);
    const fontSizeProp = fontSize && fontSize !== 100 ? fontSize : null;

    return (
      <ProblemList
        problems={problems}
        panelOptions={options}
        pageSize={options.pageSize}
        fontSize={fontSizeProp}
        timeRange={timeRange}
        getProblemEvents={getProblemEvents}
        getProblemAlerts={getProblemAlerts}
        getScripts={getScripts}
        onExecuteScript={onExecuteScript}
        onProblemAck={onProblemAck}
        onColumnResize={onColumnResize}
        onTagClick={onTagClick}
      />
    );
  };

  return (
    <>
      {layout === 'list' && renderList()}
      {layout === 'table' && renderTable()}
    </>
  );
};
