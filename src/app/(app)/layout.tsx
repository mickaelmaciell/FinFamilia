'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Header } from '@/components/layout/header'
import { ToastProvider } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transações',
  '/accounts': 'Contas',
  '/categories': 'Categorias',
  '/budgets': 'Orçamentos',
  '/goals': 'Metas',
  '/recurring': 'Recorrentes',
  '/reports': 'Relatórios',
  '/household': 'Família',
  '/settings': 'Configurações',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single()
          .then(({ data }) => {
            if (data) { setUserName(data.full_name); setAvatarUrl(data.avatar_url || '') }
          })
      }
    })
  }, [])

  const title = PAGE_TITLES[pathname] || 'FinFamília'

  return (
    <ToastProvider>
      <div className="flex h-screen bg-[#080d08] overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px]">
          <Header title={title} onMenuClick={() => setSidebarOpen(true)} userName={userName} avatarUrl={avatarUrl} />
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>
        <MobileNav />
      </div>
    </ToastProvider>
  )
}
