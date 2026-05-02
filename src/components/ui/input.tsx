import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  suffix?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, suffix, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-green-400/70 leading-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-green-700 pointer-events-none flex items-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-11 rounded-xl text-sm transition-all duration-150',
              'bg-[#0c150c] text-green-100 placeholder:text-green-900/60',
              'border border-[#1e341e]',
              'focus:outline-none focus:border-green-700/60 focus:bg-[#0f1a0f]',
              'focus:ring-1 focus:ring-green-700/20',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              icon ? 'pl-10 pr-4' : 'px-4',
              suffix ? 'pr-10' : '',
              error && 'border-red-800/60 focus:border-red-700/60 focus:ring-red-700/20',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-green-700 pointer-events-none flex items-center">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-[12px] text-red-400 leading-none mt-0.5">{error}</p>}
        {hint && !error && <p className="text-[12px] text-green-800 leading-none mt-0.5">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
export { Input }
