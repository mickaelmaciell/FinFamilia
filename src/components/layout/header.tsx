'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Menu, Bell, LogOut, User, Users, Check, X } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

interface HeaderProps {
  title: string
  onMenuClick: () => void
  userName?: string
  avatarUrl?: string
}

interface PendingInvite {
  id: string
  token: string
  household_name: string
  inviter_name: string
}

export function Header({ title, onMenuClick, userName, avatarUrl }: HeaderProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)

  const loadInvites = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    const { data } = await supabase
      .from('household_invitations')
      .select('id, token, household:households(name), inviter:profiles(full_name)')
      .ilike('email', user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (!data) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setInvites(data.map((r: any) => ({
      id: r.id,
      token: r.token,
      household_name: r.household?.name || 'Lar',
      inviter_name: r.inviter?.full_name || 'Alguém',
    })))
  }, [])

  useEffect(() => { loadInvites() }, [loadInvites])

  async function acceptInvite(token: string) {
    setAccepting(token)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result } = await (supabase.rpc as any)('accept_invitation', { p_token: token })
    setAccepting(null)
    if (result === 'success' || result === 'already_member') {
      await loadInvites()
      setShowNotifs(false)
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function declineInvite(id: string) {
    const supabase = createClient()
    await supabase.from('household_invitations').update({ status: 'rejected' }).eq('id', id)
    await loadInvites()
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'
  const unread = invites.length

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
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(v => !v); setShowMenu(false) }}
            className="relative p-2 rounded-xl hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full text-[9px] font-bold text-black flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-[#1a2e1a]">
                  <p className="text-sm font-semibold text-green-200">Notificações</p>
                </div>

                {invites.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Bell size={24} className="text-green-900 mx-auto mb-2" />
                    <p className="text-sm text-green-700">Nenhuma notificação</p>
                  </div>
                ) : (
                  <ul>
                    {invites.map(inv => (
                      <li key={inv.id} className="px-4 py-3 border-b border-[#1a2e1a] last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-900/30 border border-green-800/30 flex items-center justify-center shrink-0 mt-0.5">
                            <Users size={14} className="text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-green-200 leading-snug">
                              <span className="font-medium">{inv.inviter_name}</span> te convidou para{' '}
                              <span className="font-medium text-green-300">{inv.household_name}</span>
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => acceptInvite(inv.token)}
                                disabled={accepting === inv.token}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-700/30 border border-green-700/40 text-xs text-green-300 hover:bg-green-700/50 transition-colors disabled:opacity-50"
                              >
                                <Check size={11} />
                                {accepting === inv.token ? 'Aceitando...' : 'Aceitar'}
                              </button>
                              <button
                                onClick={() => declineInvite(inv.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/20 border border-red-900/30 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
                              >
                                <X size={11} /> Recusar
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowMenu(v => !v); setShowNotifs(false) }}
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
