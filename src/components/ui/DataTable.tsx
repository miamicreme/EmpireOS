import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  /** Tailwind width class e.g. 'w-32'; defaults to flexible. */
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  const grid = columns.map((c) => c.width ?? '1fr').join(' ');

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-4 px-4 py-2.5 border-b border-border bg-surface-2/50"
        style={{ gridTemplateColumns: grid }}
      >
        {columns.map((c) => (
          <span
            key={c.key}
            className={cn(
              'text-[11px] font-mono text-empire-muted uppercase tracking-wider',
              c.align === 'right' && 'text-right',
              c.align === 'center' && 'text-center',
            )}
          >
            {c.header}
          </span>
        ))}
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'grid gap-4 px-4 py-3 items-center transition-colors',
              onRowClick && 'cursor-pointer hover:bg-surface-2',
            )}
            style={{ gridTemplateColumns: grid }}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                className={cn(
                  'min-w-0 text-sm text-gray-200',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                )}
              >
                {c.render(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
