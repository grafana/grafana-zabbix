import React, { Fragment, useEffect, useMemo, useRef } from 'react';
import {
  ColumnResizeMode,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ProblemDTO, ZBXAlert, ZBXEvent, ZBXTag } from '../../../datasource/types';
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
import { ProblemsPanelOptions, RTResized } from '../../types';
import { reportInteraction } from '@grafana/runtime';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';
import { AckProblemData } from '../AckModal';
import { TimeRange } from '@grafana/data';

const columnHelper = createColumnHelper<ProblemDTO>();

export interface ProblemListProps {
  problems: ProblemDTO[];
  panelOptions: ProblemsPanelOptions;
  loading?: boolean;
  timeRange?: TimeRange;
  range?: TimeRange;
  pageSize?: number;
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

  // Define columns inside component to access props via closure
  const columns = useMemo(() => {
    const highlightNewerThan = panelOptions.highlightNewEvents && panelOptions.highlightNewerThan;

    return [
      columnHelper.accessor('host', {
        header: 'Host',
        size: 150,
        cell: ({ cell }) => <HostCell name={cell.getValue()} maintenance={cell.row.original.hostInMaintenance} />,
      }),
      columnHelper.accessor('hostTechName', {
        header: 'Host (Technical Name)',
        size: 200,
        cell: ({ cell }) => <HostCell name={cell.getValue()} maintenance={cell.row.original.hostInMaintenance} />,
      }),
      columnHelper.accessor('groups', {
        header: 'Host Groups',
        size: 150,
        cell: ({ cell }) => {
          const groups = cell.getValue() ?? [];
          return <span>{groups.map((g) => g.name).join(', ')}</span>;
        },
      }),
      columnHelper.accessor('proxy', {
        header: 'Proxy',
        size: 120,
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
        size: 300,
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
        size: 150,
        meta: {
          className: 'problem-tags',
        },
        cell: ({ cell }) => (
          <TagCellV8
            tags={cell.getValue()}
            dataSource={cell.row.original.datasource as DataSourceRef}
            handleTagClick={onTagClick}
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

  // Convert resizedColumns from old format to column sizing state
  const getColumnSizingFromResized = (resized?: RTResized): Record<string, number> => {
    if (!resized || resized.length === 0) {
      return {};
    }
    const sizing: Record<string, number> = {};
    resized.forEach((col) => {
      sizing[col.id] = col.value;
    });
    return sizing;
  };

  const [columnSizing, setColumnSizing] = React.useState<Record<string, number>>(
    getColumnSizingFromResized(panelOptions.resizedColumns)
  );
  const [columnResizeMode] = React.useState<ColumnResizeMode>('onChange');

  // Default pageSize to 10 if not provided
  const effectivePageSize = pageSize || 10;

  // Pagination state
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: effectivePageSize,
  });

  // Update pagination when pageSize prop changes
  useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      pageSize: effectivePageSize,
    }));
  }, [effectivePageSize]);

  const table = useReactTable({
    data: problems,
    columns,
    enableColumnResizing: true,
    columnResizeMode,
    state: {
      columnSizing,
      pagination,
    },
    onPaginationChange: setPagination,
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
    onColumnSizingChange: (updater) => {
      const newSizing = typeof updater === 'function' ? updater(columnSizing) : updater;
      setColumnSizing(newSizing);

      // Convert to old format for compatibility
      const resized: RTResized = Object.entries(newSizing).map(([id, value]) => ({
        id,
        value: value as number,
      }));

      onColumnResize?.(resized);
    },
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Helper functions for pagination interactions
  const reportPageChange = (action: 'next' | 'prev') => {
    reportInteraction('grafana_zabbix_panel_page_change', { action });
  };

  const reportPageSizeChange = (pageSize: number) => {
    reportInteraction('grafana_zabbix_panel_page_size_change', { pageSize });
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (!inputValue) {
      return;
    }
    const pageNumber = Number(inputValue);
    const maxPage = table.getPageCount();

    // Clamp the value between 1 and maxPage
    const clampedPage = Math.max(1, Math.min(pageNumber, maxPage));
    const newPageIndex = clampedPage - 1;

    if (newPageIndex !== table.getState().pagination.pageIndex) {
      reportPageChange(newPageIndex > table.getState().pagination.pageIndex ? 'next' : 'prev');
      table.setPageIndex(newPageIndex);
    }
  };

  const handlePageInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // On blur, ensure the input shows a valid value
    const inputValue = e.target.value;
    if (!inputValue) {
      e.target.value = String(table.getState().pagination.pageIndex + 1);
      return;
    }
    const pageNumber = Number(inputValue);
    const maxPage = table.getPageCount();
    const clampedPage = Math.max(1, Math.min(pageNumber, maxPage));
    e.target.value = String(clampedPage);
  };

  const handlePreviousPage = () => {
    reportPageChange('prev');
    table.previousPage();
  };

  const handleNextPage = () => {
    reportPageChange('next');
    table.nextPage();
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = Number(e.target.value);
    reportPageSizeChange(newPageSize);
    table.setPageSize(newPageSize);
    onPageSizeChange?.(newPageSize, table.getState().pagination.pageIndex);
  };

  // Calculate page size options
  const pageSizeOptions = React.useMemo(() => {
    let options = [5, 10, 20, 25, 50, 100];
    if (pageSize) {
      options.push(pageSize);
      options = Array.from(new Set(options)).sort((a, b) => a - b);
    }
    return options;
  }, [pageSize]);

  return (
    <>
      <div className={`react-table-v8-wrapper ${loading ? 'is-loading' : ''}`}>
        {loading && (
          <div className="-loading -active">
            <div className="-loading-inner">Loading...</div>
          </div>
        )}
        <table className="react-table-v8">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: `${header.getSize()}px` }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                      />
                    )}
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
                          rootWidth={rootRef?.current?.clientWidth || 0}
                          timeRange={timeRange}
                          showTimeline={panelOptions.problemTimeline}
                          allowDangerousHTML={panelOptions.allowDangerousHTML}
                          panelId={panelId}
                          getProblemEvents={getProblemEvents}
                          getProblemAlerts={getProblemAlerts}
                          getScripts={getScripts}
                          onProblemAck={onProblemAck}
                          onExecuteScript={onExecuteScript}
                          onTagClick={onTagClick}
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
      <div className="pagination-v8">
        <div className="pagination-v8-controls">
          <button
            className="pagination-v8-btn -btn"
            onClick={handlePreviousPage}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <span className="pagination-v8-info">
            Page{' '}
            <input
              type="number"
              className="pagination-v8-page-input"
              value={table.getState().pagination.pageIndex + 1}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              min={1}
              max={table.getPageCount()}
            />{' '}
            of <strong>{table.getPageCount()}</strong>
          </span>
          <select
            name="pagination-v8-select"
            className="pagination-v8-select"
            value={table.getState().pagination.pageSize}
            onChange={handlePageSizeChange}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
          <button className="pagination-v8-btn -btn" onClick={handleNextPage} disabled={!table.getCanNextPage()}>
            Next
          </button>
        </div>
      </div>
    </>
  );
};
