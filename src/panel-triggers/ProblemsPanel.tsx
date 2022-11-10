import React, { useCallback, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { PanelProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { ProblemsPanelOptions } from './types';
import { ProblemDTO, ZBXTrigger } from '../datasource-zabbix/types';
import { APIExecuteScriptResponse } from '../datasource-zabbix/zabbix/connectors/zabbix_api/types';
import ProblemList from './components/Problems/Problems';

interface TimelinePanelProps extends PanelProps<ProblemsPanelOptions> {}

export const ProblemsPanel = (props: TimelinePanelProps): JSX.Element => {
  const { data, options, onOptionsChange } = props;
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
    return [];
  };

  const getProblemAlerts = async (problem: ProblemDTO) => {
    return [];
  };

  const getScripts = async (problem: ProblemDTO) => {
    return [];
  };

  const onExecuteScript = async (problem: ProblemDTO, scriptid: string): Promise<APIExecuteScriptResponse> => {
    return { response: 'success' };
  };

  const onColumnResize = (newResized) => {
    onOptionsChange({ ...options, resizedColumns: newResized });
  };

  const renderList = () => {};

  const renderTable = () => {
    const problems = prepareProblems();
    return (
      <ProblemList
        problems={problems}
        panelOptions={options}
        getProblemEvents={getProblemEvents}
        getProblemAlerts={getProblemAlerts}
        getScripts={getScripts}
        onExecuteScript={onExecuteScript}
        onColumnResize={onColumnResize}
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
