import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-[#0c150c] border border-[#1e341e] rounded-2xl overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4 border-b border-[#1e341e] flex items-center justify-between', className)} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4 border-t border-[#1e341e]', className)} {...props}>
      {children}
    </div>
  )
}

export function StatCard({
  label, value, sub, icon, trend, className,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-[12px] font-medium text-green-600 leading-none">{label}</span>
          {icon && <span className="text-green-700 shrink-0">{icon}</span>}
        </div>
        <p className={cn(
          'text-xl font-bold leading-none tabular-nums',
          trend === 'up' ? 'text-green-300' : trend === 'down' ? 'text-red-400' : 'text-green-100',
        )}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-green-800 mt-1.5 leading-none">{sub}</p>}
      </CardContent>
    </Card>
  )
}
