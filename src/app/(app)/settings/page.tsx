'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { User, Lock, LogOut, Shield, Trash2, Camera } from 'lucide-react'
import type { Profile } from '@/types/database'

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email || '')
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        if (data) { setProfile(data); setName(data.full_name); setPhone(data.phone || '') }
        setLoading(false)
      })
    })
  }, [])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ full_name: name, phone, updated_at: new Date().toISOString() }).eq('id', profile.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Perfil atualizado!')
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) { toast('As senhas não coincidem', 'error'); return }
    if (newPassword.length < 6) { toast('Senha deve ter ao menos 6 caracteres', 'error'); return }
    setChangingPwd(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPwd(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Senha alterada com sucesso!')
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-4 max-w-lg mx-auto lg:px-6 lg:py-6 space-y-4">
      {/* Avatar */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-green-900/40 border border-green-800/30 flex items-center justify-center text-2xl font-bold text-green-300">
              {initials}
            </div>
          </div>
          <div>
            <p className="text-base font-semibold text-green-100">{name || 'Usuário'}</p>
            <p className="text-sm text-green-700">{email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User size={16} className="text-green-500" />
            <h3 className="text-sm font-semibold text-green-200">Informações pessoais</h3>
          </div>
        </CardHeader>
        <CardContent className="p-5 flex flex-col gap-4">
          <Input label="Nome completo" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
          <Input label="Telefone (opcional)" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" type="tel" />
          <Input label="E-mail" value={email} disabled className="opacity-60" />
          <Button onClick={saveProfile} loading={saving}>Salvar alterações</Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-green-500" />
            <h3 className="text-sm font-semibold text-green-200">Alterar senha</h3>
          </div>
        </CardHeader>
        <CardContent className="p-5 flex flex-col gap-4">
          <Input label="Nova senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          <Input label="Confirmar nova senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          <Button onClick={changePassword} loading={changingPwd} variant="secondary">Alterar senha</Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-green-500" />
            <h3 className="text-sm font-semibold text-green-200">Conta</h3>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <Button variant="destructive" onClick={signOut} className="w-full">
            <LogOut size={16} /> Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
