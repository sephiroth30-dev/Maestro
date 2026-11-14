import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import type { EntidadRow, AgendaEntidad } from '../../api/reportes.js';
import { formatCOP, formatNumber } from './KpiCard.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TablaEntidadesProps {
  rows: EntidadRow[];
  onEntityClick?: (row: EntidadRow) => void;
  selectedEntidadId?: string | null;
  /**
   * Mes contra el que comparar. `null` o ausente = sin columna de comparación.
   *
   * La tabla sigue listando las entidades del mes MOSTRADO: una entidad que
   * facturó el año pasado y este no, no aparece. Es a propósito —la tabla
   * responde "de qué se compone este mes"— pero conviene tenerlo presente al
   * leer la comparación.
   */
  comparacion?: ComparacionEntidades | null;
  /**
   * Citas pendientes por EPS. Con ella la tabla gana tres columnas: lo
   * **agendado**, lo **proyectado** (atendido + agendado) y cómo queda frente al
   * promedio de los últimos 3 meses de esa EPS.
   */
  agenda?: ProyeccionEntidades | null;
  /**
   * Citas incumplidas por EPS, por la misma clave (`claveEntidad`). Con ella la tabla gana la columna
   * **Incumplidas**, ordenable: sirve para ver en qué EPS hay más y darles seguimiento.
   */
  incumplidas?: IncumplidasTabla | null;
}

export interface IncumplidasFila {
  incumplidas: number;
  cumplidas: number;
  /** Incumplidas ÷ (cumplidas + incumplidas), en %; `null` sin citas resueltas. */
  pct: number | null;
  /** Pocas citas resueltas: el % no es fiable. */
  muestraPequena: boolean;
}

export interface IncumplidasTabla {
  porClave: Map<string, IncumplidasFila>;
  /** Mayor número de incumplidas: la barrita de cada fila se dibuja contra él. */
  maximo: number;
  /** % global del periodo: referencia para ver qué EPS está por encima. */
  pctGlobal: number | null;
}

function CeldaIncumplidas({ n, maximo }: { n: number; maximo: number }): React.ReactElement {
  if (n <= 0) return <span className="tabla-comp-nuevo" title="Sin citas incumplidas en el periodo">—</span>;
  return (
    <span className="tabla-incumpl" title={`${n} ${n === 1 ? 'cita incumplida' : 'citas incumplidas'}`}>
      <strong className="tabla-incumpl-n">{formatNumber(n)}</strong>
      <span className="tabla-incumpl-barra"><i style={{ width: `${maximo > 0 ? Math.max((n / maximo) * 100, 4) : 0}%` }} /></span>
    </span>
  );
}

/**
 * % de incumplimiento de una EPS. Colores neutros salvo el énfasis en rosa de las que están claramente por encima del
 * global; con pocas citas resueltas se atenúa (3 de 5 es 60 % y no dice nada).
 */
function CeldaPctIncumplidas({ f, pctGlobal }: { f: IncumplidasFila | undefined; pctGlobal: number | null }): React.ReactElement {
  if (!f || f.pct === null) return <span className="tabla-comp-nuevo" title="Sin citas resueltas en el periodo">—</span>;
  const alto = !f.muestraPequena && pctGlobal !== null && f.pct >= pctGlobal * 1.25 && f.pct - pctGlobal >= 2;
  const txt = `${f.pct.toFixed(1).replace('.', ',')} %`;
  return (
    <span
      className={`tabla-pct-inc${alto ? ' tabla-pct-inc--alto' : ''}${f.muestraPequena ? ' tabla-pct-inc--tenue' : ''}`}
      title={f.muestraPequena
        ? `Solo ${f.incumplidas + f.cumplidas} citas resueltas: el porcentaje no es fiable`
        : `${f.incumplidas} incumplidas de ${f.incumplidas + f.cumplidas} citas resueltas${pctGlobal !== null ? ` (global ${pctGlobal.toFixed(1).replace('.', ',')} %)` : ''}`}
    >
      {txt}
    </span>
  );
}

export interface ProyeccionEntidades {
  /** Por la misma clave que usa la comparación (`claveEntidad`). */
  porClave: Map<string, AgendaEntidad>;
  /**
   * Si se muestra la columna «vs prom. 3 meses». SOLO tiene sentido al mirar un
   * mes completo: el promedio es mensual, y compararlo con lo proyectado de una
   * semana o de un día daría −70 % para todas las EPS y no diría nada.
   */
  conPromedio?: boolean;
}

