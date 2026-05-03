'use client'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>((
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref
) => {
  const base = [
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150',
    'select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[#3A6432]/40 focus-visible:ring-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:scale-[0.97]',
  ].join(' ')

  const variants: Record<string, string> = {
    // Botão primário: verde floresta sobre branco
    primary: [
      'bg-[#3A6432] hover:bg-[#2E5028] active:bg-[#243D22]',
      'text-white rounded-xl',
      'shadow-sm hover:shadow-md',
    ].join(' '),
    // Botão secundário: fundo creme claro com texto verde
    secondary: [
      'bg-[#F0EDE6] hover:bg-[#E8E3D8]',
      'text-[#1A2E1A] rounded-xl',
      'border border-[#D5CCBE] hover:border-[#C5B9A8]',
    ].join(' '),
    ghost: 'hover:bg-[#EEF5EB] text-[#3A6432] hover:text-[#2E5028] rounded-xl',
    destructive: [
      'bg-red-50 hover:bg-red-100',
      'text-red-600 hover:text-red-700 rounded-xl',
      'border border-red-200 hover:border-red-300',
    ].join(' '),
    outline: [
      'border border-[#D5CCBE] hover:border-[#3A6432]/40',
      'text-[#3A6432] hover:bg-[#EEF5EB] rounded-xl',
    ].join(' '),
  }

  const sizes: Record<string, string> = {
    sm:        'h-9 px-3.5 text-sm rounded-lg',
    md:        'h-11 px-4 text-sm',
    lg:        'h-12 px-5 text-base',
    icon:      'h-11 w-11 rounded-xl',
    'icon-sm': 'h-9 w-9 rounded-lg',
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
