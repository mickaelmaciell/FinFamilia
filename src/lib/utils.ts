import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  return new Intl.DateTimeFormat('pt-BR', opts ?? { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export function formatDateShort(date: string | Date): string {
  return formatDate(date, { day: '2-digit', month: 'short' })
}

export const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  credit_card: 'Cartão de Crédito',
  investment: 'Investimento',
  cash: 'Dinheiro',
  other: 'Outro',
}

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
}

export const CATEGORY_ICONS = [
  { value: 'home', label: 'Casa' },
  { value: 'car', label: 'Carro' },
  { value: 'utensils', label: 'Alimentação' },
  { value: 'heart', label: 'Saúde' },
  { value: 'graduation-cap', label: 'Educação' },
  { value: 'shopping-bag', label: 'Compras' },
  { value: 'zap', label: 'Contas' },
  { value: 'wifi', label: 'Internet' },
  { value: 'tv', label: 'Entretenimento' },
  { value: 'plane', label: 'Viagem' },
  { value: 'dumbbell', label: 'Academia' },
  { value: 'shirt', label: 'Vestuário' },
  { value: 'briefcase', label: 'Trabalho' },
  { value: 'piggy-bank', label: 'Poupança' },
  { value: 'trending-up', label: 'Investimento' },
  { value: 'gift', label: 'Presente' },
  { value: 'music', label: 'Música' },
  { value: 'coffee', label: 'Café' },
  { value: 'smartphone', label: 'Celular' },
  { value: 'tag', label: 'Outros' },
]

export const COLORS = [
  '#16a34a','#15803d','#166534','#4ade80',
  '#3b82f6','#6366f1','#8b5cf6','#ec4899',
  '#f97316','#eab308','#ef4444','#14b8a6',
  '#06b6d4','#84cc16','#f59e0b','#64748b',
]
