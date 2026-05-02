'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Menu, Bell, LogOut, User } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  title: string
  onMenuClick: () => void
  userName?: string
  avatarUrl?: string
}

export function Header({ title, onMenuClick, userName, avatarUrl }: HeaderProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-[#080d08]/90 border-b border-[#1a2e1a] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-[#1a2e1a] text-green-600 hover:text-green-400 transition-colors active:scale-95"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-green-100">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-xl hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
          <Bell size={18} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#1a2e1a] transition-colors"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-green-900/50 border border-green-800/40 flex items-center justify-center text-xs font-bold text-green-300">
                {initials}
              </div>
            )}
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-[#1a2e1a]">
                  <p className="text-sm font-medium text-green-200 truncate">{userName}</p>
                </div>
                <button
                  onClick={() => { setShowMenu(false); router.push('/settings') }}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-green-400 hover:bg-[#1a2e1a] transition-colors"
                >
                  <User size={15} /> Perfil
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  <LogOut size={15} /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
