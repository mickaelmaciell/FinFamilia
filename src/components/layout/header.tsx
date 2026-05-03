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
  const [notifError, setNotifError] = useState<string | null>(null)

  const loadInvites = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    const { data: invitesData, error } = await supabase
      .from('household_invitations')
      .select('*')
      .ilike('email', user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (error) {
      setNotifError(error.message || JSON.stringify(error))
      return
    }
    setNotifError(null)
    if (!invitesData || invitesData.length === 0) { setInvites([]); return }

    const householdIds = [...new Set(invitesData.map(i => i.household_id))]
    const inviterIds = [...new Set(invitesData.map(i => i.invited_by))]
    const [{ data: households }, { data: profiles }] = await Promise.all([
      supabase.from('households').select('id, name').in('id', householdIds),
      supabase.from('profiles').select('id, full_name').in('id', inviterIds)
    ])

    setInvites(invitesData.map(inv => {
      const hh = households?.find(h => h.id === inv.household_id)
      const prof = profiles?.find(p => p.id === inv.invited_by)
      return { id: inv.id, token: inv.token, household_name: hh?.name || 'Lar', inviter_name: prof?.full_name || 'Alguém' }
    }))
  }, [])

  useEffect(() => {
    loadInvites()
    const supabase = createClient()
    const channel = supabase.channel('realtime_invitations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_invitations' }, () => loadInvites())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadInvites])

  async function acceptInvite(token: string) {
    setAccepting(token)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result } = await (supabase.rpc as any)('accept_invitation', { p_token: token })
    setAccepting(null)
    if (result === 'success' || result === 'already_member') {
      await loadInvites(); setShowNotifs(false)
      router.push('/dashboard'); router.refresh()
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
    // Header: branco/creme — como a parede branca do quarto
    <header className="sticky top-0 z-20 flex items-center justify-between px-5 h-16 bg-white/90 border-b border-[#E2DECE] backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors active:scale-95"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg font-bold text-[#1A2E1A]">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(v => !v); setShowMenu(false) }}
            className="relative p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors"
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#3A6432] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E2DECE] rounded-2xl shadow-xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E2DECE]">
                  <p className="text-sm font-semibold text-[#1A2E1A]">Notificações</p>
                </div>
                {notifError ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-red-500">Erro: {notifError}</p>
                  </div>
                ) : invites.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={24} className="text-[#C5D9C0] mx-auto mb-2" />
                    <p className="text-sm text-[#8FAA8F]">Nenhuma notificação</p>
                  </div>
                ) : (
                  <ul>
                    {invites.map(inv => (
                      <li key={inv.id} className="px-4 py-3 border-b border-[#F0EDE6] last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center shrink-0 mt-0.5">
                            <Users size={15} className="text-[#3A6432]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1A2E1A] leading-snug">
                              <span className="font-semibold text-[#3A6432]">{inv.inviter_name}</span> te convidou para{' '}
                              <span className="font-semibold">{inv.household_name}</span>
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => acceptInvite(inv.token)}
                                disabled={accepting === inv.token}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#3A6432] text-xs font-semibold text-white hover:bg-[#2E5028] transition-colors disabled:opacity-50"
                              >
                                <Check size={12} />
                                {accepting === inv.token ? 'Aceitando...' : 'Aceitar'}
                              </button>
                              <button
                                onClick={() => declineInvite(inv.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2DECE] text-xs text-[#5A7A5A] hover:bg-[#F5F2EC] transition-colors"
                              >
                                <X size={12} /> Recusar
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
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#EEF5EB] transition-colors"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center text-sm font-bold text-[#3A6432]">
                {initials}
              </div>
            )}
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#E2DECE] rounded-2xl shadow-xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#F0EDE6]">
                  <p className="text-sm font-semibold text-[#1A2E1A] truncate">{userName}</p>
                  <p className="text-xs text-[#8FAA8F] mt-0.5">Minha conta</p>
                </div>
                <button
                  onClick={() => { setShowMenu(false); router.push('/settings') }}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-[#3A6432] hover:bg-[#EEF5EB] transition-colors"
                >
                  <User size={15} /> Perfil e Configurações
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
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
