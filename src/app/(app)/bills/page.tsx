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
  LayoutList, BarChart2, Repeat, TrendingDown, Target
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface Bill {
  id: string
  user_id: string
  name: string
  type: string
  notes?: string | null
  installment_amount: number
  my_share_amount?: number | null
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

// ── Helpers ────────────────────────────────────────────────────────────
function getMyShare(bill: Bill): number {
  if (bill.my_share_amount != null) return bill.my_share_amount
  if (bill.split_type === 'members') return bill.installment_amount / (bill.split_count || 1)
  return bill.installment_amount
}

function getBillEndDate(bill: Bill): Date | null {
  if (!bill.total_installments) return null
  const start = new Date(bill.start_date + 'T12:00:00')
  return new Date(start.getFullYear(), start.getMonth() + bill.total_installments - 1, bill.due_day)
}

// ── Tipos de parcelamento ──────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  consortium:   'Consórcio',
  installment:  'Parcelamento',
  financing:    'Financiamento',
  subscription: 'Assinatura',
  other:        'Outro',
}

// ── Tipos de contas fixas ──────────────────────────────────────────────
const FIXED_BILL_TYPES = ['agua','luz','gas','internet','condominio','saude','seguro','aluguel','outro_fixo']

const FIXED_TYPE_LABELS: Record<string, string> = {
  agua:       '💧 Água',
  luz:        '⚡ Luz/Energia',
  gas:        '🔥 Gás',
  internet:   '📶 Internet',
  condominio: '🏢 Condomínio',
  saude:      '❤️ Saúde',
  seguro:     '🛡️ Seguro',
  aluguel:    '🏠 Aluguel',
  outro_fixo: '📋 Outro fixo',
}

function isFixed(bill: Bill) { return FIXED_BILL_TYPES.includes(bill.type) }

