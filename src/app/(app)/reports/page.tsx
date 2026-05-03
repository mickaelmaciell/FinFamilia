'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

interface MonthData { month: string; receitas: number; despesas: number; saldo: number }
interface CatData { name: string; value: number; color: string }

const CHART_TOOLTIP = {
  contentStyle: { background: '#FFFFFF', border: '1px solid #E2DECE', borderRadius: '12px', fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  labelStyle: { color: '#1A2E1A', fontWeight: 600 },
  itemStyle: { color: '#5A7A5A' },
  formatter: (v: unknown) => formatCurrency(Number(v)),
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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    const hid = member.household_id

    const { data: hm } = await supabase.from('household_members').select('user_id, profiles:profiles(full_name)').eq('household_id', hid)
    setMembers((hm || []).map((m: { user_id: string; profiles: { full_name: string } | null }) => ({ id: m.user_id, name: m.profiles?.full_name || 'Membro' })))

    const months: MonthData[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const m2 = d.getMonth() + 1
      const y2 = d.getFullYear()
      const start = `${y2}-${String(m2).padStart(2, '0')}-01`
      const end = `${y2}-${String(m2).padStart(2, '0')}-${new Date(y2, m2, 0).getDate()}`
      let q = supabase.from('fin_transactions').select('type, amount').eq('household_id', hid).gte('date', start).lte('date', end)
      if (memberView !== 'all') q = q.eq('user_id', memberView)
      const { data: txsRaw } = await q
      const txs = (txsRaw || []) as { type: string; amount: number }[]
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      months.push({ month: MONTHS[m2 - 1].slice(0, 3), receitas: income, despesas: expense, saldo: income - expense })
    }
    setMonthData(months)

    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    let q2 = supabase.from('fin_transactions').select('type, amount, category:fin_categories(name, color)').eq('household_id', hid).gte('date', start).lte('date', end)
    if (memberView !== 'all') q2 = q2.eq('user_id', memberView)
    const { data: txsCurrentRaw } = await q2
    const txsCurrent = (txsCurrentRaw || []) as { type: string; amount: number; category: { name: string; color: string } | null }[]

    const income = txsCurrent.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = txsCurrent.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    setSummary({ income, expense, balance: income - expense })

    const ecMap: Record<string, { name: string; value: number; color: string }> = {}
    const icMap: Record<string, { name: string; value: number; color: string }> = {}
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
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-[#5A7A5A] flex items-center gap-1 mb-2">
            <TrendingUp size={14} className="text-[#3A6432]" /> Receitas
          </p>
          <p className="text-base font-bold text-[#3A6432]">{formatCurrency(summary.income)}</p>
        </div>
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-[#5A7A5A] flex items-center gap-1 mb-2">
            <TrendingDown size={14} className="text-red-500" /> Despesas
          </p>
          <p className="text-base font-bold text-red-500">{formatCurrency(summary.expense)}</p>
        </div>
        <div className="bg-white border border-[#E2DECE] rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-[#5A7A5A] flex items-center gap-1 mb-2">
            <Wallet size={14} className="text-[#5A7A5A]" /> Resultado
          </p>
          <p className={`text-base font-bold ${summary.balance >= 0 ? 'text-[#3A6432]' : 'text-red-500'}`}>
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
      </div>
    </div>
  )
}
