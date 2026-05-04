'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Menu, Bell, LogOut, User, Users, Check, X, AlertCircle, Clock } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'

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

interface BillReminder {
  id: string
  name: string
  amount: number
  daysUntil: number
  isOverdue: boolean
  dueDate: Date
}

export function Header({ title, onMenuClick, userName, avatarUrl }: HeaderProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [billReminders, setBillReminders] = useState<BillReminder[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)

  const loadInvites = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return
    const { data } = await supabase
      .from('household_invitations')
      .select('id, token, household:households(name), inviter:profiles(full_name)')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
    if (!data) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setInvites(data.map((r: any) => ({
      id: r.id, token: r.token,
      household_name: r.household?.name || 'Lar',
      inviter_name: r.inviter?.full_name || 'Alguém',
    })))
  }, [])

  const loadBillReminders = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: bills } = await db
      .from('fin_installments')
      .select('id, name, installment_amount, total_installments, paid_installments, start_date, due_day, split_type, split_count, until_date')
      .eq('status', 'active')
      .eq('user_id', user.id)
    if (!bills) return

    const now = new Date()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const reminders: BillReminder[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bills.forEach((bill: any) => {
      const start = new Date(bill.start_date + 'T12:00:00')
      const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
      if (monthsDiff < 0) return
      const instNum = monthsDiff + 1
      if (bill.total_installments && instNum > bill.total_installments) return
      if (bill.until_date && new Date(bill.until_date + 'T12:00:00') < now) return
      const isPaid = instNum <= bill.paid_installments
      if (isPaid) return

      const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.due_day)
      dueDate.setHours(0, 0, 0, 0)
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000)
      if (daysUntil > 5) return // só mostrar próximas e atrasadas

      const amount = bill.split_type === 'members'
        ? bill.installment_amount / (bill.split_count || 1)
        : bill.installment_amount

      reminders.push({ id: bill.id, name: bill.name, amount, daysUntil, isOverdue: daysUntil < 0, dueDate })
    })

    // Ordenar: atrasadas primeiro, depois por dias restantes
    reminders.sort((a, b) => a.daysUntil - b.daysUntil)
    setBillReminders(reminders)
  }, [])

  useEffect(() => {
    loadInvites()
    loadBillReminders()
  }, [loadInvites, loadBillReminders])

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
  const unread = invites.length + billReminders.length

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-white/90 border-b border-[#E2DECE] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-[#1A2E1A]">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Sino */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(v => !v); setShowMenu(false) }}
            className="relative p-2 rounded-xl hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#3A6432] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E2DECE] rounded-2xl shadow-xl z-20 overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-[#F0EDE6]">
                  <p className="text-sm font-semibold text-[#1A2E1A]">Notificações</p>
                </div>
                {invites.length === 0 && billReminders.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Bell size={24} className="text-[#C5D9C0] mx-auto mb-2" />
                    <p className="text-sm text-[#8FAA8F]">Nenhuma notificação</p>
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {/* Lembretes de contas */}
                    {billReminders.map(r => (
                      <li key={`bill-${r.id}`} className={`px-4 py-3 border-b border-[#F0EDE6] last:border-0 ${r.isOverdue ? 'bg-red-50/40' : 'bg-amber-50/30'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${r.isOverdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                            {r.isOverdue
                              ? <AlertCircle size={14} className="text-red-500" />
                              : <Clock size={14} className="text-amber-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold leading-snug ${r.isOverdue ? 'text-red-700' : 'text-amber-800'}`}>
                              {r.name}
                            </p>
                            <p className={`text-xs mt-0.5 ${r.isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                              {r.isOverdue
                                ? `Atrasada ${Math.abs(r.daysUntil)} dia${Math.abs(r.daysUntil) !== 1 ? 's' : ''}`
                                : r.daysUntil === 0 ? 'Vence hoje!'
                                : `Vence em ${r.daysUntil} dia${r.daysUntil > 1 ? 's' : ''}`
                              }
                              {' · '}<span className="font-semibold">{formatCurrency(r.amount)}</span>
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                    {/* Convites de família */}
                    {invites.map(inv => (
                      <li key={inv.id} className="px-4 py-3 border-b border-[#F0EDE6] last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center shrink-0 mt-0.5">
                            <Users size={14} className="text-[#3A6432]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#1A2E1A] leading-snug">
                              <span className="font-medium">{inv.inviter_name}</span> te convidou para{' '}
                              <span className="font-medium text-[#3A6432]">{inv.household_name}</span>
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => acceptInvite(inv.token)}
                                disabled={accepting === inv.token}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEF5EB] border border-[#C5D9C0] text-xs font-medium text-[#3A6432] hover:bg-[#C5D9C0]/40 transition-colors disabled:opacity-50"
                              >
                                <Check size={11} />
                                {accepting === inv.token ? 'Aceitando...' : 'Aceitar'}
                              </button>
                              <button
                                onClick={() => declineInvite(inv.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
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

        {/* Avatar */}
        <div className="relative">
          <button
            onClick={() => { setShowMenu(v => !v); setShowNotifs(false) }}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#EEF5EB] transition-colors"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center text-xs font-bold text-[#3A6432]">
                {initials}
              </div>
            )}
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#E2DECE] rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-[#F0EDE6]">
                  <p className="text-sm font-medium text-[#1A2E1A] truncate">{userName}</p>
                </div>
                <button
                  onClick={() => { setShowMenu(false); router.push('/settings') }}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-[#5A7A5A] hover:bg-[#EEF5EB] hover:text-[#3A6432] transition-colors"
                >
                  <User size={15} /> Perfil
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
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
