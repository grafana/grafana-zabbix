import React, { useMemo, useRef, useState } from 'react';
import { cx } from '@emotion/css';
import _ from 'lodash';
import ReactTable from 'react-table-6';
import { ProblemsTable } from './ProblemsTable';
import { AckProblemData } from '../AckModal';
import { ProblemsPanelOptions, RTCell, RTResized } from '../../types';
import { ProblemDTO, ZBXAlert, ZBXEvent, ZBXTag } from '../../../datasource/types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';
import { AckCell } from './AckCell';
import { TimeRange } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { reportInteraction } from '@grafana/runtime';
import { LastChangeCell } from './Cells/LastChangeCell';
import { AgeCell } from './Cells/AgeCell';
import { TagCell } from './Cells/TagCell';
import { ProblemCell } from './Cells/ProblemCell';
import { OpdataCell } from './Cells/OpdataCell';
import { SeverityCell } from './Cells/SeverityCell';
import { GroupCell } from './Cells/GroupCell';
import { StatusCell } from './Cells/StatusCell';
import { StatusIconCell } from './Cells/StatusIconCell';
import { HostCell } from './Cells/HostCell';
import { ProblemDetails } from './ProblemDetails';

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

  const [expanded, setExpanded] = useState({});
  const [expandedProblems, setExpandedProblems] = useState({});
  const [page, setPage] = useState(0);
  const rootRef = useRef(null);

  // Default pageSize to 10 if not provided
  const effectivePageSize = pageSize || 10;

  const handleProblemAck = (problem: ProblemDTO, data: AckProblemData) => {
    return onProblemAck!(problem, data);
  };

  const handlePageSizeChange = (pageSize, pageIndex) => {
    onPageSizeChange?.(pageSize, pageIndex);
  };

  const handleResizedChange = (newResized, event) => {
    onColumnResize?.(newResized);
  };

  const handleExpandedChange = (expandedChange: any, event: any) => {
    reportInteraction('grafana_zabbix_panel_row_expanded', {});
    const newExpandedProblems = {};

    for (const row in expandedChange) {
      const rowId = Number(row);
      const problemIndex = effectivePageSize * page + rowId;
      if (expandedChange[row] && problemIndex < problems.length) {
        const expandedProblem = problems[problemIndex].eventid;
        if (expandedProblem) {
          newExpandedProblems[expandedProblem] = true;
        }
      }
    }

    const nextExpanded = { ...expanded };
    nextExpanded[page] = expandedChange;

    const nextExpandedProblems = { ...expandedProblems };
    nextExpandedProblems[page] = newExpandedProblems;

    setExpanded(nextExpanded);
    setExpandedProblems(nextExpandedProblems);
  };

  const handleTagClick = (tag: ZBXTag, datasource: DataSourceRef, ctrlKey?: boolean, shiftKey?: boolean) => {
    onTagClick?.(tag, datasource, ctrlKey, shiftKey);
  };

  const getExpandedPage = (page: number) => {
    const expandedProblemsPage = expandedProblems[page] || {};
    const expandedPage = {};

    // Go through the page and search for expanded problems
    const startIndex = effectivePageSize * page;
    const endIndex = Math.min(startIndex + effectivePageSize, problems.length);
    for (let i = startIndex; i < endIndex; i++) {
      const problem = problems[i];
      if (expandedProblemsPage[problem.eventid]) {
        expandedPage[i - startIndex] = {};
      }
    }

    return expandedPage;
  };

  const columns = useMemo(() => {
    const result = [];
    const highlightNewerThan = panelOptions.highlightNewEvents && panelOptions.highlightNewerThan;
    const statusCell = (props) => StatusCell(props, highlightNewerThan);
    const statusIconCell = (props) => StatusIconCell(props, highlightNewerThan);
    const hostNameCell = (props) => (
      <HostCell name={props.original.host} maintenance={props.original.hostInMaintenance} />
    );
    const hostTechNameCell = (props) => (
      <HostCell name={props.original.hostTechName} maintenance={props.original.hostInMaintenance} />
    );

    const allColumns = [
      { Header: 'Host', id: 'host', show: panelOptions.hostField, Cell: hostNameCell },
      {
        Header: 'Host (Technical Name)',
        id: 'hostTechName',
        show: panelOptions.hostTechNameField,
        Cell: hostTechNameCell,
      },
      { Header: 'Host Groups', accessor: 'groups', show: panelOptions.hostGroups, Cell: GroupCell },
      { Header: 'Proxy', accessor: 'proxy', show: panelOptions.hostProxy },
      {
        Header: 'Severity',
        show: panelOptions.severityField,
        className: 'problem-severity',
        width: 120,
        accessor: (problem) => problem.priority,
        id: 'severity',
        Cell: (props) =>
          SeverityCell(
            props,
            panelOptions.triggerSeverity,
            panelOptions.markAckEvents,
            panelOptions.ackEventColor,
            panelOptions.okEventColor
          ),
      },
      {
        Header: '',
        id: 'statusIcon',
        show: panelOptions.statusIcon,
        className: 'problem-status-icon',
        width: 50,
        accessor: 'value',
        Cell: statusIconCell,
      },
      { Header: 'Status', accessor: 'value', show: panelOptions.statusField, width: 100, Cell: statusCell },
      { Header: 'Problem', accessor: 'name', minWidth: 200, Cell: ProblemCell },
      { Header: 'Operational data', accessor: 'opdata', show: panelOptions.opdataField, width: 150, Cell: OpdataCell },
      {
        Header: 'Ack',
        id: 'ack',
        show: panelOptions.ackField,
        width: 70,
        Cell: (props) => <AckCell {...props} />,
      },
      {
        Header: 'Tags',
        accessor: 'tags',
        show: panelOptions.showTags,
        className: 'problem-tags',
        Cell: (props) => <TagCell {...props} onTagClick={handleTagClick} />,
      },
      {
        Header: 'Age',
        className: 'problem-age',
        width: 100,
        show: panelOptions.ageField,
        accessor: 'timestamp',
        id: 'age',
        Cell: AgeCell,
      },
      {
        Header: 'Time',
        className: 'last-change',
        width: 150,
        accessor: 'timestamp',
        id: 'lastchange',
        Cell: (props) => LastChangeCell(props, panelOptions.customLastChangeFormat && panelOptions.lastChangeFormat),
      },
      { Header: '', className: 'custom-expander', width: 60, expander: true, Expander: CustomExpander },
    ];
    for (const column of allColumns) {
      if (column.show || column.show === undefined) {
        delete column.show;
        result.push(column);
      }
    }
    return result;
  }, [panelOptions, handleTagClick]);

  const pageSizeOptions = useMemo(() => {
    let options = [5, 10, 20, 25, 50, 100];
    if (pageSize) {
      options.push(pageSize);
      options = _.uniq(_.sortBy(options));
    }
    return options;
  }, [pageSize]);
  // console.log('Panel Options', panelOptions);
  return (
    <div className={cx('panel-problems', { [`font-size--${fontSize}`]: !!fontSize })} ref={rootRef}>
      <ProblemsTable
        rootWidth={rootRef?.current?.clientWidth || 0}
        problems={problems}
        panelOptions={panelOptions}
        timeRange={timeRange}
        getProblemEvents={getProblemEvents}
        getProblemAlerts={getProblemAlerts}
        getScripts={getScripts}
        onProblemAck={handleProblemAck}
        onExecuteScript={onExecuteScript}
        onTagClick={handleTagClick}
      />
      <ReactTable
        data={problems}
        columns={columns}
        defaultPageSize={10}
        pageSize={effectivePageSize}
        pageSizeOptions={pageSizeOptions}
        resized={panelOptions.resizedColumns}
        minRows={0}
        loading={loading}
        noDataText="No problems found"
        SubComponent={(props) => (
          <ProblemDetails
            {...props}
            rootWidth={rootRef?.current?.clientWidth || 0}
            timeRange={timeRange}
            showTimeline={panelOptions.problemTimeline}
            allowDangerousHTML={panelOptions.allowDangerousHTML}
            panelId={panelId}
            getProblemEvents={getProblemEvents}
            getProblemAlerts={getProblemAlerts}
            getScripts={getScripts}
            onProblemAck={handleProblemAck}
            onExecuteScript={onExecuteScript}
            onTagClick={handleTagClick}
            subRows={false}
          />
        )}
        expanded={getExpandedPage(page)}
        onExpandedChange={handleExpandedChange}
        onPageChange={(newPage) => {
          reportInteraction('grafana_zabbix_panel_page_change', {
            action: newPage > page ? 'next' : 'prev',
          });

          setPage(newPage);
        }}
        onPageSizeChange={handlePageSizeChange}
        onResizedChange={handleResizedChange}
      />
    </div>
  );
};

function CustomExpander(props: RTCell<any>) {
  return (
    <span className={props.isExpanded ? 'expanded' : ''}>
      <i className="fa fa-info-circle"></i>
    </span>
  );
}
