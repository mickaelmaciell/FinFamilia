'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  Plus, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Trash2, Pencil, Users, User, CalendarClock, AlertCircle,
  LayoutList, BarChart2
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface Bill {
  id: string
  user_id: string
  name: string
  type: string
  notes?: string | null
  installment_amount: number
  total_installments: number | null
  paid_installments: number
  until_date?: string | null
  due_day: number
  start_date: string
  split_type: 'personal' | 'members'
  split_count: number
  household_id?: string | null
  status: string
}

interface InstallmentRow {
  number: number
  dueDate: Date
  totalAmount: number
  myShare: number
  isPaid: boolean
}

function billInstallments(bill: Bill): InstallmentRow[] {
  const start = new Date(bill.start_date + 'T12:00:00')
  const myShare = bill.split_type === 'members'
    ? bill.installment_amount / (bill.split_count || 1)
    : bill.installment_amount

  let count = 0
  if (bill.total_installments) {
    count = bill.total_installments
  } else if (bill.until_date) {
    const until = new Date(bill.until_date + 'T12:00:00')
    let d = new Date(start)
    while (d <= until && count < 600) { count++; d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
  } else {
    count = 60 // padrão 5 anos se não informado
  }

  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    dueDate: new Date(start.getFullYear(), start.getMonth() + i, bill.due_day),
    totalAmount: bill.installment_amount,
    myShare,
    isPaid: (i + 1) <= bill.paid_installments,
  }))
}

function getDueStatus(dueDate: Date, isPaid: boolean) {
  if (isPaid) return { color: 'text-[#3A6432]', bg: 'bg-[#EEF5EB]', border: 'border-[#C5D9C0]', label: 'Pago' }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dueDate); d.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: `Atrasado ${Math.abs(diff)}d` }
  if (diff === 0) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Hoje!' }
  if (diff <= 5) return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', label: `${diff}d` }
  return { color: 'text-[#5A7A5A]', bg: 'bg-[#F5F2EE]', border: 'border-[#E2DECE]', label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
}

const TYPE_LABELS: Record<string, string> = {
  consortium: 'Consórcio',
  installment: 'Parcelamento',
  financing: 'Financiamento',
  subscription: 'Assinatura',
  other: 'Outro',
}