function billInstallments(bill: Bill): InstallmentRow[] {
  const fixedBill = isFixed(bill)
  const start = new Date(bill.start_date + 'T12:00:00')
  const myShare = getMyShare(bill)

  let startInstNum = 1
  let count = 0

  if (bill.total_installments) {
    count = bill.total_installments
  } else if (bill.until_date) {
    const until = new Date(bill.until_date + 'T12:00:00')
    let d = new Date(start)
    while (d <= until && count < 600) { count++; d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
  } else if (fixedBill) {
    const now = new Date()
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const twelveFwd = new Date(now.getFullYear(), now.getMonth() + 12, 1)
    const fromDate = start > sixAgo ? start : sixAgo
    const firstNum = Math.max(1, (fromDate.getFullYear() - start.getFullYear()) * 12 + (fromDate.getMonth() - start.getMonth()) + 1)
    const lastNum = (twelveFwd.getFullYear() - start.getFullYear()) * 12 + (twelveFwd.getMonth() - start.getMonth())
    startInstNum = firstNum
    count = Math.max(0, lastNum - firstNum + 1)
  } else {
    count = 60
  }

  return Array.from({ length: count }, (_, i) => {
    const num = startInstNum + i
    return {
      number: num,
      dueDate: new Date(start.getFullYear(), start.getMonth() + num - 1, bill.due_day),
      totalAmount: bill.installment_amount,
      myShare,
      isPaid: num <= bill.paid_installments,
    }
  })
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

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const EMPTY_FORM = {
  name: '', notes: '',
  billCategory: 'parcela' as 'parcela' | 'fixa',
  type: 'installment' as string,
  installment_amount: '',
  my_share_amount: '',
  mode: 'installments' as 'installments' | 'until_date',
  total_installments: '',
  until_date: '',
  due_day: '10',
  start_date: new Date().toISOString().split('T')[0],
  split_type: 'personal' as 'personal' | 'members',
}

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
    const fixedBill = isFixed(bill)
    setForm({
      name: bill.name,
      notes: bill.notes || '',
      billCategory: fixedBill ? 'fixa' : 'parcela',
      type: bill.type,
      installment_amount: String(bill.installment_amount),
      my_share_amount: bill.my_share_amount != null ? String(bill.my_share_amount) : '',
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

    const myShareAmt = form.split_type === 'members' && form.my_share_amount
      ? parseFloat(form.my_share_amount) : null

    const payload = {
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      type: form.type,
      installment_amount: parseFloat(form.installment_amount),
      my_share_amount: myShareAmt,
      total_installments: form.billCategory === 'parcela' && form.mode === 'installments' && form.total_installments
        ? parseInt(form.total_installments) : null,
      until_date: form.billCategory === 'parcela' && form.mode === 'until_date' && form.until_date
        ? form.until_date : null,
      due_day: parseInt(form.due_day) || 10,
      start_date: form.start_date,
      split_type: form.split_type,
      split_count: form.split_type === 'members' ? 2 : 1,
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
    if (inst.isPaid) { newPaid = inst.number - 1; toast('Pagamento removido', 'info') }
    else { newPaid = Math.max(bill.paid_installments, inst.number); toast('Pagamento registrado! ✓') }
    const { error } = await db.from('fin_installments')
      .update({ paid_installments: newPaid, updated_at: new Date().toISOString() })
      .eq('id', bill.id)
    if (error) toast(error.message, 'error')
    setTogglingPay(null); load()
  }

  async function deleteBill() {
    if (!deleteTarget) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any).from('fin_installments').update({ status: 'inactive' }).eq('id', deleteTarget.id)
    toast('Conta removida', 'info'); setDeleteTarget(null); load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
    </div>
  )

  const myBills    = bills.filter(b => b.user_id === userId)
  const familyBills = bills.filter(b => b.user_id !== userId)

  // ── Dívida total (só parcelas com prazo definido) ──
  const debtBills = bills.filter(b => !isFixed(b) && b.total_installments && b.user_id === userId)
  const totalDebt = debtBills.reduce((sum, b) => {
    const remaining = Math.max(0, (b.total_installments ?? 0) - b.paid_installments)
    return sum + remaining * getMyShare(b)
  }, 0)
  const latestPayoff = debtBills.reduce((latest: Date | null, b) => {
    const end = getBillEndDate(b)
    if (!end) return latest
    return !latest || end > latest ? end : latest
  }, null)

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

  // ── Render de card de conta ──
  const renderBillCard = (bill: Bill) => {
    const fixedBill = isFixed(bill)
    const myShare   = getMyShare(bill)
    const insts     = billInstallments(bill)
    const paidCount = bill.paid_installments
    const isExpanded = expanded === bill.id
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const nextUnpaid  = insts.find(i => !i.isPaid && i.dueDate >= today)
    const overdueCount = insts.filter(i => !i.isPaid && i.dueDate < today).length
    const canEdit = bill.user_id === userId
    const startDate = new Date(bill.start_date + 'T12:00:00')
    const activeSince = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const hasCustomSplit = bill.split_type === 'members' && bill.my_share_amount != null
    const otherShare = hasCustomSplit
      ? bill.installment_amount - bill.my_share_amount!
      : bill.split_type === 'members'
        ? bill.installment_amount - myShare
        : null

    return (
      <Card key={bill.id} className={overdueCount > 0 ? '!border-red-200' : fixedBill ? '!border-[#C5D9C0]' : ''}>
        <CardContent className="p-0">
          <div className="px-5 pt-5 pb-4">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-[#1A2E1A]">{bill.name}</h3>
                  {fixedBill ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EEF5EB] border border-[#C5D9C0] text-[#3A6432]">
                      {FIXED_TYPE_LABELS[bill.type] || 'Fixa'}
                    </span>
                  ) : bill.type && TYPE_LABELS[bill.type] && (
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
                      <Users size={9} /> dividida
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

            {/* Valor mensal */}
            <div className="flex items-baseline gap-2 mt-2.5">
              <span className="text-xl font-bold text-[#1A2E1A]">
                {formatCurrency(myShare)}<span className="text-xs text-[#8FAA8F] font-normal ml-0.5">/mês</span>
              </span>
              {otherShare !== null && otherShare > 0 && (
                <span className="text-xs text-[#5A7A5A]">
                  total {formatCurrency(bill.installment_amount)} · outra pessoa paga{' '}
                  <span className="font-medium">{formatCurrency(otherShare)}</span>
                  {' '}
                  <span className="text-[#8FAA8F]">({(otherShare / bill.installment_amount * 100).toFixed(0)}%)</span>
                </span>
              )}
            </div>

            {/* Progresso / info de conta fixa */}
            {fixedBill ? (
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#8FAA8F]">Ativa desde <span className="text-[#5A7A5A] font-medium capitalize">{activeSince}</span></p>
                  <p className="text-[11px] text-[#8FAA8F] mt-0.5"><span className="text-[#3A6432] font-semibold">{paidCount}</span> {paidCount === 1 ? 'mês pago' : 'meses pagos'}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#5A7A5A]">
                  <Repeat size={12} className="text-[#8FAA8F]" />
                  <span>Recorrente</span>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                {(() => {
                  const totalCount = insts.length
                  const pct = totalCount > 0 ? (paidCount / totalCount) * 100 : 0
                  return (
                    <>
                      <div className="flex justify-between text-[10px] text-[#8FAA8F] mb-1.5">
                        <span>{paidCount} de {totalCount} parcelas pagas</span>
                        <span>{Math.min(pct, 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-[#EEF5EB] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#3A6432' : '#5A9A52' }} />
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Previsão de quitação — card destaque */}
            {!fixedBill && bill.total_installments && (() => {
              const remainingCount = Math.max(0, bill.total_installments - paidCount)
              const remainingAmount = remainingCount * myShare
              const endDate = getBillEndDate(bill)
              const endStr = endDate
                ? endDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                : null
              if (remainingCount === 0) return (
                <p className="text-xs mt-2.5 font-semibold text-[#3A6432]">✓ Todas as parcelas pagas!</p>
              )
              return (
                <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F5FAF4] border border-[#D8EDD4]">
                  <Target size={15} className="text-[#5A7A5A] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#5A7A5A]">
                      <span className="font-semibold text-[#1A2E1A]">{remainingCount}</span> parcela{remainingCount !== 1 ? 's' : ''} restante{remainingCount !== 1 ? 's' : ''}
                      {endStr && <> · Quita em <span className="font-semibold text-[#3A6432] capitalize">{endStr}</span></>}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-600 shrink-0">{formatCurrency(remainingAmount)}</p>
                </div>
              )
            })()}

            {nextUnpaid && !(!fixedBill && bill.total_installments) && (() => {
              const s = getDueStatus(nextUnpaid.dueDate, false)
              const dateStr = nextUnpaid.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              return (
                <p className={`text-xs mt-2 font-medium ${s.color}`}>
                  {fixedBill ? 'Próximo vencimento' : `Próxima (parcela ${nextUnpaid.number})`}: {dateStr} — {s.label}
                </p>
              )
            })()}
          </div>

          <button onClick={() => setExpanded(isExpanded ? null : bill.id)}
            className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-[#F0EDE6] text-xs text-[#8FAA8F] hover:text-[#3A6432] hover:bg-[#EEF5EB]/50 transition-colors">
            {isExpanded
              ? <><ChevronUp size={13} /> Recolher</>
              : <><ChevronDown size={13} /> {fixedBill ? 'Ver meses' : `Ver ${bill.total_installments ?? insts.length} parcelas`}</>
            }
          </button>

          {isExpanded && (
            <ul className="border-t border-[#F0EDE6]">
              {insts.map(inst => {
                const key = `${bill.id}-${inst.number}`
                const { color, label } = getDueStatus(inst.dueDate, inst.isPaid)
                const fullDate = inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const weekday = inst.dueDate.toLocaleDateString('pt-BR', { weekday: 'long' })
                const monthLabel = inst.dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
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
                      <p className={`text-sm font-medium capitalize ${inst.isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>
                        {fixedBill ? monthLabel : `${inst.number}ª parcela`}
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

  // ── Cálculo dinâmico da divisão no formulário ──
  const totalAmt = parseFloat(form.installment_amount) || 0
  const myShareAmt = parseFloat(form.my_share_amount) || 0
  const otherShareAmt = totalAmt - myShareAmt
  const otherSharePct = totalAmt > 0 && myShareAmt > 0 && myShareAmt < totalAmt
    ? (otherShareAmt / totalAmt * 100).toFixed(1) : null

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
          {/* Card de dívida total */}
          {debtBills.length > 0 && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="px-5 py-4 bg-gradient-to-r from-[#1A2E1A] to-[#2C4A2C]">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={14} className="text-[#8BB88A]" />
                    <p className="text-[11px] font-bold text-[#8BB88A] uppercase tracking-widest">Dívida Ativa Total</p>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold text-white">{formatCurrency(totalDebt)}</p>
                      <p className="text-xs text-[#8BB88A] mt-1">
                        {debtBills.length} financiamento{debtBills.length !== 1 ? 's' : ''}/consórcio{debtBills.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {latestPayoff && (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-[#8BB88A] font-medium">Quitação prevista</p>
                        <p className="text-lg font-bold text-[#C8E6C4] capitalize mt-0.5">
                          {latestPayoff.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Linha por bill */}
                <ul className="divide-y divide-[#F0EDE6]">
                  {debtBills.map(b => {
                    const remaining = Math.max(0, (b.total_installments ?? 0) - b.paid_installments)
                    const remainingAmt = remaining * getMyShare(b)
                    const endDate = getBillEndDate(b)
                    const endStr = endDate
                      ? endDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                      : '—'
                    const pct = b.total_installments
                      ? Math.min((b.paid_installments / b.total_installments) * 100, 100)
                      : 0
                    return (
                      <li key={b.id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <p className="text-xs font-semibold text-[#1A2E1A] truncate">{b.name}</p>
                          <p className="text-xs font-bold text-red-600 shrink-0">{formatCurrency(remainingAmt)}</p>
                        </div>
                        <div className="h-1.5 bg-[#EEF5EB] rounded-full overflow-hidden mb-1">
                          <div className="h-full bg-[#5A9A52] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#8FAA8F]">
                          <span>{b.paid_installments}/{b.total_installments} parcelas</span>
                          <span className="capitalize">quita em {endStr}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {bills.length === 0 && (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                <CalendarClock size={32} className="text-[#C5D9C0]" />
                <p className="text-sm font-medium text-[#5A7A5A]">Nenhuma conta cadastrada</p>
                <p className="text-xs text-[#8FAA8F]">Adicione contas fixas (água, luz, internet) ou parcelamentos</p>
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
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const paidAll   = allEntries.filter(e => e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
              const unpaidAll = allEntries.filter(e => !e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
              return (
                <>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-[#8FAA8F] mb-1">Já pago</p>
                    <p className="text-sm font-bold text-[#3A6432]">{formatCurrency(paidAll)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-[#8FAA8F] mb-1">A pagar</p>
                    <p className="text-sm font-bold text-red-500">{formatCurrency(unpaidAll)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-[#8FAA8F] mb-1">Contas</p>
                    <p className="text-sm font-bold text-[#1A2E1A]">{bills.length}</p>
                  </CardContent></Card>
                </>
              )
            })()}
          </div>

          {monthKeys.map(key => {
            const [year, monthIdx] = key.split('-').map(Number)
            const entries = byMonth[key]
            const isCurrentMonth = key === nowKey
            const isPastMonth = key < nowKey
            const monthTotal = entries.reduce((s, e) => s + e.inst.myShare, 0)
            const monthPaid  = entries.filter(e => e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
            const monthLeft  = monthTotal - monthPaid
            const overdueInMonth = entries.filter(e => !e.inst.isPaid && isPastMonth).length

            return (
              <Card key={key} className={isCurrentMonth ? '!border-[#3A6432]/40 ring-1 ring-[#3A6432]/20' : ''}>
                <CardHeader className={isCurrentMonth ? 'bg-[#EEF5EB]/60' : isPastMonth ? 'bg-[#FAFAF9]' : ''}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1A2E1A]">{MONTH_NAMES[monthIdx]} {year}</h3>
                      {isCurrentMonth && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#3A6432] text-white font-medium">Atual</span>}
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
                    {entries.sort((a, b) => a.inst.dueDate.getTime() - b.inst.dueDate.getTime()).map((entry) => {
                      const { color, bg, border, label } = getDueStatus(entry.inst.dueDate, entry.inst.isPaid)
                      const day = entry.inst.dueDate.getDate()
                      const weekday = entry.inst.dueDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                      const fullDate = entry.inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      const key2 = `${entry.bill.id}-${entry.inst.number}`
                      const fixedEntry = isFixed(entry.bill)
                      return (
                        <li key={key2} className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#F0EDE6] last:border-0 ${entry.inst.isPaid ? 'bg-[#FAFAF9]' : ''}`}>
                          <div className={`w-10 text-center rounded-lg py-1.5 shrink-0 border ${bg} ${border}`}>
                            <p className={`text-sm font-bold leading-none ${color}`}>{String(day).padStart(2, '0')}</p>
                            <p className={`text-[9px] mt-0.5 leading-none capitalize ${color}`}>{weekday}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium truncate ${entry.inst.isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>{entry.bill.name}</p>
                              {fixedEntry && <Repeat size={10} className="text-[#8FAA8F] shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-[#8FAA8F]">
                                {fullDate} · {fixedEntry
                                  ? 'Conta fixa'
                                  : `${entry.inst.number}ª parcela${entry.bill.total_installments ? ` de ${entry.bill.total_installments}` : ''}`
                                }
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${entry.inst.isPaid ? 'text-[#8FAA8F] line-through' : 'text-[#1A2E1A]'}`}>
                              {formatCurrency(entry.inst.myShare)}
                            </p>
                            <p className={`text-xs font-medium ${color}`}>{label}</p>
                          </div>
                          <button onClick={() => togglePayment(entry.bill, entry.inst)} disabled={togglingPay === key2} className="shrink-0 ml-1">
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
            <Card><CardContent className="py-10 text-center"><p className="text-sm text-[#8FAA8F]">Nenhum vencimento encontrado</p></CardContent></Card>
          )}
        </div>
      )}

      {/* ── Modal Nova/Editar conta ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conta' : 'Nova conta'} size="md">
        <div className="p-5 flex flex-col gap-4">

          {/* Categoria */}
          {!editing && (
            <div>
              <p className="text-xs font-semibold text-[#5A7A5A] mb-2">O que é esta conta?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, billCategory: 'parcela', type: 'installment' }))}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-colors ${form.billCategory === 'parcela' ? 'border-[#3A6432] bg-[#EEF5EB] text-[#3A6432]' : 'border-[#E2DECE] bg-white text-[#5A7A5A] hover:border-[#C5D9C0]'}`}>
                  <CalendarClock size={20} />
                  <span className="text-xs font-semibold">Parcelamento</span>
                  <span className="text-[10px] text-center opacity-70">Consórcio, financiamento,<br/>cartão parcelado</span>
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, billCategory: 'fixa', type: 'agua' }))}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-colors ${form.billCategory === 'fixa' ? 'border-[#3A6432] bg-[#EEF5EB] text-[#3A6432]' : 'border-[#E2DECE] bg-white text-[#5A7A5A] hover:border-[#C5D9C0]'}`}>
                  <Repeat size={20} />
                  <span className="text-xs font-semibold">Conta Fixa</span>
                  <span className="text-[10px] text-center opacity-70">Água, luz, internet,<br/>condomínio, aluguel</span>
                </button>
              </div>
            </div>
          )}

          <Input label="Nome da conta"
            placeholder={form.billCategory === 'fixa' ? 'ex: Água SABESP, Luz Enel' : 'ex: Consórcio Honda, Financiamento Caixa'}
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />

          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold text-[#5A7A5A] mb-2">{form.billCategory === 'fixa' ? 'Categoria' : 'Tipo'}</p>
            {form.billCategory === 'fixa' ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(FIXED_TYPE_LABELS).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v }))}
                    className={`py-2 px-1.5 text-xs font-medium rounded-xl border transition-colors text-center ${form.type === v ? 'bg-[#EEF5EB] border-[#C5D9C0] text-[#3A6432]' : 'bg-white border-[#E2DECE] text-[#5A7A5A] hover:border-[#C5D9C0]'}`}>
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(TYPE_LABELS).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v }))}
                    className={`py-2 px-2 text-xs font-medium rounded-xl border transition-colors ${form.type === v ? 'bg-[#EEF5EB] border-[#C5D9C0] text-[#3A6432]' : 'bg-white border-[#E2DECE] text-[#5A7A5A] hover:border-[#C5D9C0]'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Input label="Observação (opcional)" placeholder="ex: Banco Itaú, contrato nº 123"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="grid grid-cols-2 gap-3">
            <Input label={form.billCategory === 'fixa' ? 'Valor total da conta (R$)' : 'Valor total da parcela (R$)'}
              type="number" placeholder="0,00"
              value={form.installment_amount} onChange={e => setForm(f => ({ ...f, installment_amount: e.target.value }))} />
            <Input label="Dia do vencimento" type="number" placeholder="10"
              value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
          </div>

          <Input label={form.billCategory === 'fixa' ? 'Ativa desde' : 'Data da 1ª parcela'}
            type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />

          {/* Duração — só para parcelamentos */}
          {form.billCategory === 'parcela' && (
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
          )}

          {form.billCategory === 'fixa' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0]">
              <Repeat size={14} className="text-[#3A6432] mt-0.5 shrink-0" />
              <p className="text-xs text-[#3A6432]">Conta recorrente sem data de término. Você pode registrar o pagamento todo mês.</p>
            </div>
          )}

          {/* Divisão do valor */}
          {householdId && (
            <div>
              <p className="text-xs font-semibold text-[#5A7A5A] mb-2">Divisão do valor</p>
              <div className="flex rounded-xl overflow-hidden border border-[#E2DECE]">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, split_type: 'personal', my_share_amount: '' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${form.split_type === 'personal' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                  <User size={13} /> Só eu pago
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, split_type: 'members', my_share_amount: '' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-l border-[#E2DECE] ${form.split_type === 'members' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                  <Users size={13} /> Dividir
                </button>
              </div>

              {form.split_type === 'members' && (
                <div className="mt-3 space-y-2">
                  <Input
                    label="Minha parte (R$)"
                    type="number"
                    placeholder={totalAmt > 0 ? `ex: ${(totalAmt / 2).toFixed(2)}` : '0,00'}
                    value={form.my_share_amount}
                    onChange={e => setForm(f => ({ ...f, my_share_amount: e.target.value }))}
                  />
                  {otherSharePct && otherShareAmt > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F5F2EE] border border-[#E2DECE]">
                      <div>
                        <p className="text-xs text-[#5A7A5A] font-medium">Outra pessoa paga</p>
                        <p className="text-[11px] text-[#8FAA8F] mt-0.5">
                          {otherSharePct}% do total
                        </p>
                      </div>
                      <p className="text-lg font-bold text-[#1A2E1A]">{formatCurrency(otherShareAmt)}</p>
                    </div>
                  )}
                  {myShareAmt > 0 && totalAmt > 0 && (
                    <p className="text-[11px] text-[#8FAA8F] text-center">
                      Você paga <span className="font-semibold text-[#3A6432]">{(myShareAmt / totalAmt * 100).toFixed(1)}%</span> do total de {formatCurrency(totalAmt)}
                    </p>
                  )}
                </div>
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
