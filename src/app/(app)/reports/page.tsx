'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, CheckCircle2, Clock } from 'lucide-react'

interface MonthData { month: string; receitas: number; pagas: number; aPagar: number }
interface CatData { name: string; value: number; color: string }

interface Installment {
  id: string; user_id: string; name: string; type: string
  installment_amount: number; total_installments: number | null
  paid_installments: number; start_date: string; due_day: number
  split_type: 'personal' | 'members'; split_count: number
  until_date?: string | null; household_id?: string | null; status: string
}

interface BillStatus {
  bill: Installment
  instNum: number
  dueDate: Date
  isPaid: boolean
  myShare: number
  paidCount: number
  totalCount: number
}

const TYPE_COLORS: Record<string, string> = {
  consortium: '#8B5CF6',
  financing: '#F59E0B',
  installment: '#3B82F6',
  subscription: '#10B981',
  other: '#6B7280',
}
const TYPE_LABELS: Record<string, string> = {
  consortium: 'Consórcio',
  financing: 'Financiamento',
  installment: 'Parcelamento',
  subscription: 'Assinatura',
  other: 'Outro',
}

const CHART_TOOLTIP = {
  contentStyle: { background: '#FFF', border: '1px solid #E2DECE', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  labelStyle: { color: '#1A2E1A', fontWeight: 600 },
  itemStyle: { color: '#5A7A5A' },
  formatter: (v: unknown) => formatCurrency(Number(v)),
}

/** Retorna o status da parcela de um bill em determinado mês/ano */
function getInstallmentStatus(bill: Installment, y2: number, m2: number): { amount: number; isPaid: boolean; instNum: number; dueDate: Date } | null {
  const start = new Date(bill.start_date + 'T12:00:00')
  const monthsDiff = (y2 - start.getFullYear()) * 12 + (m2 - 1 - start.getMonth())
  if (monthsDiff < 0) return null
  const instNum = monthsDiff + 1
  const total = bill.total_installments ?? Infinity
  if (instNum > total) return null
  if (bill.until_date) {
    const until = new Date(bill.until_date + 'T12:00:00')
    if (new Date(y2, m2 - 1, bill.due_day) > until) return null
  }
  const myShare = bill.split_type === 'members'
    ? bill.installment_amount / (bill.split_count || 1)
    : bill.installment_amount
  return { amount: myShare, isPaid: instNum <= bill.paid_installments, instNum, dueDate: new Date(y2, m2 - 1, bill.due_day) }
}

/** Conta total de parcelas de um bill */
function totalInstallments(bill: Installment): number {
  if (bill.total_installments) return bill.total_installments
  if (bill.until_date) {
    const start = new Date(bill.start_date + 'T12:00:00')
    const until = new Date(bill.until_date + 'T12:00:00')
    let count = 0; let d = new Date(start)
    while (d <= until && count < 600) { count++; d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
    return count
  }
  return 60
}

export default function ReportsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [monthData, setMonthData] = useState<MonthData[]>([])
  const [expenseCats, setExpenseCats] = useState<CatData[]>([])
  const [incomeCats, setIncomeCats] = useState<CatData[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ income: 0, paid: 0, toPay: 0 })
  const [billStatuses, setBillStatuses] = useState<BillStatus[]>([])
  const [memberView, setMemberView] = useState<'all' | string>('all')
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberRow } = await supabase
      .from('household_members').select('household_id').eq('user_id', user.id).single()
    const hid = memberRow?.household_id ?? null

    if (hid) {
      const { data: hm } = await supabase
        .from('household_members')
        .select('user_id, profiles:profiles(full_name)')
        .eq('household_id', hid)
      setMembers((hm || []).map((m: { user_id: string; profiles: { full_name: string } | null }) => ({
        id: m.user_id, name: m.profiles?.full_name || 'Membro'
      })))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: installmentsRaw } = await db
      .from('fin_installments').select('*').eq('status', 'active')
    const installments: Installment[] = (installmentsRaw || []).filter((b: Installment) =>
      memberView === 'all' ? true : b.user_id === memberView
    )

    // ── Gráfico: últimos 6 meses ──
    const months: MonthData[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const m2 = d.getMonth() + 1
      const y2 = d.getFullYear()
      const start = `${y2}-${String(m2).padStart(2, '0')}-01`
      const end = `${y2}-${String(m2).padStart(2, '0')}-${new Date(y2, m2, 0).getDate()}`

      let q = supabase.from('fin_transactions').select('type, amount')
      if (hid) q = q.eq('household_id', hid); else q = q.eq('user_id', user.id)
      q = q.gte('date', start).lte('date', end)
      if (memberView !== 'all') q = q.eq('user_id', memberView)
      const { data: txsRaw } = await q
      const txs = (txsRaw || []) as { type: string; amount: number }[]
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const txExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

      let instPaid = 0, instToPay = 0
      installments.forEach(bill => {
        const st = getInstallmentStatus(bill, y2, m2)
        if (!st) return
        if (st.isPaid) instPaid += st.amount + (txExpense > 0 ? 0 : 0)
        else instToPay += st.amount
      })

      months.push({ month: MONTHS[m2 - 1].slice(0, 3), receitas: income, pagas: txExpense + instPaid, aPagar: instToPay })
    }
    setMonthData(months)

    // ── Resumo do mês atual ──
    const startCur = `${year}-${String(month).padStart(2, '0')}-01`
    const endCur = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    let q2 = supabase.from('fin_transactions').select('type, amount, category:fin_categories(name, color)')
    if (hid) q2 = q2.eq('household_id', hid); else q2 = q2.eq('user_id', user.id)
    q2 = q2.gte('date', startCur).lte('date', endCur)
    if (memberView !== 'all') q2 = q2.eq('user_id', memberView)
    const { data: txsCurrentRaw } = await q2
    const txsCurrent = (txsCurrentRaw || []) as { type: string; amount: number; category: { name: string; color: string } | null }[]

    const income = txsCurrent.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const txExpenseCur = txsCurrent.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    let instPaidCur = 0, instToPayCur = 0
    const statuses: BillStatus[] = []

    installments.forEach(bill => {
      const st = getInstallmentStatus(bill, year, month)
      const tot = totalInstallments(bill)
      if (st) {
        if (st.isPaid) instPaidCur += st.amount
        else instToPayCur += st.amount
        statuses.push({
          bill, instNum: st.instNum, dueDate: st.dueDate,
          isPaid: st.isPaid, myShare: st.amount,
          paidCount: bill.paid_installments, totalCount: tot,
        })
      }
    })
    statuses.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

    setSummary({ income, paid: txExpenseCur + instPaidCur, toPay: instToPayCur })
    setBillStatuses(statuses)

    // ── Categorias ──
    const ecMap: Record<string, { name: string; value: number; color: string }> = {}
    const icMap: Record<string, { name: string; value: number; color: string }> = {}
    txsCurrent.forEach(t => {
      const cat = t.category
      const key = cat?.name || 'Outros'; const color = cat?.color || '#6b7280'
      if (t.type === 'expense') {
        if (!ecMap[key]) ecMap[key] = { name: key, value: 0, color }
        ecMap[key].value += Number(t.amount)
      } else {
        if (!icMap[key]) icMap[key] = { name: key, value: 0, color }
        icMap[key].value += Number(t.amount)
      }
    })
    installments.forEach(bill => {
      const st = getInstallmentStatus(bill, year, month)
      if (!st || !st.isPaid) return
      const label = TYPE_LABELS[bill.type] || 'Parcelas'
      const color = TYPE_COLORS[bill.type] || '#6B7280'
      if (!ecMap[label]) ecMap[label] = { name: label, value: 0, color }
      ecMap[label].value += st.amount
    })
    setExpenseCats(Object.values(ecMap).sort((a, b) => b.value - a.value))
    setIncomeCats(Object.values(icMap).sort((a, b) => b.value - a.value))
    setLoading(false)
  }, [year, month, memberView])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="px-4 py-5 max-w-3xl mx-auto lg:px-6 space-y-4">
      {[1, 2, 3].map(n => (
        <div key={n} className="rounded-2xl bg-white border border-[#E2DECE] p-5 h-32 animate-pulse shadow-sm" />
      ))}
    </div>
  )

  const totalMonth = summary.paid + summary.toPay
  const paidPct = totalMonth > 0 ? (summary.paid / totalMonth) * 100 : 0

  return (
    <div className="px-4 py-5 max-w-3xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* ── Controles de mês ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
            className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-bold text-[#1A2E1A] min-w-[130px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
            className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
        {members.length > 1 && (
          <select value={memberView} onChange={e => setMemberView(e.target.value)}
            className="h-10 bg-white border border-[#D5CCBE] rounded-xl text-sm text-[#1A2E1A] px-3 focus:outline-none focus:border-[#3A6432]">
            <option value="all">Toda a família</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {/* ── Resumo do mês: hero card ── */}
      <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
        {/* Linha superior: totais */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-xs text-[#8FAA8F] flex items-center gap-1 mb-1">
              <TrendingUp size={11} className="text-[#3A6432]" /> Receitas
            </p>
            <p className="text-sm font-bold text-[#3A6432] truncate">{formatCurrency(summary.income)}</p>
          </div>
          <div>
            <p className="text-xs text-[#8FAA8F] flex items-center gap-1 mb-1">
              <CheckCircle2 size={11} className="text-[#3A6432]" /> Pagas
            </p>
            <p className="text-sm font-bold text-[#3A6432] truncate">{formatCurrency(summary.paid)}</p>
          </div>
          <div>
            <p className="text-xs text-[#8FAA8F] flex items-center gap-1 mb-1">
              <Clock size={11} className="text-red-500" /> A pagar
            </p>
            <p className="text-sm font-bold text-red-500 truncate">{formatCurrency(summary.toPay)}</p>
          </div>
        </div>

        {/* Barra de progresso do mês */}
        {totalMonth > 0 && (
          <div>
            <div className="flex justify-between text-[10px] text-[#8FAA8F] mb-1.5">
              <span>{formatCurrency(summary.paid)} pagos de {formatCurrency(totalMonth)}</span>
              <span>{paidPct.toFixed(0)}% quitado</span>
            </div>
            <div className="h-2.5 bg-[#EEF5EB] rounded-full overflow-hidden">
              <div className="h-full bg-[#3A6432] rounded-full transition-all duration-500" style={{ width: `${paidPct}%` }} />
            </div>
            {summary.toPay === 0 && (
              <p className="text-xs text-[#3A6432] font-semibold mt-1.5 text-center">✓ Mês totalmente quitado!</p>
            )}
          </div>
        )}

        {/* Resultado */}
        <div className="mt-3 pt-3 border-t border-[#F0EDE6] flex items-center justify-between">
          <span className="text-xs text-[#8FAA8F]">Resultado (receitas − despesas)</span>
          <span className={`text-sm font-bold truncate ${summary.income - summary.paid - summary.toPay >= 0 ? 'text-[#3A6432]' : 'text-red-500'}`}>
            {formatCurrency(summary.income - summary.paid - summary.toPay)}
          </span>
        </div>
      </div>

      {/* ── Contas do mês: status individual ── */}
      {billStatuses.length > 0 && (
        <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0EDE6]">
            <h3 className="text-sm font-bold text-[#1A2E1A]">Contas de {MONTHS[month - 1]}</h3>
          </div>
          <ul>
            {billStatuses.map(({ bill, instNum, dueDate, isPaid, myShare, paidCount, totalCount }) => {
              const pct = totalCount > 0 ? Math.min((paidCount / totalCount) * 100, 100) : 0
              const dayStr = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              const typeLabel = TYPE_LABELS[bill.type] || ''
              const typeColor = TYPE_COLORS[bill.type] || '#6B7280'
              return (
                <li key={bill.id} className={`px-4 py-3.5 border-b border-[#F0EDE6] last:border-0 ${isPaid ? 'bg-[#FAFAF9]' : ''}`}>
                  <div className="flex items-start gap-3">
                    {/* Ícone status */}
                    <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isPaid ? 'bg-[#EEF5EB]' : 'bg-red-50'}`}>
                      {isPaid
                        ? <CheckCircle2 size={15} className="text-[#3A6432]" />
                        : <Clock size={15} className="text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isPaid ? 'text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>
                            {bill.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {typeLabel && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                                style={{ background: typeColor + '20', color: typeColor }}>
                                {typeLabel}
                              </span>
                            )}
                            <span className="text-[11px] text-[#8FAA8F]">
                              Parcela {instNum}{bill.total_installments ? ` de ${bill.total_installments}` : ''} · vence {dayStr}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${isPaid ? 'text-[#8FAA8F] line-through' : 'text-red-500'}`}>
                            {formatCurrency(myShare)}
                          </p>
                          <p className="text-[10px] text-[#8FAA8F]">{isPaid ? 'pago' : 'a pagar'}</p>
                        </div>
                      </div>

                      {/* Mini progresso geral da conta */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-[#8FAA8F] mb-1">
                          <span>{paidCount} de {totalCount} pagas · {formatCurrency((totalCount - paidCount) * myShare)} restante</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#EEF5EB] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: pct >= 100 ? '#3A6432' : '#5A9A52' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Rodapé totais */}
          <div className="px-4 py-3 bg-[#F9F7F4] border-t border-[#E2DECE] flex items-center justify-between">
            <span className="text-xs text-[#5A7A5A] font-medium">Total do mês</span>
            <div className="flex items-center gap-3">
              {summary.paid > 0 && (
                <span className="text-xs text-[#3A6432] font-medium">{formatCurrency(summary.paid)} pago</span>
              )}
              {summary.toPay > 0 && (
                <span className="text-xs text-red-500 font-semibold">{formatCurrency(summary.toPay)} a pagar</span>
              )}
              {summary.toPay === 0 && summary.paid > 0 && (
                <span className="text-xs text-[#3A6432] font-semibold">✓ Quitado!</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Gráfico: Evolução 6 meses ── */}
      <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE6]">
          <h3 className="text-sm font-bold text-[#1A2E1A]">Evolução mensal</h3>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-[#5A7A5A]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3A6432] inline-block" /> Receitas
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#5A7A5A]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Pagas
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#5A7A5A]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> A pagar
            </span>
          </div>
        </div>
        <div className="px-2 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5A7A5A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8FAA8F' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar dataKey="receitas" name="Receitas" fill="#3A6432" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="pagas" name="Pagas" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="aPagar" name="A pagar" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Categorias de despesa ── */}
      {expenseCats.length > 0 && (
        <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE6]">
            <h3 className="text-sm font-bold text-[#1A2E1A]">Despesas pagas por categoria</h3>
          </div>
          <div className="p-4 flex items-center gap-5">
            <PieChart width={88} height={88}>
              <Pie data={expenseCats} cx={40} cy={40} innerRadius={24} outerRadius={40} dataKey="value" paddingAngle={2}>
                {expenseCats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <ul className="flex-1 flex flex-col gap-2.5 max-h-36 overflow-y-auto">
              {expenseCats.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-sm text-[#5A7A5A] flex-1 truncate">{c.name}</span>
                  <span className="text-sm font-bold text-[#1A2E1A] tabular-nums">{formatCurrency(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Categorias de receita ── */}
      {incomeCats.length > 0 && (
        <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE6]">
            <h3 className="text-sm font-bold text-[#1A2E1A]">Receitas por categoria</h3>
          </div>
          <div className="p-4 flex items-center gap-5">
            <PieChart width={88} height={88}>
              <Pie data={incomeCats} cx={40} cy={40} innerRadius={24} outerRadius={40} dataKey="value" paddingAngle={2}>
                {incomeCats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <ul className="flex-1 flex flex-col gap-2.5 max-h-36 overflow-y-auto">
              {incomeCats.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-sm text-[#5A7A5A] flex-1 truncate">{c.name}</span>
                  <span className="text-sm font-bold text-[#1A2E1A] tabular-nums">{formatCurrency(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {expenseCats.length === 0 && incomeCats.length === 0 && billStatuses.length === 0 && (
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-[#8FAA8F]">Nenhuma movimentação registrada neste mês</p>
        </div>
      )}
    </div>
  )
}
