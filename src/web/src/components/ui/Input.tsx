import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white',
        'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
