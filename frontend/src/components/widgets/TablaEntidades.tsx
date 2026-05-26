import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import type { EntidadRow } from '../../api/reportes.js';
import { formatCOP, formatNumber } from './KpiCard.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TablaEntidadesProps {
  rows: EntidadRow[];
  onEntityClick?: (row: EntidadRow) => void;
  selectedEntidadId?: string | null;
}

// ─── Tipo badge ───────────────────────────────────────────────────────────────

const TIPO_BADGE_CLASS: Record<string, string> = {
  EPS:        'badge badge--blue',
  PARTICULAR: 'badge badge--green',
  CONVENIO:   'badge badge--purple',
  ARL:        'badge badge--amber',
  OTRO:       'badge badge--gray',
};

function TipoBadge({ tipo }: { tipo: string }): React.ReactElement {
  return (
    <span className={TIPO_BADGE_CLASS[tipo] ?? 'badge badge--gray'}>
      {tipo}
    </span>
  );
}

// ─── Column helper ────────────────────────────────────────────────────────────

const colHelper = createColumnHelper<EntidadRow>();

const columns = [
  colHelper.accessor('entidad', {
    header: 'Entidad',
    cell: (info) => (
      <span className="tabla-entidades-nombre">{info.getValue()}</span>
    ),
  }),
  colHelper.accessor('tipo', {
    header: 'Tipo',
    cell: (info) => <TipoBadge tipo={info.getValue()} />,
  }),
  colHelper.accessor('cantidad', {
    header: 'Atenciones',
    cell: (info) => formatNumber(info.getValue()),
  }),
  colHelper.accessor('valor_bruto', {
    header: 'Valor Bruto',
    cell: (info) => formatCOP(info.getValue()),
  }),
  colHelper.accessor('participacion_pct', {
    header: 'Participación',
    cell: (info) => {
      const pct = info.getValue();
      return (
        <div className="tabla-entidades-pct">
          <div className="tabla-entidades-pct-bar">
            <div
              className="tabla-entidades-pct-fill"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="tabla-entidades-pct-label">{pct.toFixed(1)}%</span>
        </div>
      );
    },
  }),
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TablaEntidades({ rows, onEntityClick, selectedEntidadId }: TablaEntidadesProps): React.ReactElement {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'valor_bruto', desc: true },
  ]);
  const [showAll, setShowAll] = useState(false);

  const data = useMemo(
    () => (showAll ? rows : rows.slice(0, 10)),
    [rows, showAll]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="tabla-entidades">
      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`tabla-entidades-th ${header.column.getCanSort() ? 'tabla-entidades-th--sortable' : ''}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const pct = row.original.participacion_pct;
              const isHighConcentration = pct > 40;
              const isSelected = selectedEntidadId != null && row.original.id === selectedEntidadId;
              const isClickable = onEntityClick && row.original.id != null;
              return (
                <tr
                  key={row.id}
                  className={[
                    'tabla-entidades-tr',
                    isHighConcentration ? 'tabla-entidades-tr--alert' : '',
                    isClickable ? 'tabla-entidades-tr--clickable' : '',
                    isSelected ? 'tabla-entidades-tr--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={isClickable ? () => onEntityClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="tabla-entidades-td">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 10 && (
        <button
          type="button"
          className="tabla-entidades-toggle"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Ver menos' : `Ver todas (${rows.length})`}
        </button>
      )}
    </div>
  );
}
