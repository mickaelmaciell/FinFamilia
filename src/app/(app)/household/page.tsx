'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
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
    setHousehold(hh); setMembers((mems as MemberWithProfile[]) || []); setInvitations(invs || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase.channel('realtime_household_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_invitations' }, () => load())
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
    const { error } = await supabase.from('household_members').delete().eq('household_id', household.id).eq('user_id', memberToRemove.user_id)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Membro removido', 'info'); setMemberToRemove(null); load()
  }

  async function changeRole(memberId: string, newRole: 'admin' | 'member') {
    const supabase = createClient()
    const { error } = await supabase.from('household_members').update({ role: newRole }).eq('id', memberId)
    if (error) { toast(error.message, 'error'); return }
    toast(`Cargo alterado para ${ROLE_LABELS[newRole]}`); load()
  }

  async function renameHousehold() {
    if (!newName.trim() || !household) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('households').update({ name: newName.trim(), updated_at: new Date().toISOString() }).eq('id', household.id)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Nome atualizado!'); setShowRenameModal(false); load()
  }

  async function deleteHousehold() {
    if (!household || deleteConfirm !== household.name) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('households').delete().eq('id', household.id)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Lar excluído', 'info'); router.push('/dashboard'); router.refresh()
  }

  async function leaveHousehold() {
    if (!household) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('household_members').delete().eq('household_id', household.id).eq('user_id', currentUserId)
    setActionLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Você saiu do lar', 'info'); router.push('/dashboard'); router.refresh()
  }

  async function shareOrCopyInviteLink(token: string) {
    const link = `${window.location.origin}/invite?token=${token}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Convite para FinFamília', text: `Você foi convidado para o lar ${household?.name}!`, url: link }); return }
      catch { /* fallback */ }
    }
    await navigator.clipboard.writeText(link)
    setCopiedToken(token); toast('Link copiado!')
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (loading) return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 space-y-4">
      {[1, 2].map(n => (
        <div key={n} className="rounded-2xl bg-white border border-[#E2DECE] p-5 animate-pulse shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF5EB]" />
            <div className="space-y-2"><div className="h-4 w-32 rounded bg-[#EEF5EB]" /><div className="h-3 w-20 rounded bg-[#F0EDE6]" /></div>
          </div>
        </div>
      ))}
    </div>
  )

  if (!household) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-center px-6">
      <div className="w-16 h-16 bg-[#EEF5EB] border border-[#C5D9C0] rounded-3xl flex items-center justify-center mb-2">
        <Home size={30} className="text-[#3A6432]" />
      </div>
      <h2 className="text-xl font-bold text-[#1A2E1A]">Nenhum Lar Encontrado</h2>
      <p className="text-sm text-[#5A7A5A] max-w-sm">Crie ou entre em um lar para gerenciar as finanças da sua família.</p>
      <button onClick={() => router.push('/onboarding')} className="mt-2 px-5 py-3 rounded-xl bg-[#3A6432] text-white font-semibold text-sm hover:bg-[#2E5028] transition-colors">
        Criar meu lar
      </button>
    </div>
  )

  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'admin'
  const canManage = isOwner || isAdmin

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* ── Household Info ── */}
      <div className="bg-white rounded-2xl border border-[#E2DECE] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#EEF5EB] border border-[#C5D9C0] rounded-2xl flex items-center justify-center">
              <Home size={22} className="text-[#3A6432]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1A2E1A]">{household.name}</h2>
              <p className="text-sm text-[#8FAA8F]">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => { setNewName(household.name); setShowRenameModal(true) }}
              className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors">
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Members ── */}
      <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1A2E1A]">Membros do Lar</h3>
          {canManage && (
            <button onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3A6432] text-xs font-semibold text-white hover:bg-[#2E5028] transition-colors">
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
              <li key={m.id} className={`flex items-center gap-3 px-5 py-4 ${i < members.length - 1 ? 'border-b border-[#F5F2EC]' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center text-sm font-bold text-[#3A6432]">
                  {(m.profiles?.full_name || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-[#1A2E1A] truncate">
                    {m.profiles?.full_name || 'Membro'}
                    {isMe && <span className="text-xs text-[#8FAA8F] ml-1.5 font-normal">(você)</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon size={12} className={m.role === 'owner' ? 'text-yellow-500' : m.role === 'admin' ? 'text-[#3A6432]' : 'text-[#8FAA8F]'} />
                    <span className="text-sm text-[#8FAA8F]">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canChangeRole && (
                    m.role === 'admin' ? (
                      <button onClick={() => changeRole(m.id, 'member')} title="Rebaixar para Membro" className="p-2 rounded-lg hover:bg-[#F0EDE6] text-[#8FAA8F] hover:text-[#5A7A5A] transition-colors">
                        <ChevronDown size={15} />
                      </button>
                    ) : (
                      <button onClick={() => changeRole(m.id, 'admin')} title="Promover a Admin" className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors">
                        <ChevronUp size={15} />
                      </button>
                    )
                  )}
                  {canRemove && (
                    <button onClick={() => setMemberToRemove(m)} title="Remover" className="p-2 rounded-lg hover:bg-red-50 text-[#8FAA8F] hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
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
        <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE6]">
            <h3 className="text-sm font-bold text-[#1A2E1A]">Convites Pendentes</h3>
          </div>
          <ul>
            {invitations.map((inv, i) => (
              <li key={inv.id} className={`flex items-center gap-3 px-5 py-4 ${i < invitations.length - 1 ? 'border-b border-[#F5F2EC]' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-[#EEF5EB] flex items-center justify-center">
                  <Mail size={16} className="text-[#3A6432]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A2E1A] truncate">{inv.email}</p>
                  <p className="text-xs text-[#8FAA8F]">Expira {new Date(inv.expires_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => shareOrCopyInviteLink(inv.token)} title="Compartilhar" className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors">
                    {copiedToken === inv.token ? <Check size={14} className="text-[#3A6432]" /> : <Share size={14} />}
                  </button>
                  {canManage && (
                    <button onClick={() => revokeInvite(inv.id)} title="Cancelar" className="p-2 rounded-lg hover:bg-red-50 text-[#8FAA8F] hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Danger Zone ── */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm mt-6">
        <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Zona de Perigo</p>
        {isOwner ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1A2E1A]">Excluir lar</p>
              <p className="text-xs text-[#8FAA8F] mt-0.5">Remove o lar e todos os dados permanentemente</p>
            </div>
            <button onClick={() => { setDeleteConfirm(''); setShowDeleteModal(true) }}
              className="px-3 py-1.5 rounded-xl border border-red-200 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
              Excluir
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1A2E1A]">Sair do lar</p>
              <p className="text-xs text-[#8FAA8F] mt-0.5">Você perderá acesso a todos os dados</p>
            </div>
            <button onClick={() => setShowLeaveModal(true)}
              className="px-3 py-1.5 rounded-xl border border-red-200 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
              Sair
            </button>
          </div>
        )}
      </div>

      {/* ── Modais ── */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Convidar Membro" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-[#5A7A5A]">Envie um convite por e-mail para adicionar alguém ao seu lar.</p>
          <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} icon={<Mail size={16} />} onKeyDown={e => e.key === 'Enter' && sendInvite()} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={sendInvite} loading={inviting} disabled={!inviteEmail.includes('@')} className="flex-1 bg-[#3A6432] hover:bg-[#2E5028] text-white border-0">Enviar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showRenameModal} onClose={() => setShowRenameModal(false)} title="Renomear Lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Novo nome" value={newName} onChange={e => setNewName(e.target.value)} icon={<Home size={16} />} onKeyDown={e => e.key === 'Enter' && renameHousehold()} autoFocus />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowRenameModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={renameHousehold} loading={actionLoading} disabled={!newName.trim()} className="flex-1 bg-[#3A6432] hover:bg-[#2E5028] text-white border-0">Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!memberToRemove} onClose={() => setMemberToRemove(null)} title="Remover membro" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">Remover <span className="font-semibold">{memberToRemove?.profiles?.full_name || 'este membro'}</span>? Ele perderá acesso ao lar.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMemberToRemove(null)} className="flex-1">Cancelar</Button>
            <Button onClick={confirmRemoveMember} loading={actionLoading} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white">Remover</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Sair do lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <LogOut size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">Tem certeza? Você perderá acesso ao lar <span className="font-semibold">{household?.name}</span>.</p>
          </div>
          <p className="text-sm text-[#8FAA8F]">Para voltar precisará de um novo convite.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowLeaveModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={leaveHousehold} loading={actionLoading} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white">Sair do lar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Excluir lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">Esta ação é <span className="font-semibold">irreversível</span>. Todos os dados serão removidos.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-[#5A7A5A]">Para confirmar, digite: <span className="font-semibold text-[#1A2E1A]">{household?.name}</span></p>
            <Input placeholder={household?.name} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={deleteHousehold} loading={actionLoading} disabled={deleteConfirm !== household?.name} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white disabled:opacity-40">Excluir lar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
