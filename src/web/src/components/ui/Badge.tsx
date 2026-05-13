export function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function TagBadge({ label, color = 'blue' }: { label: string; color?: 'blue' | 'amber' | 'gray' }) {
  const styles = {
    blue:  'bg-sky-100 text-sky-700',
    amber: 'bg-amber-100 text-amber-700',
    gray:  'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[color]}`}>
      {label}
    </span>
  )
}
