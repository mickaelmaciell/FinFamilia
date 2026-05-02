'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { TrendingUp, Users, Check, X } from 'lucide-react'

function InviteContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'success'>('loading')
  const [householdName, setHouseholdName] = useState('')
  const [inviterName, setInviterName] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Token não encontrado.'); return }
    const supabase = createClient()
    Promise.all([
      supabase.auth.getUser(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)('get_invitation_preview', { p_token: token }),
    ]).then(([{ data: { user } }, { data: rows, error }]) => {
      if (error || !rows || rows.length === 0) {
        setStatus('error'); setErrorMsg('Convite não encontrado.'); return
      }
      const row = rows[0]
      if (!row.is_valid) {
        setStatus('error'); setErrorMsg('Este convite expirou ou já foi usado.'); return
      }
      setHouseholdName(row.household_name || '')
      setInviterName(row.inviter_name || '')
      if (user) setUserId(user.id)
      setStatus('ready')
    })
  }, [token])

  async function acceptInvite() {
    if (!userId) {
      router.push(`/login?redirect=/invite?token=${token}`)
      return
    }
    setAccepting(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase.rpc as any)('accept_invitation', { p_token: token })
    setAccepting(false)
    if (error) { setErrorMsg(error.message); setStatus('error'); return }
    if (result === 'invalid') { setErrorMsg('Convite inválido ou expirado.'); setStatus('error'); return }
    if (result === 'already_member') {
      router.push('/dashboard'); return
    }
    setStatus('success')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080d08] px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 border border-green-800/40 rounded-2xl mb-4">
            <TrendingUp size={28} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-green-100">FinFamília</h1>
        </div>

        <div className="bg-[#0f1a0f] border border-[#1a2e1a] rounded-2xl p-6 shadow-2xl text-center">
          {status === 'loading' && (
            <div className="py-8">
              <div className="w-8 h-8 border-2 border-green-700 border-t-green-400 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-green-600 mt-3">Verificando convite...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-8">
              <X size={40} className="text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-green-100 mb-2">Convite inválido</h2>
              <p className="text-sm text-green-600 mb-5">{errorMsg || 'Este convite pode ter expirado ou já foi usado.'}</p>
              <Button onClick={() => router.push('/login')}>Ir para o login</Button>
            </div>
          )}

          {status === 'ready' && (
            <div className="py-4">
              <div className="w-14 h-14 bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users size={26} className="text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-green-100 mb-1">Você foi convidado!</h2>
              <p className="text-sm text-green-500 mb-2">
                {inviterName ? <><strong>{inviterName}</strong> te convidou para</> : 'Você foi convidado para'}
              </p>
              <div className="bg-green-900/20 border border-green-800/30 rounded-xl px-4 py-3 mb-6">
                <p className="text-base font-bold text-green-300">{householdName}</p>
              </div>
              {!userId && (
                <p className="text-xs text-green-700 mb-4">
                  Faça login ou crie uma conta para aceitar o convite.
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={acceptInvite} loading={accepting} className="w-full">
                  {userId ? 'Aceitar convite' : 'Entrar para aceitar'}
                </Button>
                {!userId && (
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/register?redirect=/invite?token=${token}`)}
                    className="w-full"
                  >
                    Criar conta nova
                  </Button>
                )}
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="py-8">
              <Check size={40} className="text-green-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-green-100 mb-2">Bem-vindo!</h2>
              <p className="text-sm text-green-600">
                Você entrou em <strong>{householdName}</strong>. Redirecionando...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080d08] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  )
}
