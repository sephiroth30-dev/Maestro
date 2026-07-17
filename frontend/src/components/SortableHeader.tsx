import React from 'react';

interface SortableHeaderProps<F extends string> {
  field: F;
  label: string;
  sortField: F;
  sortDir: 'asc' | 'desc';
  onSort: (f: F) => void;
  right?: boolean;
  width?: number;
  thClass?: string;
}

export function SortableHeader<F extends string,>({
  field, label, sortField, sortDir, onSort,
  right = false, width, thClass = 'liq-th',
}: SortableHeaderProps<F>): React.ReactElement {
  const active = sortField === field;
  const arrow = active ? (sortDir === 'asc' ? '↑' : '↓') : '↕';
  const cls = `${thClass} sort-th${right ? ` ${thClass}--r` : ''}`;
  return (
    <th
      className={cls}
      style={width !== undefined ? { width } : undefined}
      onClick={() => onSort(field)}
    >
      {label}<span className={`liq-sort-icon${active ? ' liq-sort-icon--active' : ''}`}>{arrow}</span>
    </th>
  );
}

export function useSortState<F extends string>(defaultField: F, defaultDir: 'asc' | 'desc' = 'asc') {
  const [sortField, setSortField] = React.useState<F>(defaultField);
  const [sortDir, setSortDir]     = React.useState<'asc' | 'desc'>(defaultDir);

  function onSort(field: F): void {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(defaultDir); }
  }

  return { sortField, sortDir, onSort };
}
