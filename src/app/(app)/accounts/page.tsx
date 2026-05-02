'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, ACCOUNT_TYPE_LABELS, COLORS } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, Wallet, CreditCard, PiggyBank, TrendingUp, Banknote, MoreHorizontal, Pencil, Trash2, EyeOff, Eye, Users, Lock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinAccount } from '@/types/database'

const TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Wallet, savings: PiggyBank, credit_card: CreditCard,
  investment: TrendingUp, cash: Banknote, other: Wallet,
}

// ── Paleta: Verde elegante midtone ──
// Fundo da página / layout:  controlado pelo layout pai (não alteramos aqui)
// Cards ativos:   bg-[#1b2e1b]  border-[#2d4a2d]
// Cards hover:    bg-[#1f3520]
// Banner total:   from-[#1a3a1a] via-[#162e16]
// Texto primário: text-[#c8e6c8]  (verde muito claro / quase branco-esverdeado)
// Texto secundário: text-[#5a8a5a]
// Acento ação:    bg-[#2d6a2d]  hover:bg-[#3a7a3a]
// Separadores:    border-[#2d4a2d]

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
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { name: '', type: 'checking', balance: '', color: '#16a34a', is_shared: true }
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
    reset({ name: '', type: 'checking', balance: '', color: '#16a34a', is_shared: true })
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
    const payload = {
      household_id: householdId, user_id: userId,
      name: data.name, type: data.type as FinAccount['type'],
      balance: parseFloat(data.balance || '0'),
      color: data.color, is_shared: data.is_shared,
    }
    if (editing) {
      const { error } = await supabase.from('fin_accounts').update({
        name: data.name, type: data.type as FinAccount['type'],
        balance: parseFloat(data.balance || '0'), color: data.color,
        is_shared: data.is_shared, updated_at: new Date().toISOString()
      }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta atualizada!')
    } else {
      const { error } = await supabase.from('fin_accounts').insert(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta criada com sucesso!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function toggleActive(acc: FinAccount) {
    const supabase = createClient()
    await supabase.from('fin_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id)
    setActiveMenu(null)
    toast(acc.is_active ? 'Conta arquivada' : 'Conta reativada', 'info')
    load()
  }

  async function deleteAccount(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('fin_accounts').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Conta excluída permanentemente.', 'info')
    setDeleting(null)
    load()
  }

  const active = accounts.filter(a => a.is_active)
  const inactive = accounts.filter(a => !a.is_active)
  const totalBalance = active.reduce((s, a) => s + Number(a.balance), 0)

  // ── Skeleton Loader ──
  if (loading) return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 space-y-4">
      <div className="rounded-2xl bg-[#1a2e1a] border border-[#2d4a2d] p-5 space-y-2.5 animate-pulse">
        <div className="h-2.5 w-24 rounded bg-[#2d4a2d]" />
        <div className="h-8 w-40 rounded bg-[#2d4a2d]" />
        <div className="h-2 w-16 rounded bg-[#2d4a2d]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="relative rounded-2xl bg-[#1a2e1a] border border-[#2d4a2d] p-4 pt-5 space-y-3 overflow-hidden animate-pulse">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#2d4a2d] rounded-t-2xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2d4a2d]" />
              <div className="space-y-2">
                <div className="h-3.5 w-28 rounded bg-[#2d4a2d]" />
                <div className="h-2.5 w-20 rounded bg-[#2d4a2d]" />
              </div>
            </div>
            <div className="h-6 w-32 rounded bg-[#2d4a2d]" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-5">

      {/* ── Banner Patrimônio Total ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#2d5a2d] bg-gradient-to-br from-[#1a3a1a] via-[#162e16] to-[#0f220f] p-5 shadow-lg">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-green-600/8 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-green-400/5 blur-xl pointer-events-none" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#5a9a5a] uppercase tracking-[0.15em] mb-1">Patrimônio Total</p>
            <p className={`text-3xl font-bold tracking-tight tabular-nums ${totalBalance >= 0 ? 'text-[#c8e6c8]' : 'text-red-400'}`}>
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-xs text-[#4a7a4a] mt-1.5">
              {active.length} conta{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}
              {inactive.length > 0 && <span className="ml-2 text-[#3a5a3a]">· {inactive.length} arquivada{inactive.length !== 1 ? 's' : ''}</span>}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-900/30 border border-green-800/30 flex items-center justify-center">
            <TrendingUp size={18} className="text-[#5a9a5a]" />
          </div>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#a0c8a0]">Contas</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e3e1e] border border-[#2d5a2d] text-xs font-semibold text-[#7ab87a] hover:bg-[#244424] hover:text-[#a0d8a0] transition-all active:scale-95"
        >
          <Plus size={13} /> Nova conta
        </button>
      </div>

      {/* ── Active Accounts Grid ── */}
      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {active.map(acc => {
            const Icon = TYPE_ICONS[acc.type] || Wallet
            return (
              <div
                key={acc.id}
                className="relative overflow-hidden rounded-2xl border border-[#2d4a2d] bg-[#1b2e1b] hover:bg-[#1f3520] transition-colors shadow-sm group"
              >
                {/* Color accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: acc.color }} />

                <div className="p-4 pt-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: acc.color + '18', border: `1.5px solid ${acc.color}40` }}
                      >
                        <Icon size={17} style={{ color: acc.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#c8e6c8] leading-tight">{acc.name}</p>
                        <p className="text-[11px] text-[#4a7a4a] mt-0.5">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                      </div>
                    </div>

                    {/* Kebab menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === acc.id ? null : acc.id)}
                        className="p-1 rounded-lg text-[#3a6a3a] hover:text-[#7ab87a] hover:bg-[#2d4a2d] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {activeMenu === acc.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                          <div className="absolute right-0 top-full mt-1.5 w-38 bg-[#162816] border border-[#2d4a2d] rounded-xl shadow-2xl z-20 overflow-hidden">
                            <button onClick={() => { setActiveMenu(null); openEdit(acc) }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[#a0c8a0] hover:bg-[#2d4a2d] transition-colors">
                              <Pencil size={13} /> Editar
                            </button>
                            <button onClick={() => toggleActive(acc)} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[#a0c8a0] hover:bg-[#2d4a2d] transition-colors">
                              <EyeOff size={13} /> Arquivar
                            </button>
                            <div className="border-t border-[#2d4a2d]" />
                            <button onClick={() => { setActiveMenu(null); setDeleting(acc.id) }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors">
                              <Trash2 size={13} /> Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Balance + meta */}
                  <div className="mt-4 flex items-end justify-between">
                    <p className={`text-xl font-bold tabular-nums leading-none ${Number(acc.balance) >= 0 ? 'text-[#c8e6c8]' : 'text-red-400'}`}>
                      {formatCurrency(Number(acc.balance))}
                    </p>
                    <div className="flex items-center gap-1">
                      {!acc.is_shared ? (
                        <span className="flex items-center gap-1 text-[10px] text-[#3a6a3a] bg-[#1a2e1a] border border-[#2d4a2d] rounded-full px-2 py-0.5">
                          <Lock size={9} /> Privada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-[#3a6a3a] bg-[#1a2e1a] border border-[#2d4a2d] rounded-full px-2 py-0.5">
                          <Users size={9} /> Família
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2d4a2d] bg-[#162816]/50 py-16 gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1b2e1b] border border-[#2d4a2d] flex items-center justify-center">
            <Wallet size={26} className="text-[#4a7a4a]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#a0c8a0]">Nenhuma conta cadastrada</p>
            <p className="text-xs text-[#4a7a4a] mt-1">Adicione suas contas bancárias, carteiras ou investimentos.</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e3e1e] border border-[#2d5a2d] text-sm font-medium text-[#7ab87a] hover:bg-[#244424] transition-all"
          >
            <Plus size={14} /> Adicionar primeira conta
          </button>
        </div>
      )}

      {/* ── Archived Accounts ── */}
      {inactive.length > 0 && (
        <div>
          <p className="text-[11px] text-[#3a5a3a] mb-2 flex items-center gap-1.5">
            <EyeOff size={11} /> Contas arquivadas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {inactive.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 bg-[#162816]/60 border border-[#2d4a2d]/40 rounded-xl px-4 py-3 opacity-50 hover:opacity-80 transition-opacity">
                <Wallet size={15} className="text-[#3a5a3a]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#4a7a4a] truncate">{acc.name}</p>
                  <p className="text-xs text-[#3a5a3a]">{formatCurrency(Number(acc.balance))}</p>
                </div>
                <button onClick={() => toggleActive(acc)} title="Reativar conta" className="p-1 text-[#4a7a4a] hover:text-[#7ab87a] transition-colors">
                  <Eye size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conta' : 'Nova conta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <Input
            label="Nome da conta"
            placeholder="Ex: Nubank, Bradesco, Carteira..."
            {...register('name', { required: true })}
          />
          <Select label="Tipo de conta" {...register('type')}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Saldo atual (R$)" type="number" step="0.01" placeholder="0,00" {...register('balance')} />

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[#5a8a5a] uppercase tracking-wider">Cor de identificação</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setValue('color', c)}
                  className={`w-7 h-7 rounded-lg transition-all ${selectedColor === c ? 'ring-2 ring-white/70 scale-110 shadow-md' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Shared toggle */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-[#2d4a2d] bg-[#1a2e1a] hover:bg-[#1f3520] transition-colors">
            <input type="checkbox" {...register('is_shared')} className="w-4 h-4 accent-green-500 rounded" />
            <div>
              <span className="text-sm font-medium text-[#a0c8a0]">Conta compartilhada com a família</span>
              <p className="text-xs text-[#4a7a4a] mt-0.5">Todos os membros poderão visualizar esta conta</p>
            </div>
          </label>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 bg-green-700 hover:bg-green-600 text-white border-0">
              {editing ? 'Salvar alterações' : 'Criar conta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir conta" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-red-900/10 border border-red-900/20 rounded-xl p-3">
            <Trash2 size={17} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">
              Esta ação é <span className="font-semibold">irreversível</span>. A conta e todas as transações vinculadas serão excluídas permanentemente.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button
              onClick={() => deleting && deleteAccount(deleting)}
              className="flex-1 !bg-red-600 hover:!bg-red-500 text-white"
            >
              Excluir conta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
