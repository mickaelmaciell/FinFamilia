'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

interface MonthData { month: string; receitas: number; despesas: number; saldo: number }
interface CatData { name: string; value: number; color: string }

interface Installment {
  id: string; user_id: string; name: string; type: string
  installment_amount: number; total_installments: number | null
  paid_installments: number; start_date: string; due_day: number
  split_type: 'personal' | 'members'; split_count: number
  until_date?: string | null; household_id?: string | null; status: string
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
  other: 'Outros',
}

const CHART_TOOLTIP = {
  contentStyle: { background: '#FFFFFF', border: '1px solid #E2DECE', borderRadius: '12px', fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  labelStyle: { color: '#1A2E1A', fontWeight: 600 },
  itemStyle: { color: '#5A7A5A' },
  formatter: (v: unknown) => formatCurrency(Number(v)),
}

/** Calcula a parcela de um bill para um dado mês (1-based) / ano */
function getInstallmentForMonth(bill: Installment, y2: number, m2: number): number | null {
  const start = new Date(bill.start_date + 'T12:00:00')
  const monthsDiff = (y2 - start.getFullYear()) * 12 + (m2 - 1 - start.getMonth())
  if (monthsDiff < 0) return null
  const instNum = monthsDiff + 1
  const total = bill.total_installments ?? Infinity
  if (instNum > total) return null
  if (bill.until_date) {
    const until = new Date(bill.until_date + 'T12:00:00')
    const dueDate = new Date(y2, m2 - 1, bill.due_day)
    if (dueDate > until) return null
  }
  const isPaid = instNum <= bill.paid_installments
  if (!isPaid) return null
  return bill.split_type === 'members'
    ? bill.installment_amount / (bill.split_count || 1)
    : bill.installment_amount
}

export default function ReportsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [monthData, setMonthData] = useState<MonthData[]>([])
  const [expenseCats, setExpenseCats] = useState<CatData[]>([])
  const [incomeCats, setIncomeCats] = useState<CatData[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
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

    // Busca todas as parcelas ativas visíveis pelo usuário
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: installmentsRaw } = await db
      .from('fin_installments')
      .select('*')
      .eq('status', 'active')
    const installments: Installment[] = (installmentsRaw || []).filter((b: Installment) =>
      memberView === 'all' ? true : b.user_id === memberView
    )

    // ── Gráfico: últimos 6 meses ──────────────────────────────────────
    const months: MonthData[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const m2 = d.getMonth() + 1
      const y2 = d.getFullYear()
      const start = `${y2}-${String(m2).padStart(2, '0')}-01`
      const end = `${y2}-${String(m2).padStart(2, '0')}-${new Date(y2, m2, 0).getDate()}`

      // Transações manuais
      let q = supabase.from('fin_transactions').select('type, amount')
      if (hid) q = q.eq('household_id', hid)
      else q = q.eq('user_id', user.id)
      q = q.gte('date', start).lte('date', end)
      if (memberView !== 'all') q = q.eq('user_id', memberView)
      const { data: txsRaw } = await q
      const txs = (txsRaw || []) as { type: string; amount: number }[]
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const txExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

      // Parcelas pagas neste mês
      const instExpense = installments.reduce((sum, bill) => {
        const amt = getInstallmentForMonth(bill, y2, m2)
        return sum + (amt ?? 0)
      }, 0)

      months.push({
        month: MONTHS[m2 - 1].slice(0, 3),
        receitas: income,
        despesas: txExpense + instExpense,
        saldo: income - (txExpense + instExpense),
      })
    }
    setMonthData(months)

    // ── Resumo do mês atual ───────────────────────────────────────────
    const startCur = `${year}-${String(month).padStart(2, '0')}-01`
    const endCur = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    let q2 = supabase.from('fin_transactions').select('type, amount, category:fin_categories(name, color)')
    if (hid) q2 = q2.eq('household_id', hid)
    else q2 = q2.eq('user_id', user.id)
    q2 = q2.gte('date', startCur).lte('date', endCur)
    if (memberView !== 'all') q2 = q2.eq('user_id', memberView)
    const { data: txsCurrentRaw } = await q2
    const txsCurrent = (txsCurrentRaw || []) as { type: string; amount: number; category: { name: string; color: string } | null }[]

    const income = txsCurrent.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const txExpenseCur = txsCurrent.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    // Parcelas pagas no mês atual
    const instExpenseCur = installments.reduce((sum, bill) => {
      const amt = getInstallmentForMonth(bill, year, month)
      return sum + (amt ?? 0)
    }, 0)

    const totalExpense = txExpenseCur + instExpenseCur
    setSummary({ income, expense: totalExpense, balance: income - totalExpense })

    // ── Categorias de despesa ─────────────────────────────────────────
    const ecMap: Record<string, { name: string; value: number; color: string }> = {}
    const icMap: Record<string, { name: string; value: number; color: string }> = {}

    // Transações manuais por categoria
    txsCurrent.forEach(t => {
      const cat = t.category
      const key = cat?.name || 'Outros'
      const color = cat?.color || '#6b7280'
      if (t.type === 'expense') {
        if (!ecMap[key]) ecMap[key] = { name: key, value: 0, color }
        ecMap[key].value += Number(t.amount)
      } else if (t.type === 'income') {
        if (!icMap[key]) icMap[key] = { name: key, value: 0, color }
        icMap[key].value += Number(t.amount)
      }
    })

    // Parcelas pagas agrupadas por tipo
    installments.forEach(bill => {
      const amt = getInstallmentForMonth(bill, year, month)
      if (!amt) return
      const label = TYPE_LABELS[bill.type] || 'Parcelas'
      const color = TYPE_COLORS[bill.type] || '#6B7280'
      if (!ecMap[label]) ecMap[label] = { name: label, value: 0, color }
      ecMap[label].value += amt
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

  return (
    <div className="px-4 py-5 max-w-3xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* ── Controles de mês ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
            className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-bold text-[#1A2E1A] min-w-[130px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
            className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors active:scale-95"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        {members.length > 1 && (
          <select
            value={memberView}
            onChange={e => setMemberView(e.target.value)}
            className="h-10 bg-white border border-[#D5CCBE] rounded-xl text-sm text-[#1A2E1A] px-3 focus:outline-none focus:border-[#3A6432]"
          >
            <option value="all">Toda a família</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {/* ── Resumo do mês ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-3 shadow-sm">
          <p className="text-xs font-medium text-[#5A7A5A] flex items-center gap-1 mb-1.5">
            <TrendingUp size={12} className="text-[#3A6432]" /> Receitas
          </p>
          <p className="text-sm font-bold text-[#3A6432] truncate">{formatCurrency(summary.income)}</p>
        </div>
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-3 shadow-sm">
          <p className="text-xs font-medium text-[#5A7A5A] flex items-center gap-1 mb-1.5">
            <TrendingDown size={12} className="text-red-500" /> Despesas
          </p>
          <p className="text-sm font-bold text-red-500 truncate">{formatCurrency(summary.expense)}</p>
        </div>
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-3 shadow-sm">
          <p className="text-xs font-medium text-[#5A7A5A] flex items-center gap-1 mb-1.5">
            <Wallet size={12} className="text-[#5A7A5A]" /> Resultado
          </p>
          <p className={`text-sm font-bold truncate ${summary.balance >= 0 ? 'text-[#3A6432]' : 'text-red-500'}`}>
            {formatCurrency(summary.balance)}
          </p>
        </div>
      </div>

      {/* ── Gráfico: Evolução mensal ── */}
      <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE6]">
          <h3 className="text-base font-bold text-[#1A2E1A]">Evolução mensal</h3>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-sm text-[#5A7A5A]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3A6432] inline-block" /> Receitas
            </span>
            <span className="flex items-center gap-1.5 text-sm text-[#5A7A5A]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Despesas
            </span>
          </div>
        </div>
        <div className="px-2 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 13, fill: '#5A7A5A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#8FAA8F' }} axisLine={false} tickLine={false} tickFormatter={v => `${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar dataKey="receitas" fill="#3A6432" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Bar dataKey="despesas" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gráfico: Resultado por mês ── */}
      <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE6]">
          <h3 className="text-base font-bold text-[#1A2E1A]">Resultado por mês</h3>
          <p className="text-sm text-[#8FAA8F] mt-0.5">Sobra ou déficit mensal</p>
        </div>
        <div className="px-2 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={monthData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 13, fill: '#5A7A5A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#8FAA8F' }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Line type="monotone" dataKey="saldo" stroke="#3A6432" strokeWidth={2.5} dot={{ fill: '#3A6432', strokeWidth: 0, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Categorias ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {expenseCats.length > 0 && (
          <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EDE6]">
              <h3 className="text-base font-bold text-[#1A2E1A]">Despesas por categoria</h3>
            </div>
            <div className="p-5 flex items-center gap-5">
              <PieChart width={96} height={96}>
                <Pie data={expenseCats} cx={44} cy={44} innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={2}>
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
        {incomeCats.length > 0 && (
          <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EDE6]">
              <h3 className="text-base font-bold text-[#1A2E1A]">Receitas por categoria</h3>
            </div>
            <div className="p-5 flex items-center gap-5">
              <PieChart width={96} height={96}>
                <Pie data={incomeCats} cx={44} cy={44} innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={2}>
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
        {expenseCats.length === 0 && incomeCats.length === 0 && (
          <div className="col-span-full bg-white border border-[#E2DECE] rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-[#8FAA8F]">Nenhuma movimentação registrada neste mês</p>
            <p className="text-xs text-[#C5D9C0] mt-1">Parcelas de contas aparecerão aqui quando marcadas como pagas</p>
          </div>
        )}
      </div>
    </div>
  )
}
