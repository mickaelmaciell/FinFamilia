'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS, ACCOUNT_TYPE_LABELS } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Target, ArrowUpRight, ArrowDownRight, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { FinTransaction, FinAccount, FinGoal } from '@/types/database'

interface Summary { income: number; expense: number; balance: number }
interface ChartDay { day: string; receitas: number; despesas: number }
interface CategorySplit { name: string; value: number; color: string }

function formatRelativeDate(dateStr: string): string {
  const today = new Date()
  const d = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

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

    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    const hid = member.household_id
    setHouseholdId(hid)

    const m = now.getMonth() + 1
    const y = now.getFullYear()
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`

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
    setRecentTx((t as typeof recentTx).slice(0, 6))
    setGoals(gs || [])

    const days: ChartDay[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const dayTxs = t.filter(x => x.date === ds)
      days.push({
        day: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'),
        receitas: dayTxs.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0),
        despesas: dayTxs.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0),
      })
    }
    setChartData(days)

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
    <div className="px-4 py-5 max-w-4xl mx-auto lg:px-6 space-y-4">
      {[1, 2, 3].map(n => (
        <div key={n} className="rounded-2xl bg-white border border-[#E2DECE] p-5 space-y-3 animate-pulse shadow-sm">
          <div className="h-3 w-24 rounded bg-[#EEF5EB]" />
          <div className="h-8 w-44 rounded bg-[#EEF5EB]" />
        </div>
      ))}
    </div>
  )

  if (!householdId) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-5 px-6 text-center">
      <div className="w-20 h-20 bg-[#EEF5EB] border border-[#C5D9C0] rounded-3xl flex items-center justify-center">
        <Wallet size={36} className="text-[#3A6432]" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#1A2E1A] mb-2">Você ainda não tem um lar</h2>
        <p className="text-base text-[#5A7A5A]">Crie ou entre em um lar para começar a controlar suas finanças</p>
      </div>
      <Link href="/onboarding" className="bg-[#3A6432] hover:bg-[#2E5028] text-white px-6 py-3 rounded-xl font-semibold text-base transition-colors">
        Criar meu lar
      </Link>
    </div>
  )

  const savingsRate = summary.income > 0 ? Math.round(((summary.income - summary.expense) / summary.income) * 100) : 0

  return (
    <div className="px-4 py-5 space-y-5 max-w-4xl mx-auto lg:px-6 lg:py-6">

      {/* ── Cabeçalho / Mês ── */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E1A]">Resumo de {monthLabel}</h1>
        <p className="text-sm font-medium text-[#4A6A4A] mt-0.5 capitalize">
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Banner: Saldo Total ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#C5D9C0] bg-[#243D22] p-6 shadow-md">
        {/* Decoração sutil — como a textura do quarto */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/4 blur-2xl pointer-events-none" />
        <div className="relative">
          <p className="text-sm font-medium text-[#8BB88A] mb-1">Saldo em todas as contas</p>
          <p className={`text-4xl font-bold tracking-tight tabular-nums ${summary.balance >= 0 ? 'text-[#EEF5EB]' : 'text-red-300'}`}>
            {formatCurrency(summary.balance)}
          </p>
          {savingsRate !== 0 && (
            <p className="text-sm text-[#6A9A68] mt-2.5">
              Taxa de poupança: <span className={`font-bold ${savingsRate >= 0 ? 'text-[#C8E6C4]' : 'text-red-300'}`}>{savingsRate}%</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Receitas e Despesas ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#E2DECE] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEF5EB] flex items-center justify-center">
              <TrendingUp size={16} className="text-[#3A6432]" />
            </div>
            <span className="text-sm font-semibold text-[#5A7A5A]">Receitas</span>
          </div>
          <p className="text-2xl font-bold text-[#3A6432] tabular-nums">{formatCurrency(summary.income)}</p>
          <p className="text-xs text-[#8FAA8F] mt-1">{monthLabel}</p>
        </div>
        <div className="rounded-2xl border border-[#E2DECE] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingDown size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-semibold text-[#5A7A5A]">Despesas</span>
          </div>
          <p className="text-2xl font-bold text-red-500 tabular-nums">{formatCurrency(summary.expense)}</p>
          <p className="text-xs text-[#8FAA8F] mt-1">{monthLabel}</p>
        </div>
      </div>

      {/* ── Gráfico 7 dias ── */}
      {chartData.some(d => d.receitas > 0 || d.despesas > 0) && (
        <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1A2E1A]">Últimos 7 dias</h3>
            <div className="flex items-center gap-4 text-xs text-[#8FAA8F]">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3A6432] inline-block" /> Receitas</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Despesas</span>
            </div>
          </div>
          <div className="px-2 pb-4 pt-3">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3A6432" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3A6432" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#8FAA8F' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8FAA8F' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E2DECE', borderRadius: '12px', fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  labelStyle={{ color: '#1A2E1A', fontWeight: 600 }}
                  itemStyle={{ color: '#5A7A5A' }}
                  formatter={(v) => formatCurrency(Number(v))}
                />
                <Area type="monotone" dataKey="receitas" stroke="#3A6432" fill="url(#colorIncome)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="despesas" stroke="#ef4444" fill="url(#colorExpense)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Contas ── */}
      <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1A2E1A]">Minhas Contas</h3>
          <Link href="/accounts" className="flex items-center gap-1 text-sm font-medium text-[#3A6432] hover:text-[#2E5028] transition-colors">
            Ver todas <ChevronRight size={15} />
          </Link>
        </div>
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[#8FAA8F]">Nenhuma conta cadastrada ainda</p>
            <Link href="/accounts" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0] text-sm font-semibold text-[#3A6432] hover:bg-[#E0EDD9] transition-all">
              <Plus size={14} /> Adicionar conta
            </Link>
          </div>
        ) : (
          <ul>
            {accounts.map((acc, i) => (
              <li key={acc.id} className={`flex items-center gap-4 px-5 py-4 ${i < accounts.length - 1 ? 'border-b border-[#F5F2EC]' : ''}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: acc.color + '18', border: `1.5px solid ${acc.color}44` }}>
                  <Wallet size={16} style={{ color: acc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-[#1A2E1A] truncate">{acc.name}</p>
                  <p className="text-sm font-medium text-[#4A6A4A]">{ACCOUNT_TYPE_LABELS[acc.type] || acc.type}</p>
                </div>
                <p className={`text-base font-bold tabular-nums ${Number(acc.balance) >= 0 ? 'text-[#3A6432]' : 'text-red-500'}`}>
                  {formatCurrency(Number(acc.balance))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Gastos por Categoria + Metas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categoryData.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EDE6]">
              <h3 className="text-base font-bold text-[#1A2E1A]">Onde estou gastando</h3>
            </div>
            <div className="p-5 flex items-center gap-5">
              <PieChart width={96} height={96}>
                <Pie data={categoryData} cx={44} cy={44} innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={3}>
                  {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <ul className="flex-1 flex flex-col gap-2.5">
                {categoryData.map((c, i) => (
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

        {goals.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1A2E1A]">Minhas Metas</h3>
              <Link href="/goals" className="flex items-center gap-1 text-sm font-medium text-[#3A6432] hover:text-[#2E5028] transition-colors">
                Ver todas <ChevronRight size={15} />
              </Link>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {goals.map(g => {
                const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100)
                return (
                  <div key={g.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1A2E1A]">{g.name}</p>
                      <span className="text-sm font-bold" style={{ color: g.color }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 bg-[#F0EDE6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                    <p className="text-xs text-[#8FAA8F]">
                      {formatCurrency(Number(g.current_amount))} de {formatCurrency(Number(g.target_amount))}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Últimas Transações ── */}
      <div className="bg-white rounded-2xl border border-[#E2DECE] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1A2E1A]">Últimas Transações</h3>
          <Link href="/transactions" className="flex items-center gap-1 text-sm font-medium text-[#3A6432] hover:text-[#2E5028] transition-colors">
            Ver todas <ChevronRight size={15} />
          </Link>
        </div>
        {recentTx.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center px-6">
            <p className="text-base font-semibold text-[#1A2E1A]">Nenhuma transação registrada este mês</p>
            <p className="text-sm text-[#4A6A4A]">Registre sua primeira entrada ou saída para começar.</p>
            <Link href="/transactions" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#EEF5EB] border border-[#C5D9C0] text-sm font-semibold text-[#3A6432] hover:bg-[#E0EDD9] transition-all">
              <Plus size={14} /> Registrar primeira transação
            </Link>
          </div>
        ) : (
          <ul>
            {recentTx.map((tx, i) => (
              <li key={tx.id} className={`flex items-center gap-4 px-5 py-4 ${i < recentTx.length - 1 ? 'border-b border-[#F5F2EC]' : ''}`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-[#EEF5EB] border border-[#C5D9C0]' : 'bg-red-50 border border-red-100'}`}>
                  {tx.type === 'income'
                    ? <ArrowUpRight size={20} className="text-[#3A6432]" />
                    : <ArrowDownRight size={20} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-[#1A2E1A] truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {tx.category && (
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: tx.category.color + '18', color: tx.category.color }}>
                        {tx.category.name}
                      </span>
                    )}
                    <span className="text-sm text-[#8FAA8F]">{formatRelativeDate(tx.date)}</span>
                  </div>
                </div>
                <p className={`text-base font-bold tabular-nums ${tx.type === 'income' ? 'text-[#3A6432]' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── FAB: Nova Transação ── */}
      <Link
        href="/transactions"
        className="fixed bottom-24 right-5 lg:bottom-8 lg:right-8 z-30 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-[#243D22] hover:bg-[#1E3320] text-white font-semibold text-base shadow-xl shadow-[#243D22]/30 transition-all active:scale-95 hover:scale-105"
      >
        <Plus size={22} />
        <span className="hidden sm:inline">Nova Transação</span>
      </Link>
    </div>
  )
}