const EMPTY_FORM = {
  name: '', notes: '',
  type: 'installment' as string,
  installment_amount: '',
  mode: 'installments' as 'installments' | 'until_date',
  total_installments: '',
  until_date: '',
  due_day: '10',
  start_date: new Date().toISOString().split('T')[0],
  split_type: 'personal' as 'personal' | 'members',
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function BillsPage() {
  const { toast } = useToast()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'contas' | 'relatorio'>('contas')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(1)
  const [togglingPay, setTogglingPay] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: mem } = await supabase.from('household_members')
      .select('household_id').eq('user_id', user.id).single()
    const hid = mem?.household_id ?? null
    setHouseholdId(hid)
    if (hid) {
      const { data: mems } = await supabase.from('household_members').select('id').eq('household_id', hid)
      setMemberCount(mems?.length ?? 1)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: billsData } = await db
      .from('fin_installments')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    setBills(billsData || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setForm({ ...EMPTY_FORM }); setShowModal(true) }
  function openEdit(bill: Bill) {
    setEditing(bill)
    setForm({
      name: bill.name,
      notes: bill.notes || '',
      type: bill.type,
      installment_amount: String(bill.installment_amount),
      mode: bill.total_installments ? 'installments' : 'until_date',
      total_installments: String(bill.total_installments || ''),
      until_date: bill.until_date || '',
      due_day: String(bill.due_day),
      start_date: bill.start_date,
      split_type: bill.split_type,
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim() || !form.installment_amount) return
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    const payload = {
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      type: form.type,
      installment_amount: parseFloat(form.installment_amount),
      total_installments: form.mode === 'installments' && form.total_installments
        ? parseInt(form.total_installments) : null,
      until_date: form.mode === 'until_date' && form.until_date ? form.until_date : null,
      due_day: parseInt(form.due_day) || 10,
      start_date: form.start_date,
      split_type: form.split_type,
      split_count: form.split_type === 'members' ? memberCount : 1,
      updated_at: new Date().toISOString(),
    }

    if (editing) {
      const { error } = await db.from('fin_installments').update(payload).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta atualizada!')
    } else {
      const { error } = await db.from('fin_installments').insert({
        ...payload,
        user_id: userId,
        household_id: householdId || null,
        paid_installments: 0,
        status: 'active',
      })
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta adicionada!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function togglePayment(bill: Bill, inst: InstallmentRow) {
    const key = `${bill.id}-${inst.number}`
    setTogglingPay(key)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any

    let newPaid: number
    if (inst.isPaid) {
      // Desmarcar: volta para a parcela anterior
      newPaid = inst.number - 1
      toast('Pagamento removido', 'info')
    } else {
      // Marcar paga: avança o contador
      newPaid = Math.max(bill.paid_installments, inst.number)
      toast('Parcela marcada como paga! ✓')
    }

    const { error } = await db.from('fin_installments')
      .update({ paid_installments: newPaid, updated_at: new Date().toISOString() })
      .eq('id', bill.id)

    if (error) toast(error.message, 'error')
    setTogglingPay(null)
    load()
  }

  async function deleteBill() {
    if (!deleteTarget) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any)
      .from('fin_installments')
      .update({ status: 'inactive' })
      .eq('id', deleteTarget.id)
    toast('Conta removida', 'info')
    setDeleteTarget(null)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
    </div>
  )

  const myBills = bills.filter(b => b.user_id === userId)
  const familyBills = bills.filter(b => b.user_id !== userId)

  // ── Relatório: todos os vencimentos agrupados por mês ──
  interface ReportEntry { bill: Bill; inst: InstallmentRow }
  const allEntries: ReportEntry[] = bills.flatMap(bill =>
    billInstallments(bill).map(inst => ({ bill, inst }))
  )
  allEntries.sort((a, b) => a.inst.dueDate.getTime() - b.inst.dueDate.getTime())

  const byMonth: Record<string, ReportEntry[]> = {}
  allEntries.forEach(entry => {
    const key = `${entry.inst.dueDate.getFullYear()}-${String(entry.inst.dueDate.getMonth()).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(entry)
  })
  const monthKeys = Object.keys(byMonth).sort()
  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, '0')}`

  const renderBillCard = (bill: Bill) => {
    const insts = billInstallments(bill)
    const paidCount = bill.paid_installments
    const totalCount = insts.length
    const pct = totalCount > 0 ? (paidCount / totalCount) * 100 : 0
    const myShare = bill.split_type === 'members'
      ? bill.installment_amount / (bill.split_count || 1)
      : bill.installment_amount
    const remaining = (totalCount - paidCount) * myShare
    const isExpanded = expanded === bill.id
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const nextUnpaid = insts.find(i => !i.isPaid && i.dueDate >= today)
    const overdueCount = insts.filter(i => !i.isPaid && i.dueDate < today).length
    const canEdit = bill.user_id === userId

    return (
      <Card key={bill.id} className={overdueCount > 0 ? '!border-red-200' : ''}>
        <CardContent className="p-0">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-[#1A2E1A]">{bill.name}</h3>
                  {bill.type && TYPE_LABELS[bill.type] && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#F5F2EE] border border-[#E2DECE] text-[#5A7A5A]">
                      {TYPE_LABELS[bill.type]}
                    </span>
                  )}
                  {overdueCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600">
                      <AlertCircle size={9} /> {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {bill.split_type === 'members' && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600">
                      <Users size={9} /> ÷{bill.split_count}
                    </span>
                  )}
                  {!canEdit && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-600">
                      <Users size={9} /> família
                    </span>
                  )}
                </div>
                {bill.notes && <p className="text-xs text-[#8FAA8F] mt-0.5 truncate">{bill.notes}</p>}
              </div>
              {canEdit && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => openEdit(bill)} className="p-1.5 rounded-lg hover:bg-[#EEF5EB] text-[#8FAA8F] hover:text-[#3A6432] transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(bill)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#8FAA8F] hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-2.5">
              <span className="text-xl font-bold text-[#1A2E1A]">
                {formatCurrency(myShare)}<span className="text-xs text-[#8FAA8F] font-normal ml-0.5">/mês</span>
              </span>
              {bill.split_type === 'members' && (
                <span className="text-xs text-[#8FAA8F]">total {formatCurrency(bill.installment_amount)} ÷ {bill.split_count}</span>
              )}
              <span className="ml-auto text-xs font-medium text-[#5A7A5A]">{formatCurrency(remaining)} restante</span>
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-[#8FAA8F] mb-1.5">
                <span>{paidCount} de {totalCount} parcelas pagas</span>
                <span>{Math.min(pct, 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-[#EEF5EB] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#3A6432' : '#5A9A52' }} />
              </div>
            </div>

            {nextUnpaid && (() => {
              const s = getDueStatus(nextUnpaid.dueDate, false)
              const dateStr = nextUnpaid.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              return <p className={`text-xs mt-2 font-medium ${s.color}`}>Próxima: {dateStr} (parcela {nextUnpaid.number}) — {s.label}</p>
            })()}
            {paidCount >= totalCount && totalCount > 0 && (
              <p className="text-xs mt-2 font-medium text-[#3A6432]">✓ Todas as parcelas pagas!</p>
            )}
          </div>

          <button
            onClick={() => setExpanded(isExpanded ? null : bill.id)}
            className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-[#F0EDE6] text-xs text-[#8FAA8F] hover:text-[#3A6432] hover:bg-[#EEF5EB]/50 transition-colors"
          >
            {isExpanded ? <><ChevronUp size={13} /> Recolher</> : <><ChevronDown size={13} /> Ver {totalCount} parcelas</>}
          </button>

          {isExpanded && (
            <ul className="border-t border-[#F0EDE6]">
              {insts.map(inst => {
                const key = `${bill.id}-${inst.number}`
                const { color, label } = getDueStatus(inst.dueDate, inst.isPaid)
                const fullDate = inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const weekday = inst.dueDate.toLocaleDateString('pt-BR', { weekday: 'long' })
                return (
                  <li key={inst.number} className={`flex items-center gap-3 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0 ${inst.isPaid ? 'bg-[#FAFAF9]' : ''}`}>
                    <button onClick={() => togglePayment(bill, inst)} disabled={togglingPay === key} className="shrink-0">
                      {togglingPay === key
                        ? <div className="w-5 h-5 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
                        : inst.isPaid
                          ? <CheckCircle2 size={20} className="text-[#3A6432]" />
                          : <Circle size={20} className="text-[#C5D9C0] hover:text-[#3A6432] transition-colors" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${inst.isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>
                        {inst.number}ª parcela
                      </p>
                      <p className="text-xs text-[#8FAA8F]">{fullDate} · <span className="capitalize">{weekday}</span></p>
                      <p className={`text-xs font-medium ${color}`}>{label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${inst.isPaid ? 'text-[#8FAA8F] line-through' : 'text-[#1A2E1A]'}`}>
                        {formatCurrency(inst.myShare)}
                      </p>
                      {bill.split_type === 'members' && <p className="text-[10px] text-[#8FAA8F]">de {formatCurrency(inst.totalAmount)}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-3">

      {/* Ações */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#8FAA8F]">{bills.length} conta{bills.length !== 1 ? 's' : ''} ativa{bills.length !== 1 ? 's' : ''}</p>
        <Button onClick={openNew} size="sm"><Plus size={14} /> Nova conta</Button>
      </div>

      {/* Tabs */}
      {bills.length > 0 && (
        <div className="flex rounded-xl overflow-hidden border border-[#E2DECE] bg-white">
          <button onClick={() => setTab('contas')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${tab === 'contas' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
            <LayoutList size={14} /> Contas
          </button>
          <button onClick={() => setTab('relatorio')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-l border-[#E2DECE] ${tab === 'relatorio' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
            <BarChart2 size={14} /> Relatório
          </button>
        </div>
      )}

      {/* ── TAB: CONTAS ── */}
      {tab === 'contas' && (
        <>
          {bills.length === 0 && (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                <CalendarClock size={32} className="text-[#C5D9C0]" />
                <p className="text-sm font-medium text-[#5A7A5A]">Nenhuma conta cadastrada</p>
                <p className="text-xs text-[#8FAA8F]">Adicione financiamentos, consórcios ou qualquer conta parcelada</p>
                <Button onClick={openNew} size="sm" className="mt-1"><Plus size={14} /> Adicionar conta</Button>
              </CardContent>
            </Card>
          )}

          {/* Minhas contas */}
          {myBills.length > 0 && (
            <div className="space-y-3">
              {myBills.length < bills.length && (
                <div className="flex items-center gap-2">
                  <User size={13} className="text-[#8FAA8F]" />
                  <p className="text-xs font-semibold text-[#8FAA8F] uppercase tracking-wide">Minhas contas</p>
                </div>
              )}
              {myBills.map(bill => renderBillCard(bill))}
            </div>
          )}

          {/* Contas da família */}
          {familyBills.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mt-2">
                <Users size={13} className="text-[#8FAA8F]" />
                <p className="text-xs font-semibold text-[#8FAA8F] uppercase tracking-wide">Contas da família</p>
              </div>
              {familyBills.map(bill => renderBillCard(bill))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: RELATÓRIO ── */}
      {tab === 'relatorio' && (
        <div className="space-y-4">
          {/* Resumo geral */}
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const totalAll = allEntries.reduce((s, e) => s + e.inst.myShare, 0)
              const paidAll = allEntries.filter(e => e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
              const leftAll = totalAll - paidAll
              return (
                <>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-[#8FAA8F] mb-1">Total geral</p>
                    <p className="text-sm font-bold text-[#1A2E1A]">{formatCurrency(totalAll)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-[#8FAA8F] mb-1">Já pago</p>
                    <p className="text-sm font-bold text-[#3A6432]">{formatCurrency(paidAll)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-[#8FAA8F] mb-1">Ainda deve</p>
                    <p className="text-sm font-bold text-red-500">{formatCurrency(leftAll)}</p>
                  </CardContent></Card>
                </>
              )
            })()}
          </div>

          {/* Por mês */}
          {monthKeys.map(key => {
            const [year, monthIdx] = key.split('-').map(Number)
            const entries = byMonth[key]
            const isCurrentMonth = key === nowKey
            const isPastMonth = key < nowKey
            const monthTotal = entries.reduce((s, e) => s + e.inst.myShare, 0)
            const monthPaid = entries.filter(e => e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
            const monthLeft = monthTotal - monthPaid
            const overdueInMonth = entries.filter(e => !e.inst.isPaid && isPastMonth).length

            return (
              <Card key={key} className={isCurrentMonth ? '!border-[#3A6432]/40 ring-1 ring-[#3A6432]/20' : ''}>
                <CardHeader className={isCurrentMonth ? 'bg-[#EEF5EB]/60' : isPastMonth ? 'bg-[#FAFAF9]' : ''}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1A2E1A]">{MONTH_NAMES[monthIdx]} {year}</h3>
                      {isCurrentMonth && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#3A6432] text-white font-medium">Atual</span>
                      )}
                      {overdueInMonth > 0 && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600">
                          <AlertCircle size={9} /> {overdueInMonth}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {monthPaid > 0 && <span className="text-[11px] text-[#3A6432]">{formatCurrency(monthPaid)} pago</span>}
                      {monthLeft > 0 && <span className="text-[11px] text-red-500 font-medium">{formatCurrency(monthLeft)} a pagar</span>}
                      {monthLeft === 0 && monthPaid > 0 && <span className="text-[11px] text-[#3A6432] font-medium">✓ Mês quitado</span>}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#1A2E1A] shrink-0">{formatCurrency(monthTotal)}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <ul>
                    {entries
                      .sort((a, b) => a.inst.dueDate.getTime() - b.inst.dueDate.getTime())
                      .map((entry) => {
                        const { color, bg, border, label } = getDueStatus(entry.inst.dueDate, entry.inst.isPaid)
                        const day = entry.inst.dueDate.getDate()
                        const weekday = entry.inst.dueDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                        const fullDate = entry.inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        const key2 = `${entry.bill.id}-${entry.inst.number}`
                        return (
                          <li key={key2} className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#F0EDE6] last:border-0 ${entry.inst.isPaid ? 'bg-[#FAFAF9]' : ''}`}>
                            <div className={`w-10 text-center rounded-lg py-1.5 shrink-0 border ${bg} ${border}`}>
                              <p className={`text-sm font-bold leading-none ${color}`}>{String(day).padStart(2, '0')}</p>
                              <p className={`text-[9px] mt-0.5 leading-none capitalize ${color}`}>{weekday}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${entry.inst.isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>
                                {entry.bill.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-[#8FAA8F]">{fullDate} · {entry.inst.number}ª parcela</span>
                                {entry.bill.split_type === 'members' && (
                                  <span className="text-[10px] text-blue-500">÷{entry.bill.split_count}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-semibold ${entry.inst.isPaid ? 'text-[#8FAA8F] line-through' : 'text-[#1A2E1A]'}`}>
                                {formatCurrency(entry.inst.myShare)}
                              </p>
                              <p className={`text-xs font-medium ${color}`}>{label}</p>
                            </div>
                            <button
                              onClick={() => togglePayment(entry.bill, entry.inst)}
                              disabled={togglingPay === key2}
                              className="shrink-0 ml-1"
                            >
                              {togglingPay === key2
                                ? <div className="w-5 h-5 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
                                : entry.inst.isPaid
                                  ? <CheckCircle2 size={18} className="text-[#3A6432]" />
                                  : <Circle size={18} className="text-[#C5D9C0] hover:text-[#3A6432] transition-colors" />
                              }
                            </button>
                          </li>
                        )
                      })}
                  </ul>
                </CardContent>
              </Card>
            )
          })}

          {monthKeys.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-[#8FAA8F]">Nenhum vencimento encontrado</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modal adicionar/editar */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conta' : 'Nova conta a pagar'} size="md">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Nome da conta" placeholder="ex: Consórcio Honda, Financiamento Caixa"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />

          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold text-[#5A7A5A] mb-2">Tipo</p>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(TYPE_LABELS).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v }))}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border transition-colors ${
                    form.type === v ? 'bg-[#EEF5EB] border-[#C5D9C0] text-[#3A6432]' : 'bg-white border-[#E2DECE] text-[#5A7A5A] hover:border-[#C5D9C0]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Input label="Observação (opcional)" placeholder="ex: Banco Itaú, HONDA"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor da parcela (R$)" type="number" placeholder="0,00"
              value={form.installment_amount} onChange={e => setForm(f => ({ ...f, installment_amount: e.target.value }))} />
            <Input label="Dia do vencimento" type="number" placeholder="10"
              value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
          </div>

          <Input label="Data da 1ª parcela" type="date"
            value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />

          <div>
            <p className="text-xs font-semibold text-[#5A7A5A] mb-2">Duração</p>
            <div className="flex rounded-xl overflow-hidden border border-[#E2DECE]">
              <button type="button" onClick={() => setForm(f => ({ ...f, mode: 'installments' }))}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${form.mode === 'installments' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                Nº de parcelas
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, mode: 'until_date' }))}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors border-l border-[#E2DECE] ${form.mode === 'until_date' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                Até uma data
              </button>
            </div>
            <div className="mt-2">
              {form.mode === 'installments'
                ? <Input label="Número de parcelas" type="number" placeholder="ex: 75"
                    value={form.total_installments} onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))} />
                : <Input label="Pagar até" type="date"
                    value={form.until_date} onChange={e => setForm(f => ({ ...f, until_date: e.target.value }))} />
              }
            </div>
          </div>

          {householdId && memberCount > 1 && (
            <div>
              <p className="text-xs font-semibold text-[#5A7A5A] mb-2">Divisão</p>
              <div className="flex rounded-xl overflow-hidden border border-[#E2DECE]">
                <button type="button" onClick={() => setForm(f => ({ ...f, split_type: 'personal' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${form.split_type === 'personal' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                  <User size={13} /> Só eu
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, split_type: 'members' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-l border-[#E2DECE] ${form.split_type === 'members' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                  <Users size={13} /> Dividir ({memberCount})
                </button>
              </div>
              {form.split_type === 'members' && form.installment_amount && (
                <p className="text-xs text-[#5A7A5A] mt-1.5 text-center">
                  Cada pessoa paga <span className="font-semibold text-[#3A6432]">{formatCurrency(parseFloat(form.installment_amount) / memberCount)}</span>/mês
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={save} loading={saving} disabled={!form.name.trim() || !form.installment_amount} className="flex-1">
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover conta" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-[#5A7A5A]">
            Tem certeza que deseja remover <span className="font-semibold text-[#1A2E1A]">{deleteTarget?.name}</span>?
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button onClick={deleteBill} className="flex-1 !bg-red-500 hover:!bg-red-600">Remover</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
