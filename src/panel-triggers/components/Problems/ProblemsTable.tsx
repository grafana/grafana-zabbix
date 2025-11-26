import React from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ProblemDTO } from '../../../datasource/types';
import { ProblemListProps } from './Problems';
import { HostCell } from './Cells/HostCell';
import { AckCellV8 } from './AckCell';
import { AgeCellV8 } from './Cells/AgeCell';

const columnHelper = createColumnHelper<ProblemDTO>();

const columns = [
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
  }),
  columnHelper.display({
    id: 'statusIcon',
    header: 'Status Icon',
  }),
  columnHelper.accessor('value', {
    header: 'Status',
  }),
  columnHelper.accessor('name', {
    header: 'Problem',
  }),
  columnHelper.accessor('opdata', {
    header: 'Operational data',
  }),
  columnHelper.accessor('acknowledged', {
    header: 'Ack',
    cell: ({ cell }) => <AckCellV8 acknowledges={cell.row.original.acknowledges} />,
  }),
  columnHelper.accessor('tags', {
    header: 'Tags',
  }),
  columnHelper.accessor('timestamp', {
    id: 'age',
    header: 'Age',
    cell: ({ cell }) => <AgeCellV8 timestamp={cell.row.original.timestamp} />,
  }),
  columnHelper.accessor('timestamp', {
    id: 'lastchange',
    header: 'Time',
  }),
];

export const ProblemsTable = (props: Pick<ProblemListProps, 'problems' | 'panelOptions'>) => {
  const { problems, panelOptions } = props;

  const [data, _setData] = React.useState<ProblemDTO[]>(() => []);
  console.log('ProblemsTable', problems);
  const table = useReactTable({
    data,
    columns,
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

  return (
    <table>
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
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        {table.getFooterGroups().map((footerGroup) => (
          <tr key={footerGroup.id}>
            {footerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </tfoot>
    </table>
  );
};
