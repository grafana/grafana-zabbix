import React, { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@emotion/css';
import { AckProblemData } from '../AckModal';
import { ProblemsPanelOptions, RTResized } from '../../types';
import { ProblemDTO, ZBXAlert, ZBXEvent, ZBXGroup, ZBXTag } from '../../../datasource/types';
import { APIExecuteScriptResponse, ZBXScript } from '../../../datasource/zabbix/connectors/zabbix_api/types';
import { TimeRange } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { HostCell } from './Cells/HostCell';
import { ProblemCell } from './Cells/ProblemCell';
import { SeverityCell } from './Cells/SeverityCell';
import { StatusIconCellV8 } from './Cells/StatusIconCell';
import { StatusCellV8 } from './Cells/StatusCell';
import { AckCell } from './Cells/AckCell';
import { TagCell } from './Cells/TagCell';
import { LastChangeCell } from './Cells/LastChangeCell';
import { AgeCell } from './Cells/AgeCell';
import { getProblemsDataLinks } from '../../dataLinks';
import {
  ColumnFiltersState,
  ColumnResizeMode,
  SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';
import { ProblemDetails } from './ProblemDetails';
import { capitalizeFirstLetter, parseCustomTagColumns } from './utils';
import { getStyles } from './Problems.styles';

export interface ProblemListProps {
  problems: ProblemDTO[];
  panelOptions: ProblemsPanelOptions;
  loading?: boolean;
  timeRange?: TimeRange;
  range?: TimeRange;
  /** Rows per page; 'auto' (or undefined) fits the rows to the panel height */
  pageSize?: number | 'auto';
  fontSize?: number;
  panelId?: number;
  getProblemEvents: (problem: ProblemDTO) => Promise<ZBXEvent[]>;
  getProblemAlerts: (problem: ProblemDTO) => Promise<ZBXAlert[]>;
  getScripts: (problem: ProblemDTO) => Promise<ZBXScript[]>;
  onExecuteScript: (problem: ProblemDTO, scriptid: string, scope: string) => Promise<APIExecuteScriptResponse>;
  onProblemAck?: (problem: ProblemDTO, data: AckProblemData) => void;
  onTagClick?: (tag: ZBXTag, datasource: DataSourceRef, ctrlKey?: boolean, shiftKey?: boolean) => void;
  onPageSizeChange?: (pageSize: number | 'auto', pageIndex: number) => void;
  onColumnResize?: (newResized: RTResized) => void;
}

const columnHelper = createColumnHelper<ProblemDTO>();

export const DEFAULT_PAGE_SIZE = 10;

// Row height from the mockup at the 14px base; used before any row is rendered
const ROW_HEIGHT_EM = 52 / 14;

/** Rows that fit the space left for the table body; the default until the panel is laid out */
export const computeAutoPageSize = (availableHeight: number, rowHeight: number): number => {
  if (availableHeight <= 0 || rowHeight <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.floor(availableHeight / rowHeight));
};

const SORT_ARIA = {
  asc: 'ascending',
  desc: 'descending',
  none: 'none',
} as const;

const buildCustomTagColumns = (customTagColumns?: string) => {
  const tagNames = parseCustomTagColumns(customTagColumns);

  return tagNames.map((tagName) =>
    columnHelper.accessor(
      (row) => {
        const tags = row.tags ?? [];
        const values = tags
          .filter((t) => t.tag === tagName)
          .map((t) => t.value)
          .filter(Boolean);

        return values.length ? values.join(', ') : '';
      },
      {
        id: `problem-tag_${tagName}`,
        header: capitalizeFirstLetter(tagName),
        size: 150,
        sortingFn: 'alphanumeric',
        meta: {
          className: `problem-tag_${tagName}`,
        },
        cell: ({ getValue }) => <span>{getValue() as string}</span>,
      }
    )
  );
};

// Join group names the same way the cell renders them, so sorting compares
// the visible text instead of falling back to comparing arrays.
const joinGroupNames = (groups?: ZBXGroup[]): string => (groups ?? []).map((g) => g.name).join(', ');

// Second line of the host cell: reuse the host-group or technical-name data only while
// those columns are hidden, so nothing is shown twice.
const getHostSubtitle = (problem: ProblemDTO, options: ProblemsPanelOptions): string | undefined => {
  if (!options.hostGroups && problem.groups?.length) {
    return problem.groups.map((g) => g.name).join(' / ');
  }
  if (!options.hostTechNameField && problem.hostTechName && problem.hostTechName !== problem.host) {
    return problem.hostTechName;
  }
  return undefined;
};

// Resolve the datasource name the same way the cell renders it, so sorting
// matches the visible text instead of comparing refs or raw uids.
const resolveDatasourceName = (datasource?: DataSourceRef | string): string => {
  if ((datasource as DataSourceRef)?.uid) {
    const instance = getDataSourceSrv().getInstanceSettings((datasource as DataSourceRef).uid);
    return instance?.name ?? String((datasource as DataSourceRef).uid);
  }
  return (datasource as string) ?? '';
};

// Derive the table's sorting state from the "Sort by" panel option, so the panel
// keeps the configured ordering instead of forcing its own.
const getSortingFromOption = (sortProblems?: ProblemsPanelOptions['sortProblems']): SortingState => {
  switch (sortProblems) {
    case 'priority':
      return [{ id: 'priority', desc: true }];
    case 'lastchange':
      return [{ id: 'lastchange', desc: true }];
    default:
      return [];
  }
};

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const styles = useStyles2(getStyles);

  // Define columns inside component to access props via closure
  const columns = useMemo(() => {
    const highlightNewerThan = panelOptions.highlightNewEvents && panelOptions.highlightNewerThan;

    const customTagColumns = buildCustomTagColumns(panelOptions.customTagColumns);

    return [
      columnHelper.accessor('host', {
        header: 'Host',
        size: 120,
        enableSorting: true,
        sortingFn: 'alphanumeric',
        cell: ({ cell }) => (
          <HostCell
            name={cell.getValue()}
            subtitle={getHostSubtitle(cell.row.original, panelOptions)}
            maintenance={cell.row.original.hostInMaintenance}
          />
        ),
      }),
      columnHelper.accessor('hostTechName', {
        header: 'Host (Technical Name)',
        size: 170,
        enableSorting: true,
        sortingFn: 'alphanumeric',
        cell: ({ cell }) => <HostCell name={cell.getValue()} maintenance={cell.row.original.hostInMaintenance} />,
      }),
      columnHelper.accessor('groups', {
        header: 'Host Groups',
        size: 150,
        sortingFn: (rowA, rowB) =>
          joinGroupNames(rowA.original.groups).localeCompare(joinGroupNames(rowB.original.groups)),
        cell: ({ cell }) => <span>{joinGroupNames(cell.getValue())}</span>,
      }),
      columnHelper.accessor('proxy', {
        header: 'Proxy',
        size: 120,
        enableSorting: true,
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor('priority', {
        header: 'Severity',
        // Fits the pill for the default names up to "Disaster"; longer names ellipsize with a tooltip
        size: 96,
        sortDescFirst: true,
        sortingFn: (rowA, rowB) => {
          const a = parseInt(rowA.original.severity ?? '0', 10);
          const b = parseInt(rowB.original.severity ?? '0', 10);
          return a - b;
        },
        meta: {
          className: 'problem-severity',
        },
        cell: ({ cell }) => (
          <SeverityCell
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
        size: 70,
        enableSorting: false,
        cell: ({ cell }) => <StatusCellV8 cell={cell} highlightNewerThan={highlightNewerThan} />,
      }),
      columnHelper.accessor('name', {
        header: 'Problem',
        size: 250,
        minSize: 200,
        enableSorting: true,
        sortingFn: 'alphanumeric',
        cell: ({ cell }) => (
          <ProblemCell
            description={cell.getValue()}
            // Only as a subtitle while the Operational data column is hidden
            opdata={panelOptions.opdataField ? undefined : cell.row.original.opdata}
            // Panel data links apply to the description, like a native table cell
            links={getProblemsDataLinks(panelOptions.dataLinks, cell.row.original)}
          />
        ),
      }),
      columnHelper.accessor('opdata', {
        header: 'Operational data',
        size: 150,
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor('acknowledged', {
        header: 'Ack',
        size: 70,
        enableSorting: false,
        cell: ({ cell }) => <AckCell acknowledges={cell.row.original.acknowledges} />,
      }),
      ...customTagColumns,
      columnHelper.accessor('tags', {
        header: 'Tags',
        size: 150,
        enableSorting: false,
        meta: {
          className: 'problem-tags',
        },
        cell: ({ cell }) => (
          <TagCell
            tags={cell.getValue()}
            dataSource={cell.row.original.datasource as DataSourceRef}
            handleTagClick={onTagClick}
          />
        ),
      }),
      columnHelper.accessor('datasource', {
        header: 'Datasource',
        size: 120,
        enableSorting: true,
        sortingFn: (rowA, rowB) =>
          resolveDatasourceName(rowA.original.datasource).localeCompare(
            resolveDatasourceName(rowB.original.datasource)
          ),
        cell: ({ cell }) => <span>{resolveDatasourceName(cell.getValue())}</span>,
      }),
      columnHelper.accessor('timestamp', {
        id: 'age',
        header: 'Age',
        size: 92, // compact age such as "12h 41m"
        enableSorting: true,
        // Age counts backwards from timestamp: a newer timestamp is a smaller age.
        sortingFn: (rowA, rowB) => Number(rowB.original.timestamp) - Number(rowA.original.timestamp),
        meta: {
          className: 'problem-age',
        },
        cell: ({ cell }) => <AgeCell timestamp={cell.row.original.timestamp} />,
      }),
      columnHelper.accessor('timestamp', {
        id: 'lastchange',
        header: 'Time',
        size: 150,
        enableSorting: true,
        sortingFn: (rowA, rowB) => Number(rowA.original.timestamp) - Number(rowB.original.timestamp),
        meta: {
          className: 'last-change',
        },
        cell: ({ cell }) => (
          <LastChangeCell
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
          className: cx('custom-expander', styles.expanderCell),
        },
        cell: ({ row }) => {
          const expanded = row.getIsExpanded();
          return (
            <button
              type="button"
              onClick={row.getToggleExpandedHandler()}
              className={cx(styles.expander, { [styles.expanderOpen]: expanded })}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide problem details' : 'Show problem details'}
            >
              <Icon name="angle-down" />
            </button>
          );
        },
      }),
    ];
  }, [panelOptions, styles]);

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

  const [columnSizing, setColumnSizing] = useState<Record<string, number>>(
    getColumnSizingFromResized(panelOptions.resizedColumns)
  );
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const [sorting, setSorting] = useState<SortingState>(() => getSortingFromOption(panelOptions.sortProblems));
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Follow the "Sort by" panel option when it is changed in the editor
  useEffect(() => {
    setSorting(getSortingFromOption(panelOptions.sortProblems));
  }, [panelOptions.sortProblems]);

  // Clear global filter when the option is disabled
  useEffect(() => {
    if (!panelOptions.showSearchFilter) {
      setGlobalFilter('');
    }
  }, [panelOptions.showSearchFilter]);

  // "Auto" (the default for new panels) fits the rows to the panel height like Grafana's table;
  // a saved number keeps that fixed size.
  const isAutoPageSize = pageSize === 'auto' || pageSize === undefined;
  const [autoPageSize, setAutoPageSize] = useState(DEFAULT_PAGE_SIZE);
  const effectivePageSize = isAutoPageSize ? autoPageSize : pageSize;

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!isAutoPageSize || !wrapper) {
      return undefined;
    }
    const measure = () => {
      // Not laid out yet (or hidden): keep the current size rather than collapsing to one row
      if (wrapper.clientHeight === 0) {
        return;
      }
      const headHeight = theadRef.current?.offsetHeight ?? 0;
      const firstRow = wrapper.querySelector<HTMLTableRowElement>('tbody > tr[data-row]');
      const rowHeight = firstRow?.offsetHeight || parseFloat(getComputedStyle(wrapper).fontSize) * ROW_HEIGHT_EM;
      setAutoPageSize(computeAutoPageSize(wrapper.clientHeight - headHeight, rowHeight));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [isAutoPageSize, fontSize]);

  // Pagination state
  const [pagination, setPagination] = useState({
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

  // Column visibility state derived from panelOptions
  const columnVisibility = useMemo(
    () => ({
      host: panelOptions.hostField,
      hostTechName: panelOptions.hostTechNameField,
      groups: panelOptions.hostGroups,
      proxy: panelOptions.hostProxy,
      priority: panelOptions.severityField,
      statusIcon: panelOptions.statusIcon,
      value: panelOptions.statusField,
      opdata: panelOptions.opdataField,
      acknowledged: panelOptions.ackField,
      tags: panelOptions.showTags,
      datasource: panelOptions.showDatasourceName,
      age: panelOptions.ageField,
    }),
    [panelOptions]
  );

  // https://github.com/TanStack/table/issues/6137
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable returns functions that cannot be memoized
  const table = useReactTable({
    data: problems,
    columns,
    enableColumnResizing: true,
    columnResizeMode,
    state: {
      columnSizing,
      pagination,
      columnVisibility,
      sorting,
      columnFilters,
      globalFilter,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    meta: {
      panelOptions,
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
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleTagClick = (tag: ZBXTag, datasource: DataSourceRef, ctrlKey?: boolean, shiftKey?: boolean) => {
    onTagClick?.(tag, datasource, ctrlKey, shiftKey);
  };

  // Helper functions for pagination interactions
  const reportPageChange = (action: 'next' | 'prev') => {
    reportInteraction('grafana_zabbix_panel_page_change', { action });
  };

  const reportPageSizeChange = (pageSize: number | 'auto') => {
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
    const newPageSize: number | 'auto' = e.target.value === 'auto' ? 'auto' : Number(e.target.value);
    reportPageSizeChange(newPageSize);
    if (newPageSize !== 'auto') {
      table.setPageSize(newPageSize);
    }
    onPageSizeChange?.(newPageSize, table.getState().pagination.pageIndex);
  };

  // Calculate page size options
  const pageSizeOptions = React.useMemo(() => {
    let options = [5, 10, 20, 25, 50, 100];
    if (typeof pageSize === 'number') {
      options.push(pageSize);
      options = Array.from(new Set(options)).sort((a, b) => a - b);
    }
    return options;
  }, [pageSize]);

  // Counts and the visible row range follow the current search filter, not the raw input
  const filteredRows = table.getFilteredRowModel().rows;
  const totalRows = filteredRows.length;
  const activeCount = filteredRows.filter((row) => row.original.value === '1').length;
  const unacknowledgedCount = filteredRows.filter(
    (row) => row.original.value === '1' && row.original.acknowledged !== '1'
  ).length;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const rangeStart = pageIndex * currentPageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * currentPageSize, totalRows);
  const rangeLabel = totalRows === 0 ? '0 of 0' : `${rangeStart}–${rangeEnd} of ${totalRows}`;

  return (
    <div className={cx(styles.root, 'panel-problems', { [`font-size--${fontSize}`]: !!fontSize })} ref={rootRef}>
      {panelOptions.showSearchFilter && (
        <div className={styles.toolbar}>
          <div className={styles.badges}>
            <span className={cx(styles.badge, styles.badgeActive)}>
              <span className={styles.badgeDot} />
              {activeCount} active
            </span>
            <span className={styles.badge}>{unacknowledgedCount} unacknowledged</span>
          </div>
          <div className={styles.search}>
            <Icon name="search" className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              aria-label="Search problems"
              placeholder="Search host, problem, tag…"
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                table.setPageIndex(0);
              }}
            />
          </div>
        </div>
      )}
      <div ref={wrapperRef} className={cx(styles.wrapper, { [styles.wrapperLoading]: loading })}>
        {loading && <div className={styles.loadingOverlay}>Loading...</div>}
        {/* The react-table-v8 class scopes the expanded row (ProblemDetails) stylesheet */}
        <table className={cx(styles.table, 'react-table-v8')}>
          <thead ref={theadRef}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const label = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className={styles.headerCell}
                      aria-sort={canSort ? SORT_ARIA[sorted || 'none'] : undefined}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          className={cx(styles.headerButton, { [styles.headerSorted]: !!sorted })}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className={styles.headerLabel}>{label}</span>
                          {sorted ? (
                            <Icon name={sorted === 'asc' ? 'angle-up' : 'angle-down'} size="sm" />
                          ) : (
                            <span className={styles.sortHint} data-sort-hint aria-hidden="true">
                              <Icon name="angle-down" size="sm" />
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className={styles.headerLabel}>{label}</span>
                      )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cx(styles.resizer, { [styles.resizerActive]: header.column.getIsResizing() })}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr className={styles.row} data-row>
                  {row.getVisibleCells().map((cell) => {
                    const className = (cell.column.columnDef.meta as any)?.className;
                    return (
                      <td
                        key={cell.id}
                        className={cx(styles.bodyCell, className)}
                        style={{ width: `${cell.column.getSize()}px` }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length} className={styles.expandedCell}>
                      <ProblemDetails
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
                        onTagClick={handleTagClick}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && <div className={styles.noData}>No problems found</div>}
      </div>
      <div className={styles.pagination}>
        <span className={styles.paginationRange}>{rangeLabel}</span>
        <div className={styles.paginationControls}>
          <button
            type="button"
            className={styles.pageButton}
            onClick={handlePreviousPage}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <Icon name="angle-left" />
          </button>
          <span className={styles.pageInfo}>
            Page
            <input
              type="number"
              className={styles.pageInput}
              aria-label="Page number"
              value={pageIndex + 1}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              min={1}
              max={table.getPageCount()}
            />
            of <strong>{table.getPageCount()}</strong>
          </span>
          <button
            type="button"
            className={styles.pageButton}
            onClick={handleNextPage}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <Icon name="angle-right" />
          </button>
          <span className={styles.pageSize}>
            <select
              name="pagination-v8-select"
              className={styles.pageSizeSelect}
              aria-label="Rows per page"
              value={isAutoPageSize ? 'auto' : currentPageSize}
              onChange={handlePageSizeChange}
            >
              <option value="auto">Auto</option>
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <Icon name="angle-down" className={styles.pageSizeIcon} />
          </span>
        </div>
      </div>
    </div>
  );
};
