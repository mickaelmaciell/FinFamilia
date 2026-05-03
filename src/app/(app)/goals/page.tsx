'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, COLORS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, Target, Pencil, Trash2, PlusCircle, AlertTriangle, CheckCircle } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
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

  const { register, handleSubmit, reset, watch, setValue, control } = useForm({
    defaultValues: { name: '', description: '', target_amount: '', current_amount: '', deadline: '', color: '#3A6432' }
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
    setEditing(null)
    reset({ name: '', description: '', target_amount: '', current_amount: '', deadline: '', color: '#3A6432' })
    setShowModal(true)
  }

  function openEdit(g: FinGoal) {
    setEditing(g)
    reset({ name: g.name, description: g.description || '', target_amount: String(g.target_amount), current_amount: String(g.current_amount), deadline: g.deadline || '', color: g.color })
    setShowModal(true)
  }

  async function onSubmit(data: { name: string; description: string; target_amount: string; current_amount: string; deadline: string; color: string }) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      household_id: householdId, user_id: userId,
      name: data.name, description: data.description || null,
      target_amount: parseFloat(data.target_amount || '0'),
      current_amount: parseFloat(data.current_amount || '0'),
      deadline: data.deadline || null, color: data.color,
    }
    const { error } = editing
      ? await supabase.from('fin_goals').update({
          name: data.name, description: data.description || null,
          target_amount: parseFloat(data.target_amount || '0'),
          current_amount: parseFloat(data.current_amount || '0'),
          deadline: data.deadline || null, color: data.color,
          updated_at: new Date().toISOString()
        }).eq('id', editing.id)
      : await supabase.from('fin_goals').insert(payload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(editing ? 'Meta atualizada!' : 'Meta criada!')
    setShowModal(false); load()
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

  async function deleteGoal(id: string) {
    const supabase = createClient()
    await supabase.from('fin_goals').delete().eq('id', id)
    toast('Meta excluída!', 'info'); setDeleting(null); load()
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const displayed = tab === 'active' ? activeGoals : completedGoals

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">

      {/* ── Abas ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Tab switcher — fundo creme claro, sem preto */}
        <div className="flex bg-[#F0EDE6] border border-[#E2DECE] rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'active' ? 'bg-white text-[#1A2E1A] shadow-sm' : 'text-[#5A7A5A] hover:text-[#3A6432]'}`}
          >
            Ativas ({activeGoals.length})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'completed' ? 'bg-white text-[#1A2E1A] shadow-sm' : 'text-[#5A7A5A] hover:text-[#3A6432]'}`}
          >
            Concluídas ({completedGoals.length})
          </button>
        </div>
        <Button onClick={openNew}><Plus size={16} /> Nova meta</Button>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(n => <div key={n} className="bg-white border border-[#E2DECE] rounded-2xl h-40 animate-pulse shadow-sm" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white border border-[#E2DECE] rounded-2xl shadow-sm flex flex-col items-center gap-3 py-14 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF5EB] border border-[#C5D9C0] flex items-center justify-center">
            <Target size={26} className="text-[#3A6432]" />
          </div>
          <p className="text-base font-semibold text-[#1A2E1A]">
            Nenhuma meta {tab === 'active' ? 'ativa' : 'concluída'}
          </p>
          <p className="text-sm text-[#7A9A7A]">
            {tab === 'active' ? 'Defina objetivos financeiros e acompanhe seu progresso.' : 'As metas concluídas aparecerão aqui.'}
          </p>
          {tab === 'active' && <Button onClick={openNew} className="mt-1"><Plus size={15} /> Criar primeira meta</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayed.map(g => {
            const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100)
            const remaining = Number(g.target_amount) - Number(g.current_amount)
            return (
              <div key={g.id} className="relative overflow-hidden bg-white border border-[#E2DECE] rounded-2xl shadow-sm">
                {/* Barra de cor no topo */}
                <div className="h-[3px]" style={{ background: g.color }} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: g.color + '18', border: `1.5px solid ${g.color}40` }}>
                        <Target size={20} style={{ color: g.color }} />
                      </div>
                      <div>
                        <p className="text-base font-bold text-[#1A2E1A]">{g.name}</p>
                        {g.deadline && <p className="text-xs text-[#7A9A7A] mt-0.5">Prazo: {formatDate(g.deadline)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {g.status === 'active' && (
                        <button onClick={() => setShowDeposit(g)} className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#7A9A7A] hover:text-[#3A6432] transition-colors" title="Adicionar depósito">
                          <PlusCircle size={15} />
                        </button>
                      )}
                      <button onClick={() => openEdit(g)} className="p-2 rounded-lg hover:bg-[#EEF5EB] text-[#7A9A7A] hover:text-[#3A6432] transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(g.id)} className="p-2 rounded-lg hover:bg-red-50 text-[#7A9A7A] hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-bold text-[#1A2E1A]">{formatCurrency(Number(g.current_amount))}</span>
                    <span className="text-[#7A9A7A]">de {formatCurrency(Number(g.target_amount))}</span>
                  </div>

                  {/* Barra de progresso — fundo creme, nunca preto */}
                  <div className="h-3 bg-[#F0EDE6] rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#4A6A4A]">
                      {g.status === 'completed'
                        ? <span className="flex items-center gap-1 text-[#3A6432]"><CheckCircle size={13} /> Concluída</span>
                        : `Faltam ${formatCurrency(remaining)}`}
                    </span>
                    <span className="text-sm font-bold" style={{ color: g.color }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal criar/editar ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar meta' : 'Nova meta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <Input label="Nome da meta" placeholder="Ex: Viagem para Europa, Reserva de emergência..." {...register('name', { required: true })} />
          <Input label="Descrição (opcional)" placeholder="Detalhes sobre esta meta..." {...register('description')} />

          <Controller
            name="target_amount"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <CurrencyInput label="Valor alvo" value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="current_amount"
            control={control}
            render={({ field }) => (
              <CurrencyInput label="Valor já guardado" value={field.value} onChange={field.onChange} />
            )}
          />

          <Input label="Prazo (opcional)" type="date" {...register('deadline')} />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[#3A6432]">Cor da meta</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setValue('color', c)}
                  className={`w-9 h-9 rounded-xl transition-all ${selectedColor === c ? 'ring-2 ring-[#1A2E1A]/40 scale-110 shadow-md' : 'hover:scale-105'}`}
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

      {/* ── Modal depósito ── */}
      <Modal open={!!showDeposit} onClose={() => { setShowDeposit(null); setDepositAmount('') }} title="Adicionar depósito" size="sm">
        <div className="p-5 flex flex-col gap-4">
          {showDeposit && (
            <div className="bg-[#EEF5EB] border border-[#C5D9C0] rounded-xl p-3">
              <p className="text-sm font-bold text-[#1A2E1A]">{showDeposit.name}</p>
              <p className="text-xs text-[#4A6A4A] mt-0.5">Faltam {formatCurrency(Number(showDeposit.target_amount) - Number(showDeposit.current_amount))}</p>
            </div>
          )}
          <CurrencyInput label="Valor do depósito" value={depositAmount} onChange={setDepositAmount} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowDeposit(null); setDepositAmount('') }} className="flex-1">Cancelar</Button>
            <Button onClick={addDeposit} className="flex-1">Depositar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal excluir ── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir meta" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={17} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-600">Excluir esta meta permanentemente?</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button onClick={() => deleting && deleteGoal(deleting)} className="flex-1 !bg-red-500 hover:!bg-red-600 text-white border-0">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
