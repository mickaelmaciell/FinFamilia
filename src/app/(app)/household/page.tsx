'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserPlus, Crown, Shield, User, Trash2, Mail, Home, Check, Pencil, LogOut, AlertTriangle, Share, ChevronUp, ChevronDown } from 'lucide-react'
import type { HouseholdMember, HouseholdInvitation, Household, Profile } from '@/types/database'

type MemberWithProfile = HouseholdMember & { profiles?: Profile }

const ROLE_LABELS = { owner: 'Proprietário', admin: 'Administrador', member: 'Membro' }
const ROLE_ICONS = { owner: Crown, admin: Shield, member: User }

export default function HouseholdPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentRole, setCurrentRole] = useState<'owner' | 'admin' | 'member'>('member')

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<MemberWithProfile | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [inviting, setInviting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: member } = await supabase.from('household_members').select('household_id, role').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    setCurrentRole(member.role as 'owner' | 'admin' | 'member')

    const [{ data: hh }, { data: mems }, { data: invs }] = await Promise.all([
      supabase.from('households').select('*').eq('id', member.household_id).single(),
      supabase.from('household_members').select('*, profiles(*)').eq('household_id', member.household_id).order('joined_at', { ascending: true }),
      supabase.from('household_invitations').select('*').eq('household_id', member.household_id).eq('status', 'pending'),
    ])
    setHousehold(hh)
    setMembers((mems as MemberWithProfile[]) || [])
    setInvitations(invs || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('realtime_household_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, () => { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_invitations' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  async function sendInvite() {
    if (!household || !inviteEmail.trim()) return
    setInviting(true)
    const supabase = createClient()
    const { error } = await supabase.from('household_invitations').insert({
      household_id: household.id, invited_by: currentUserId, email: inviteEmail.trim().toLowerCase()
    })
    setInviting(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Convite enviado para ${inviteEmail}!`)
    setInviteEmail(''); setShowInviteModal(false); load()
  }

  async function revokeInvite(id: string) {
    const supabase = createClient()
    await supabase.from('household_invitations').update({ status: 'rejected' }).eq('id', id)
    toast('Convite cancelado', 'info'); load()
  }

  async function confirmRemoveMember() {
    if (!memberToRemove || !household) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('household_members').delete()
      .eq('household_id', household.id).eq('user_id', memberToRemove.user_id)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Membro removido', 'info')
    setMemberToRemove(null); load()
  }

  async function changeRole(memberId: string, newRole: 'admin' | 'member') {
    const supabase = createClient()
    const { error } = await supabase.from('household_members').update({ role: newRole }).eq('id', memberId)
    if (error) { toast(error.message, 'error'); return }
    toast(`Cargo alterado para ${ROLE_LABELS[newRole]}`)
    load()
  }

  async function renameHousehold() {
    if (!newName.trim() || !household) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('households').update({ name: newName.trim(), updated_at: new Date().toISOString() }).eq('id', household.id)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Nome atualizado!')
    setShowRenameModal(false); load()
  }

  async function deleteHousehold() {
    if (!household || deleteConfirm !== household.name) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('households').delete().eq('id', household.id)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Lar excluído', 'info')
    router.push('/dashboard'); router.refresh()
  }

  async function leaveHousehold() {
    if (!household) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('household_members').delete()
      .eq('household_id', household.id).eq('user_id', currentUserId)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Você saiu do lar', 'info')
    router.push('/dashboard'); router.refresh()
  }

  async function shareOrCopyInviteLink(token: string) {
    const link = `${window.location.origin}/invite?token=${token}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Convite para FinFamília', text: `Você foi convidado para o lar ${household?.name}!`, url: link })
        return
      } catch { /* fallback */ }
    }
    await navigator.clipboard.writeText(link)
    setCopiedToken(token)
    toast('Link copiado!')
    setTimeout(() => setCopiedToken(null), 2000)
  }

  // ── Skeleton Loader ──
  if (loading) return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      <div className="rounded-2xl bg-[#1a2e1a] border border-[#2d4a2d] p-5 flex items-center gap-3 animate-pulse">
        <Skeleton className="w-12 h-12 rounded-2xl bg-[#2d4a2d]" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 bg-[#2d4a2d]" />
          <Skeleton className="h-3 w-16 bg-[#2d4a2d]" />
        </div>
      </div>
      <div className="rounded-2xl bg-[#1a2e1a] border border-[#2d4a2d] overflow-hidden animate-pulse">
        <div className="px-5 py-3 border-b border-[#2d4a2d] flex justify-between">
          <Skeleton className="h-4 w-20 bg-[#2d4a2d]" />
          <Skeleton className="h-7 w-24 rounded-lg bg-[#2d4a2d]" />
        </div>
        {[1, 2].map(n => (
          <div key={n} className="px-5 py-4 border-b border-[#2d4a2d] last:border-0 flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl bg-[#2d4a2d]" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-36 bg-[#2d4a2d]" />
              <Skeleton className="h-3 w-20 bg-[#2d4a2d]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (!household) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-center px-6">
      <div className="w-16 h-16 bg-[#1b2e1b] border border-[#2d4a2d] rounded-3xl flex items-center justify-center mb-2">
        <Home size={30} className="text-[#4a7a4a]" />
      </div>
      <h2 className="text-lg font-bold text-[#c8e6c8]">Nenhum Lar Encontrado</h2>
      <p className="text-sm text-[#4a7a4a] max-w-sm">Crie ou entre em um lar para gerenciar as finanças da sua família.</p>
      <button
        onClick={() => router.push('/onboarding')}
        className="mt-2 px-5 py-2.5 rounded-xl bg-green-700/30 border border-green-700/50 text-sm font-medium text-green-300 hover:bg-green-700/50 transition-all"
      >
        Criar meu lar
      </button>
    </div>
  )

  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'admin'
  const canManage = isOwner || isAdmin

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* ── Household Info Card ── */}
      <div className="rounded-2xl border border-[#2d4a2d] bg-[#1b2e1b] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-900/25 border border-green-800/25 rounded-2xl flex items-center justify-center">
              <Home size={22} className="text-green-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#c8e6c8]">{household.name}</h2>
              <p className="text-xs text-[#4a7a4a]">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => { setNewName(household.name); setShowRenameModal(true) }}
              className="p-2 rounded-xl hover:bg-[#2d4a2d] text-[#4a7a4a] hover:text-[#7ab87a] transition-colors"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Members Card ── */}
      <div className="rounded-2xl border border-[#2d4a2d] bg-[#1b2e1b] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#2d4a2d] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#a0c8a0]">Membros do Lar</h3>
          {canManage && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700/20 border border-green-700/30 text-xs font-semibold text-green-400 hover:bg-green-700/35 transition-all"
            >
              <UserPlus size={13} /> Convidar
            </button>
          )}
        </div>
        <ul>
          {members.map((m, i) => {
            const Icon = ROLE_ICONS[m.role as keyof typeof ROLE_ICONS] ?? User
            const isMe = m.user_id === currentUserId
            const canRemove = !isMe && (isOwner || (isAdmin && m.role === 'member'))
            const canChangeRole = isOwner && !isMe && m.role !== 'owner'

            return (
              <li key={m.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < members.length - 1 ? 'border-b border-[#2d4a2d]' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-[#162816] border border-[#2d4a2d] flex items-center justify-center text-xs font-bold text-green-400">
                  {(m.profiles?.full_name || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#c8e6c8] truncate">
                    {m.profiles?.full_name || 'Membro'}
                    {isMe && <span className="text-xs text-[#3a6a3a] ml-1">(você)</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon size={11} className={m.role === 'owner' ? 'text-yellow-500' : m.role === 'admin' ? 'text-green-400' : 'text-[#4a7a4a]'} />
                    <span className="text-[10px] text-[#4a7a4a]">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canChangeRole && (
                    m.role === 'admin' ? (
                      <button onClick={() => changeRole(m.id, 'member')} title="Rebaixar para Membro" className="p-1.5 rounded-lg hover:bg-[#2d4a2d] text-[#4a7a4a] hover:text-[#a0c8a0] transition-colors">
                        <ChevronDown size={14} />
                      </button>
                    ) : (
                      <button onClick={() => changeRole(m.id, 'admin')} title="Promover a Administrador" className="p-1.5 rounded-lg hover:bg-[#2d4a2d] text-[#4a7a4a] hover:text-green-400 transition-colors">
                        <ChevronUp size={14} />
                      </button>
                    )
                  )}
                  {canRemove && (
                    <button onClick={() => setMemberToRemove(m)} title="Remover Membro" className="p-1.5 rounded-lg hover:bg-red-900/20 text-[#4a7a4a] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Pending Invitations ── */}
      {invitations.length > 0 && (
        <div className="rounded-2xl border border-[#2d4a2d] bg-[#1b2e1b] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2d4a2d]">
            <h3 className="text-sm font-semibold text-[#a0c8a0]">Convites Pendentes</h3>
          </div>
          <ul>
            {invitations.map((inv, i) => (
              <li key={inv.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < invitations.length - 1 ? 'border-b border-[#2d4a2d]' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-[#162816] flex items-center justify-center">
                  <Mail size={15} className="text-[#5a8a5a]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#a0c8a0] truncate">{inv.email}</p>
                  <p className="text-[10px] text-[#3a6a3a]">Expira {new Date(inv.expires_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => shareOrCopyInviteLink(inv.token)} title="Compartilhar link" className="p-1.5 rounded-lg hover:bg-[#2d4a2d] text-[#4a7a4a] hover:text-[#7ab87a] transition-colors">
                    {copiedToken === inv.token ? <Check size={13} className="text-green-400" /> : <Share size={13} />}
                  </button>
                  {canManage && (
                    <button onClick={() => revokeInvite(inv.id)} title="Cancelar convite" className="p-1.5 rounded-lg hover:bg-red-900/20 text-[#4a7a4a] hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Danger Zone ── */}
      <div className="rounded-2xl border border-red-900/25 bg-[#1b2e1b] p-5 mt-6">
        <p className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest mb-3">Zona de Perigo</p>
        {isOwner ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#c8e6c8]">Excluir lar</p>
              <p className="text-xs text-[#4a7a4a] mt-0.5">Remove o lar e todos os dados permanentemente</p>
            </div>
            <button
              onClick={() => { setDeleteConfirm(''); setShowDeleteModal(true) }}
              className="px-3 py-1.5 rounded-xl border border-red-900/40 text-xs font-medium text-red-400 hover:bg-red-900/15 transition-colors"
            >
              Excluir
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#c8e6c8]">Sair do lar</p>
              <p className="text-xs text-[#4a7a4a] mt-0.5">Você perderá acesso a todos os dados</p>
            </div>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="px-3 py-1.5 rounded-xl border border-red-900/40 text-xs font-medium text-red-400 hover:bg-red-900/15 transition-colors"
            >
              Sair
            </button>
          </div>
        )}
      </div>

      {/* ── Invite Modal ── */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Convidar Membro" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-[#5a8a5a]">Envie um convite por e-mail para adicionar alguém ao seu lar.</p>
          <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} icon={<Mail size={16} />} onKeyDown={e => e.key === 'Enter' && sendInvite()} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={sendInvite} loading={inviting} disabled={!inviteEmail.includes('@')} className="flex-1 bg-green-700 hover:bg-green-600 text-white border-0">Enviar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Rename Modal ── */}
      <Modal open={showRenameModal} onClose={() => setShowRenameModal(false)} title="Renomear Lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Novo nome" value={newName} onChange={e => setNewName(e.target.value)} icon={<Home size={16} />} onKeyDown={e => e.key === 'Enter' && renameHousehold()} autoFocus />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowRenameModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={renameHousehold} loading={actionLoading} disabled={!newName.trim()} className="flex-1 bg-green-700 hover:bg-green-600 text-white border-0">Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Remove Member Modal ── */}
      <Modal open={!!memberToRemove} onClose={() => setMemberToRemove(null)} title="Remover membro" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-900/10 border border-red-900/20 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">
              Remover <span className="font-semibold">{memberToRemove?.profiles?.full_name || 'este membro'}</span>? Ele perderá acesso ao lar.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMemberToRemove(null)} className="flex-1">Cancelar</Button>
            <Button onClick={confirmRemoveMember} loading={actionLoading} className="flex-1 !bg-red-600 hover:!bg-red-500 text-white">Remover</Button>
          </div>
        </div>
      </Modal>

      {/* ── Leave Modal ── */}
      <Modal open={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Sair do lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-900/10 border border-red-900/20 rounded-xl p-3">
            <LogOut size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">
              Tem certeza que deseja sair de <span className="font-semibold">{household?.name}</span>? Para voltar precisará de um novo convite.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowLeaveModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={leaveHousehold} loading={actionLoading} className="flex-1 !bg-red-600 hover:!bg-red-500 text-white">Sair do lar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Excluir lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-900/10 border border-red-900/20 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">Esta ação é <span className="font-semibold">irreversível</span>. Todos os dados serão excluídos permanentemente.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-[#5a8a5a]">
              Para confirmar, digite: <span className="font-semibold text-[#a0c8a0]">{household?.name}</span>
            </p>
            <Input placeholder={household?.name} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={deleteHousehold} loading={actionLoading} disabled={deleteConfirm !== household?.name} className="flex-1 !bg-red-600 hover:!bg-red-500 text-white disabled:opacity-40">Excluir lar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
