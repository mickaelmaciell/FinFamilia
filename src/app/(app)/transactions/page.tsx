'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Plus, Search, Filter, Pencil, Trash2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { FinTransaction, FinAccount, FinCategory } from '@/types/database'

type TxWithRelations = FinTransaction & {
  category?: { name: string; color: string } | null
  account?: { name: string; color: string } | null
  profile?: { full_name: string } | null
}

const schema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1),
  description: z.string().min(1, 'Descrição obrigatória'),
  account_id: z.string().min(1, 'Selecione uma conta'),
  category_id: z.string().optional(),
  to_account_id: z.string().optional(),
  date: z.string().min(1),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const TYPE_LABELS = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' }
const PAGE_SIZE = 20

export default function TransactionsPage() {
  const { toast } = useToast()
  const [txs, setTxs] = useState<TxWithRelations[]>([])
  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [categories, setCategories] = useState<FinCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TxWithRelations | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', date: new Date().toISOString().split('T')[0] }
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

    let query = supabase.from('fin_transactions')
      .select('*, category:fin_categories(name,color), account:fin_accounts(name,color), profile:profiles(full_name)', { count: 'exact' })
      .eq('household_id', hid)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (search) query = query.ilike('description', `%${search}%`)
    if (filterType) query = query.eq('type', filterType as 'income' | 'expense' | 'transfer')
    if (filterAccount) query = query.eq('account_id', filterAccount)
    if (filterCategory) query = query.eq('category_id', filterCategory)

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count } = await query
    setTxs((data as TxWithRelations[]) || [])
    setTotal(count || 0)

    const [{ data: accs }, { data: cats }] = await Promise.all([
      supabase.from('fin_accounts').select('*').eq('household_id', hid).eq('is_active', true),
      supabase.from('fin_categories').select('*').or(`household_id.eq.${hid},household_id.is.null`).order('sort_order'),
    ])
    setAccounts(accs || [])
    setCategories(cats || [])
    setLoading(false)
  }, [search, filterType, filterAccount, filterCategory, page])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    reset({ type: 'expense', date: new Date().toISOString().split('T')[0] })
    setShowModal(true)
  }

  function openEdit(tx: TxWithRelations) {
    setEditing(tx)
    reset({
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description,
      account_id: tx.account_id,
      category_id: tx.category_id || '',
      to_account_id: tx.to_account_id || '',
      date: tx.date,
      notes: tx.notes || '',
    })
    setShowModal(true)
  }

  async function onSubmit(data: FormData) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      household_id: householdId,
      user_id: userId,
      type: data.type,
      amount: parseFloat(data.amount.replace(',', '.')),
      description: data.description,
      account_id: data.account_id,
      category_id: data.category_id || null,
      to_account_id: data.type === 'transfer' ? (data.to_account_id || null) : null,
      date: data.date,
      notes: data.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('fin_transactions').update({ type: payload.type, amount: payload.amount, description: payload.description, account_id: payload.account_id, category_id: payload.category_id, to_account_id: payload.to_account_id, date: payload.date, notes: payload.notes, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Transação atualizada!')
    } else {
      const { error } = await supabase.from('fin_transactions').insert(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Transação adicionada!')
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function deleteTransaction(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('fin_transactions').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Transação excluída!', 'info')
    setDeleting(null)
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const filteredCategories = categories.filter(c => txType !== 'transfer' ? c.type === (txType === 'income' ? 'income' : 'expense') : false)

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto lg:px-6 lg:py-6">
      {/* Top actions */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-green-700 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar transações..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full h-10 bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl pl-9 pr-4 text-sm text-green-100 placeholder:text-green-900 focus:outline-none focus:border-green-700"
          />
        </div>
        <Button variant="secondary" size="icon" onClick={() => setShowFilter(!showFilter)} className={showFilter ? 'border-green-700 text-green-400' : ''}>
          <Filter size={16} />
        </Button>
        <Button onClick={openNew} size="icon" className="shrink-0">
          <Plus size={18} />
        </Button>
      </div>

      {/* Filters */}
      {showFilter && (
        <Card className="mb-4 animate-fade-in">
          <CardContent className="p-4 grid grid-cols-2 gap-3">
            <Select label="Tipo" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
              <option value="">Todos os tipos</option>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
              <option value="transfer">Transferência</option>
            </Select>
            <Select label="Conta" value={filterAccount} onChange={e => { setFilterAccount(e.target.value); setPage(1) }}>
              <option value="">Todas as contas</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Select label="Categoria" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }} className="col-span-2">
              <option value="">Todas as categorias</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { setFilterType(''); setFilterAccount(''); setFilterCategory(''); setSearch(''); setPage(1) }} className="col-span-2 text-xs">
              <X size={12} /> Limpar filtros
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-green-700">{total} transaç{total === 1 ? 'ão' : 'ões'}</p>
        <p className="text-xs text-green-700">Página {page} de {Math.max(1, totalPages)}</p>
      </div>

      {/* List */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
          </div>
        ) : txs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <ArrowLeftRight size={32} className="text-green-900" />
            <p className="text-sm text-green-700">Nenhuma transação encontrada</p>
            <Button onClick={openNew} size="sm"><Plus size={14} /> Nova transação</Button>
          </div>
        ) : (
          <ul>
            {txs.map((tx, i) => (
              <li key={tx.id} className={`flex items-center gap-3 px-4 py-3.5 group active:bg-[#1a2e1a] transition-colors ${i < txs.length - 1 ? 'border-b border-[#1a2e1a]' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-income' : tx.type === 'expense' ? 'bg-expense' : 'bg-transfer'}`}>
                  {tx.type === 'income' ? <ArrowUpRight size={18} className="text-income" /> : tx.type === 'expense' ? <ArrowDownRight size={18} className="text-expense" /> : <ArrowLeftRight size={18} className="text-transfer" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-200 truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {tx.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ background: tx.category.color + '22', color: tx.category.color }}>
                        {tx.category.name}
                      </span>
                    )}
                    {tx.account && <span className="text-[10px] text-green-800">{tx.account.name}</span>}
                    <span className="text-[10px] text-green-900">{formatDate(tx.date)}</span>
                    {tx.profile && tx.profile.full_name && <span className="text-[10px] text-green-900">• {tx.profile.full_name.split(' ')[0]}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${tx.type === 'income' ? 'text-income' : tx.type === 'expense' ? 'text-expense' : 'text-transfer'}`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(Number(tx.amount))}
                  </p>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleting(tx.id)} className="p-1.5 rounded-lg hover:bg-red-900/20 text-green-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="secondary" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-green-600">{page} / {totalPages}</span>
          <Button variant="secondary" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar transação' : 'Nova transação'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button key={t} type="button" onClick={() => setValue('type', t)}
                className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${txType === t
                  ? t === 'income' ? 'bg-income border-green-700/50 text-green-400'
                  : t === 'expense' ? 'bg-expense border-red-700/50 text-red-400'
                  : 'bg-transfer border-blue-700/50 text-blue-400'
                  : 'border-[#1a2e1a] text-green-700 hover:bg-[#1a2e1a]'}`}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <Input label="Valor (R$)" type="number" step="0.01" min="0.01" placeholder="0,00"
            {...register('amount')} error={errors.amount?.message} />
          <Input label="Descrição" placeholder="Ex: Supermercado, Salário..."
            {...register('description')} error={errors.description?.message} />
          <Select label="Conta" {...register('account_id')} error={errors.account_id?.message}>
            <option value="">Selecionar conta</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          {txType === 'transfer' && (
            <Select label="Conta destino" {...register('to_account_id')}>
              <option value="">Selecionar conta destino</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
          {txType !== 'transfer' && (
            <Select label="Categoria" {...register('category_id')}>
              <option value="">Sem categoria</option>
              {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          <Input label="Data" type="date" {...register('date')} />
          <Input label="Observações (opcional)" placeholder="Detalhes adicionais..." {...register('notes')} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">{editing ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir transação" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-green-400">Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteTransaction(deleting)} className="flex-1">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
