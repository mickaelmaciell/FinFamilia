'use client'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className, variant = 'primary', size = 'md', loading, disabled, children, ...props
}, ref) => {
  const base = [
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
    'select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-green-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:scale-[0.97]',
  ].join(' ')

  const variants: Record<string, string> = {
    primary: [
      'bg-green-600 hover:bg-green-500 active:bg-green-700',
      'text-white rounded-xl',
      'shadow-[0_1px_2px_rgba(0,0,0,.4),0_0_0_1px_rgba(22,163,74,.2)_inset]',
      'hover:shadow-[0_1px_2px_rgba(0,0,0,.4),0_0_0_1px_rgba(22,163,74,.3)_inset,0_0_16px_rgba(22,163,74,.15)]',
    ].join(' '),
    secondary: [
      'bg-[#132013] hover:bg-[#172617] active:bg-[#0f1a0f]',
      'text-green-300 rounded-xl',
      'border border-[#1e341e] hover:border-[#2a4a2a]',
    ].join(' '),
    ghost: 'hover:bg-[#132013] text-green-400 hover:text-green-300 rounded-xl',
    destructive: [
      'bg-red-950/40 hover:bg-red-950/70',
      'text-red-400 hover:text-red-300 rounded-xl',
      'border border-red-900/30 hover:border-red-800/50',
    ].join(' '),
    outline: [
      'border border-[#1e341e] hover:border-green-700/40',
      'text-green-400 hover:text-green-300 hover:bg-[#132013] rounded-xl',
    ].join(' '),
  }

  const sizes: Record<string, string> = {
    sm:      'h-8 px-3 text-xs rounded-lg',
    md:      'h-10 px-4 text-sm',
    lg:      'h-12 px-5 text-[15px]',
    icon:    'h-10 w-10 rounded-xl',
    'icon-sm': 'h-8 w-8 rounded-lg',
  }

  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {children}
    </button>
  )
})
Button.displayName = 'Button'
export { Button }
