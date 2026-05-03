'use client'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface Toast { id: string; type: ToastType; message: string }
interface ToastContextValue { toast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const icons = { success: CheckCircle, error: XCircle, warning: AlertCircle, info: Info }
  const colors = {
    success: 'border-[#C5D9C0] bg-white text-[#1A2E1A] [&_svg]:text-[#3A6432]',
    error:   'border-red-200 bg-white text-[#1A2E1A] [&_svg]:text-red-500',
    warning: 'border-yellow-200 bg-white text-[#1A2E1A] [&_svg]:text-yellow-600',
    info:    'border-blue-200 bg-white text-[#1A2E1A] [&_svg]:text-blue-500',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 sm:bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl animate-fade-in pointer-events-auto', colors[t.type])}>
              <Icon size={18} className="shrink-0" />
              <p className="text-sm flex-1">{t.message}</p>
              <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
