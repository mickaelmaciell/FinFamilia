'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS, COLORS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, CreditCard, Users, CalendarDays, CheckCircle2, Circle, Pencil, Trash2, AlertTriangle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import type { FinInstallment, FinAccount, FinCategory } from '@/types/database'

type InstallmentWithRelations = FinInstallment & {
  account?: { name: string } | null
  category?: { name: string; color: string } | null
}

const TYPE_LABELS = { installment: 'Parcelado', consortium: 'Consórcio' }

function addMonths(date: Date, n: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function getInstallmentDate(startDate: string, dueDay: number, index: number): Date {
  const start = new Date(startDate + 'T00:00:00')
  const d = addMonths(start, index)
  const day = Math.min(dueDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())
  d.setDate(day)
  return d
}

interface FormData {
  name: string; type: string; installment_amount: string;
  total_installments: string; paid_installments: string;
  start_date: string; due_day: string;
  account_id: string; category_id: string; color: string; notes: string
}

export default function InstallmentsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<InstallmentWithRelations[]>([])
  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [categories, setCategories] = useState<FinCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [schemaError, setSchemaError] = useState(false)
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InstallmentWithRelations | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, setValue, control } = useForm<FormData>({
    defaultValues: {
      name: '', type: 'installment', installment_amount: '',
      total_installments: '12', paid_installments: '0',
      start_date: new Date().toISOString().split('T')[0],
      due_day: '10', account_id: '', category_id: '', color: '#3A6432', notes: ''
    }
  })
  const selectedColor = watch('color')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    const hid = member.household_id
    setHouseholdId(hid)
    const [{ data: inst, error: instErr }, { data: accs }, { data: cats }] = await Promise.all([
      supabase.from('fin_installments').select('*, account:fin_accounts(name), category:fin_categories(name,color)').eq('household_id', hid).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('fin_accounts').select('*').eq('household_id', hid).eq('is_active', true),
      supabase.from('fin_categories').select('*').or(`household_id.eq.${hid},household_id.is.null`).eq('type', 'expense').order('name'),
    ])
    if (instErr?.code === '42P01' || instErr?.message?.includes('schema cache') || instErr?.message?.includes('fin_installments')) {
      setSchemaError(true); setLoading(false); return
    }
    setItems((inst as InstallmentWithRelations[]) || [])
    setAccounts(accs || [])
    setCategories(cats || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    reset({ name: '', type: 'installment', installment_amount: '', total_installments: '12', paid_installments: '0', start_date: new Date().toISOString().split('T')[0], due_day: '10', account_id: '', category_id: '', color: '#3A6432', notes: '' })
    setShowModal(true)
  }

  function openEdit(item: InstallmentWithRelations) {
    setEditing(item)
    reset({ name: item.name, type: item.type, installment_amount: String(item.installment_amount), total_installments: String(item.total_installments), paid_installments: String(item.paid_installments), start_date: item.start_date, due_day: String(item.due_day), account_id: item.account_id || '', category_id: item.category_id || '', color: item.color, notes: item.notes || '' })
    setShowModal(true)
  }

  async function onSubmit(data: FormData) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const insertPayload = {
      household_id: householdId, user_id: userId,
      name: data.name, type: data.type as 'installment' | 'consortium',
      installment_amount: parseFloat(data.installment_amount),
      total_installments: parseInt(data.total_installments),
      paid_installments: parseInt(data.paid_installments || '0'),
      start_date: data.start_date,
      due_day: parseInt(data.due_day || '10'),
      account_id: data.account_id || null,
      category_id: data.category_id || null,
      color: data.color, notes: data.notes || null,
    }
    const updatePayload = {
      name: data.name, type: data.type as 'installment' | 'consortium',
      installment_amount: parseFloat(data.installment_amount),
      total_installments: parseInt(data.total_installments),
      paid_installments: parseInt(data.paid_installments || '0'),
      start_date: data.start_date,
      due_day: parseInt(data.due_day || '10'),
      account_id: data.account_id || null,
      category_id: data.category_id || null,
      color: data.color, notes: data.notes || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = editing
      ? await supabase.from('fin_installments').update(updatePayload).eq('id', editing.id)
      : await supabase.from('fin_installments').insert(insertPayload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(editing ? 'Parcelamento atualizado!' : 'Parcelamento criado!')
    setShowModal(false); load()
  }

  async function markPaid(item: InstallmentWithRelations) {
    const next = item.paid_installments + 1
    const supabase = createClient()
    const status = next >= item.total_installments ? 'completed' : 'active'
    await supabase.from('fin_installments').update({ paid_installments: next, status, updated_at: new Date().toISOString() }).eq('id', item.id)
    toast(status === 'completed' ? '🎉 Parcelamento concluído!' : `Parcela ${next}/${item.total_installments} marcada como paga!`)
    load()
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    await supabase.from('fin_installments').delete().eq('id', id)
    toast('Excluído!', 'info'); setDeleting(null); load()
  }

  const totalMonthlyCommitment = items.reduce((s, i) => s + Number(i.installment_amount), 0)
  const totalRemaining = items.reduce((s, i) => s + (Number(i.installment_amount) * (i.total_installments - i.paid_installments)), 0)

  return (
    <div className="space-y-4">
      {/* ── Erro de schema cache ── */}
      {schemaError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-800">Tabela de parcelamentos não encontrada</p>
            <p className="text-sm text-yellow-700 mt-1">O Supabase ainda não reconhece a tabela <code className="font-mono bg-yellow-100 px-1 rounded">fin_installments</code>. Vá em <strong>Supabase → Project Settings → API → Reload Schema</strong> e recarregue esta página.</p>
          </div>
        </div>
      )}
      {/* ── Resumo ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
          <p className="text-sm text-[#5A7A5A] mb-1">Compromisso mensal</p>
          <p className="text-xl font-bold text-red-500">{formatCurrency(totalMonthlyCommitment)}</p>
          <p className="text-xs text-[#8FAA8F] mt-0.5">{items.length} ativo{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
          <p className="text-sm text-[#5A7A5A] mb-1">Total restante</p>
          <p className="text-xl font-bold text-[#1A2E1A]">{formatCurrency(totalRemaining)}</p>
          <p className="text-xs text-[#8FAA8F] mt-0.5">a pagar no futuro</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={openNew}><Plus size={16} /> Novo parcelamento</Button>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(n => <div key={n} className="bg-white border border-[#E2DECE] rounded-2xl h-28 animate-pulse shadow-sm" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm flex flex-col items-center gap-3 py-14 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center">
            <CreditCard size={26} className="text-[#3A6432]" />
          </div>
          <p className="text-base font-semibold text-[#1A2E1A]">Nenhum parcelamento cadastrado</p>
          <p className="text-sm text-[#8FAA8F]">Registre compras parceladas ou consórcios para controlar seus compromissos futuros.</p>
          <Button onClick={openNew} className="mt-1"><Plus size={15} /> Cadastrar primeiro</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const remaining = item.total_installments - item.paid_installments
            const pct = Math.round((item.paid_installments / item.total_installments) * 100)
            const nextDate = remaining > 0 ? getInstallmentDate(item.start_date, item.due_day, item.paid_installments) : null
            const isExpanded = expanded === item.id

            // Próximas parcelas para previsão
            const futureItems = Array.from({ length: Math.min(remaining, 6) }, (_, i) => {
              const d = getInstallmentDate(item.start_date, item.due_day, item.paid_installments + i)
              return { index: item.paid_installments + i + 1, date: d }
            })

            return (
              <div key={item.id} className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
                {/* Barra de cor no topo */}
                <div className="h-[3px]" style={{ background: item.color }} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color + '18', border: `1.5px solid ${item.color}40` }}>
                      {item.type === 'consortium' ? <Users size={20} style={{ color: item.color }} /> : <CreditCard size={20} style={{ color: item.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-[#1A2E1A] truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: item.color + '18', color: item.color }}>
                          {TYPE_LABELS[item.type]}
                        </span>
                        {item.category && (
                          <span className="text-xs text-[#8FAA8F]">{item.category.name}</span>
                        )}
                        {item.account && (
                          <span className="text-xs text-[#8FAA8F]">· {item.account.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(item.id)} className="p-2 rounded-lg hover:bg-red-50 text-[#8FAA8F] hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Progresso */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold text-[#1A2E1A]">{item.paid_installments}/{item.total_installments} parcelas pagas</span>
                      <span className="font-bold" style={{ color: item.color }}>{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-[#F0EDE6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="grid grid-cols-3 gap-3 text-center py-3 border-y border-[#F0EDE6] mb-3">
                    <div>
                      <p className="text-xs text-[#8FAA8F] mb-0.5">Por mês</p>
                      <p className="text-sm font-bold text-red-500">{formatCurrency(Number(item.installment_amount))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8FAA8F] mb-0.5">Restante</p>
                      <p className="text-sm font-bold text-[#1A2E1A]">{formatCurrency(Number(item.installment_amount) * remaining)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8FAA8F] mb-0.5">Próx. venc.</p>
                      <p className="text-sm font-bold text-[#1A2E1A]">
                        {nextDate ? `${nextDate.getDate()}/${MONTHS[nextDate.getMonth()].slice(0, 3)}` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    {remaining > 0 && (
                      <button
                        onClick={() => markPaid(item)}
                        className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0] text-sm font-semibold text-[#3A6432] hover:bg-[#E0EDD9] transition-colors"
                      >
                        <CheckCircle2 size={15} /> Marcar parcela {item.paid_installments + 1} como paga
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-[#F5F2EC] border border-[#E2DECE] text-sm text-[#5A7A5A] hover:bg-[#EDE8E0] transition-colors"
                    >
                      <CalendarDays size={14} />
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Projeção futura expandida */}
                  {isExpanded && futureItems.length > 0 && (
                    <div className="mt-3 border border-[#E2DECE] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-[#F5F2EC] border-b border-[#E2DECE]">
                        <p className="text-xs font-bold text-[#5A7A5A] uppercase tracking-wide">Próximas parcelas</p>
                      </div>
                      <ul>
                        {futureItems.map((fi, idx) => (
                          <li key={idx} className={`flex items-center justify-between px-4 py-3 ${idx < futureItems.length - 1 ? 'border-b border-[#F5F2EC]' : ''}`}>
                            <div className="flex items-center gap-2.5">
                              <Circle size={14} className="text-[#C5D9C0]" />
                              <div>
                                <p className="text-sm font-semibold text-[#1A2E1A]">Parcela {fi.index}/{item.total_installments}</p>
                                <p className="text-xs text-[#8FAA8F]">
                                  {fi.date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-red-500 tabular-nums">{formatCurrency(Number(item.installment_amount))}</p>
                          </li>
                        ))}
                        {remaining > 6 && (
                          <li className="px-4 py-3 text-center">
                            <p className="text-xs text-[#8FAA8F]">+ {remaining - 6} parcela{remaining - 6 > 1 ? 's' : ''} restante{remaining - 6 > 1 ? 's' : ''}</p>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal criar/editar ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar parcelamento' : 'Novo parcelamento'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {(['installment', 'consortium'] as const).map(t => (
              <button key={t} type="button" onClick={() => setValue('type', t)}
                className={`py-3 rounded-xl text-sm font-bold border transition-all ${watch('type') === t ? 'bg-[#EEF5EB] border-[#3A6432] text-[#3A6432]' : 'border-[#E2DECE] text-[#5A7A5A] bg-white hover:bg-[#F5F2EC]'}`}>
                {t === 'installment' ? '💳 Compra Parcelada' : '🤝 Consórcio'}
              </button>
            ))}
          </div>

          <Input label="Nome" placeholder="Ex: iPhone 15, Consórcio Auto..." {...register('name', { required: true })} />

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="installment_amount"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <CurrencyInput label="Valor da parcela" value={field.value} onChange={field.onChange} />
              )}
            />
            <Input label="Nº de parcelas" type="number" min="1" placeholder="12" {...register('total_installments', { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Início (1ª parcela)" type="date" {...register('start_date', { required: true })} />
            <Input label="Dia do vencimento" type="number" min="1" max="31" placeholder="10" {...register('due_day')} />
          </div>

          {/* Parcelas já pagas — aparece sempre (novo E edição) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[#3A6432]">Quantas parcelas já foram pagas?</label>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => setValue('paid_installments', String(Math.max(0, parseInt(watch('paid_installments') || '0') - 1)))}
                className="w-12 h-12 rounded-xl border border-[#D5CCBE] bg-white text-[#1A2E1A] text-xl font-bold hover:bg-[#EEF5EB] transition-colors flex items-center justify-center">
                −
              </button>
              <div className="flex-1 text-center">
                <p className="text-3xl font-bold text-[#1A2E1A]">{watch('paid_installments') || '0'}</p>
                <p className="text-xs text-[#7A9A7A] mt-0.5">de {watch('total_installments') || '0'} parcelas</p>
              </div>
              <button type="button"
                onClick={() => setValue('paid_installments', String(Math.min(parseInt(watch('total_installments') || '0'), parseInt(watch('paid_installments') || '0') + 1)))}
                className="w-12 h-12 rounded-xl border border-[#D5CCBE] bg-white text-[#1A2E1A] text-xl font-bold hover:bg-[#EEF5EB] transition-colors flex items-center justify-center">
                +
              </button>
            </div>
            <p className="text-xs text-[#7A9A7A]">Se a compra é nova, deixe em 0. Se já pagou algumas parcelas, ajuste aqui.</p>
          </div>

          <Select label="Conta de débito" {...register('account_id')}>
            <option value="">Sem conta específica</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>

          <Select label="Categoria" {...register('category_id')}>
            <option value="">Sem categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          {/* Cor */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[#3A6432]">Cor de identificação</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setValue('color', c)}
                  className={`w-8 h-8 rounded-lg transition-all ${selectedColor === c ? 'ring-2 ring-[#1A2E1A]/40 scale-110 shadow-md' : 'hover:scale-105'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <Input label="Observações (opcional)" placeholder="Detalhes sobre a compra ou consórcio..." {...register('notes')} />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal excluir ── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir parcelamento" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={17} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">Excluir este parcelamento? O histórico será perdido permanentemente.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button onClick={() => deleting && deleteItem(deleting)} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white border-0">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
