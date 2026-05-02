'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, BarChart3, Pencil, Trash2, ChevronLeft, ChevronRight, Tag } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinBudget, FinCategory } from '@/types/database'

type BudgetWithCategory = FinBudget & { category?: FinCategory }
type SpendMap = Record<string, number>

export default function BudgetsPage() {
  const { toast } = useToast()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([])
  const [spends, setSpends] = useState<SpendMap>({})
  const [categories, setCategories] = useState<FinCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BudgetWithCategory | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { category_id: '', amount: '' }
  })

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    const hid = member.household_id
    setHouseholdId(hid)

    const [{ data: buds }, { data: cats }] = await Promise.all([
      supabase.from('fin_budgets').select('*, category:fin_categories(*)').eq('household_id', hid).eq('month', month).eq('year', year),
      supabase.from('fin_categories').select('*').or(`household_id.eq.${hid},household_id.is.null`).eq('type', 'expense').order('name'),
    ])
    setBudgets((buds as BudgetWithCategory[]) || [])
    setCategories(cats || [])

    // Get actual spending per category this month
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
    const { data: txs } = await supabase.from('fin_transactions')
      .select('category_id, amount').eq('household_id', hid).eq('type', 'expense').gte('date', start).lte('date', end)
    const sm: SpendMap = {}
    ;(txs || []).forEach(t => {
      if (t.category_id) sm[t.category_id] = (sm[t.category_id] || 0) + Number(t.amount)
    })
    setSpends(sm)
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  function openNew() {
    setEditing(null); reset({ category_id: '', amount: '' }); setShowModal(true)
  }
  function openEdit(b: BudgetWithCategory) {
    setEditing(b); reset({ category_id: b.category_id, amount: String(b.amount) }); setShowModal(true)
  }

  async function onSubmit(data: { category_id: string; amount: string }) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const payload = { household_id: householdId, category_id: data.category_id, amount: parseFloat(data.amount), month, year }
    if (editing) {
      const { error } = await supabase.from('fin_budgets').update({ amount: payload.amount, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Orçamento atualizado!')
    } else {
      const { error } = await supabase.from('fin_budgets').insert(payload)
      if (error) { toast('Já existe orçamento para esta categoria neste mês.', 'error'); setSaving(false); return }
      toast('Orçamento criado!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function deleteBudget(id: string) {
    const supabase = createClient()
    await supabase.from('fin_budgets').delete().eq('id', id)
    toast('Orçamento excluído!', 'info'); setDeleting(null); load()
  }

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0)
  const totalSpent = budgets.reduce((s, b) => s + (spends[b.category_id] || 0), 0)

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-[#1a2e1a] text-green-600 hover:text-green-400 transition-colors active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-base font-semibold text-green-200">{MONTHS[month - 1]} {year}</h2>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-[#1a2e1a] text-green-600 hover:text-green-400 transition-colors active:scale-95">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-green-700 mb-1">Orçamento total</p>
            <p className="text-lg font-bold text-green-300">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-green-700 mb-1">Gasto total</p>
            <p className={`text-lg font-bold ${totalSpent > totalBudget ? 'text-red-400' : 'text-green-300'}`}>{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={openNew}><Plus size={16} /> Novo orçamento</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BarChart3 size={32} className="text-green-900" />
            <p className="text-sm text-green-700">Nenhum orçamento para este mês</p>
            <Button onClick={openNew} size="sm"><Plus size={14} /> Criar orçamento</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {budgets.map(b => {
            const spent = spends[b.category_id] || 0
            const pct = Math.min(100, totalBudget > 0 ? (spent / Number(b.amount)) * 100 : 0)
            const over = spent > Number(b.amount)
            return (
              <Card key={b.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {b.category && (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: b.category.color + '22' }}>
                          <Tag size={12} style={{ color: b.category.color }} />
                        </div>
                      )}
                      <p className="text-sm font-medium text-green-200">{b.category?.name || 'Sem categoria'}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setDeleting(b.id)} className="p-1.5 rounded-lg hover:bg-red-900/20 text-green-700 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="h-2.5 bg-[#1a2e1a] rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={over ? 'text-red-400' : 'text-green-600'}>{formatCurrency(spent)} gasto</span>
                    <span className="text-green-700">de {formatCurrency(Number(b.amount))}</span>
                    <span className={`font-medium ${over ? 'text-red-400' : 'text-green-500'}`}>{pct.toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar orçamento' : 'Novo orçamento'} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          {!editing && (
            <Select label="Categoria" {...register('category_id', { required: true })}>
              <option value="">Selecionar categoria</option>
              {categories.filter(c => !budgets.some(b => b.category_id === c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
          {editing && <p className="text-sm text-green-400 font-medium">{editing.category?.name}</p>}
          <Input label={`Valor do orçamento para ${MONTHS[month - 1]}`} type="number" step="0.01" min="0.01" placeholder="0,00" {...register('amount', { required: true })} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir orçamento" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-green-400">Excluir este orçamento?</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteBudget(deleting)} className="flex-1">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
