'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ArrowLeftRight, Wallet, Target, PieChart } from 'lucide-react'

const items = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Lançamentos' },
  { href: '/accounts', icon: Wallet, label: 'Contas' },
  { href: '/goals', icon: Target, label: 'Metas' },
  { href: '/reports', icon: PieChart, label: 'Relatórios' },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 border-t border-[#E2DECE] backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-around px-1 py-1">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-2 rounded-xl min-w-[64px] transition-all duration-150',
                active ? 'text-[#3A6432]' : 'text-[#4A6A4A] hover:text-[#3A6432]'
              )}
            >
              <div className={cn(
                'w-12 h-12 flex items-center justify-center rounded-2xl transition-all',
                active ? 'bg-[#EEF5EB] border border-[#C5D9C0]' : 'bg-transparent'
              )}>
                <Icon size={24} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className={cn(
                'text-[12px] font-semibold leading-none',
                active ? 'text-[#3A6432]' : 'text-[#4A6A4A]'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </nav>
  )
}
