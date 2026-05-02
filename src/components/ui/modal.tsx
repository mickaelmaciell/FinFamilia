'use client'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const maxW = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-2xl' }[size]

  const content = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className={cn(
        'relative w-full flex flex-col',
        'bg-[#0c150c] border border-[#1e341e]',
        'rounded-t-3xl sm:rounded-2xl',
        'shadow-[0_-8px_32px_rgba(0,0,0,0.6)]',
        'animate-fade-up max-h-[92dvh]',
        maxW,
      )}>
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#1e341e]" />
        </div>

        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-4 border-b border-[#1e341e] shrink-0 sm:pt-5">
            <div>
              {title && <h2 className="text-[15px] font-semibold text-green-100 leading-snug">{title}</h2>}
              {description && <p className="text-[13px] text-green-600 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-green-700 hover:text-green-400 hover:bg-[#172617] transition-colors shrink-0 mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}
