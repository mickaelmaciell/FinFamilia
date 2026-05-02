'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, TrendingUp, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 border border-green-800/40 rounded-2xl mb-4">
          <TrendingUp size={28} className="text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-green-100">FinFamília</h1>
      </div>

      <div className="bg-[#0f1a0f] border border-[#1a2e1a] rounded-2xl p-6 shadow-2xl">
        {sent ? (
          <div className="text-center py-4">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-green-100 mb-2">E-mail enviado!</h2>
            <p className="text-sm text-green-600">Verifique sua caixa de entrada e clique no link para redefinir sua senha.</p>
            <Link href="/login" className="inline-flex items-center gap-2 mt-5 text-sm text-green-500 hover:text-green-400">
              <ArrowLeft size={14} /> Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-green-100 mb-1">Redefinir senha</h2>
            <p className="text-sm text-green-600 mb-6">Enviaremos um link para seu e-mail</p>
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} icon={<Mail size={16} />} required />
              {error && <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <Button type="submit" loading={loading} className="w-full" size="lg">Enviar link</Button>
            </form>
          </>
        )}
      </div>

      <p className="text-center mt-4">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:text-green-400 transition-colors">
          <ArrowLeft size={14} /> Voltar ao login
        </Link>
      </p>
    </div>
  )
}
