'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, PieChart } from 'lucide-react'

const items = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { href: '/accounts', icon: Wallet, label: 'Contas' },
  { href: '/goals', icon: Target, label: 'Metas' },
  { href: '/reports', icon: PieChart, label: 'Relatórios' },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a120a]/95 border-t border-[#1a2e1a] backdrop-blur-xl lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className={cn(
              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[60px] transition-all duration-150',
              active ? 'text-green-400' : 'text-green-800 hover:text-green-600'
            )}>
              <div className={cn('p-1.5 rounded-lg transition-all', active && 'bg-green-900/40')}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
