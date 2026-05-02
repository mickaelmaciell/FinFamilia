'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Users, UserPlus, Crown, Shield, User, Trash2, Mail, Home, Copy, Check, Pencil, LogOut, AlertTriangle } from 'lucide-react'
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

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<MemberWithProfile | null>(null)

  // Form state
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
      supabase.from('household_members').select('*, profiles(*)').eq('household_id', member.household_id),
      supabase.from('household_invitations').select('*').eq('household_id', member.household_id).eq('status', 'pending'),
    ])
    setHousehold(hh)
    setMembers((mems as MemberWithProfile[]) || [])
    setInvitations(invs || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function sendInvite() {
    if (!household || !inviteEmail.trim()) return
    setInviting(true)
    const supabase = createClient()
    const { error } = await supabase.from('household_invitations').insert({
      household_id: household.id, invited_by: currentUserId, email: inviteEmail.trim()
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
    setMemberToRemove(null)
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
    router.push('/dashboard')
    router.refresh()
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
    router.push('/dashboard')
    router.refresh()
  }

  async function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite?token=${token}`
    await navigator.clipboard.writeText(link)
    setCopiedToken(token)
    toast('Link copiado!')
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
    </div>
  )

  if (!household) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <Home size={32} className="text-green-900" />
      <p className="text-sm text-green-700">Você não está em nenhum lar</p>
      <Button onClick={() => router.push('/onboarding')}>Criar lar</Button>
    </div>
  )

  const isOwner = currentRole === 'owner'
  const canManage = currentRole !== 'member'

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      {/* Household info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-900/30 border border-green-800/30 rounded-2xl flex items-center justify-center">
                <Home size={22} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-green-100">{household.name}</h2>
                <p className="text-xs text-green-700">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {canManage && (
              <button onClick={() => { setNewName(household.name); setShowRenameModal(true) }}
                className="p-2 rounded-xl hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                <Pencil size={16} />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-green-200">Membros</h3>
          {canManage && (
            <Button size="sm" onClick={() => setShowInviteModal(true)}><UserPlus size={14} /> Convidar</Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ul>
            {members.map((m, i) => {
              const Icon = ROLE_ICONS[m.role as keyof typeof ROLE_ICONS] ?? User
              const isMe = m.user_id === currentUserId
              const canRemove = !isMe && isOwner && m.role !== 'owner'
              return (
                <li key={m.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < members.length - 1 ? 'border-b border-[#1a2e1a]' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-green-900/30 border border-green-800/30 flex items-center justify-center text-xs font-bold text-green-300">
                    {(m.profiles?.full_name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-200 truncate">
                      {m.profiles?.full_name || 'Membro'}{isMe && <span className="text-xs text-green-700 ml-1">(você)</span>}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Icon size={11} className={m.role === 'owner' ? 'text-yellow-500' : m.role === 'admin' ? 'text-blue-400' : 'text-green-700'} />
                      <span className="text-[10px] text-green-700">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</span>
                    </div>
                  </div>
                  {canRemove && (
                    <button
                      onClick={() => setMemberToRemove(m)}
                      className="p-1.5 rounded-lg hover:bg-red-900/20 text-green-700 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-green-200">Convites pendentes</h3></CardHeader>
          <CardContent className="p-0">
            <ul>
              {invitations.map((inv, i) => (
                <li key={inv.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < invitations.length - 1 ? 'border-b border-[#1a2e1a]' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-green-900/20 flex items-center justify-center">
                    <Mail size={15} className="text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-green-300 truncate">{inv.email}</p>
                    <p className="text-[10px] text-green-800">Expira {new Date(inv.expires_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => copyInviteLink(inv.token)} className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                      {copiedToken === inv.token ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                    <button onClick={() => revokeInvite(inv.id)} className="p-1.5 rounded-lg hover:bg-red-900/20 text-green-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-900/30">
        <CardContent className="p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Zona de perigo</p>
          {isOwner ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-200">Excluir lar</p>
                <p className="text-xs text-green-700 mt-0.5">Remove o lar e todos os dados permanentemente</p>
              </div>
              <button
                onClick={() => { setDeleteConfirm(''); setShowDeleteModal(true) }}
                className="px-3 py-1.5 rounded-xl border border-red-800/50 text-xs font-medium text-red-400 hover:bg-red-900/20 transition-colors"
              >
                Excluir
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-200">Sair do lar</p>
                <p className="text-xs text-green-700 mt-0.5">Você perderá acesso a todos os dados</p>
              </div>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="px-3 py-1.5 rounded-xl border border-red-800/50 text-xs font-medium text-red-400 hover:bg-red-900/20 transition-colors"
              >
                Sair
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Invite Modal ── */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Convidar membro" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-green-500">Envie um convite por e-mail para adicionar alguém ao seu lar.</p>
          <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} icon={<Mail size={16} />} onKeyDown={e => e.key === 'Enter' && sendInvite()} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={sendInvite} loading={inviting} className="flex-1">Enviar convite</Button>
          </div>
        </div>
      </Modal>

      {/* ── Rename Modal ── */}
      <Modal open={showRenameModal} onClose={() => setShowRenameModal(false)} title="Renomear lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Novo nome" value={newName} onChange={e => setNewName(e.target.value)} icon={<Home size={16} />} onKeyDown={e => e.key === 'Enter' && renameHousehold()} autoFocus />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowRenameModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={renameHousehold} loading={actionLoading} disabled={!newName.trim()} className="flex-1">Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Remove Member Modal ── */}
      <Modal open={!!memberToRemove} onClose={() => setMemberToRemove(null)} title="Remover membro" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-900/10 border border-red-900/20 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">
              Tem certeza que deseja remover <span className="font-semibold">{memberToRemove?.profiles?.full_name || 'este membro'}</span> do lar?
            </p>
          </div>
          <p className="text-xs text-green-700">O membro perderá acesso a todos os dados do lar.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMemberToRemove(null)} className="flex-1">Cancelar</Button>
            <Button
              onClick={confirmRemoveMember}
              loading={actionLoading}
              className="flex-1 !bg-red-600 hover:!bg-red-500"
            >
              Remover
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Leave Modal ── */}
      <Modal open={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Sair do lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-900/10 border border-red-900/20 rounded-xl p-3">
            <LogOut size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">
              Tem certeza que deseja sair de <span className="font-semibold">{household.name}</span>?
            </p>
          </div>
          <p className="text-xs text-green-700">Você perderá acesso a todos os dados do lar. Para entrar novamente, precisará de um novo convite.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowLeaveModal(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={leaveHousehold}
              loading={actionLoading}
              className="flex-1 !bg-red-600 hover:!bg-red-500"
            >
              Sair do lar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Excluir lar" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-900/10 border border-red-900/20 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">
              Esta ação é <span className="font-semibold">irreversível</span>. Todos os dados do lar serão excluídos permanentemente.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-green-600">
              Para confirmar, digite o nome do lar: <span className="font-semibold text-green-400">{household.name}</span>
            </p>
            <Input
              placeholder={household.name}
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={deleteHousehold}
              loading={actionLoading}
              disabled={deleteConfirm !== household.name}
              className="flex-1 !bg-red-600 hover:!bg-red-500 disabled:opacity-40"
            >
              Excluir lar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
