import React from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
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

const columnHelper = createColumnHelper<ProblemDTO>();

export const ProblemsTable = (props: Pick<ProblemListProps, 'problems' | 'panelOptions' | 'onTagClick'>) => {
  const { problems, panelOptions, onTagClick } = props;

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
      columnHelper.accessor('severity', {
        header: 'Severity',
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
        cell: ({ cell }) => <StatusCellV8 cell={cell} highlightNewerThan={highlightNewerThan} />,
      }),
      columnHelper.accessor('name', {
        header: 'Problem',
        cell: ({ cell }) => (
          <div>
            <span className="problem-description">{cell.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('opdata', {
        header: 'Operational data',
        cell: ({ cell }) => (
          <div>
            <span>{cell.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('acknowledged', {
        header: 'Ack',
        cell: ({ cell }) => <AckCellV8 acknowledges={cell.row.original.acknowledges} />,
      }),
      columnHelper.accessor('tags', {
        header: 'Tags',
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
        cell: ({ cell }) => <AgeCellV8 timestamp={cell.row.original.timestamp} />,
      }),
      columnHelper.accessor('timestamp', {
        id: 'lastchange',
        header: 'Time',
        cell: ({ cell }) => (
          <LastChangeCellV8
            original={cell.row.original}
            customFormat={panelOptions.customLastChangeFormat && panelOptions.lastChangeFormat}
          />
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
    getCoreRowModel: getCoreRowModel(),
  });

  const handleTagClick = (tag: ZBXTag, datasource: DataSourceRef, ctrlKey?: boolean, shiftKey?: boolean) => {
    onTagClick?.(tag, datasource, ctrlKey, shiftKey);
  };

  return (
    <table className="react-table-v8">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => {
              // if cell.id
              console.log('--------------------------------------------------');
              console.log(cell.column.columnDef.cell, cell.getContext());
              console.log('--------------------------------------------------');
              return <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
            })}
          </tr>
        ))}
      </tbody>
      {/*<tfoot>*/}
      {/*  {table.getFooterGroups().map((footerGroup) => (*/}
      {/*    <tr key={footerGroup.id}>*/}
      {/*      {footerGroup.headers.map((header) => (*/}
      {/*        <th key={header.id}>*/}
      {/*          {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}*/}
      {/*        </th>*/}
      {/*      ))}*/}
      {/*    </tr>*/}
      {/*  ))}*/}
      {/*</tfoot>*/}
    </table>
  );
};
