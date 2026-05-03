'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, FREQUENCY_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, RefreshCw, Pencil, Trash2, Pause, Play, ArrowUpRight, ArrowDownRight, CreditCard, AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinRecurring, FinAccount, FinCategory } from '@/types/database'
import InstallmentsTab from './_installments'

type RecurringWithRelations = FinRecurring & {
  category?: FinCategory | null
  account?: FinAccount | null
}

type Tab = 'recurring' | 'installments'

export default function RecurringPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('recurring')
  const [items, setItems] = useState<RecurringWithRelations[]>([])
  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [categories, setCategories] = useState<FinCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<RecurringWithRelations | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { type: 'expense', amount: '', description: '', account_id: '', category_id: '', frequency: 'monthly', next_date: new Date().toISOString().split('T')[0], end_date: '' }
  })
  const txType = watch('type')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    const hid = member.household_id
    setHouseholdId(hid)
    const [{ data: recs }, { data: accs }, { data: cats }] = await Promise.all([
      supabase.from('fin_recurring').select('*, category:fin_categories(*), account:fin_accounts(*)').eq('household_id', hid).order('next_date'),
      supabase.from('fin_accounts').select('*').eq('household_id', hid).eq('is_active', true),
      supabase.from('fin_categories').select('*').or(`household_id.eq.${hid},household_id.is.null`).order('name'),
    ])
    setItems((recs as RecurringWithRelations[]) || [])
    setAccounts(accs || [])
    setCategories(cats || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    reset({ type: 'expense', amount: '', description: '', account_id: '', category_id: '', frequency: 'monthly', next_date: new Date().toISOString().split('T')[0], end_date: '' })
    setShowModal(true)
  }

  function openEdit(r: RecurringWithRelations) {
    setEditing(r)
    reset({ type: r.type, amount: String(r.amount), description: r.description, account_id: r.account_id, category_id: r.category_id || '', frequency: r.frequency, next_date: r.next_date, end_date: r.end_date || '' })
    setShowModal(true)
  }

  async function onSubmit(data: { type: string; amount: string; description: string; account_id: string; category_id: string; frequency: string; next_date: string; end_date: string }) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const insertPayload = { household_id: householdId, user_id: userId, type: data.type as 'income' | 'expense', amount: parseFloat(data.amount), description: data.description, account_id: data.account_id, category_id: data.category_id || null, frequency: data.frequency as FinRecurring['frequency'], next_date: data.next_date, end_date: data.end_date || null }
    const updatePayload = { type: data.type as 'income' | 'expense', amount: parseFloat(data.amount), description: data.description, account_id: data.account_id, category_id: data.category_id || null, frequency: data.frequency as FinRecurring['frequency'], next_date: data.next_date, end_date: data.end_date || null, updated_at: new Date().toISOString() }
    const { error } = editing
      ? await supabase.from('fin_recurring').update(updatePayload).eq('id', editing.id)
      : await supabase.from('fin_recurring').insert(insertPayload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(editing ? 'Recorrente atualizado!' : 'Recorrente criado!')
    setShowModal(false); load()
  }

  async function toggleActive(r: RecurringWithRelations) {
    const supabase = createClient()
    await supabase.from('fin_recurring').update({ is_active: !r.is_active, updated_at: new Date().toISOString() }).eq('id', r.id)
    load()
  }

  async function deleteRecurring(id: string) {
    const supabase = createClient()
    await supabase.from('fin_recurring').delete().eq('id', id)
    toast('Excluído!', 'info'); setDeleting(null); load()
  }

  const totalMonthly = items.filter(r => r.is_active && r.frequency === 'monthly').reduce((s, r) => r.type === 'income' ? s + Number(r.amount) : s - Number(r.amount), 0)
  const filteredCats = categories.filter(c => c.type === txType)

  const TABS = [
    { id: 'recurring' as Tab, label: 'Recorrentes', icon: RefreshCw },
    { id: 'installments' as Tab, label: 'Parcelamentos', icon: CreditCard },
  ]

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      {/* ── Abas ── */}
      <div className="flex gap-1 bg-[#F0EDE6] p-1 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === id ? 'bg-white text-[#1A2E1A] shadow-sm' : 'text-[#5A7A5A] hover:text-[#3A6432]'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Aba Recorrentes ── */}
      {tab === 'recurring' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-[#5A7A5A] mb-1">Impacto mensal</p>
              <p className={`text-xl font-bold ${totalMonthly >= 0 ? 'text-[#3A6432]' : 'text-red-500'}`}>{formatCurrency(totalMonthly)}</p>
            </div>
            <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-[#5A7A5A] mb-1">Recorrentes ativos</p>
              <p className="text-xl font-bold text-[#1A2E1A]">{items.filter(r => r.is_active).length}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={openNew}><Plus size={16} /> Novo recorrente</Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(n => <div key={n} className="bg-white border border-[#E2DECE] rounded-2xl h-16 animate-pulse shadow-sm" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm flex flex-col items-center gap-3 py-14 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center">
                <RefreshCw size={26} className="text-[#3A6432]" />
              </div>
              <p className="text-base font-semibold text-[#1A2E1A]">Nenhuma transação recorrente</p>
              <p className="text-sm text-[#8FAA8F]">Cadastre salários, assinaturas, aluguel e outros lançamentos fixos.</p>
              <Button onClick={openNew} className="mt-1"><Plus size={15} /> Criar recorrente</Button>
            </div>
          ) : (
            <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
              <ul>
                {items.map((r, i) => (
                  <li key={r.id} className={`flex items-center gap-3 px-5 py-4 ${!r.is_active ? 'opacity-50' : ''} ${i < items.length - 1 ? 'border-b border-[#F5F2EC]' : ''}`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${r.type === 'income' ? 'bg-[#EEF5EB] border border-[#C5D9C0]' : 'bg-red-50 border border-red-100'}`}>
                      {r.type === 'income' ? <ArrowUpRight size={20} className="text-[#3A6432]" /> : <ArrowDownRight size={20} className="text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-[#1A2E1A] truncate">{r.description}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-sm text-[#5A7A5A]">{FREQUENCY_LABELS[r.frequency]}</span>
                        <span className="text-sm text-[#8FAA8F]">· Próximo: {formatDate(r.next_date)}</span>
                        {r.category && <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: r.category.color + '18', color: r.category.color }}>{r.category.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className={`text-base font-bold tabular-nums ${r.type === 'income' ? 'text-[#3A6432]' : 'text-red-500'}`}>
                        {r.type === 'income' ? '+' : '-'}{formatCurrency(Number(r.amount))}
                      </p>
                      <button onClick={() => toggleActive(r)} className={`p-2 rounded-lg transition-colors ${r.is_active ? 'hover:bg-yellow-50 text-[#8FAA8F] hover:text-yellow-600' : 'hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432]'}`}>
                        {r.is_active ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button onClick={() => openEdit(r)} className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-[#8FAA8F] hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Modal recorrente */}
          <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar recorrente' : 'Novo recorrente'}>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                {(['expense', 'income'] as const).map(t => (
                  <button key={t} type="button" onClick={() => reset({ ...watch(), type: t })}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all ${txType === t ? t === 'income' ? 'bg-[#EEF5EB] border-[#3A6432] text-[#3A6432]' : 'bg-red-50 border-red-400 text-red-600' : 'border-[#E2DECE] text-[#5A7A5A] bg-white hover:bg-[#F5F2EC]'}`}>
                    {t === 'income' ? 'Receita' : 'Despesa'}
                  </button>
                ))}
              </div>
              <Input label="Descrição" placeholder="Ex: Netflix, Aluguel, Salário..." {...register('description', { required: true })} />
              <Input label="Valor (R$)" type="number" step="0.01" min="0.01" placeholder="0,00" {...register('amount', { required: true })} />
              <Select label="Frequência" {...register('frequency')}>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Select label="Conta" {...register('account_id', { required: true })}>
                <option value="">Selecionar conta</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Select label="Categoria" {...register('category_id')}>
                <option value="">Sem categoria</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Próxima data" type="date" {...register('next_date', { required: true })} />
                <Input label="Data final (opcional)" type="date" {...register('end_date')} />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" loading={saving} className="flex-1">{editing ? 'Salvar' : 'Criar'}</Button>
              </div>
            </form>
          </Modal>

          <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir recorrente" size="sm">
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
                <AlertTriangle size={17} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-600">Excluir este recorrente permanentemente?</p>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
                <Button onClick={() => deleting && deleteRecurring(deleting)} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white border-0">Excluir</Button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* ── Aba Parcelamentos ── */}
      {tab === 'installments' && <InstallmentsTab />}
    </div>
  )
}
