'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Tag, Target,
  PieChart, Users, Settings, TrendingUp, X, BarChart3, RefreshCw, CalendarClock, CalendarDays
} from 'lucide-react'

// Sidebar tem a sensação da parede de acento verde floresta do quarto elegante
// Texto: creme claro sobre fundo verde escuro

const groups = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Início' },
      { href: '/bills', icon: CalendarClock, label: 'Contas a Pagar' },
      { href: '/calendar', icon: CalendarDays, label: 'Calendário' },
      { href: '/accounts', icon: Wallet, label: 'Saldo em Contas' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/transactions', icon: ArrowLeftRight, label: 'Lançamentos' },
      { href: '/budgets', icon: BarChart3, label: 'Orçamentos' },
      { href: '/goals', icon: Target, label: 'Metas' },
      { href: '/recurring', icon: RefreshCw, label: 'Recorrentes' },
      { href: '/categories', icon: Tag, label: 'Categorias' },
    ],
  },
  {
    label: 'Família e Conta',
    items: [
      { href: '/reports', icon: PieChart, label: 'Relatórios' },
      { href: '/household', icon: Users, label: 'Minha Família' },
      { href: '/settings', icon: Settings, label: 'Configurações' },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed top-0 left-0 h-full z-50 flex flex-col w-[270px]',
        // Verde floresta profundo — como a parede de acento do quarto
        'bg-[#243D22] border-r border-[#1E3320]',
        'transition-transform duration-300 ease-in-out',
        'lg:translate-x-0',
        open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-[#C8E6C4]" />
            </div>
            <div>
              <p className="text-base font-bold text-[#EEF5EB]">FinFamília</p>
              <p className="text-xs text-[#8BB88A]">Gestão financeira</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-white/10 text-[#8BB88A] hover:text-[#C8E6C4] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-5 pt-5 border-t border-white/10' : ''}>
              <p className="text-[11px] font-bold text-[#6A9A68] uppercase tracking-widest px-3 mb-2">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all duration-150',
                          active
                            ? 'bg-white/15 text-white'
                            : 'text-[#9FC49E] hover:text-[#D4EBD2] hover:bg-white/8'
                        )}
                      >
                        <Icon
                          size={20}
                          className={active ? 'text-white' : 'text-[#6A9A68]'}
                          strokeWidth={active ? 2.5 : 2}
                        />
                        {label}
                        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-[#5A8A58]">FinFamília v1.0</p>
        </div>
      </aside>
    </>
  )
}
