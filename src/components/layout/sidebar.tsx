'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Tag, Target,
  PieChart, Users, Settings, TrendingUp, X, BarChart3, RefreshCw
} from 'lucide-react'

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { href: '/accounts', icon: Wallet, label: 'Contas' },
  { href: '/categories', icon: Tag, label: 'Categorias' },
  { href: '/budgets', icon: BarChart3, label: 'Orçamentos' },
  { href: '/goals', icon: Target, label: 'Metas' },
  { href: '/recurring', icon: RefreshCw, label: 'Recorrentes' },
  { href: '/reports', icon: PieChart, label: 'Relatórios' },
  { href: '/household', icon: Users, label: 'Família' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed top-0 left-0 h-full z-50 flex flex-col',
        'bg-[#0a120a] border-r border-[#1a2e1a] w-[260px]',
        'transition-transform duration-300 ease-in-out',
        'lg:translate-x-0',
        open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#1a2e1a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-green-900/40 border border-green-800/40 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-100">FinFamília</p>
              <p className="text-xs text-green-700">Gestão financeira</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {nav.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <li key={href}>
                  <Link href={href} onClick={onClose} className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-green-900/40 text-green-300 border border-green-800/30'
                      : 'text-green-700 hover:text-green-400 hover:bg-[#1a2e1a]'
                  )}>
                    <Icon size={18} className={active ? 'text-green-400' : 'text-green-800'} />
                    {label}
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-3 py-4 border-t border-[#1a2e1a]">
          <p className="text-xs text-green-900 text-center">FinFamília v1.0</p>
        </div>
      </aside>
    </>
  )
}
