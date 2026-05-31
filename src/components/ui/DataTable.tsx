import { Fragment, type ReactNode } from 'react';

export interface DataColumn {
  header: string;
  accessor?: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  hideHeader?: boolean;
  /** Render function — keep simple to avoid oxc parser bugs */
  render?: (row: Record<string, unknown>) => ReactNode;
}

interface DataTableProps {
  columns: DataColumn[];
  data: Record<string, unknown>[];
  keyAccessor: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  expandedId?: string | null;
  renderExpanded?: (row: Record<string, unknown>) => ReactNode;
  isLoading?: boolean;
  emptyMessage?: string;
}

const ALIGN: Record<string, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function DataTable({
  columns,
  data,
  keyAccessor,
  onRowClick,
  expandedId,
  renderExpanded,
  isLoading,
  emptyMessage = 'Нет данных',
}: DataTableProps) {
  const n = columns.length;

  return (
    <table className="w-full table-fixed border-separate border-spacing-0">
      <thead>
        <tr className="text-sm font-semibold text-foreground">
          {columns.map((c) => (
            <th key={c.header} scope="col" className={`py-3 px-3 ${c.width || ''} ${ALIGN[c.align || 'left']}`}>
              {c.hideHeader ? null : c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isLoading && (
          <tr><td colSpan={n} className="px-3 py-12 text-center text-sm text-muted-foreground">Загрузка...</td></tr>
        )}
        {!isLoading && data.length === 0 && (
          <tr><td colSpan={n} className="px-3 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</td></tr>
        )}
        {data.map((row) => {
          const id = String(row[keyAccessor]);
          const isOpen = expandedId === id;
          return (
            <Fragment key={id}>
              <tr
                className={`group ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
              >
                {columns.map((c) => (
                  <td key={c.header} className={`py-2 px-3 text-sm ${c.width || ''} ${ALIGN[c.align || 'left']}`}>
                    {c.render ? c.render(row) : (c.accessor ? String(row[c.accessor] ?? '') : null)}
                  </td>
                ))}
              </tr>
              {isOpen && renderExpanded && (
                <tr className="bg-[#FAFAFA]">
                  <td colSpan={n} className="pb-4 pt-0 pl-6 pr-6">{renderExpanded(row)}</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
