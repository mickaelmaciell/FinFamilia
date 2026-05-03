'use client'
import { forwardRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

/**
 * CurrencyInput — campo monetário brasileiro (R$ 1.234,56)
 * - Armazena o valor numérico via onChange com valor parseado
 * - Exibe formatado enquanto o usuário digita
 */

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string
  error?: string
  hint?: string
  value?: string | number
  onChange?: (raw: string) => void
}

function formatBRL(raw: string): string {
  // Remove tudo que não é dígito
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Converte centavos: "12345" → "123,45"
  const cents = parseInt(digits, 10)
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseRaw(formatted: string): string {
  // "1.234,56" → "1234.56"
  return formatted.replace(/\./g, '').replace(',', '.')
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, label, error, hint, value, onChange, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')

    // Formata o valor atual para exibição
    const displayValue = value !== undefined && value !== ''
      ? formatBRL(String(value).replace('.', '').replace(',', ''))
      : ''

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatBRL(e.target.value)
      const raw = parseRaw(formatted)
      e.target.value = formatted
      onChange?.(raw)
    }, [onChange])

    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-[#3A6432] leading-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A9A7A] text-sm font-medium pointer-events-none">
            R$
          </span>
          <input
            ref={ref}
            id={inputId}
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            className={cn(
              'w-full h-12 pl-10 pr-4 rounded-xl text-base font-medium transition-all duration-150',
              'bg-white text-[#1A2E1A] placeholder:text-[#9EB09E] placeholder:font-normal',
              'border border-[#D5CCBE]',
              'focus:outline-none focus:border-[#3A6432] focus:ring-2 focus:ring-[#3A6432]/15 focus:bg-white',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-red-400 focus:border-red-500 focus:ring-red-400/15',
              className,
            )}
            placeholder="0,00"
            {...props}
          />
        </div>
        {error && <p className="text-sm text-red-500 leading-tight mt-0.5">{error}</p>}
        {hint && !error && <p className="text-sm text-[#7A9A7A] leading-tight mt-0.5">{hint}</p>}
      </div>
    )
  }
)
CurrencyInput.displayName = 'CurrencyInput'
export { CurrencyInput }
