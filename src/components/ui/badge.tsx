import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'income' | 'expense' | 'transfer' | 'warning' | 'info'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-green-900/30 text-green-400 border-green-900/30',
    income: 'bg-green-900/30 text-green-400 border-green-900/30',
    expense: 'bg-red-900/30 text-red-400 border-red-900/30',
    transfer: 'bg-blue-900/30 text-blue-400 border-blue-900/30',
    warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-900/30',
    info: 'bg-indigo-900/30 text-indigo-400 border-indigo-900/30',
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border', variants[variant], className)} {...props}>
      {children}
    </span>
  )
}
