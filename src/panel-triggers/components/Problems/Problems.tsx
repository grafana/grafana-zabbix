import React, { useRef } from 'react';
import { cx } from '@emotion/css';
import { ProblemsTable } from './ProblemsTable';
import { AckProblemData } from '../AckModal';
import { ProblemsPanelOptions, RTResized } from '../../types';
import { ProblemDTO, ZBXAlert, ZBXEvent, ZBXTag } from '../../../datasource/types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';
import { TimeRange } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';

export interface ProblemListProps {
  problems: ProblemDTO[];
  panelOptions: ProblemsPanelOptions;
  loading?: boolean;
  timeRange?: TimeRange;
  range?: TimeRange;
  pageSize?: number;
  fontSize?: number;
  panelId?: number;
  getProblemEvents: (problem: ProblemDTO) => Promise<ZBXEvent[]>;
  getProblemAlerts: (problem: ProblemDTO) => Promise<ZBXAlert[]>;
  getScripts: (problem: ProblemDTO) => Promise<ZBXScript[]>;
  onExecuteScript: (problem: ProblemDTO, scriptid: string, scope: string) => Promise<APIExecuteScriptResponse>;
  onProblemAck?: (problem: ProblemDTO, data: AckProblemData) => void;
  onTagClick?: (tag: ZBXTag, datasource: DataSourceRef, ctrlKey?: boolean, shiftKey?: boolean) => void;
  onPageSizeChange?: (pageSize: number, pageIndex: number) => void;
  onColumnResize?: (newResized: RTResized) => void;
}

export const ProblemList = (props: ProblemListProps) => {
  const {
    pageSize,
    fontSize,
    problems,
    panelOptions,
    onProblemAck,
    onPageSizeChange,
    onColumnResize,
    onTagClick,
    loading,
    timeRange,
    panelId,
    getProblemEvents,
    getProblemAlerts,
    getScripts,
    onExecuteScript,
  } = props;

  const rootRef = useRef(null);

  return (
    <div className={cx('panel-problems', { [`font-size--${fontSize}`]: !!fontSize })} ref={rootRef}>
      <ProblemsTable
        rootWidth={rootRef?.current?.clientWidth || 0}
        panelId={panelId}
        problems={problems}
        panelOptions={panelOptions}
        timeRange={timeRange}
        getProblemEvents={getProblemEvents}
        getProblemAlerts={getProblemAlerts}
        getScripts={getScripts}
        onProblemAck={onProblemAck}
        onExecuteScript={onExecuteScript}
        onTagClick={onTagClick}
        onColumnResize={onColumnResize}
        pageSize={pageSize || 10}
        onPageSizeChange={onPageSizeChange}
        loading={loading}
      />
    </div>
  );
};
