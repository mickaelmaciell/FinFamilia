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

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface Bill {
  id: string
  user_id: string
  name: string
  type: string
  notes?: string | null
  installment_amount: number
  my_share_amount?: number | null
  split_with_user_id?: string | null
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

interface HouseholdMember {
  id: string
  name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de valor
// ─────────────────────────────────────────────────────────────────────────────

/** Parcela do dono da conta */
function getOwnerShare(bill: Bill): number {
  if (bill.my_share_amount != null) return bill.my_share_amount
  if (bill.split_type === 'members') return bill.installment_amount / (bill.split_count || 1)
  return bill.installment_amount
}

/** Parcela do viewer (pode ser o dono ou um familiar) */
function getViewerShare(bill: Bill, viewerId: string): number {
  const isOwner = bill.user_id === viewerId
  if (bill.my_share_amount != null) {
    return isOwner
      ? bill.my_share_amount
      : Math.max(0, bill.installment_amount - bill.my_share_amount)
  }
  if (bill.split_type === 'members') return bill.installment_amount / (bill.split_count || 1)
  return bill.installment_amount
}

function getBillEndDate(bill: Bill): Date | null {
  if (!bill.total_installments) return null
  const start = new Date(bill.start_date + 'T12:00:00')
  return new Date(start.getFullYear(), start.getMonth() + bill.total_installments - 1, bill.due_day)
}

/** Aceita "1.234,56" ou "1234.56" → número */
function parseMoney(raw: string): number {
  // Remove separadores de milhar (ponto antes de vírgula), troca vírgula por ponto
  const cleaned = raw.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de tipos
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  consortium:   'Consórcio',
  installment:  'Parcelamento',
  financing:    'Financiamento',
  subscription: 'Assinatura',
  other:        'Outro',
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Geração de parcelas
// ─────────────────────────────────────────────────────────────────────────────
function billInstallments(bill: Bill, viewerId: string): InstallmentRow[] {
  const fixedBill = isFixed(bill)
  const myShare = getViewerShare(bill, viewerId)
  const start = new Date(bill.start_date + 'T12:00:00')

  let startNum = 1
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
    startNum = firstNum
    count = Math.max(0, lastNum - firstNum + 1)
  } else {
    count = 60
  }

  return Array.from({ length: count }, (_, i) => {
    const num = startNum + i
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
  if (diff < 0)  return { color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200',    label: `Atrasado ${Math.abs(diff)}d` }
  if (diff === 0) return { color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200',  label: 'Hoje!' }
  if (diff <= 5)  return { color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-100',  label: `${diff}d` }
  return { color: 'text-[#5A7A5A]', bg: 'bg-[#F5F2EE]', border: 'border-[#E2DECE]', label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ─────────────────────────────────────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', notes: '',
  billCategory: 'parcela' as 'parcela' | 'fixa',
  type: 'installment' as string,
  installment_amount: '',
  my_share_amount: '',
  /**
   * inputMode controla como o usuário informa os valores quando billCategory='parcela'
   * e total_installments > 1:
   *   'perInstallment' → os campos mostram o valor por parcela (armazenado diretamente)
   *   'total'          → os campos mostram o total da compra (dividido por nº parcelas ao salvar)
   */
  inputMode: 'perInstallment' as 'perInstallment' | 'total',
  mode: 'installments' as 'installments' | 'until_date',
  total_installments: '',
  until_date: '',
  due_day: '10',
  start_date: new Date().toISOString().split('T')[0],
  split_type: 'personal' as 'personal' | 'members',
  splitWithUserId: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────
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
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [togglingPay, setTogglingPay] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null)

  // ── Carregar dados ────────────────────────────────────────────────────────
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: mems } = await (supabase as any)
        .from('household_members')
        .select('user_id, profiles:profiles(full_name)')
        .eq('household_id', hid)
      setHouseholdMembers((mems || []).map((m: { user_id: string; profiles: { full_name: string } | null }) => ({
        id: m.user_id,
        name: m.profiles?.full_name || 'Familiar',
      })))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: billsData } = await (supabase as any)
      .from('fin_installments')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    setBills(billsData || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Abrir modal ───────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(bill: Bill) {
    setEditing(bill)
    setForm({
      name: bill.name,
      notes: bill.notes || '',
      billCategory: isFixed(bill) ? 'fixa' : 'parcela',
      type: bill.type,
      installment_amount: String(bill.installment_amount).replace('.', ','),
      my_share_amount: bill.my_share_amount != null ? String(bill.my_share_amount).replace('.', ',') : '',
      inputMode: 'perInstallment' as 'perInstallment' | 'total', // ao editar, já está em valor por parcela
      mode: bill.total_installments ? 'installments' : 'until_date',
      total_installments: String(bill.total_installments || ''),
      until_date: bill.until_date || '',
      due_day: String(bill.due_day),
      start_date: bill.start_date,
      split_type: bill.split_type,
      splitWithUserId: bill.split_with_user_id || '',
    })
    setShowModal(true)
  }

  // ── Salvar conta ──────────────────────────────────────────────────────────
  async function save() {
    if (!form.name.trim() || !form.installment_amount) return
    setSaving(true)

    const numParcelas = parseInt(form.total_installments) || 1
    // Verifica se o usuário informou os valores como totais da compra (não por parcela)
    const isInputTotal = form.inputMode === 'total'
      && form.billCategory === 'parcela'
      && form.mode === 'installments'
      && numParcelas > 1

    // Sempre armazenar valor por parcela
    const totalInstAmt = isInputTotal
      ? parseMoney(form.installment_amount) / numParcelas
      : parseMoney(form.installment_amount)

    // Calcular my_share_amount (sempre em valor por parcela)
    let mySharePerInst: number | null = null
    if (form.split_type === 'members' && form.my_share_amount) {
      const inputAmt = parseMoney(form.my_share_amount)
      mySharePerInst = isInputTotal ? inputAmt / numParcelas : inputAmt
    }

    const payload = {
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      type: form.type,
      installment_amount: totalInstAmt,
      my_share_amount: mySharePerInst,
      split_with_user_id: form.split_type === 'members' && form.splitWithUserId ? form.splitWithUserId : null,
      total_installments: form.billCategory === 'parcela' && form.mode === 'installments' && form.total_installments
        ? parseInt(form.total_installments) : null,
      until_date: form.billCategory === 'parcela' && form.mode === 'until_date' && form.until_date
        ? form.until_date : null,
      due_day: parseInt(form.due_day) || 10,
      start_date: form.start_date,
      split_type: form.split_type,
      split_count: 2,
      updated_at: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    if (editing) {
      const { error } = await db.from('fin_installments').update(payload).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta atualizada!')
    } else {
      const { error } = await db.from('fin_installments').insert({
        ...payload, user_id: userId, household_id: householdId || null,
        paid_installments: 0, status: 'active',
      })
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta adicionada!')
    }
    setSaving(false); setShowModal(false); load()
  }

  // ── Marcar pagamento ──────────────────────────────────────────────────────
  async function togglePayment(bill: Bill, inst: InstallmentRow) {
    const key = `${bill.id}-${inst.number}`
    setTogglingPay(key)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    const newPaid = inst.isPaid
      ? (toast('Pagamento removido', 'info'), inst.number - 1)
      : (toast('Pagamento registrado! ✓'), Math.max(bill.paid_installments, inst.number))
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
    </div>
  )

  // ── Dados derivados ───────────────────────────────────────────────────────
  const myBills     = bills.filter(b => b.user_id === userId)
  const familyBills = bills.filter(b => b.user_id !== userId)

  const debtBills = myBills.filter(b => !isFixed(b) && b.total_installments)
  const totalDebt = debtBills.reduce((sum, b) => {
    const remaining = Math.max(0, (b.total_installments ?? 0) - b.paid_installments)
    return sum + remaining * getOwnerShare(b)
  }, 0)
  const latestPayoff = debtBills.reduce((latest: Date | null, b) => {
    const end = getBillEndDate(b); if (!end) return latest
    return !latest || end > latest ? end : latest
  }, null)

  const otherMembers = householdMembers.filter(m => m.id !== userId)

  // Relatório
  interface ReportEntry { bill: Bill; inst: InstallmentRow }
  const allEntries: ReportEntry[] = bills.flatMap(b => billInstallments(b, userId).map(inst => ({ bill: b, inst })))
  allEntries.sort((a, b) => a.inst.dueDate.getTime() - b.inst.dueDate.getTime())
  const byMonth: Record<string, ReportEntry[]> = {}
  allEntries.forEach(({ bill: b, inst }) => {
    const key = `${inst.dueDate.getFullYear()}-${String(inst.dueDate.getMonth()).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push({ bill: b, inst })
  })
  const monthKeys = Object.keys(byMonth).sort()
  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, '0')}`

  // ── Cálculos do formulário (tempo-real) ───────────────────────────────────
  const formInputInstAmt  = parseMoney(form.installment_amount)  // raw input (pode ser total ou por parcela)
  const formMyShareInput  = parseMoney(form.my_share_amount)     // raw input (idem)
  const formNumParcelas   = parseInt(form.total_installments) || 1
  // Mostrar toggle de modo apenas quando fizer sentido (parcelamento com N>1 parcelas)
  const showInputMode     = form.billCategory === 'parcela' && form.mode === 'installments' && formNumParcelas > 1
  const isInputTotal      = form.inputMode === 'total' && showInputMode

  // Converter para valor por parcela (base de todos os cálculos)
  const perInstAmt   = isInputTotal ? formInputInstAmt / formNumParcelas : formInputInstAmt
  const myPerInst    = isInputTotal ? formMyShareInput / formNumParcelas : formMyShareInput
  const myTotal      = myPerInst * formNumParcelas
  const otherPerInst = perInstAmt > 0 ? Math.max(0, perInstAmt - myPerInst) : 0
  const otherTotal   = otherPerInst * formNumParcelas
  const myPct        = perInstAmt > 0 && myPerInst > 0 ? (myPerInst / perInstAmt * 100) : 0
  const otherPct     = 100 - myPct
  const showCalc     = form.split_type === 'members' && perInstAmt > 0 && formMyShareInput > 0 && myPerInst < perInstAmt && myPerInst > 0

  // ── Renderizar card de conta ──────────────────────────────────────────────
  const renderBillCard = (bill: Bill) => {
    const fixedBill   = isFixed(bill)
    const myShare     = getViewerShare(bill, userId)
    const insts       = billInstallments(bill, userId)
    const paidCount   = bill.paid_installments
    const isExpanded  = expanded === bill.id
    const today       = new Date(); today.setHours(0, 0, 0, 0)
    const nextUnpaid  = insts.find(i => !i.isPaid && i.dueDate >= today)
    const overdueCount = insts.filter(i => !i.isPaid && i.dueDate < today).length
    const canEdit     = bill.user_id === userId
    const isOwner     = bill.user_id === userId
    const startDate   = new Date(bill.start_date + 'T12:00:00')
    const activeSince = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    // Info de divisão para exibir no card
    const hasSplit     = bill.split_type === 'members'
    const ownerShare   = getOwnerShare(bill)
    const otherShare   = hasSplit ? Math.max(0, bill.installment_amount - ownerShare) : 0
    const splitPartner = bill.split_with_user_id
      ? householdMembers.find(m => m.id === (isOwner ? bill.split_with_user_id : bill.user_id))
      : null
    const partnerName  = splitPartner?.name ?? (hasSplit ? 'familiar' : '')

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
                      {FIXED_TYPE_LABELS[bill.type] ?? 'Fixa'}
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
                  {hasSplit && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600">
                      <Users size={9} /> dividida{partnerName ? ` com ${partnerName}` : ''}
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

            {/* Valor */}
            <div className="flex items-baseline gap-2 mt-2.5 flex-wrap">
              <span className="text-xl font-bold text-[#1A2E1A]">
                {formatCurrency(myShare)}<span className="text-xs text-[#8FAA8F] font-normal ml-0.5">/mês</span>
              </span>
              {hasSplit && otherShare > 0 && (
                <span className="text-xs text-[#5A7A5A]">
                  total {formatCurrency(bill.installment_amount)} ·{' '}
                  {isOwner
                    ? <>{partnerName || 'outra pessoa'} paga <span className="font-medium">{formatCurrency(otherShare)}</span> <span className="text-[#8FAA8F]">({(otherShare / bill.installment_amount * 100).toFixed(0)}%)</span></>
                    : <>{partnerName || 'outra pessoa'} paga <span className="font-medium">{formatCurrency(ownerShare)}</span> <span className="text-[#8FAA8F]">({(ownerShare / bill.installment_amount * 100).toFixed(0)}%)</span></>
                  }
                </span>
              )}
            </div>

            {/* Progresso */}
            {fixedBill ? (
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#8FAA8F]">Ativa desde <span className="text-[#5A7A5A] font-medium capitalize">{activeSince}</span></p>
                  <p className="text-[11px] text-[#8FAA8F] mt-0.5"><span className="text-[#3A6432] font-semibold">{paidCount}</span> {paidCount === 1 ? 'mês pago' : 'meses pagos'}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#5A7A5A]"><Repeat size={12} className="text-[#8FAA8F]" /> Recorrente</div>
              </div>
            ) : (
              <div className="mt-3">
                {(() => {
                  const total = insts.length
                  const pct   = total > 0 ? (paidCount / total) * 100 : 0
                  return (
                    <>
                      <div className="flex justify-between text-[10px] text-[#8FAA8F] mb-1.5">
                        <span>{paidCount} de {total} parcelas pagas</span>
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

            {/* Previsão de quitação */}
            {!fixedBill && bill.total_installments && (() => {
              const remaining   = Math.max(0, bill.total_installments - paidCount)
              const remainingAmt = remaining * myShare
              const endDate     = getBillEndDate(bill)
              const endStr      = endDate?.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) ?? null
              if (remaining === 0) return (
                <p className="text-xs mt-2.5 font-semibold text-[#3A6432]">✓ Todas as parcelas pagas!</p>
              )
              return (
                <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F5FAF4] border border-[#D8EDD4]">
                  <Target size={15} className="text-[#5A7A5A] shrink-0" />
                  <p className="flex-1 text-[11px] text-[#5A7A5A]">
                    <span className="font-semibold text-[#1A2E1A]">{remaining}</span> parcela{remaining !== 1 ? 's' : ''} restante{remaining !== 1 ? 's' : ''}
                    {endStr && <> · Quita em <span className="font-semibold text-[#3A6432] capitalize">{endStr}</span></>}
                  </p>
                  <p className="text-sm font-bold text-red-600 shrink-0">{formatCurrency(remainingAmt)}</p>
                </div>
              )
            })()}

            {/* Próximo vencimento (para fixas) */}
            {nextUnpaid && fixedBill && (() => {
              const s = getDueStatus(nextUnpaid.dueDate, false)
              return <p className={`text-xs mt-2 font-medium ${s.color}`}>Próximo vencimento: {nextUnpaid.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} — {s.label}</p>
            })()}
          </div>

          {/* Expandir */}
          <button onClick={() => setExpanded(isExpanded ? null : bill.id)}
            className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-[#F0EDE6] text-xs text-[#8FAA8F] hover:text-[#3A6432] hover:bg-[#EEF5EB]/50 transition-colors">
            {isExpanded
              ? <><ChevronUp size={13} /> Recolher</>
              : <><ChevronDown size={13} /> {fixedBill ? 'Ver meses' : `Ver ${bill.total_installments ?? insts.length} parcelas`}</>}
          </button>

          {isExpanded && (
            <ul className="border-t border-[#F0EDE6]">
              {insts.map(inst => {
                const key = `${bill.id}-${inst.number}`
                const { color, label } = getDueStatus(inst.dueDate, inst.isPaid)
                const fullDate  = inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const weekday   = inst.dueDate.toLocaleDateString('pt-BR', { weekday: 'long' })
                const monthLbl  = inst.dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                return (
                  <li key={inst.number} className={`flex items-center gap-3 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0 ${inst.isPaid ? 'bg-[#FAFAF9]' : ''}`}>
                    <button onClick={() => togglePayment(bill, inst)} disabled={togglingPay === key || !canEdit} className="shrink-0">
                      {togglingPay === key
                        ? <div className="w-5 h-5 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
                        : inst.isPaid
                          ? <CheckCircle2 size={20} className="text-[#3A6432]" />
                          : <Circle size={20} className={`${canEdit ? 'text-[#C5D9C0] hover:text-[#3A6432]' : 'text-[#E2DECE]'} transition-colors`} />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium capitalize ${inst.isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>
                        {fixedBill ? monthLbl : `${inst.number}ª parcela`}
                      </p>
                      <p className="text-xs text-[#8FAA8F]">{fullDate} · <span className="capitalize">{weekday}</span></p>
                      <p className={`text-xs font-medium ${color}`}>{label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${inst.isPaid ? 'text-[#8FAA8F] line-through' : 'text-[#1A2E1A]'}`}>
                        {formatCurrency(inst.myShare)}
                      </p>
                      {hasSplit && <p className="text-[10px] text-[#8FAA8F]">de {formatCurrency(inst.totalAmount)}</p>}
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────────────────────────────────
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
          {(['contas', 'relatorio'] as const).map((t, i) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${i ? 'border-l border-[#E2DECE]' : ''} ${tab === t ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
              {t === 'contas' ? <><LayoutList size={14} /> Contas</> : <><BarChart2 size={14} /> Relatório</>}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB CONTAS ── */}
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
                      <p className="text-xs text-[#8BB88A] mt-1">{debtBills.length} contrato{debtBills.length !== 1 ? 's' : ''} ativos</p>
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
                <ul className="divide-y divide-[#F0EDE6]">
                  {debtBills.map(b => {
                    const rem    = Math.max(0, (b.total_installments ?? 0) - b.paid_installments)
                    const remAmt = rem * getOwnerShare(b)
                    const end    = getBillEndDate(b)
                    const endStr = end?.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) ?? '—'
                    const pct    = b.total_installments
                      ? Math.min((b.paid_installments / b.total_installments) * 100, 100) : 0
                    return (
                      <li key={b.id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <p className="text-xs font-semibold text-[#1A2E1A] truncate">{b.name}</p>
                          <p className="text-xs font-bold text-red-600 shrink-0">{formatCurrency(remAmt)}</p>
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
                <p className="text-xs text-[#8FAA8F]">Adicione contas fixas (água, luz) ou parcelamentos</p>
                <Button onClick={openNew} size="sm" className="mt-1"><Plus size={14} /> Adicionar conta</Button>
              </CardContent>
            </Card>
          )}

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

      {/* ── TAB RELATÓRIO ── */}
      {tab === 'relatorio' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const paidAll   = allEntries.filter(e => e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
              const unpaidAll = allEntries.filter(e => !e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
              return (
                <>
                  <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-[#8FAA8F] mb-1">Já pago</p><p className="text-sm font-bold text-[#3A6432]">{formatCurrency(paidAll)}</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-[#8FAA8F] mb-1">A pagar</p><p className="text-sm font-bold text-red-500">{formatCurrency(unpaidAll)}</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-[#8FAA8F] mb-1">Contas</p><p className="text-sm font-bold text-[#1A2E1A]">{bills.length}</p></CardContent></Card>
                </>
              )
            })()}
          </div>

          {monthKeys.map(key => {
            const [year, monthIdx] = key.split('-').map(Number)
            const entries    = byMonth[key]
            const isCurrent  = key === nowKey
            const isPast     = key < nowKey
            const mTotal     = entries.reduce((s, e) => s + e.inst.myShare, 0)
            const mPaid      = entries.filter(e => e.inst.isPaid).reduce((s, e) => s + e.inst.myShare, 0)
            const mLeft      = mTotal - mPaid
            const overdueN   = entries.filter(e => !e.inst.isPaid && isPast).length
            return (
              <Card key={key} className={isCurrent ? '!border-[#3A6432]/40 ring-1 ring-[#3A6432]/20' : ''}>
                <CardHeader className={isCurrent ? 'bg-[#EEF5EB]/60' : isPast ? 'bg-[#FAFAF9]' : ''}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1A2E1A]">{MONTH_NAMES[monthIdx]} {year}</h3>
                      {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#3A6432] text-white font-medium">Atual</span>}
                      {overdueN > 0 && <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600"><AlertCircle size={9}/>{overdueN}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {mPaid > 0 && <span className="text-[11px] text-[#3A6432]">{formatCurrency(mPaid)} pago</span>}
                      {mLeft > 0  && <span className="text-[11px] text-red-500 font-medium">{formatCurrency(mLeft)} a pagar</span>}
                      {mLeft === 0 && mPaid > 0 && <span className="text-[11px] text-[#3A6432] font-medium">✓ Quitado</span>}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#1A2E1A] shrink-0">{formatCurrency(mTotal)}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <ul>
                    {entries.sort((a, b) => a.inst.dueDate.getTime() - b.inst.dueDate.getTime()).map(({ bill: b, inst }) => {
                      const { color, bg, border, label } = getDueStatus(inst.dueDate, inst.isPaid)
                      const day2    = inst.dueDate.getDate()
                      const wd      = inst.dueDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                      const fDate   = inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      const k2      = `${b.id}-${inst.number}`
                      const fixedE  = isFixed(b)
                      return (
                        <li key={k2} className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#F0EDE6] last:border-0 ${inst.isPaid ? 'bg-[#FAFAF9]' : ''}`}>
                          <div className={`w-10 text-center rounded-lg py-1.5 shrink-0 border ${bg} ${border}`}>
                            <p className={`text-sm font-bold leading-none ${color}`}>{String(day2).padStart(2,'0')}</p>
                            <p className={`text-[9px] mt-0.5 leading-none capitalize ${color}`}>{wd}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium truncate ${inst.isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>{b.name}</p>
                              {fixedE && <Repeat size={10} className="text-[#8FAA8F] shrink-0" />}
                            </div>
                            <span className="text-xs text-[#8FAA8F]">
                              {fDate} · {fixedE ? 'Conta fixa' : `${inst.number}ª parcela${b.total_installments ? ` de ${b.total_installments}` : ''}`}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${inst.isPaid ? 'text-[#8FAA8F] line-through' : 'text-[#1A2E1A]'}`}>{formatCurrency(inst.myShare)}</p>
                            <p className={`text-xs font-medium ${color}`}>{label}</p>
                          </div>
                          <button onClick={() => b.user_id === userId && togglePayment(b, inst)} disabled={togglingPay === k2 || b.user_id !== userId} className="shrink-0 ml-1">
                            {togglingPay === k2
                              ? <div className="w-5 h-5 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
                              : inst.isPaid
                                ? <CheckCircle2 size={18} className="text-[#3A6432]" />
                                : <Circle size={18} className={`${b.user_id === userId ? 'text-[#C5D9C0] hover:text-[#3A6432]' : 'text-[#E2DECE]'} transition-colors`} />
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

      {/* ─────────────────────────────────────────────────────────────────────
          MODAL: NOVA / EDITAR CONTA
         ───────────────────────────────────────────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conta' : 'Nova conta'} size="md">
        <div className="p-5 flex flex-col gap-4">

          {/* Categoria (apenas criação) */}
          {!editing && (
            <div>
              <p className="text-xs font-semibold text-[#5A7A5A] mb-2">O que é esta conta?</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: 'parcela', icon: <CalendarClock size={22} />, label: 'Parcelamento', sub: 'Consórcio, financiamento,\ncartão parcelado' },
                  { v: 'fixa',    icon: <Repeat size={22} />,        label: 'Conta Fixa',    sub: 'Água, luz, internet,\ncondomínio, aluguel' },
                ] as const).map(({ v, icon, label, sub }) => (
                  <button key={v} type="button"
                    onClick={() => setForm(f => ({ ...f, billCategory: v, type: v === 'fixa' ? 'agua' : 'installment' }))}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-colors ${form.billCategory === v ? 'border-[#3A6432] bg-[#EEF5EB] text-[#3A6432]' : 'border-[#E2DECE] bg-white text-[#5A7A5A] hover:border-[#C5D9C0]'}`}>
                    {icon}
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] text-center opacity-70 whitespace-pre-line">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input label="Nome da conta"
            placeholder={form.billCategory === 'fixa' ? 'ex: Água SABESP, Luz Enel' : 'ex: Consórcio Honda, Financiamento CEF'}
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />

          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold text-[#5A7A5A] mb-2">{form.billCategory === 'fixa' ? 'Categoria' : 'Tipo'}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(form.billCategory === 'fixa' ? FIXED_TYPE_LABELS : TYPE_LABELS).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v }))}
                  className={`py-2 px-1.5 text-xs font-medium rounded-xl border transition-colors text-center ${form.type === v ? 'bg-[#EEF5EB] border-[#C5D9C0] text-[#3A6432]' : 'bg-white border-[#E2DECE] text-[#5A7A5A] hover:border-[#C5D9C0]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Input label="Observação (opcional)" placeholder="ex: Banco Itaú, contrato 123"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          {/* Valor e vencimento */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={
                form.billCategory === 'fixa' ? 'Valor mensal (R$)'
                : isInputTotal ? 'Valor total da compra (R$)'
                : 'Valor da parcela (R$)'
              }
              type="text" inputMode="decimal"
              placeholder={isInputTotal ? 'ex: 1.024,00' : 'ex: 451,00'}
              value={form.installment_amount}
              onChange={e => setForm(f => ({ ...f, installment_amount: e.target.value }))}
            />
            <Input label="Dia do vencimento" type="text" inputMode="numeric"
              placeholder="10"
              value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
          </div>

          <Input label={form.billCategory === 'fixa' ? 'Ativa desde' : 'Data da 1ª parcela'}
            type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />

          {/* Duração — só parcelamentos */}
          {form.billCategory === 'parcela' && (
            <div>
              <p className="text-xs font-semibold text-[#5A7A5A] mb-2">Duração</p>
              <div className="flex rounded-xl overflow-hidden border border-[#E2DECE]">
                {(['installments', 'until_date'] as const).map((m, i) => (
                  <button key={m} type="button" onClick={() => setForm(f => ({ ...f, mode: m }))}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${i ? 'border-l border-[#E2DECE]' : ''} ${form.mode === m ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                    {m === 'installments' ? 'Nº de parcelas' : 'Até uma data'}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                {form.mode === 'installments'
                  ? <Input label="Número de parcelas" type="text" inputMode="numeric" placeholder="ex: 75"
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
              <p className="text-xs text-[#3A6432]">Conta recorrente sem data de término. Registre o pagamento todo mês.</p>
            </div>
          )}

          {/* ── Divisão do valor ── */}
          {householdId && (
            <div>
              <p className="text-xs font-semibold text-[#5A7A5A] mb-2">Divisão do valor</p>
              <div className="flex rounded-xl overflow-hidden border border-[#E2DECE]">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, split_type: 'personal', my_share_amount: '', splitWithUserId: '' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${form.split_type === 'personal' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                  <User size={13} /> Só eu pago
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, split_type: 'members' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-l border-[#E2DECE] ${form.split_type === 'members' ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F] hover:text-[#5A7A5A]'}`}>
                  <Users size={13} /> Dividir
                </button>
              </div>

              {form.split_type === 'members' && (
                <div className="mt-3 space-y-3">

                  {/* Selecionar familiar */}
                  {otherMembers.length > 0 && (
                    <div>
                      <p className="text-xs text-[#5A7A5A] font-semibold mb-2">Dividir com:</p>
                      <div className="space-y-1.5">
                        {otherMembers.map(member => {
                          const sel = form.splitWithUserId === member.id
                          const initials = member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                          return (
                            <button key={member.id} type="button"
                              onClick={() => setForm(f => ({ ...f, splitWithUserId: sel ? '' : member.id }))}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${sel ? 'border-[#3A6432] bg-[#EEF5EB]' : 'border-[#E2DECE] hover:border-[#C5D9C0] bg-white'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${sel ? 'bg-[#3A6432] text-white' : 'bg-[#EEF5EB] border border-[#C5D9C0] text-[#3A6432]'}`}>
                                {initials}
                              </div>
                              <span className={`text-sm font-medium flex-1 text-left ${sel ? 'text-[#3A6432]' : 'text-[#1A2E1A]'}`}>{member.name}</span>
                              {sel && <CheckCircle2 size={16} className="text-[#3A6432] shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Minha parte */}
                  <div>
                    {/* Toggle: os valores informados são por parcela ou totais? */}
                    {showInputMode && (
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-[11px] text-[#8FAA8F]">Como você quer informar os valores?</p>
                        <div className="flex rounded-lg overflow-hidden border border-[#E2DECE] text-[10px]">
                          {(['perInstallment', 'total'] as const).map((m, i) => (
                            <button key={m} type="button"
                              onClick={() => setForm(f => ({ ...f, inputMode: m }))}
                              className={`px-2.5 py-1 font-semibold transition-colors ${i ? 'border-l border-[#E2DECE]' : ''} ${form.inputMode === m ? 'bg-[#EEF5EB] text-[#3A6432]' : 'text-[#8FAA8F]'}`}>
                              {m === 'total' ? 'Total' : '/parcela'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-[#5A7A5A]">
                        {isInputTotal ? 'Minha parte total (R$)' : 'Minha parte por parcela (R$)'}
                      </p>
                    </div>
                    <Input
                      type="text" inputMode="decimal"
                      placeholder={
                        isInputTotal
                          ? `Total que vou pagar (ex: ${(formInputInstAmt / 2).toFixed(2).replace('.', ',')})`
                          : `Por parcela (ex: ${(perInstAmt / 2).toFixed(2).replace('.', ',')})`
                      }
                      value={form.my_share_amount}
                      onChange={e => setForm(f => ({ ...f, my_share_amount: e.target.value }))}
                    />
                  </div>

                  {/* Cálculo em tempo-real */}
                  {showCalc && (
                    <div className="space-y-1.5">
                      {/* Mostrar breakdown por parcela quando em modo total */}
                      {isInputTotal && formNumParcelas > 1 && (
                        <div className="px-3 py-2 rounded-lg bg-[#EEF5EB] border border-[#C5D9C0]">
                          <p className="text-[11px] text-[#5A7A5A]">
                            <span className="font-semibold">{formatCurrency(formInputInstAmt)}</span> total ÷ {formNumParcelas} parcelas
                            = <span className="font-semibold text-[#1A2E1A]">{formatCurrency(perInstAmt)}/parcela</span>
                          </p>
                          <p className="text-[11px] text-[#5A7A5A] mt-0.5">
                            Minha parte: <span className="font-semibold">{formatCurrency(formMyShareInput)}</span> total
                            = <span className="font-semibold text-[#3A6432]">{formatCurrency(myPerInst)}/parcela</span>
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F5F2EE] border border-[#E2DECE]">
                        <div>
                          <p className="text-xs font-semibold text-[#5A7A5A]">
                            {form.splitWithUserId
                              ? `${otherMembers.find(m => m.id === form.splitWithUserId)?.name ?? 'Outra pessoa'} paga`
                              : 'Outra pessoa paga'}
                          </p>
                          <p className="text-[11px] text-[#8FAA8F] mt-0.5">
                            {otherPct.toFixed(1)}% do total
                            {formNumParcelas > 1 && ` · ${formatCurrency(otherPerInst)}/parcela`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-[#1A2E1A]">{formatCurrency(otherTotal)}</p>
                          {formNumParcelas > 1 && <p className="text-[10px] text-[#8FAA8F]">em {formNumParcelas} parcelas</p>}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8FAA8F] text-center">
                        Você paga <span className="font-semibold text-[#3A6432]">{myPct.toFixed(1)}%</span> do total ·{' '}
                        <span className="font-semibold text-[#1A2E1A]">{formatCurrency(myTotal)}</span> no total
                      </p>
                    </div>
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

      {/* ── Modal confirmar exclusão ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover conta" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-[#5A7A5A]">Tem certeza que deseja remover <span className="font-semibold text-[#1A2E1A]">{deleteTarget?.name}</span>?</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button onClick={deleteBill} className="flex-1 !bg-red-500 hover:!bg-red-600">Remover</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