/**
 * Proyectado de una EPS frente a su promedio mensual de 3 meses, en %.
 * `null` si no hay historial: sin base no se inventa una comparación.
 *
 * No es un tope. Es la referencia que permite ver «esta EPS va por encima de lo
 * habitual» sin que nadie tenga que definir qué es pasarse: eso lo decide quien
 * administra la agenda.
 */
export function vsPromedio(proyectado: number, promedio3m: number | null | undefined): number | null {
  return promedio3m && promedio3m > 0 ? ((proyectado - promedio3m) / promedio3m) * 100 : null;
}

function CeldaVsPromedio({ pct }: { pct: number | null }): React.ReactElement {
  if (pct === null) {
    return <span className="tabla-comp-nuevo" title="Sin historial de 3 meses cerrados para comparar">—</span>;
  }
  const igual = Math.abs(pct) < 0.5;
  // Colores NEUTROS a propósito: estar por encima no es «malo» ni por debajo
  // «bueno»; depende de la EPS y del momento. Solo se muestra el sentido.
  const clase = igual ? 'igual' : pct > 0 ? 'arriba' : 'abajo';
  const flecha = igual ? '=' : pct > 0 ? '▲' : '▼';
  return (
    <span
      className={`tabla-vs-prom tabla-vs-prom--${clase}`}
      title="Lo proyectado de esta EPS frente a su facturación mensual promedio de los últimos 3 meses cerrados"
    >
      {flecha} {pct > 0 && !igual ? '+' : ''}{Math.round(pct)} %
    </span>
  );
}

export interface ComparacionEntidades {
  /** Texto del encabezado, p. ej. "Enero 2025". */
  label: string;
  /** Valor bruto del mes comparado, por `id` de entidad (o por nombre si no tiene id). */
  porClave: Map<string, number>;
}

/**
 * Clave para enfrentar la misma entidad en dos meses distintos.
 *
 * Se usa el `id` cuando existe; las filas sin id (agrupaciones y "SIN
 * ENTIDAD") solo se pueden casar por nombre.
 */
export function claveEntidad(row: Pick<EntidadRow, 'id' | 'entidad'>): string {
  return row.id ?? `nombre:${row.entidad}`;
}

