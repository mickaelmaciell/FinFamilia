'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, BarChart3, Pencil, Trash2, ChevronLeft, ChevronRight, Tag, AlertTriangle } from 'lucide-react'
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

    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
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

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  function openNew() { setEditing(null); reset({ category_id: '', amount: '' }); setShowModal(true) }
  function openEdit(b: BudgetWithCategory) { setEditing(b); reset({ category_id: b.category_id, amount: String(b.amount) }); setShowModal(true) }

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
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* ── Navegação de mês ── */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-[#1A2E1A]">{MONTHS[month - 1]} {year}</h2>
        <button onClick={nextMonth} className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors active:scale-95">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* ── Resumo ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-[#5A7A5A] mb-1.5">Orçamento total</p>
          <p className="text-xl font-bold text-[#1A2E1A]">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-[#5A7A5A] mb-1.5">Gasto total</p>
          <p className={`text-xl font-bold ${totalSpent > totalBudget ? 'text-red-500' : 'text-[#3A6432]'}`}>
            {formatCurrency(totalSpent)}
          </p>
        </div>
      </div>

      {/* ── Ação ── */}
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-[#5A7A5A]">
          {budgets.length} orçamento{budgets.length !== 1 ? 's' : ''} definido{budgets.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={openNew}>
          <Plus size={16} /> Novo orçamento
        </Button>
      </div>

      {/* ── Lista de orçamentos ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white border border-[#E2DECE] rounded-2xl p-4 animate-pulse shadow-sm">
              <div className="h-4 w-36 rounded bg-[#EEF5EB] mb-3" />
              <div className="h-2.5 rounded-full bg-[#F0EDE6]" />
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm">
          <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center">
              <BarChart3 size={26} className="text-[#3A6432]" />
            </div>
            <p className="text-base font-semibold text-[#1A2E1A]">Nenhum orçamento para este mês</p>
            <p className="text-sm text-[#8FAA8F]">Defina limites por categoria para controlar seus gastos</p>
            <Button onClick={openNew} className="mt-1">
              <Plus size={15} /> Criar primeiro orçamento
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {budgets.map(b => {
            const spent = spends[b.category_id] || 0
            const pct = Math.min(100, Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0)
            const over = spent > Number(b.amount)
            const remaining = Number(b.amount) - spent
            return (
              <div key={b.id} className="bg-white border border-[#E2DECE] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {b.category && (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: b.category.color + '18', border: `1.5px solid ${b.category.color}40` }}>
                        <Tag size={15} style={{ color: b.category.color }} />
                      </div>
                    )}
                    <div>
                      <p className="text-base font-bold text-[#1A2E1A]">{b.category?.name || 'Sem categoria'}</p>
                      <p className="text-xs text-[#8FAA8F]">
                        {over
                          ? <span className="text-red-500 font-medium">Excedeu em {formatCurrency(Math.abs(remaining))}</span>
                          : <span>Restam {formatCurrency(remaining)}</span>
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(b)} className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(b.id)} className="p-2 rounded-lg hover:bg-red-50 text-[#8FAA8F] hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="h-3 bg-[#F0EDE6] rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-[#3A6432]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className={`font-semibold ${over ? 'text-red-500' : 'text-[#3A6432]'}`}>
                    {formatCurrency(spent)} gasto
                  </span>
                  <span className="text-[#8FAA8F]">
                    de {formatCurrency(Number(b.amount))}
                  </span>
                  <span className={`font-bold ${over ? 'text-red-500' : pct > 80 ? 'text-yellow-600' : 'text-[#1A2E1A]'}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal criar/editar ── */}
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
          {editing && (
            <div className="flex items-center gap-2 p-3 bg-[#EEF5EB] border border-[#C5D9C0] rounded-xl">
              <Tag size={16} className="text-[#3A6432]" />
              <p className="text-sm font-bold text-[#1A2E1A]">{editing.category?.name}</p>
            </div>
          )}
          <Input
            label={`Limite para ${MONTHS[month - 1]} (R$)`}
            type="number" step="0.01" min="0.01" placeholder="0,00"
            {...register('amount', { required: true })}
          />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal excluir ── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir orçamento" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={17} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">Excluir este orçamento do mês?</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button onClick={() => deleting && deleteBudget(deleting)} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white border-0">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
