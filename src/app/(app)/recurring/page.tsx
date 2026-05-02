'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, FREQUENCY_LABELS } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, RefreshCw, Pencil, Trash2, Pause, Play, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinRecurring, FinAccount, FinCategory } from '@/types/database'

type RecurringWithRelations = FinRecurring & {
  category?: FinCategory | null
  account?: FinAccount | null
}

export default function RecurringPage() {
  const { toast } = useToast()
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
    setEditing(null); reset({ type: 'expense', amount: '', description: '', account_id: '', category_id: '', frequency: 'monthly', next_date: new Date().toISOString().split('T')[0], end_date: '' }); setShowModal(true)
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
    const payload = { household_id: householdId, user_id: userId, type: data.type as 'income' | 'expense', amount: parseFloat(data.amount), description: data.description, account_id: data.account_id, category_id: data.category_id || null, frequency: data.frequency as FinRecurring['frequency'], next_date: data.next_date, end_date: data.end_date || null }
    if (editing) {
      const { error } = await supabase.from('fin_recurring').update({ type: data.type as 'income' | 'expense', amount: parseFloat(data.amount), description: data.description, account_id: data.account_id, category_id: data.category_id || null, frequency: data.frequency as FinRecurring['frequency'], next_date: data.next_date, end_date: data.end_date || null, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Recorrente atualizado!')
    } else {
      const { error } = await supabase.from('fin_recurring').insert(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Recorrente criado!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function toggleActive(r: RecurringWithRelations) {
    const supabase = createClient()
    await supabase.from('fin_recurring').update({ is_active: !r.is_active, updated_at: new Date().toISOString() }).eq('id', r.id)
    load()
  }

  async function deleteRecurring(id: string) {
    const supabase = createClient()
    await supabase.from('fin_recurring').delete().eq('id', id)
    toast('Recorrente excluído!', 'info'); setDeleting(null); load()
  }

  const totalMonthly = items.filter(r => r.is_active && r.frequency === 'monthly').reduce((s, r) => {
    return r.type === 'income' ? s + Number(r.amount) : s - Number(r.amount)
  }, 0)

  const filteredCats = categories.filter(c => c.type === txType)

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-green-700 mb-1">Impacto mensal estimado</p>
          <p className={`text-lg font-bold ${totalMonthly >= 0 ? 'text-green-300' : 'text-red-400'}`}>{formatCurrency(totalMonthly)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-green-700 mb-1">Recorrentes ativos</p>
          <p className="text-lg font-bold text-green-300">{items.filter(r => r.is_active).length}</p>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={openNew}><Plus size={16} /> Novo recorrente</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <RefreshCw size={32} className="text-green-900" />
            <p className="text-sm text-green-700">Nenhuma transação recorrente</p>
            <Button onClick={openNew} size="sm"><Plus size={14} /> Criar recorrente</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul>
            {items.map((r, i) => (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3.5 group ${!r.is_active ? 'opacity-50' : ''} ${i < items.length - 1 ? 'border-b border-[#1a2e1a]' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.type === 'income' ? 'bg-income' : 'bg-expense'}`}>
                  {r.type === 'income' ? <ArrowUpRight size={18} className="text-income" /> : <ArrowDownRight size={18} className="text-expense" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-200 truncate">{r.description}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-xs text-green-700">{FREQUENCY_LABELS[r.frequency]}</span>
                    <span className="text-xs text-green-800">• Próximo: {formatDate(r.next_date)}</span>
                    {r.category && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: r.category.color + '22', color: r.category.color }}>{r.category.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${r.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {r.type === 'income' ? '+' : '-'}{formatCurrency(Number(r.amount))}
                  </p>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button onClick={() => toggleActive(r)} className={`p-1.5 rounded-lg transition-colors ${r.is_active ? 'hover:bg-yellow-900/20 text-green-700 hover:text-yellow-400' : 'hover:bg-green-900/20 text-green-700 hover:text-green-400'}`}>
                      {r.is_active ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleting(r.id)} className="p-1.5 rounded-lg hover:bg-red-900/20 text-green-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar recorrente' : 'Novo recorrente'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as const).map(t => (
              <button key={t} type="button" onClick={() => reset({ ...watch(), type: t })}
                className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${txType === t ? t === 'income' ? 'bg-income border-green-700/50 text-green-400' : 'bg-expense border-red-700/50 text-red-400' : 'border-[#1a2e1a] text-green-700 hover:bg-[#1a2e1a]'}`}>
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
          <p className="text-sm text-green-400">Excluir este recorrente permanentemente?</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteRecurring(deleting)} className="flex-1">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
