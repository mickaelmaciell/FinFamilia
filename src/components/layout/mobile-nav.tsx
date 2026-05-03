'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, CalendarClock, Wallet, Users, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { ArrowLeftRight, Target, PieChart, Tag, BarChart3, RefreshCw, Settings } from 'lucide-react'

const primary = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { href: '/bills', icon: CalendarClock, label: 'Contas' },
  { href: '/accounts', icon: Wallet, label: 'Saldo' },
  { href: '/household', icon: Users, label: 'Família' },
]

const secondary = [
  { href: '/transactions', icon: ArrowLeftRight, label: 'Lançamentos' },
  { href: '/goals', icon: Target, label: 'Metas' },
  { href: '/budgets', icon: BarChart3, label: 'Orçamentos' },
  { href: '/reports', icon: PieChart, label: 'Relatórios' },
  { href: '/recurring', icon: RefreshCw, label: 'Recorrentes' },
  { href: '/categories', icon: Tag, label: 'Categorias' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
]

export function MobileNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {showMore && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-[72px] left-3 right-3 z-40 bg-white border border-[#E2DECE] rounded-2xl p-3 shadow-xl animate-fade-up">
            <div className="grid grid-cols-4 gap-1">
              {secondary.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      'flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl transition-colors',
                      active ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#5A7A5A] hover:text-[#3A6432] hover:bg-[#EEF5EB]/60'
                    )}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[10px] font-medium leading-none text-center">{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 border-t border-[#E2DECE] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around px-1 py-1">
          {primary.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-2 rounded-xl min-w-[64px] transition-all duration-150',
                  active ? 'text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'
                )}
              >
                <div className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-xl transition-all',
                  active ? 'bg-[#EEF5EB] border border-[#C5D9C0]' : 'bg-transparent'
                )}>
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className="text-[11px] font-semibold leading-none">{label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setShowMore(v => !v)}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-2 rounded-xl min-w-[64px] transition-all duration-150',
              showMore ? 'text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'
            )}
          >
            <div className={cn(
              'w-10 h-10 flex items-center justify-center rounded-xl transition-all',
              showMore ? 'bg-[#EEF5EB] border border-[#C5D9C0]' : 'bg-transparent'
            )}>
              <MoreHorizontal size={22} strokeWidth={showMore ? 2.5 : 2} />
            </div>
            <span className="text-[11px] font-semibold leading-none">Mais</span>
          </button>
        </div>
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </nav>
    </>
  )
}
