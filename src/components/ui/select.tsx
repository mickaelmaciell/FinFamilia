import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label htmlFor={selectId} className="text-sm font-semibold text-[#3A6432] leading-none">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full h-12 rounded-xl text-base font-medium appearance-none',
              'bg-white text-[#1A2E1A]',
              'border border-[#D5CCBE] px-4 pr-10',
              'focus:outline-none focus:border-[#3A6432] focus:ring-2 focus:ring-[#3A6432]/15',
              'transition-all duration-150 cursor-pointer',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-red-400',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A9A7A]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {error && <p className="text-sm text-red-500 leading-tight mt-0.5">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
export { Select }
