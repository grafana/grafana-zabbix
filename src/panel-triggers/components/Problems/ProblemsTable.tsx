import React, { Fragment } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ProblemDTO, ZBXTag } from '../../../datasource/types';
import { ProblemListProps } from './Problems';
import { HostCell } from './Cells/HostCell';
import { AckCellV8 } from './AckCell';
import { AgeCellV8 } from './Cells/AgeCell';
import { SeverityCellV8 } from './Cells/SeverityCell';
import { StatusCellV8 } from './Cells/StatusCell';
import { StatusIconCellV8 } from './Cells/StatusIconCell';
import { LastChangeCellV8 } from './Cells/LastChangeCell';
import { DataSourceRef } from '@grafana/schema';
import { TagCellV8 } from './Cells/TagCell';
import { ProblemDetailsV8 } from './ProblemDetails';

const columnHelper = createColumnHelper<ProblemDTO>();

export const ProblemsTable = (
  props: Pick<
    ProblemListProps,
    | 'problems'
    | 'panelOptions'
    | 'onTagClick'
    | 'timeRange'
    | 'panelId'
    | 'getProblemEvents'
    | 'getProblemAlerts'
    | 'getScripts'
    | 'onExecuteScript'
    | 'onProblemAck'
  > & { rootWidth: number }
) => {
  const {
    problems,
    panelOptions,
    onTagClick,
    timeRange,
    panelId,
    getProblemEvents,
    getProblemAlerts,
    getScripts,
    onExecuteScript,
    onProblemAck,
    rootWidth,
  } = props;

  // Define columns inside component to access props via closure
  const columns = React.useMemo(() => {
    const highlightNewerThan = panelOptions.highlightNewEvents && panelOptions.highlightNewerThan;

    return [
      columnHelper.accessor('host', {
        header: 'Host',
        cell: ({ cell }) => <HostCell name={cell.getValue()} maintenance={cell.row.original.hostInMaintenance} />,
      }),
      columnHelper.accessor('hostTechName', {
        header: 'Host (Technical Name)',
        cell: ({ cell }) => <HostCell name={cell.getValue()} maintenance={cell.row.original.hostInMaintenance} />,
      }),
      columnHelper.accessor('groups', {
        header: 'Host Groups',
        cell: ({ cell }) => {
          const groups = cell.getValue() ?? [];
          return <span>{groups.map((g) => g.name).join(', ')}</span>;
        },
      }),
      columnHelper.accessor('proxy', {
        header: 'Proxy',
      }),
      columnHelper.accessor('priority', {
        header: 'Severity',
        size: 120,
        meta: {
          className: 'problem-severity',
        },
        cell: ({ cell }) => (
          <SeverityCellV8
            cell={cell}
            problemSeverityDesc={panelOptions.triggerSeverity}
            markAckEvents={panelOptions.markAckEvents}
            ackEventColor={panelOptions.ackEventColor}
            okColor={panelOptions.okEventColor}
          />
        ),
      }),
      columnHelper.display({
        id: 'statusIcon',
        header: 'Status Icon',
        size: 50,
        meta: {
          className: 'problem-status-icon',
        },
        cell: ({ cell }) => (
          <StatusIconCellV8
            cellValue={cell.row.original.value}
            row={cell.row}
            highlightNewerThan={highlightNewerThan}
          />
        ),
      }),
      columnHelper.accessor('value', {
        header: 'Status',
        size: 100,
        cell: ({ cell }) => <StatusCellV8 cell={cell} highlightNewerThan={highlightNewerThan} />,
      }),
      columnHelper.accessor('name', {
        header: 'Problem',
        minSize: 200,
        cell: ({ cell }) => (
          <div>
            <span className="problem-description">{cell.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('opdata', {
        header: 'Operational data',
        size: 150,
        cell: ({ cell }) => (
          <div>
            <span>{cell.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('acknowledged', {
        header: 'Ack',
        size: 70,
        cell: ({ cell }) => <AckCellV8 acknowledges={cell.row.original.acknowledges} />,
      }),
      columnHelper.accessor('tags', {
        header: 'Tags',
        meta: {
          className: 'problem-tags',
        },
        cell: ({ cell }) => (
          <TagCellV8
            tags={cell.getValue()}
            dataSource={cell.row.original.datasource as DataSourceRef}
            handleTagClick={handleTagClick}
          />
        ),
      }),
      columnHelper.accessor('timestamp', {
        id: 'age',
        header: 'Age',
        size: 100,
        meta: {
          className: 'problem-age',
        },
        cell: ({ cell }) => <AgeCellV8 timestamp={cell.row.original.timestamp} />,
      }),
      columnHelper.accessor('timestamp', {
        id: 'lastchange',
        header: 'Time',
        size: 150,
        meta: {
          className: 'last-change',
        },
        cell: ({ cell }) => (
          <LastChangeCellV8
            original={cell.row.original}
            customFormat={panelOptions.customLastChangeFormat && panelOptions.lastChangeFormat}
          />
        ),
      }),
      columnHelper.display({
        header: null,
        id: 'expander',
        size: 60,
        meta: {
          className: 'custom-expander',
        },
        cell: ({ row }) => (
          <button
            onClick={row.getToggleExpandedHandler()}
            style={{ cursor: 'pointer' }}
            className={row.getIsExpanded() ? 'expanded' : ''}
          >
            <i className="fa fa-info-circle" />
          </button>
        ),
      }),
    ];
  }, [panelOptions]);

  console.log('ProblemsTable', problems);
  const table = useReactTable({
    data: problems,
    columns,
    meta: {
      panelOptions,
    },
    initialState: {
      columnVisibility: {
        host: panelOptions.hostField,
        hostTechName: panelOptions.hostTechNameField,
        groups: panelOptions.hostGroups,
        proxy: panelOptions.hostProxy,
        severity: panelOptions.severityField,
        statusIcon: panelOptions.statusIcon,
        opdata: panelOptions.opdataField,
        ack: panelOptions.ackField,
        tags: panelOptions.showTags,
        age: panelOptions.ageField,
      },
    },
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const handleTagClick = (tag: ZBXTag, datasource: DataSourceRef, ctrlKey?: boolean, shiftKey?: boolean) => {
    onTagClick?.(tag, datasource, ctrlKey, shiftKey);
  };

  return (
    <div className="react-table-v8-wrapper">
      <table className="react-table-v8">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} style={{ width: `${header.getSize()}px` }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={table.getAllColumns().length} className="no-data-cell">
                <div className="rt-noData">No problems found</div>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, rowIndex) => (
              <Fragment key={row.id}>
                <tr className={rowIndex % 2 === 1 ? 'even-row' : 'odd-row'}>
                  {row.getVisibleCells().map((cell) => {
                    const className = (cell.column.columnDef.meta as any)?.className;
                    return (
                      <td key={cell.id} className={className} style={{ width: `${cell.column.getSize()}px` }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
                {row.getIsExpanded() && (
                  <tr className={rowIndex % 2 === 1 ? 'even-row-expanded' : 'odd-row-expanded'}>
                    <td colSpan={row.getVisibleCells().length}>
                      <ProblemDetailsV8
                        original={row.original}
                        rootWidth={rootWidth}
                        timeRange={timeRange}
                        showTimeline={panelOptions.problemTimeline}
                        allowDangerousHTML={panelOptions.allowDangerousHTML}
                        panelId={panelId}
                        getProblemEvents={getProblemEvents}
                        getProblemAlerts={getProblemAlerts}
                        getScripts={getScripts}
                        onProblemAck={onProblemAck}
                        onExecuteScript={onExecuteScript}
                        onTagClick={handleTagClick}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
