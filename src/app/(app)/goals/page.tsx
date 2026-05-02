'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, COLORS } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, Target, Pencil, Trash2, Check, X, PlusCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinGoal } from '@/types/database'

export default function GoalsPage() {
  const { toast } = useToast()
  const [goals, setGoals] = useState<FinGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDeposit, setShowDeposit] = useState<FinGoal | null>(null)
  const [editing, setEditing] = useState<FinGoal | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [tab, setTab] = useState<'active' | 'completed'>('active')

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { name: '', description: '', target_amount: '', current_amount: '0', deadline: '', color: '#16a34a' }
  })
  const selectedColor = watch('color')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    setHouseholdId(member.household_id)
    const { data } = await supabase.from('fin_goals').select('*').eq('household_id', member.household_id).order('created_at', { ascending: false })
    setGoals(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null); reset({ name: '', description: '', target_amount: '', current_amount: '0', deadline: '', color: '#16a34a' }); setShowModal(true)
  }
  function openEdit(g: FinGoal) {
    setEditing(g); reset({ name: g.name, description: g.description || '', target_amount: String(g.target_amount), current_amount: String(g.current_amount), deadline: g.deadline || '', color: g.color }); setShowModal(true)
  }

  async function onSubmit(data: { name: string; description: string; target_amount: string; current_amount: string; deadline: string; color: string }) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const payload = { household_id: householdId, user_id: userId, name: data.name, description: data.description || null, target_amount: parseFloat(data.target_amount), current_amount: parseFloat(data.current_amount || '0'), deadline: data.deadline || null, color: data.color }
    if (editing) {
      const { error } = await supabase.from('fin_goals').update({ name: data.name, description: data.description || null, target_amount: parseFloat(data.target_amount), current_amount: parseFloat(data.current_amount || '0'), deadline: data.deadline || null, color: data.color, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Meta atualizada!')
    } else {
      const { error } = await supabase.from('fin_goals').insert(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Meta criada!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function addDeposit() {
    if (!showDeposit || !depositAmount) return
    const supabase = createClient()
    const newAmount = Math.min(Number(showDeposit.target_amount), Number(showDeposit.current_amount) + parseFloat(depositAmount))
    const status = newAmount >= Number(showDeposit.target_amount) ? 'completed' : 'active'
    const { error } = await supabase.from('fin_goals').update({ current_amount: newAmount, status, updated_at: new Date().toISOString() }).eq('id', showDeposit.id)
    if (error) { toast(error.message, 'error'); return }
    if (status === 'completed') toast('🎉 Meta atingida! Parabéns!')
    else toast('Depósito adicionado!')
    setShowDeposit(null); setDepositAmount(''); load()
  }

  async function updateStatus(id: string, status: 'active' | 'completed' | 'cancelled') {
    const supabase = createClient()
    await supabase.from('fin_goals').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function deleteGoal(id: string) {
    const supabase = createClient()
    await supabase.from('fin_goals').delete().eq('id', id)
    toast('Meta excluída!', 'info'); setDeleting(null); load()
  }

  const filtered = goals.filter(g => g.status === tab || (tab === 'active' && g.status === 'active'))
  const completed = goals.filter(g => g.status === 'completed')

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl p-1 gap-1">
          <button onClick={() => setTab('active')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'active' ? 'bg-green-900/40 text-green-400' : 'text-green-700'}`}>
            Ativas ({goals.filter(g => g.status === 'active').length})
          </button>
          <button onClick={() => setTab('completed')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'completed' ? 'bg-green-900/40 text-green-400' : 'text-green-700'}`}>
            Concluídas ({completed.length})
          </button>
        </div>
        <Button onClick={openNew}><Plus size={16} /> Nova meta</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Target size={32} className="text-green-900" />
            <p className="text-sm text-green-700">Nenhuma meta {tab === 'active' ? 'ativa' : 'concluída'}</p>
            {tab === 'active' && <Button onClick={openNew} size="sm"><Plus size={14} /> Criar meta</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(tab === 'active' ? goals.filter(g => g.status === 'active') : completed).map(g => {
            const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100)
            const remaining = Number(g.target_amount) - Number(g.current_amount)
            return (
              <Card key={g.id} className="relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: g.color }} />
                <CardContent className="p-4 pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: g.color + '20' }}>
                        <Target size={16} style={{ color: g.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-200">{g.name}</p>
                        {g.deadline && <p className="text-[10px] text-green-800">Prazo: {formatDate(g.deadline)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {g.status === 'active' && (
                        <>
                          <button onClick={() => setShowDeposit(g)} className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-600 hover:text-green-400 transition-colors">
                            <PlusCircle size={13} />
                          </button>
                          <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                            <Pencil size={13} />
                          </button>
                        </>
                      )}
                      <button onClick={() => setDeleting(g.id)} className="p-1.5 rounded-lg hover:bg-red-900/20 text-green-700 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-green-300 font-semibold">{formatCurrency(Number(g.current_amount))}</span>
                      <span className="text-green-700">{formatCurrency(Number(g.target_amount))}</span>
                    </div>
                    <div className="h-3 bg-[#1a2e1a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-700">
                      {g.status === 'completed' ? '✓ Concluída' : `Faltam ${formatCurrency(remaining)}`}
                    </span>
                    <span className="text-sm font-bold" style={{ color: g.color }}>{pct.toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar meta' : 'Nova meta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <Input label="Nome da meta" placeholder="Ex: Viagem para Europa, Reserva de emergência..." {...register('name', { required: true })} />
          <Input label="Descrição (opcional)" placeholder="Detalhes da meta..." {...register('description')} />
          <Input label="Valor alvo (R$)" type="number" step="0.01" min="0.01" placeholder="0,00" {...register('target_amount', { required: true })} />
          <Input label="Valor já guardado (R$)" type="number" step="0.01" min="0" placeholder="0,00" {...register('current_amount')} />
          <Input label="Prazo (opcional)" type="date" {...register('deadline')} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-green-300/80">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setValue('color', c)}
                  className={`w-8 h-8 rounded-lg transition-all ${selectedColor === c ? 'ring-2 ring-white/60 scale-110' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showDeposit} onClose={() => { setShowDeposit(null); setDepositAmount('') }} title="Adicionar depósito" size="sm">
        <div className="p-5 flex flex-col gap-4">
          {showDeposit && (
            <div className="bg-[#1a2e1a] rounded-xl p-3">
              <p className="text-sm text-green-300 font-medium">{showDeposit.name}</p>
              <p className="text-xs text-green-600">Faltam {formatCurrency(Number(showDeposit.target_amount) - Number(showDeposit.current_amount))}</p>
            </div>
          )}
          <Input label="Valor do depósito (R$)" type="number" step="0.01" min="0.01" placeholder="0,00" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowDeposit(null); setDepositAmount('') }} className="flex-1">Cancelar</Button>
            <Button onClick={addDeposit} className="flex-1">Depositar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir meta" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-green-400">Excluir esta meta permanentemente?</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteGoal(deleting)} className="flex-1">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
