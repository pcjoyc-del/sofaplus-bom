import { Pencil, Trash2 } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  width?: string
  render?: (row: T) => React.ReactNode
}

interface Props<T extends { id: number }> {
  columns: Column<T>[]
  data: T[]
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  loading?: boolean
  emptyText?: string
}

export function DataTable<T extends { id: number }>({
  columns, data, onEdit, onDelete, loading, emptyText = 'No records found',
}: Props<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  const hasActions = !!(onEdit || onDelete)

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
            {hasActions && (
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (hasActions ? 1 : 0)} className="px-4 py-10 text-center text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-gray-700">
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-1.5 rounded text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Deactivate"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
