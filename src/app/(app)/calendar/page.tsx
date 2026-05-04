'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle,
  AlertCircle, Clock, Repeat, CalendarDays
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

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
  status: string
}

interface CalendarBill {
  billId: string
  name: string
  type: string
  amount: number
  instNum: number
  totalInst: number | null
  isPaid: boolean
  isOverdue: boolean
  isDueSoon: boolean
  dueDay: number
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const FIXED_BILL_TYPES = ['agua', 'luz', 'gas', 'internet', 'condominio', 'saude', 'seguro', 'aluguel', 'outro_fixo']

export default function CalendarPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data } = await db
      .from('fin_installments')
      .select('*')
      .eq('status', 'active')
    setBills(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-indexed

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const todayDay = today.getDate()

  function getBillsForDay(day: number): CalendarBill[] {
    const dueDate = new Date(year, month, day)
    dueDate.setHours(0, 0, 0, 0)
    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000)

    return bills.flatMap(bill => {
      if (bill.due_day !== day) return []

      const start = new Date(bill.start_date + 'T12:00:00')
      const monthsDiff = (year - start.getFullYear()) * 12 + (month - start.getMonth())
      if (monthsDiff < 0) return [] // ainda não começou

      const instNum = monthsDiff + 1
      if (bill.total_installments && instNum > bill.total_installments) return [] // já terminou
      if (bill.until_date) {
        const until = new Date(bill.until_date + 'T12:00:00')
        if (new Date(year, month, day) > until) return []
      }

      const amount = bill.split_type === 'members'
        ? bill.installment_amount / (bill.split_count || 1)
        : bill.installment_amount
      const isPaid = instNum <= bill.paid_installments

      return [{
        billId: bill.id,
        name: bill.name,
        type: bill.type,
        amount,
        instNum,
        totalInst: bill.total_installments,
        isPaid,
        isOverdue: !isPaid && daysUntil < 0,
        isDueSoon: !isPaid && daysUntil >= 0 && daysUntil <= 5,
        dueDay: day,
      }]
    })
  }

  // Montar grade do calendário
  const firstWeekday = new Date(year, month, 1).getDay() // 0 = dom
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const calendarCells: Array<{ day: number | null; bills: CalendarBill[] }> = []
  for (let i = 0; i < firstWeekday; i++) calendarCells.push({ day: null, bills: [] })
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push({ day: d, bills: getBillsForDay(d) })
  while (calendarCells.length % 7 !== 0) calendarCells.push({ day: null, bills: [] })

  // Resumo do mês
  const allBillsMonth: CalendarBill[] = []
  for (let d = 1; d <= daysInMonth; d++) allBillsMonth.push(...getBillsForDay(d))
  const totalMonth  = allBillsMonth.reduce((s, b) => s + b.amount, 0)
  const paidMonth   = allBillsMonth.filter(b => b.isPaid).reduce((s, b) => s + b.amount, 0)
  const overdueList = allBillsMonth.filter(b => b.isOverdue)
  const dueSoonList = allBillsMonth.filter(b => b.isDueSoon)

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null) }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null) }

  const selectedBills = selectedDay !== null ? getBillsForDay(selectedDay) : []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#C5D9C0] border-t-[#3A6432] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth}
          className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors border border-[#E2DECE]">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-[#1A2E1A]">{MONTH_NAMES[month]} {year}</p>
          <p className="text-xs text-[#8FAA8F]">
            {allBillsMonth.length} vencimento{allBillsMonth.length !== 1 ? 's' : ''} · {formatCurrency(totalMonth)}
          </p>
        </div>
        <button onClick={nextMonth}
          className="p-2.5 rounded-xl hover:bg-[#EEF5EB] text-[#5A7A5A] hover:text-[#3A6432] transition-colors border border-[#E2DECE]">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Alertas do mês */}
      {(overdueList.length > 0 || dueSoonList.length > 0) && isCurrentMonth && (
        <div className="space-y-2">
          {overdueList.length > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-red-50 border border-red-200">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-700">
                  {overdueList.length === 1 ? '1 conta atrasada' : `${overdueList.length} contas atrasadas`}
                </p>
                <p className="text-[11px] text-red-500 mt-0.5 truncate">
                  {overdueList.map(b => b.name).join(', ')}
                </p>
              </div>
            </div>
          )}
          {dueSoonList.length > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">
                  {dueSoonList.length === 1 ? '1 conta vence em breve' : `${dueSoonList.length} vencem em breve`}
                </p>
                <p className="text-[11px] text-amber-600 mt-0.5 truncate">
                  {dueSoonList.map(b => b.name).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grade do calendário */}
      <Card>
        <CardContent className="p-3">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 mb-1.5">
            {WEEKDAY_LABELS.map(d => (
              <div key={d} className="text-center py-1">
                <span className="text-[11px] font-bold text-[#8FAA8F] uppercase">{d}</span>
              </div>
            ))}
          </div>

          {/* Células */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (cell.day === null) return <div key={idx} className="aspect-square" />

              const isToday = isCurrentMonth && cell.day === todayDay
              const isSelected = cell.day === selectedDay
              const hasOverdue  = cell.bills.some(b => b.isOverdue)
              const hasDueSoon  = cell.bills.some(b => b.isDueSoon)
              const allPaid     = cell.bills.length > 0 && cell.bills.every(b => b.isPaid)
              const hasBills    = cell.bills.length > 0

              // Cor do fundo/borda
              let cellBg = ''
              let numColor = 'text-[#1A2E1A]'

              if (isSelected) {
                cellBg = 'bg-[#3A6432]'
                numColor = 'text-white'
              } else if (isToday) {
                cellBg = 'ring-2 ring-[#3A6432] bg-[#EEF5EB]'
                numColor = 'text-[#3A6432] font-bold'
              } else if (hasOverdue) {
                cellBg = 'bg-red-50'
              } else if (hasDueSoon) {
                cellBg = 'bg-amber-50'
              } else if (allPaid) {
                cellBg = 'bg-[#F5FAF4]'
              }

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(cell.day === selectedDay ? null : cell.day)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative ${cellBg} ${hasBills ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                >
                  <span className={`text-[13px] leading-none font-medium ${numColor}`}>
                    {cell.day}
                  </span>
                  {hasBills && (
                    <div className="flex gap-0.5 mt-1">
                      {cell.bills.slice(0, 3).map((b, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${
                          isSelected   ? 'bg-white/80'   :
                          b.isOverdue  ? 'bg-red-500'    :
                          b.isDueSoon  ? 'bg-amber-500'  :
                          b.isPaid     ? 'bg-[#3A6432]'  :
                                         'bg-[#8FAA8F]'
                        }`} />
                      ))}
                      {cell.bills.length > 3 && (
                        <span className={`text-[8px] leading-none font-bold ${isSelected ? 'text-white/80' : 'text-[#8FAA8F]'}`}>
                          +{cell.bills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {[
          { color: 'bg-red-500',    label: 'Atrasada' },
          { color: 'bg-amber-500',  label: 'Vence em breve' },
          { color: 'bg-[#3A6432]',  label: 'Paga' },
          { color: 'bg-[#8FAA8F]',  label: 'A pagar' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-[11px] text-[#8FAA8F]">{label}</span>
          </div>
        ))}
      </div>

      {/* Resumo do mês */}
      {allBillsMonth.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-[#8FAA8F] mb-1">Total</p>
            <p className="text-sm font-bold text-[#1A2E1A]">{formatCurrency(totalMonth)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-[#8FAA8F] mb-1">Pago</p>
            <p className="text-sm font-bold text-[#3A6432]">{formatCurrency(paidMonth)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-[#8FAA8F] mb-1">A pagar</p>
            <p className="text-sm font-bold text-red-500">{formatCurrency(totalMonth - paidMonth)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Detalhe do dia selecionado */}
      {selectedDay !== null && selectedBills.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-[#F0EDE6] bg-[#F9F7F4] rounded-t-2xl">
              <p className="text-sm font-semibold text-[#1A2E1A]">
                Dia {String(selectedDay).padStart(2, '0')}/{String(month + 1).padStart(2, '0')} — {selectedBills.length} conta{selectedBills.length !== 1 ? 's' : ''}
              </p>
            </div>
            <ul>
              {selectedBills.map(b => {
                const isFixedBill = FIXED_BILL_TYPES.includes(b.type)
                return (
                  <li key={b.billId} className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#F0EDE6] last:border-0 ${b.isPaid ? 'bg-[#FAFAF9]' : ''}`}>
                    {b.isPaid
                      ? <CheckCircle2 size={20} className="text-[#3A6432] shrink-0" />
                      : b.isOverdue
                        ? <AlertCircle size={20} className="text-red-500 shrink-0" />
                        : b.isDueSoon
                          ? <Clock size={20} className="text-amber-500 shrink-0" />
                          : <Circle size={20} className="text-[#C5D9C0] shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-medium ${b.isPaid ? 'line-through text-[#8FAA8F]' : 'text-[#1A2E1A]'}`}>
                          {b.name}
                        </p>
                        {isFixedBill && <Repeat size={11} className="text-[#8FAA8F] shrink-0" />}
                      </div>
                      <p className={`text-xs mt-0.5 ${
                        b.isOverdue ? 'text-red-500 font-medium' :
                        b.isDueSoon ? 'text-amber-600 font-medium' :
                        'text-[#8FAA8F]'
                      }`}>
                        {isFixedBill
                          ? 'Conta fixa'
                          : `${b.instNum}ª parcela${b.totalInst ? ` de ${b.totalInst}` : ''}`
                        }
                        {b.isOverdue && ' · Atrasada!'}
                        {b.isDueSoon && !b.isOverdue && ' · Vence em breve'}
                        {b.isPaid && ' · Paga ✓'}
                      </p>
                    </div>
                    <p className={`text-base font-bold shrink-0 ${
                      b.isPaid    ? 'text-[#8FAA8F] line-through' :
                      b.isOverdue ? 'text-red-600' :
                      b.isDueSoon ? 'text-amber-700' :
                                    'text-[#1A2E1A]'
                    }`}>
                      {formatCurrency(b.amount)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {selectedDay !== null && selectedBills.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CalendarDays size={28} className="text-[#C5D9C0] mx-auto mb-2" />
            <p className="text-sm text-[#8FAA8F]">
              Nenhum vencimento em {String(selectedDay).padStart(2, '0')}/{String(month + 1).padStart(2, '0')}
            </p>
          </CardContent>
        </Card>
      )}

      {allBillsMonth.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <CalendarDays size={32} className="text-[#C5D9C0]" />
            <p className="text-sm font-medium text-[#5A7A5A]">Nenhum vencimento em {MONTH_NAMES[month]}</p>
            <p className="text-xs text-[#8FAA8F]">Adicione contas na seção "Contas" para vê-las aqui</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
