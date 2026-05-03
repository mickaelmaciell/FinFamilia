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
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')

    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-[#3A6432] leading-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A9A7A] pointer-events-none flex items-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-12 rounded-xl text-base font-medium transition-all duration-150',
              // Cores explícitas — não herdar do body para evitar bugs
              'bg-white text-[#1A2E1A] placeholder:text-[#9EB09E] placeholder:font-normal',
              'border border-[#D5CCBE]',
              'focus:outline-none focus:border-[#3A6432] focus:ring-2 focus:ring-[#3A6432]/15 focus:bg-white',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-[#F5F2EC]',
              icon ? 'pl-11 pr-4' : 'px-4',
              suffix ? 'pr-11' : '',
              error && 'border-red-400 focus:border-red-500 focus:ring-red-400/15',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A9A7A] pointer-events-none flex items-center">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-sm text-red-500 leading-tight mt-0.5">{error}</p>}
        {hint && !error && <p className="text-sm text-[#7A9A7A] leading-tight mt-0.5">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
export { Input }
