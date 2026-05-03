import { cn } from '@/lib/utils'

// Paleta elegante clara — inspirada no quarto com parede verde e paredes brancas
// bg-card:    #FFFFFF  (branco puro)
// border:     #E2DECE  (bege suave)
// text-main:  #1A2E1A  (verde escuro / quase preto)
// text-sub:   #5A7A5A  (verde médio)

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white border border-[#E2DECE] rounded-2xl overflow-hidden shadow-sm',
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
    <div className={cn('px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between', className)} {...props}>
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
    <div className={cn('px-5 py-4 border-t border-[#F0EDE6]', className)} {...props}>
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
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-sm font-semibold text-[#5A7A5A] leading-none">{label}</span>
          {icon && <span className="text-[#8FAA8F] shrink-0">{icon}</span>}
        </div>
        <p className={cn(
          'text-2xl font-bold leading-none tabular-nums',
          trend === 'up' ? 'text-[#3A6432]' : trend === 'down' ? 'text-red-500' : 'text-[#1A2E1A]',
        )}>
          {value}
        </p>
        {sub && <p className="text-sm text-[#8FAA8F] mt-2 leading-none">{sub}</p>}
      </CardContent>
    </Card>
  )
}
