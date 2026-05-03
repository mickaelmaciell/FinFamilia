'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, ACCOUNT_TYPE_LABELS, COLORS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, Wallet, CreditCard, PiggyBank, TrendingUp, Banknote, Pencil, Trash2, EyeOff, Eye, Users, Lock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinAccount } from '@/types/database'

const TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Wallet, savings: PiggyBank, credit_card: CreditCard,
  investment: TrendingUp, cash: Banknote, other: Wallet,
}

export default function AccountsPage() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FinAccount | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { name: '', type: 'checking', balance: '', color: '#3A6432', is_shared: true }
  })
  const selectedColor = watch('color')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    setHouseholdId(member.household_id)
    const { data } = await supabase.from('fin_accounts').select('*').eq('household_id', member.household_id).order('created_at')
    setAccounts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    reset({ name: '', type: 'checking', balance: '', color: '#3A6432', is_shared: true })
    setShowModal(true)
  }

  function openEdit(acc: FinAccount) {
    setEditing(acc)
    reset({ name: acc.name, type: acc.type, balance: String(acc.balance), color: acc.color, is_shared: acc.is_shared })
    setShowModal(true)
  }

  async function onSubmit(data: { name: string; type: string; balance: string; color: string; is_shared: boolean }) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const payload = { household_id: householdId, user_id: userId, name: data.name, type: data.type as FinAccount['type'], balance: parseFloat(data.balance || '0'), color: data.color, is_shared: data.is_shared }
    if (editing) {
      const { error } = await supabase.from('fin_accounts').update({ name: data.name, type: data.type as FinAccount['type'], balance: parseFloat(data.balance || '0'), color: data.color, is_shared: data.is_shared, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta atualizada!')
    } else {
      const { error } = await supabase.from('fin_accounts').insert(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta criada!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function toggleActive(acc: FinAccount) {
    const supabase = createClient()
    await supabase.from('fin_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id)
    toast(acc.is_active ? 'Conta arquivada' : 'Conta reativada', 'info'); load()
  }

  async function deleteAccount(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('fin_accounts').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Conta excluída.', 'info'); setDeleting(null); load()
  }

  const active = accounts.filter(a => a.is_active)
  const inactive = accounts.filter(a => !a.is_active)
  const totalBalance = active.reduce((s, a) => s + Number(a.balance), 0)

  if (loading) return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 space-y-4">
      <div className="rounded-2xl bg-white border border-[#E2DECE] p-5 space-y-2 animate-pulse shadow-sm">
        <div className="h-3 w-28 rounded bg-[#EEF5EB]" />
        <div className="h-8 w-40 rounded bg-[#EEF5EB]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="rounded-2xl bg-white border border-[#E2DECE] p-5 space-y-3 animate-pulse shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#EEF5EB]" />
              <div className="space-y-2"><div className="h-4 w-28 rounded bg-[#EEF5EB]" /><div className="h-3 w-20 rounded bg-[#F0EDE6]" /></div>
            </div>
            <div className="h-6 w-32 rounded bg-[#EEF5EB]" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-5">

      {/* ── Banner Patrimônio ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#C5D9C0] bg-[#243D22] p-6 shadow-md">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="relative">
          <p className="text-xs font-bold text-[#8BB88A] uppercase tracking-widest mb-1.5">Patrimônio Total</p>
          <p className={`text-3xl font-bold tracking-tight tabular-nums ${totalBalance >= 0 ? 'text-[#EEF5EB]' : 'text-red-300'}`}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-sm text-[#6A9A68] mt-2">
            {active.length} conta{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}
            {inactive.length > 0 && <span className="ml-2 text-[#4A7A48]">· {inactive.length} arquivada{inactive.length !== 1 ? 's' : ''}</span>}
          </p>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1A2E1A]">Contas Cadastradas</h2>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3A6432] text-sm font-semibold text-white hover:bg-[#2E5028] transition-all active:scale-95">
          <Plus size={15} /> Nova conta
        </button>
      </div>

      {/* ── Active Accounts ── */}
      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {active.map(acc => {
            const Icon = TYPE_ICONS[acc.type] || Wallet
            return (
              <div key={acc.id} className="relative overflow-hidden rounded-2xl border border-[#E2DECE] bg-white shadow-sm">
                {/* Color accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: acc.color }} />

                <div className="p-5 pt-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: acc.color + '18', border: `1.5px solid ${acc.color}40` }}>
                      <Icon size={20} style={{ color: acc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-[#1A2E1A] leading-tight truncate">{acc.name}</p>
                      <p className="text-sm text-[#8FAA8F] mt-0.5">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                    </div>
                    {!acc.is_shared ? (
                      <span className="flex items-center gap-1 text-xs text-[#8FAA8F] bg-[#F5F2EC] border border-[#E2DECE] rounded-full px-2.5 py-1 shrink-0">
                        <Lock size={11} /> Privada
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[#8FAA8F] bg-[#EEF5EB] border border-[#C5D9C0] rounded-full px-2.5 py-1 shrink-0">
                        <Users size={11} /> Família
                      </span>
                    )}
                  </div>

                  <p className={`text-2xl font-bold tabular-nums mb-4 ${Number(acc.balance) >= 0 ? 'text-[#1A2E1A]' : 'text-red-500'}`}>
                    {formatCurrency(Number(acc.balance))}
                  </p>

                  {/* Always-visible actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-[#F0EDE6]">
                    <button onClick={() => openEdit(acc)}
                      className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0] text-sm font-semibold text-[#3A6432] hover:bg-[#E0EDD9] transition-colors">
                      <Pencil size={14} /> Editar
                    </button>
                    <button onClick={() => toggleActive(acc)}
                      className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-xl bg-[#F5F2EC] border border-[#E2DECE] text-sm font-medium text-[#5A7A5A] hover:bg-[#EDE8E0] transition-colors">
                      <EyeOff size={14} /> Arquivar
                    </button>
                    <button onClick={() => setDeleting(acc.id)}
                      className="flex items-center justify-center px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-red-500 hover:bg-red-100 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#C5D9C0] bg-[#EEF5EB]/50 py-16 gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#C5D9C0] flex items-center justify-center shadow-sm">
            <Wallet size={26} className="text-[#3A6432]" />
          </div>
          <div>
            <p className="text-base font-bold text-[#1A2E1A]">Nenhuma conta cadastrada</p>
            <p className="text-sm text-[#8FAA8F] mt-1">Adicione suas contas bancárias, carteiras ou investimentos.</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3A6432] text-sm font-semibold text-white hover:bg-[#2E5028] transition-all">
            <Plus size={14} /> Adicionar primeira conta
          </button>
        </div>
      )}

      {/* ── Archived ── */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#8FAA8F] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
            <EyeOff size={11} /> Contas arquivadas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {inactive.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 bg-white border border-[#E2DECE] rounded-xl px-4 py-3 opacity-60 hover:opacity-90 transition-opacity">
                <Wallet size={15} className="text-[#8FAA8F]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#5A7A5A] truncate">{acc.name}</p>
                  <p className="text-xs text-[#8FAA8F]">{formatCurrency(Number(acc.balance))}</p>
                </div>
                <button onClick={() => toggleActive(acc)} title="Reativar" className="p-1.5 rounded-lg text-[#8FAA8F] hover:text-[#3A6432] hover:bg-[#EEF5EB] transition-colors">
                  <Eye size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal Criar / Editar ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conta' : 'Nova conta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <Input label="Nome da conta" placeholder="Ex: Nubank, Bradesco, Carteira..." {...register('name', { required: true })} />
          <Select label="Tipo de conta" {...register('type')}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Saldo atual (R$)" type="number" step="0.01" placeholder="0,00" {...register('balance')} />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[#3A6432]">Cor de identificação</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setValue('color', c)}
                  className={`w-8 h-8 rounded-lg transition-all ${selectedColor === c ? 'ring-2 ring-[#1A2E1A]/50 scale-110 shadow-md' : 'hover:scale-105'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-[#E2DECE] bg-[#F5F2EC] hover:bg-[#EEF5EB] transition-colors">
            <input type="checkbox" {...register('is_shared')} className="w-4 h-4 accent-[#3A6432] rounded" />
            <div>
              <span className="text-sm font-semibold text-[#1A2E1A]">Conta compartilhada com a família</span>
              <p className="text-xs text-[#8FAA8F] mt-0.5">Todos os membros poderão visualizar esta conta</p>
            </div>
          </label>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 bg-[#3A6432] hover:bg-[#2E5028] text-white border-0">
              {editing ? 'Salvar alterações' : 'Criar conta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal Excluir ── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir conta" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <Trash2 size={17} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">
              Esta ação é <span className="font-semibold">irreversível</span>. A conta e todas as transações vinculadas serão excluídas permanentemente.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button onClick={() => deleting && deleteAccount(deleting)} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white">Excluir conta</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
