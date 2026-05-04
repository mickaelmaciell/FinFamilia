'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, AlertCircle, CheckCircle2, Clock, ArrowUpRight, Users, User, Calendar } from 'lucide-react'
import Link from 'next/link'

interface Bill {
  id: string
  user_id: string
  name: string
  type: string
  installment_amount: number
  total_installments: number | null
  paid_installments: number
  start_date: string
  due_day: number
  split_type: 'personal' | 'members'
  split_count: number
  until_date?: string | null
  household_id?: string | null
  notes?: string | null
  status: string
}

function getThisMonthInstallment(bill: Bill): { number: number; dueDate: Date } | null {
  const start = new Date(bill.start_date + 'T12:00:00')
  const now = new Date()
  const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (monthsDiff < 0) return null
  const instNum = monthsDiff + 1
  const total = bill.total_installments ?? Infinity
  if (instNum > total) return null
  if (bill.until_date && new Date(bill.until_date + 'T12:00:00') < now) return null
  return { number: instNum, dueDate: new Date(now.getFullYear(), now.getMonth(), bill.due_day) }
}

interface BillRow {
  bill: Bill
  inst: { number: number; dueDate: Date }
  isPaid: boolean
  myShare: number
  daysUntil: number
  isOverdue: boolean
  isDueSoon: boolean
  isMine: boolean
}

