'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, Users, Home, Check } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [householdName, setHouseholdName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createHousehold() {
    if (!householdName.trim()) { setError('Digite um nome para o lar'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: household, error: hErr } = await supabase
      .from('households')
      .insert({ name: householdName, created_by: user.id })
      .select()
      .single()

    if (hErr) { setError(hErr.message); setLoading(false); return }

    await supabase.from('household_members').insert({
      household_id: household.id,
      user_id: user.id,
      role: 'owner',
    })

    setLoading(false)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#080d08] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/30 border border-green-800/40 rounded-2xl mb-4">
            <TrendingUp size={28} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-green-100">Bem-vindo ao FinFamília!</h1>
          <p className="text-green-600 mt-1 text-sm">Vamos configurar seu espaço financeiro</p>
        </div>

        {step === 1 && (
          <div className="bg-[#0f1a0f] border border-[#1a2e1a] rounded-2xl p-6">
            <div className="flex gap-4 mb-6">
              {[
                { icon: Home, label: 'Crie seu lar financeiro' },
                { icon: Users, label: 'Convide sua família' },
                { icon: Check, label: 'Comece a usar' },
              ].map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-xl bg-green-900/30 border border-green-800/30 flex items-center justify-center">
                    <item.icon size={18} className="text-green-400" />
                  </div>
                  <p className="text-xs text-green-600">{item.label}</p>
                </div>
              ))}
            </div>
            <h2 className="text-base font-semibold text-green-100 mb-1">Como se chama seu lar?</h2>
            <p className="text-sm text-green-600 mb-4">Ex: "Família Silva", "Apartamento 302"</p>
            <Input
              placeholder="Nome do seu lar"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              icon={<Home size={16} />}
              onKeyDown={e => e.key === 'Enter' && createHousehold()}
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <Button onClick={createHousehold} loading={loading} className="w-full mt-4" size="lg">
              Criar meu lar financeiro
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
