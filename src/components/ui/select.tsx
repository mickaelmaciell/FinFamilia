import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-[13px] font-medium text-green-400/70 leading-none">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full h-11 rounded-xl text-sm appearance-none',
              'bg-[#0c150c] text-green-100',
              'border border-[#1e341e] px-4 pr-10',
              'focus:outline-none focus:border-green-700/60',
              'focus:ring-1 focus:ring-green-700/20',
              'transition-all duration-150 cursor-pointer',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-red-800/60',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-green-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {error && <p className="text-[12px] text-red-400 leading-none mt-0.5">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
export { Select }