/** Celda compartida: valor del mes comparado y su variación. */
export function CeldaComparacion({ actual, base }: { actual: number; base: number | undefined }): React.ReactElement {
  if (base === undefined) {
    return <span className="tabla-comp-nuevo" title="No tuvo movimiento en el mes comparado">—</span>;
  }
  // Variación porcentual; con base cero no se muestra porcentaje, porque
  // "infinito por ciento" no informa de nada.
  const pct = base === 0 ? null : ((actual - base) / base) * 100;
  // El empate va en gris y sin flecha: una flecha verde hacia arriba junto a
  // un 0,0 % se lee como crecimiento cuando no lo hubo.
  const clase = pct === null || Math.abs(pct) < 0.05
    ? 'tabla-comp-delta--igual'
    : pct > 0 ? 'tabla-comp-delta--sube' : 'tabla-comp-delta--baja';
  const flecha = clase === 'tabla-comp-delta--igual' ? '=' : clase === 'tabla-comp-delta--sube' ? '▲' : '▼';
  return (
    <span className="tabla-comp">
      <span className="tabla-comp-base">{formatCOP(base)}</span>
      {pct !== null && (
        <span className={`tabla-comp-delta ${clase}`}>
          {flecha} {Math.abs(pct).toFixed(1)}%
        </span>
      )}
    </span>
  );
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

// TanStack tipa cada columna por el valor que lee; una lista que mezcla texto,
// números y celdas calculadas solo admite el tipo general.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ColumnaEntidad = ColumnDef<EntidadRow, any>;

const columnasBase: ColumnaEntidad[] = [
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

export default function TablaEntidades({ rows, onEntityClick, selectedEntidadId, comparacion, agenda, incumplidas }: TablaEntidadesProps): React.ReactElement {
  // Las columnas se arman dentro del componente porque la de comparación
  // depende del mes elegido; antes eran una constante de módulo.
  const columns = useMemo((): ColumnaEntidad[] => {
    if (!comparacion && !agenda && !incumplidas) return columnasBase;

    // Todo lo que se añade va justo después de "Valor Bruto", que es la cifra
    // con la que se compara y a la que se suma lo agendado.
    const extra: ColumnaEntidad[] = [];

    if (comparacion) {
      extra.push(colHelper.display({
        id: 'comparacion',
        header: comparacion.label,
        cell: (info) => (
          <CeldaComparacion
            actual={info.row.original.valor_bruto}
            base={comparacion.porClave.get(claveEntidad(info.row.original))}
          />
        ),
      }));
    }

    if (agenda) {
      const delaFila = (r: EntidadRow): AgendaEntidad | undefined => agenda.porClave.get(claveEntidad(r));
      extra.push(
        colHelper.accessor((r) => delaFila(r)?.valor ?? 0, {
          id: 'agendado',
          header: 'Agendado',
          cell: (info) => {
            const a = delaFila(info.row.original);
            if (!a || (a.valor === 0 && a.citas === 0)) return <span className="tabla-comp-nuevo">—</span>;
            return (
              <span className="tabla-agendado">
                <span className="tabla-agendado-valor">{formatCOP(a.valor)}</span>
                <span className="tabla-agendado-citas">
                  {formatNumber(a.citas)} {a.citas === 1 ? 'cita' : 'citas'}
                  {a.citas_sin_valor > 0 && (
                    <span title={`${a.citas_sin_valor} sin precio de referencia: no se cuentan en el valor`}> · ⚠ {a.citas_sin_valor}</span>
                  )}
                </span>
              </span>
            );
          },
        }),
        colHelper.accessor((r) => r.valor_bruto + (delaFila(r)?.valor ?? 0), {
          id: 'proyectado',
          header: 'Proyectado',
          cell: (info) => <strong className="tabla-proyectado">{formatCOP(info.getValue())}</strong>,
        }),
      );
      if (agenda.conPromedio) {
        extra.push(
          colHelper.accessor((r) => vsPromedio(r.valor_bruto + (delaFila(r)?.valor ?? 0), delaFila(r)?.promedio_3m) ?? -1e9, {
            id: 'vsPromedio',
            header: 'vs prom. 3 meses',
            cell: (info) => {
              const r = info.row.original;
              return <CeldaVsPromedio pct={vsPromedio(r.valor_bruto + (delaFila(r)?.valor ?? 0), delaFila(r)?.promedio_3m)} />;
            },
          }),
        );
      }
    }

    const i = columnasBase.findIndex((c) => 'accessorKey' in c && c.accessorKey === 'valor_bruto');
    const corte = i >= 0 ? i + 1 : columnasBase.length;
    const armadas = [...columnasBase.slice(0, corte), ...extra, ...columnasBase.slice(corte)];

    // «Incumplidas» y su % van justo antes de «Participación», que cierra la fila.
    if (incumplidas) {
      const cols = [
        colHelper.accessor((r) => incumplidas.porClave.get(claveEntidad(r))?.incumplidas ?? 0, {
          id: 'incumplidas',
          header: 'Incumplidas',
          cell: (info) => <CeldaIncumplidas n={info.getValue()} maximo={incumplidas.maximo} />,
        }),
        colHelper.accessor((r) => incumplidas.porClave.get(claveEntidad(r))?.pct ?? -1, {
          id: 'pctIncumplidas',
          header: '% incumpl.',
          cell: (info) => <CeldaPctIncumplidas f={incumplidas.porClave.get(claveEntidad(info.row.original))} pctGlobal={incumplidas.pctGlobal} />,
        }),
      ];
      const p = armadas.findIndex((c) => 'accessorKey' in c && c.accessorKey === 'participacion_pct');
      armadas.splice(p >= 0 ? p : armadas.length, 0, ...cols);
    }
    return armadas;
  }, [comparacion, agenda, incumplidas]);

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'valor_bruto', desc: true },
  ]);
  const [showAll, setShowAll] = useState(false);

  // El orden se aplica a TODAS las filas y el recorte a 10 va después, sobre el
  // resultado ya ordenado. Recortar antes ordenaba solo las 10 primeras por
  // facturación, y ordenar por «Agendado» o «Proyectado» no daba el top 10
  // real: una EPS con mucha agenda y poca facturación quedaba escondida.
  const data = rows;

  // Si cambia el conjunto de columnas (p. ej. al pasar a un filtro de día, donde
  // desaparece «vs prom.»), un orden que apunte a una columna que ya no existe
  // dejaría la tabla sin orden y sin flecha.
  useEffect(() => {
    const ids = new Set(columns.map((c) => ('id' in c && c.id) || ('accessorKey' in c && String(c.accessorKey)) || ''));
    setSorting((s) => (s.every((x) => ids.has(x.id)) ? s : [{ id: 'valor_bruto', desc: true }]));
  }, [columns]);

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
            {table.getRowModel().rows.slice(0, showAll ? undefined : 10).map((row) => {
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
