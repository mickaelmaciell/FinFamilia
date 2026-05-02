'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

interface MonthData { month: string; receitas: number; despesas: number; saldo: number }
interface CatData { name: string; value: number; color: string }

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: '#0f1a0f', border: '1px solid #1a2e1a', borderRadius: '12px', fontSize: '12px' },
  labelStyle: { color: '#86efac' },
  itemStyle: { color: '#86efac' },
  formatter: (v: unknown) => formatCurrency(Number(v)),
}

export default function ReportsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [monthData, setMonthData] = useState<MonthData[]>([])
  const [expenseCats, setExpenseCats] = useState<CatData[]>([])
  const [incomeCats, setIncomeCats] = useState<CatData[]>([])
  const [householdId, setHouseholdId] = useState('')
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
    setHouseholdId(hid)

    // Get members
    const { data: hm } = await supabase.from('household_members').select('user_id, profiles:profiles(full_name)').eq('household_id', hid)
    setMembers((hm || []).map((m: { user_id: string; profiles: { full_name: string } | null }) => ({ id: m.user_id, name: m.profiles?.full_name || 'Membro' })))

    // Last 6 months data
    const months: MonthData[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const m2 = d.getMonth() + 1
      const y2 = d.getFullYear()
      const start = `${y2}-${String(m2).padStart(2,'0')}-01`
      const end = `${y2}-${String(m2).padStart(2,'0')}-${new Date(y2, m2, 0).getDate()}`
      let q = supabase.from('fin_transactions').select('type, amount').eq('household_id', hid).gte('date', start).lte('date', end)
      if (memberView !== 'all') q = q.eq('user_id', memberView)
      const { data: txsRaw } = await q
      const txs = (txsRaw || []) as { type: string; amount: number }[]
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      months.push({ month: MONTHS[m2 - 1].slice(0, 3), receitas: income, despesas: expense, saldo: income - expense })
    }
    setMonthData(months)

    // Current month by category
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
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

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto lg:px-6 lg:py-6 space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
            className="p-2 rounded-xl hover:bg-[#1a2e1a] text-green-600 hover:text-green-400 transition-colors active:scale-95">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-green-200 min-w-[110px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
            className="p-2 rounded-xl hover:bg-[#1a2e1a] text-green-600 hover:text-green-400 transition-colors active:scale-95">
            <ChevronRight size={18} />
          </button>
        </div>
        {members.length > 1 && (
          <select value={memberView} onChange={e => setMemberView(e.target.value)}
            className="h-9 bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl text-green-100 px-3 text-xs focus:outline-none">
            <option value="all">Todos</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-green-700 flex items-center gap-1 mb-1"><TrendingUp size={11} /> Receitas</p>
          <p className="text-base font-bold text-green-400">{formatCurrency(summary.income)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-green-700 flex items-center gap-1 mb-1"><TrendingDown size={11} /> Despesas</p>
          <p className="text-base font-bold text-red-400">{formatCurrency(summary.expense)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-green-700 flex items-center gap-1 mb-1"><Wallet size={11} /> Saldo</p>
          <p className={`text-base font-bold ${summary.balance >= 0 ? 'text-green-300' : 'text-red-400'}`}>{formatCurrency(summary.balance)}</p>
        </CardContent></Card>
      </div>

      {/* Monthly overview chart */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-green-200">Evolução mensal</h3></CardHeader>
        <CardContent className="px-2 pb-4 pt-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#4a7a4a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#4a7a4a' }} axisLine={false} tickLine={false} tickFormatter={v => `${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Bar dataKey="receitas" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={32} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Saldo line */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-green-200">Resultado por mês</h3></CardHeader>
        <CardContent className="px-2 pb-4 pt-2">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#4a7a4a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#4a7a4a' }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="saldo" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', strokeWidth: 0, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {expenseCats.length > 0 && (
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-green-200">Despesas por categoria</h3></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <PieChart width={100} height={100}>
                  <Pie data={expenseCats} cx={45} cy={45} innerRadius={28} outerRadius={45} dataKey="value" paddingAngle={2}>
                    {expenseCats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <ul className="flex-1 flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                  {expenseCats.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-xs text-green-400 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-green-300 tabular-nums">{formatCurrency(c.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
        {incomeCats.length > 0 && (
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-green-200">Receitas por categoria</h3></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <PieChart width={100} height={100}>
                  <Pie data={incomeCats} cx={45} cy={45} innerRadius={28} outerRadius={45} dataKey="value" paddingAngle={2}>
                    {incomeCats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <ul className="flex-1 flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                  {incomeCats.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-xs text-green-400 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-green-300 tabular-nums">{formatCurrency(c.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
