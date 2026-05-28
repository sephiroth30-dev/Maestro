import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpAZ, ArrowDownAZ, Filter, Search, X } from 'lucide-react';

export type SortDir = 'asc' | 'desc' | null;

interface ColFilterProps {
  label: string;
  field: string;
  sortField: string | null;
  sortDir: SortDir;
  onSort: (field: string, dir: 'asc' | 'desc') => void;
  searchValue?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  sortLabels?: [string, string]; // [asc label, desc label]
  align?: 'left' | 'right' | 'center';
  style?: React.CSSProperties;
  className?: string;
  width?: string | number;
}

export function ColFilter({
  label, field, sortField, sortDir, onSort,
  searchValue, onSearch, searchPlaceholder,
  sortLabels = ['A → Z', 'Z → A'],
  align = 'left', style, className, width,
}: ColFilterProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);
  const isActive = sortField === field;
  const currentDir = isActive ? sortDir : null;
  const hasSearch = (searchValue ?? '').trim().length > 0;
  const isFiltered = isActive || hasSearch;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function handleSort(dir: 'asc' | 'desc') {
    // Clicking same sort again clears it
    if (isActive && currentDir === dir) {
      onSort(field, dir); // caller can handle toggle-off
    } else {
      onSort(field, dir);
    }
    if (!onSearch) setOpen(false);
  }

  return (
    <th
      ref={ref}
      className={`col-filter-th${isFiltered ? ' col-filter-th--active' : ''} ${className ?? ''}`}
      style={{ textAlign: align, width, ...style, position: 'relative' }}
    >
      <button className="col-filter-btn" type="button" onClick={() => setOpen((p) => !p)}>
        <span className="col-filter-label">{label}</span>
        <span className={`col-filter-icon${isFiltered ? ' col-filter-icon--active' : ''}`}>
          {currentDir === 'asc'  ? <ArrowUpAZ size={11} /> :
           currentDir === 'desc' ? <ArrowDownAZ size={11} /> :
           <Filter size={10} />}
        </span>
      </button>

      {open && (
        <div className={`col-filter-dropdown${align === 'right' ? ' col-filter-dropdown--right' : ''}`}>
          <button
            className={`col-filter-opt${currentDir === 'asc' ? ' col-filter-opt--active' : ''}`}
            onClick={() => handleSort('asc')}
          >
            <ArrowUpAZ size={12} /> {sortLabels[0]}
          </button>
          <button
            className={`col-filter-opt${currentDir === 'desc' ? ' col-filter-opt--active' : ''}`}
            onClick={() => handleSort('desc')}
          >
            <ArrowDownAZ size={12} /> {sortLabels[1]}
          </button>

          {onSearch && (
            <>
              <div className="col-filter-sep" />
              <div className="col-filter-search">
                <Search size={12} />
                <input
                  className="col-filter-search-input"
                  placeholder={searchPlaceholder ?? 'Buscar…'}
                  value={searchValue ?? ''}
                  onChange={(e) => onSearch(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                {(searchValue ?? '') && (
                  <button className="col-filter-search-clear" onClick={() => onSearch('')}>
                    <X size={10} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </th>
  );
}

// Hook to manage sort state generically
export function useColSort<T>(
  data: T[],
  getSortValue: (row: T, field: string) => string | number
) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function onSort(field: string, dir: 'asc' | 'desc') {
    if (sortField === field && sortDir === dir) {
      setSortField(null); setSortDir(null);
    } else {
      setSortField(field); setSortDir(dir);
    }
  }

  const sorted = React.useMemo(() => {
    if (!sortField || !sortDir) return data;
    return [...data].sort((a, b) => {
      const va = getSortValue(a, sortField);
      const vb = getSortValue(b, sortField);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [data, sortField, sortDir]);

  return { sorted, sortField, sortDir, onSort };
}
