'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, Search, Filter, Pencil, Trash2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
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
    reset({ type: tx.type, amount: String(tx.amount), description: tx.description, account_id: tx.account_id, category_id: tx.category_id || '', to_account_id: tx.to_account_id || '', date: tx.date, notes: tx.notes || '' })
    setShowModal(true)
  }

  async function onSubmit(data: FormData) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      household_id: householdId, user_id: userId, type: data.type,
      amount: parseFloat(data.amount.replace(',', '.')),
      description: data.description, account_id: data.account_id,
      category_id: data.category_id || null,
      to_account_id: data.type === 'transfer' ? (data.to_account_id || null) : null,
      date: data.date, notes: data.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('fin_transactions').update({
        type: payload.type, amount: payload.amount, description: payload.description,
        account_id: payload.account_id, category_id: payload.category_id,
        to_account_id: payload.to_account_id, date: payload.date,
        notes: payload.notes, updated_at: new Date().toISOString()
      }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Transação atualizada!')
    } else {
      const { error } = await supabase.from('fin_transactions').insert(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Transação adicionada!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function deleteTransaction(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('fin_transactions').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Transação excluída!', 'info'); setDeleting(null); load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const filteredCategories = categories.filter(c => txType !== 'transfer' ? c.type === (txType === 'income' ? 'income' : 'expense') : false)
  const hasFilters = search || filterType || filterAccount || filterCategory

  return (
    <div className="px-4 py-5 max-w-3xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* ── Barra de ações ── */}
      <div className="flex items-center gap-2">
        {/* Campo de busca — branco, texto escuro */}
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8FAA8F] pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar transações..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full h-12 bg-white border border-[#D5CCBE] rounded-xl pl-11 pr-4 text-base text-[#1A2E1A] placeholder:text-[#BBCFBB] focus:outline-none focus:border-[#3A6432] focus:ring-2 focus:ring-[#3A6432]/15 transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`h-12 w-12 rounded-xl flex items-center justify-center border transition-all ${showFilter || hasFilters ? 'bg-[#EEF5EB] border-[#3A6432] text-[#3A6432]' : 'bg-white border-[#D5CCBE] text-[#8FAA8F] hover:border-[#3A6432]/50 hover:text-[#3A6432]'}`}
        >
          <Filter size={18} />
        </button>
        <button
          onClick={openNew}
          className="h-12 w-12 rounded-xl bg-[#3A6432] text-white flex items-center justify-center hover:bg-[#2E5028] transition-colors shadow-sm shrink-0"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* ── Filtros ── */}
      {showFilter && (
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-bold text-[#1A2E1A]">Filtrar por</p>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          {hasFilters && (
            <button
              onClick={() => { setFilterType(''); setFilterAccount(''); setFilterCategory(''); setSearch(''); setPage(1) }}
              className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              <X size={14} /> Limpar todos os filtros
            </button>
          )}
        </div>
      )}

      {/* ── Contagem ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5A7A5A] font-medium">
          {total} transaç{total === 1 ? 'ão' : 'ões'} encontrada{total !== 1 ? 's' : ''}
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-[#8FAA8F]">Página {page} de {totalPages}</p>
        )}
      </div>

      {/* ── Lista ── */}
      <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="flex items-center gap-4 px-5 py-4 border-b border-[#F5F2EC] last:border-0 animate-pulse">
                <div className="w-11 h-11 rounded-xl bg-[#EEF5EB] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-[#EEF5EB]" />
                  <div className="h-3 w-24 rounded bg-[#F5F2EC]" />
                </div>
                <div className="h-5 w-24 rounded bg-[#EEF5EB]" />
              </div>
            ))}
          </div>
        ) : txs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center">
              <ArrowLeftRight size={24} className="text-[#3A6432]" />
            </div>
            <p className="text-base font-semibold text-[#1A2E1A]">Nenhuma transação encontrada</p>
            <p className="text-sm text-[#8FAA8F]">{hasFilters ? 'Tente ajustar os filtros.' : 'Adicione sua primeira transação clicando no botão +'}</p>
            {!hasFilters && (
              <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A6432] text-sm font-semibold text-white hover:bg-[#2E5028] transition-colors mt-1">
                <Plus size={15} /> Nova transação
              </button>
            )}
          </div>
        ) : (
          <ul>
            {txs.map((tx, i) => (
              <li key={tx.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAF8] transition-colors ${i < txs.length - 1 ? 'border-b border-[#F5F2EC]' : ''}`}>
                {/* Ícone do tipo */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-[#EEF5EB] border border-[#C5D9C0]' : tx.type === 'expense' ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'}`}>
                  {tx.type === 'income'
                    ? <ArrowUpRight size={20} className="text-[#3A6432]" />
                    : tx.type === 'expense'
                      ? <ArrowDownRight size={20} className="text-red-500" />
                      : <ArrowLeftRight size={20} className="text-blue-500" />}
                </div>

                {/* Descrição */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-[#1A2E1A] truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {tx.category && (
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: tx.category.color + '18', color: tx.category.color }}>
                        {tx.category.name}
                      </span>
                    )}
                    {tx.account && (
                      <span className="text-sm text-[#8FAA8F]">{tx.account.name}</span>
                    )}
                    <span className="text-sm text-[#8FAA8F]">{formatDate(tx.date)}</span>
                    {tx.profile?.full_name && (
                      <span className="text-xs text-[#BBCFBB]">· {tx.profile.full_name.split(' ')[0]}</span>
                    )}
                  </div>
                </div>

                {/* Valor + ações */}
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`text-base font-bold tabular-nums ${tx.type === 'income' ? 'text-[#3A6432]' : tx.type === 'expense' ? 'text-red-500' : 'text-blue-600'}`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(Number(tx.amount))}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(tx)}
                      className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(tx.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-[#8FAA8F] hover:text-red-500 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-white border border-[#D5CCBE] text-[#5A7A5A] hover:border-[#3A6432] hover:text-[#3A6432] disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-[#1A2E1A] px-2">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-white border border-[#D5CCBE] text-[#5A7A5A] hover:border-[#3A6432] hover:text-[#3A6432] disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ── Modal Adicionar / Editar ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar transação' : 'Nova transação'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          {/* Tipo de transação */}
          <div className="grid grid-cols-3 gap-2">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button
                key={t} type="button" onClick={() => setValue('type', t)}
                className={`py-3 rounded-xl text-sm font-bold transition-all border ${txType === t
                  ? t === 'income'
                    ? 'bg-[#EEF5EB] border-[#3A6432] text-[#3A6432]'
                    : t === 'expense'
                      ? 'bg-red-50 border-red-400 text-red-600'
                      : 'bg-blue-50 border-blue-400 text-blue-600'
                  : 'border-[#E2DECE] text-[#5A7A5A] bg-white hover:bg-[#F5F2EC]'
                }`}
              >
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

      {/* ── Modal Confirmar Exclusão ── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir transação" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">
              Tem certeza? Esta ação <span className="font-semibold">não pode ser desfeita</span>.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button
              onClick={() => deleting && deleteTransaction(deleting)}
              className="flex-1 !bg-red-500 hover:!bg-red-600 text-white border-0"
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
