'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Target, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react'
import Link from 'next/link'
import type { FinTransaction, FinAccount, FinGoal } from '@/types/database'

interface Summary { income: number; expense: number; balance: number }
interface ChartDay { day: string; receitas: number; despesas: number }
interface CategorySplit { name: string; value: number; color: string }

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({ income: 0, expense: 0, balance: 0 })
  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [recentTx, setRecentTx] = useState<(FinTransaction & { category?: { name: string; color: string } })[]>([])
  const [chartData, setChartData] = useState<ChartDay[]>([])
  const [categoryData, setCategoryData] = useState<CategorySplit[]>([])
  const [goals, setGoals] = useState<FinGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const now = new Date()
  const monthLabel = MONTHS[now.getMonth()]

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member } = await supabase
      .from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    const hid = member.household_id
    setHouseholdId(hid)

    const m = now.getMonth() + 1
    const y = now.getFullYear()
    const start = `${y}-${String(m).padStart(2,'0')}-01`
    const end = `${y}-${String(m).padStart(2,'0')}-${new Date(y, m, 0).getDate()}`

    const { data: txsRaw } = await supabase.from('fin_transactions').select('*, category:fin_categories(name,color)')
      .eq('household_id', hid).gte('date', start).lte('date', end).order('date', { ascending: false })
    const { data: accsRaw } = await supabase.from('fin_accounts').select('*').eq('household_id', hid).eq('is_active', true)
    const { data: gsRaw } = await supabase.from('fin_goals').select('*').eq('household_id', hid).eq('status', 'active').limit(3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txs = txsRaw as any[] | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accs = accsRaw as any[] | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = gsRaw as any[] | null

    const t = txs || []
    const income = t.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0)
    const expense = t.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0)
    const balance = (accs || []).reduce((s, a) => s + Number(a.balance), 0)
    setSummary({ income, expense, balance })
    setAccounts(accs?.slice(0, 4) || [])
    setRecentTx((t as typeof recentTx).slice(0, 5))
    setGoals(gs || [])

    // Chart: last 7 days
    const days: ChartDay[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const dayTxs = t.filter(x => x.date === ds)
      days.push({
        day: String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'),
        receitas: dayTxs.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0),
        despesas: dayTxs.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0),
      })
    }
    setChartData(days)

    // Category split for expenses
    const catMap: Record<string, { name: string; color: string; value: number }> = {}
    t.filter(x => x.type === 'expense').forEach(x => {
      const cat = (x as typeof recentTx[0]).category
      const key = cat?.name || 'Outros'
      if (!catMap[key]) catMap[key] = { name: key, color: cat?.color || '#6b7280', value: 0 }
      catMap[key].value += Number(x.amount)
    })
    setCategoryData(Object.values(catMap).sort((a, b) => b.value - a.value).slice(0, 5))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
    </div>
  )

  if (!householdId) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 px-6 text-center">
      <div className="w-16 h-16 bg-green-900/20 rounded-2xl flex items-center justify-center">
        <Wallet size={28} className="text-green-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-green-100 mb-1">Você ainda não tem um lar</h2>
        <p className="text-sm text-green-600">Crie ou entre em um lar para começar</p>
      </div>
      <Link href="/onboarding" className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors">
        Criar lar
      </Link>
    </div>
  )

  return (
    <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto lg:px-6 lg:py-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-green-700">Saldo Total</span>
              <Wallet size={14} className="text-green-700" />
            </div>
            <p className={`text-lg font-bold truncate ${summary.balance >= 0 ? 'text-green-300' : 'text-red-400'}`}>
              {formatCurrency(summary.balance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-green-700">Receitas</span>
              <TrendingUp size={14} className="text-green-500" />
            </div>
            <p className="text-lg font-bold text-green-400 truncate">{formatCurrency(summary.income)}</p>
            <p className="text-[10px] text-green-800 mt-0.5">{monthLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-green-700">Despesas</span>
              <TrendingDown size={14} className="text-red-500" />
            </div>
            <p className="text-lg font-bold text-red-400 truncate">{formatCurrency(summary.expense)}</p>
            <p className="text-[10px] text-green-800 mt-0.5">{monthLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.some(d => d.receitas > 0 || d.despesas > 0) && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-green-200">Últimos 7 dias</h3>
            <div className="flex items-center gap-3 text-xs text-green-700">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Receitas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Despesas</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4 pt-2">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a7a4a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#4a7a4a' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                <Tooltip
                  contentStyle={{ background: '#0f1a0f', border: '1px solid #1a2e1a', borderRadius: '12px', fontSize: '12px' }}
                  labelStyle={{ color: '#86efac' }} itemStyle={{ color: '#86efac' }}
                  formatter={(v) => formatCurrency(Number(v))}
                />
                <Area type="monotone" dataKey="receitas" stroke="#22c55e" fill="url(#colorIncome)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesas" stroke="#ef4444" fill="url(#colorExpense)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Accounts */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-green-200">Contas</h3>
            <Link href="/accounts" className="text-xs text-green-600 hover:text-green-400 flex items-center gap-1 transition-colors">
              Ver todas <ArrowUpRight size={12} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <p className="text-sm text-green-700">Nenhuma conta cadastrada</p>
                <Link href="/accounts" className="text-xs text-green-500 hover:text-green-400 flex items-center gap-1">
                  <Plus size={12} /> Adicionar conta
                </Link>
              </div>
            ) : (
              <ul>
                {accounts.map((acc, i) => (
                  <li key={acc.id} className={`flex items-center gap-3 px-5 py-3 ${i < accounts.length - 1 ? 'border-b border-[#1a2e1a]' : ''}`}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: acc.color + '22', border: `1px solid ${acc.color}44` }}>
                      <Wallet size={14} style={{ color: acc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-200 truncate">{acc.name}</p>
                      <p className="text-xs text-green-700 capitalize">{acc.type.replace('_', ' ')}</p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums ${Number(acc.balance) >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                      {formatCurrency(Number(acc.balance))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Gastos por categoria */}
        {categoryData.length > 0 ? (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-green-200">Despesas por categoria</h3>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <PieChart width={100} height={100}>
                <Pie data={categoryData} cx={45} cy={45} innerRadius={28} outerRadius={45} dataKey="value" paddingAngle={2}>
                  {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <ul className="flex-1 flex flex-col gap-1.5">
                {categoryData.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="text-xs text-green-400 flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-green-300 tabular-nums">{formatCurrency(c.value)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          /* Goals */
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-green-200">Metas</h3>
              <Link href="/goals" className="text-xs text-green-600 hover:text-green-400 flex items-center gap-1 transition-colors">
                Ver todas <ArrowUpRight size={12} />
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {goals.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <p className="text-sm text-green-700">Nenhuma meta cadastrada</p>
                  <Link href="/goals" className="text-xs text-green-500 hover:text-green-400 flex items-center gap-1">
                    <Plus size={12} /> Criar meta
                  </Link>
                </div>
              ) : goals.map(g => {
                const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100)
                return (
                  <div key={g.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-200 truncate">{g.name}</p>
                      <span className="text-xs text-green-500">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-[#1a2e1a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                    <p className="text-xs text-green-700">{formatCurrency(Number(g.current_amount))} / {formatCurrency(Number(g.target_amount))}</p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-green-200">Últimas transações</h3>
          <Link href="/transactions" className="text-xs text-green-600 hover:text-green-400 flex items-center gap-1 transition-colors">
            Ver todas <ArrowUpRight size={12} />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentTx.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm text-green-700">Nenhuma transação este mês</p>
              <Link href="/transactions" className="text-xs text-green-500 hover:text-green-400 flex items-center gap-1">
                <Plus size={12} /> Adicionar transação
              </Link>
            </div>
          ) : (
            <ul>
              {recentTx.map((tx, i) => (
                <li key={tx.id} className={`flex items-center gap-3 px-5 py-3 ${i < recentTx.length - 1 ? 'border-b border-[#1a2e1a]' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-income' : tx.type === 'expense' ? 'bg-expense' : 'bg-transfer'}`}>
                    {tx.type === 'income' ? <ArrowUpRight size={16} className="text-income" /> : <ArrowDownRight size={16} className="text-expense" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-200 truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tx.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: tx.category.color + '22', color: tx.category.color }}>
                          {tx.category.name}
                        </span>
                      )}
                      <span className="text-xs text-green-800">{new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
