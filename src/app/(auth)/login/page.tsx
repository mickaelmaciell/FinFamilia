'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Lock, TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error.message)
      setLoading(false)
    } else {
      const params = new URLSearchParams(window.location.search)
      const redirect = params.get('redirect') || '/dashboard'
      router.push(redirect)
      router.refresh()
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 border border-green-800/40 rounded-2xl mb-4 pulse-green">
          <TrendingUp size={28} className="text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-green-100">FinFamília</h1>
        <p className="text-green-600 mt-1 text-sm">Gestão financeira familiar</p>
      </div>

      <div className="bg-[#0f1a0f] border border-[#1a2e1a] rounded-2xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-green-100 mb-1">Entrar</h2>
        <p className="text-sm text-green-600 mb-6">Bem-vindo de volta!</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            icon={<Mail size={16} />}
            required
            autoComplete="email"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            icon={<Lock size={16} />}
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Link href="/reset-password" className="text-xs text-green-600 hover:text-green-400 transition-colors">
              Esqueci minha senha
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full mt-1" size="lg">
            Entrar
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-green-700 mt-4">
        Não tem conta?{' '}
        <Link href="/register" className="text-green-500 hover:text-green-400 font-medium transition-colors">
          Criar conta grátis
        </Link>
      </p>
    </div>
  )
}