export default function DashboardPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const now = new Date()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: mem } = await supabase.from('household_members')
      .select('household_id').eq('user_id', user.id).single()
    setHouseholdId(mem?.household_id ?? null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: billsData } = await db
      .from('fin_installments')
      .select('*')
      .eq('status', 'active')

    setBills(billsData || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
    </div>
  )

  const buildRow = (bill: Bill): BillRow | null => {
    const inst = getThisMonthInstallment(bill)
    if (!inst) return null
    const isPaid = inst.number <= bill.paid_installments
    const isMine = bill.user_id === userId
    const myShare = bill.split_type === 'members'
      ? bill.installment_amount / (bill.split_count || 1)
      : bill.installment_amount
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const due = new Date(inst.dueDate); due.setHours(0, 0, 0, 0)
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86400000)
    return {
      bill, inst, isPaid, myShare, daysUntil, isMine,
      isOverdue: !isPaid && daysUntil < 0,
      isDueSoon: !isPaid && daysUntil >= 0 && daysUntil <= 5,
    }
  }

  const allRows = bills.map(buildRow).filter(Boolean) as BillRow[]
  const myRows = allRows.filter(r => r.isMine)
  const familyRows = allRows.filter(r => !r.isMine)

  const myPaid = myRows.filter(r => r.isPaid)
  const myOverdue = myRows.filter(r => r.isOverdue)
  const myDueSoon = myRows.filter(r => r.isDueSoon)
  const myTotalToPay = myRows.filter(r => !r.isPaid).reduce((s, r) => s + r.myShare, 0)
  const myTotalPaid = myRows.filter(r => r.isPaid).reduce((s, r) => s + r.myShare, 0)

  const sortedMyRows = [...myRows].sort((a, b) => a.inst.dueDate.getTime() - b.inst.dueDate.getTime())
  const sortedFamilyRows = [...familyRows].sort((a, b) => a.inst.dueDate.getTime() - b.inst.dueDate.getTime())

  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' })

  const renderRow = ({ bill, inst, isPaid, myShare, daysUntil, isOverdue, isDueSoon }: BillRow) => {
    const dueDateStr = inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const weekday = inst.dueDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    return (
      <div key={bill.id} className={`flex items-center gap-3 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0 ${isPaid ? 'bg-[#FAFAF9]' : ''}`}>
        <div className={`shrink-0 w-10 text-center rounded-lg py-1.5 border ${
          isPaid ? 'bg-[#EEF5EB] border-[#C5D9C0]' :
          isOverdue ? 'bg-red-50 border-red-200' :
          isDueSoon ? 'bg-amber-50 border-amber-100' :
          'bg-[#F5F2EE] border-[#E2DECE]'
        }`}>
          <p className={`text-sm font-bold leading-none ${isPaid ? 'text-[#3A6432]' : isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-700' : 'text-[#1A2E1A]'}`}>
            {dueDateStr.split('/')[0]}
          </p>
          <p className={`text-[9px] mt-0.5 leading-none capitalize ${isPaid ? 'text-[#8FAA8F]' : isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-500' : 'text-[#8FAA8F]'}`}>
            {weekday}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm font-medium ${isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>
              {bill.name}
            </p>
            {bill.split_type === 'members' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF5EB] border border-[#C5D9C0] text-[#5A7A5A] shrink-0">
                ÷{bill.split_count}
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${isPaid ? 'text-[#8FAA8F]' : isOverdue ? 'text-red-500' : isDueSoon ? 'text-amber-600' : 'text-[#5A7A5A]'}`}>
            {isPaid
              ? `Pago · parcela ${inst.number}${bill.total_installments ? ` de ${bill.total_installments}` : ''}`
              : isOverdue
              ? `Atrasado ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) > 1 ? 's' : ''}`
              : daysUntil === 0 ? 'Vence hoje!'
              : `Vence em ${daysUntil} dia${daysUntil > 1 ? 's' : ''} · parcela ${inst.number}`}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${isPaid ? 'text-[#8FAA8F] line-through' : isOverdue ? 'text-red-600' : 'text-[#1A2E1A]'}`}>
            {formatCurrency(myShare)}
          </p>
          {bill.split_type === 'members' && (
            <p className="text-[10px] text-[#8FAA8F]">sua parte</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto lg:px-6 lg:py-6">

      {/* ── Alertas de vencimento ── */}
      {(myOverdue.length > 0 || myDueSoon.length > 0) && (
        <div className="space-y-2">
          {myOverdue.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-700 mb-1.5">
                  {myOverdue.length === 1 ? '⚠️ 1 conta atrasada' : `⚠️ ${myOverdue.length} contas atrasadas`}
                </p>
                <ul className="space-y-1.5">
                  {myOverdue.map(r => (
                    <li key={r.bill.id} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-red-700 font-medium truncate">
                        {r.bill.name}
                        <span className="font-normal text-red-500 ml-1">
                          · venceu dia {r.inst.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-red-700 shrink-0">{formatCurrency(r.myShare)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {myDueSoon.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800 mb-1.5">
                  {myDueSoon.length === 1 ? '🔔 1 conta vence em breve' : `🔔 ${myDueSoon.length} contas vencem em breve`}
                </p>
                <ul className="space-y-1.5">
                  {myDueSoon.map(r => (
                    <li key={r.bill.id} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-amber-800 font-medium truncate">
                        {r.bill.name}
                        <span className="font-normal text-amber-600 ml-1">
                          · {r.daysUntil === 0 ? 'vence hoje!' : `em ${r.daysUntil} dia${r.daysUntil > 1 ? 's' : ''}`}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-amber-800 shrink-0">{formatCurrency(r.myShare)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Hero: resumo pessoal ── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-[#8FAA8F] capitalize">Minhas contas de {monthName}</p>
              <p className="text-2xl font-bold text-red-500 mt-0.5">{formatCurrency(myTotalToPay)}</p>
              <p className="text-xs text-[#8FAA8F] mt-0.5">
                a pagar · já pago <span className="text-[#3A6432] font-medium">{formatCurrency(myTotalPaid)}</span>
              </p>
            </div>
            <div className="w-16 h-16 relative shrink-0">
              <svg viewBox="0 0 36 36" className="rotate-[-90deg] w-full h-full">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#EEF5EB" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#3A6432" strokeWidth="4"
                  strokeDasharray={`${myRows.length > 0 ? (myPaid.length / myRows.length) * 87.96 : 0} 87.96`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold text-[#1A2E1A]">{myPaid.length}/{myRows.length}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {myOverdue.length > 0 && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600">
                <AlertCircle size={11} /> {myOverdue.length} atrasada{myOverdue.length > 1 ? 's' : ''}
              </span>
            )}
            {myDueSoon.length > 0 && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                <Clock size={11} /> {myDueSoon.length} vence em breve
              </span>
            )}
            {myPaid.length > 0 && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#EEF5EB] border border-[#C5D9C0] text-[#3A6432]">
                <CheckCircle2 size={11} /> {myPaid.length} paga{myPaid.length > 1 ? 's' : ''}
              </span>
            )}
            {myRows.length === 0 && bills.length > 0 && (
              <span className="text-xs text-[#8FAA8F]">Nenhuma conta sua este mês</span>
            )}
            {bills.length === 0 && (
              <span className="text-xs text-[#8FAA8F]">Nenhuma conta cadastrada</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Minhas contas do mês ── */}
      {sortedMyRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User size={14} className="text-[#5A7A5A]" />
              <h3 className="text-sm font-semibold text-[#1A2E1A]">
                Minhas contas — <span className="capitalize">{monthName}</span>
              </h3>
            </div>
            <Link href="/bills" className="text-xs text-[#5A7A5A] hover:text-[#3A6432] flex items-center gap-1 transition-colors">
              Gerenciar <ArrowUpRight size={12} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {sortedMyRows.map(row => renderRow(row))}
            <div className="px-5 py-3 bg-[#F9F7F4] border-t border-[#E2DECE] flex items-center justify-between">
              <span className="text-xs text-[#5A7A5A] font-medium">Total pessoal</span>
              <div className="flex items-center gap-3">
                {myTotalPaid > 0 && <span className="text-xs text-[#3A6432] font-medium">{formatCurrency(myTotalPaid)} pago</span>}
                {myTotalToPay > 0 && <span className="text-xs text-red-500 font-semibold">{formatCurrency(myTotalToPay)} a pagar</span>}
                {myTotalToPay === 0 && myTotalPaid > 0 && <span className="text-xs text-[#3A6432] font-semibold">✓ Mês quitado!</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Contas da família ── */}
      {sortedFamilyRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#5A7A5A]" />
              <h3 className="text-sm font-semibold text-[#1A2E1A]">
                Família — <span className="capitalize">{monthName}</span>
              </h3>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sortedFamilyRows.map(row => renderRow(row))}
            <div className="px-5 py-3 bg-[#F9F7F4] border-t border-[#E2DECE] flex items-center justify-between">
              <span className="text-xs text-[#5A7A5A] font-medium">Total família</span>
              <span className="text-xs font-semibold text-[#1A2E1A]">
                {formatCurrency(sortedFamilyRows.reduce((s, r) => s + r.myShare, 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Estado vazio ── */}
      {bills.length === 0 && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF5EB] flex items-center justify-center">
              <Plus size={24} className="text-[#5A7A5A]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A2E1A]">Nenhuma conta cadastrada</p>
              <p className="text-xs text-[#8FAA8F] mt-1">Adicione seu consórcio, financiamento,<br />cartão parcelado ou qualquer dívida fixa</p>
            </div>
            <Link href="/bills"
              className="mt-1 px-4 py-2 rounded-xl bg-[#3A6432] text-white text-sm font-medium hover:bg-[#2d4f27] transition-colors">
              + Adicionar conta a pagar
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Atalhos rápidos ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/calendar" className="flex items-center gap-3 p-4 rounded-2xl border border-[#E2DECE] bg-white hover:border-[#3A6432] hover:bg-[#EEF5EB]/40 transition-colors group">
          <div className="w-9 h-9 rounded-xl bg-[#EEF5EB] flex items-center justify-center shrink-0">
            <Calendar size={18} className="text-[#5A7A5A] group-hover:text-[#3A6432] transition-colors" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A2E1A]">Calendário</p>
            <p className="text-xs text-[#8FAA8F]">Ver vencimentos</p>
          </div>
        </Link>
        {!householdId ? (
          <Link href="/onboarding" className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-[#C5D9C0] hover:border-[#3A6432] hover:bg-[#EEF5EB]/40 transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-[#EEF5EB] flex items-center justify-center shrink-0">
              <Users size={18} className="text-[#5A7A5A] group-hover:text-[#3A6432] transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#5A7A5A] group-hover:text-[#3A6432]">Criar família</p>
              <p className="text-xs text-[#8FAA8F]">Dividir contas</p>
            </div>
          </Link>
        ) : (
          <Link href="/bills" className="flex items-center gap-3 p-4 rounded-2xl border border-[#E2DECE] bg-white hover:border-[#3A6432] hover:bg-[#EEF5EB]/40 transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-[#EEF5EB] flex items-center justify-center shrink-0">
              <Plus size={18} className="text-[#5A7A5A] group-hover:text-[#3A6432] transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A2E1A]">Nova conta</p>
              <p className="text-xs text-[#8FAA8F]">Adicionar conta</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
