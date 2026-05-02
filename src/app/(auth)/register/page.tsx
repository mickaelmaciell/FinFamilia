'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Lock, User, TrendingUp } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('As senhas não coincidem.'); return }
    if (form.password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } }
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/onboarding')
  }

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 border border-green-800/40 rounded-2xl mb-4">
          <TrendingUp size={28} className="text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-green-100">FinFamília</h1>
        <p className="text-green-600 mt-1 text-sm">Comece a organizar suas finanças</p>
      </div>

      <div className="bg-[#0f1a0f] border border-[#1a2e1a] rounded-2xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-green-100 mb-1">Criar conta</h2>
        <p className="text-sm text-green-600 mb-6">Gratuito para sempre</p>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <Input label="Nome completo" type="text" placeholder="João Silva" value={form.name} onChange={set('name')} icon={<User size={16} />} required />
          <Input label="E-mail" type="email" placeholder="seu@email.com" value={form.email} onChange={set('email')} icon={<Mail size={16} />} required autoComplete="email" />
          <Input label="Senha" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} icon={<Lock size={16} />} required autoComplete="new-password" />
          <Input label="Confirmar senha" type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} icon={<Lock size={16} />} required autoComplete="new-password" />

          {error && <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

          <Button type="submit" loading={loading} className="w-full mt-1" size="lg">Criar conta</Button>
        </form>
      </div>

      <p className="text-center text-sm text-green-700 mt-4">
        Já tem conta?{' '}
        <Link href="/login" className="text-green-500 hover:text-green-400 font-medium transition-colors">Entrar</Link>
      </p>
    </div>
  )
}
