'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, ACCOUNT_TYPE_LABELS, COLORS } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, Wallet, CreditCard, PiggyBank, TrendingUp, Banknote, MoreHorizontal, Pencil, Trash2, EyeOff, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinAccount } from '@/types/database'

const TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Wallet, savings: PiggyBank, credit_card: CreditCard,
  investment: TrendingUp, cash: Banknote, other: Wallet,
}

export default function AccountsPage() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FinAccount | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { name: '', type: 'checking', balance: '', color: '#16a34a', is_shared: true }
  })
  const selectedColor = watch('color')
  const selectedType = watch('type')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    setHouseholdId(member.household_id)
    const { data } = await supabase.from('fin_accounts').select('*').eq('household_id', member.household_id).order('created_at')
    setAccounts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    reset({ name: '', type: 'checking', balance: '', color: '#16a34a', is_shared: true })
    setShowModal(true)
  }

  function openEdit(acc: FinAccount) {
    setEditing(acc)
    reset({ name: acc.name, type: acc.type, balance: String(acc.balance), color: acc.color, is_shared: acc.is_shared })
    setShowModal(true)
  }

  async function onSubmit(data: { name: string; type: string; balance: string; color: string; is_shared: boolean }) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      household_id: householdId, user_id: userId,
      name: data.name, type: data.type as FinAccount['type'],
      balance: parseFloat(data.balance || '0'),
      color: data.color, is_shared: data.is_shared,
    }
    if (editing) {
      const { error } = await supabase.from('fin_accounts').update({ name: data.name, type: data.type as FinAccount['type'], balance: parseFloat(data.balance || '0'), color: data.color, is_shared: data.is_shared, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta atualizada!')
    } else {
      const { error } = await supabase.from('fin_accounts').insert(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Conta criada!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function toggleActive(acc: FinAccount) {
    const supabase = createClient()
    await supabase.from('fin_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id)
    setActiveMenu(null); load()
  }

  async function deleteAccount(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('fin_accounts').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Conta excluída!', 'info'); setDeleting(null); load()
  }

  const active = accounts.filter(a => a.is_active)
  const inactive = accounts.filter(a => !a.is_active)
  const totalBalance = active.reduce((s, a) => s + Number(a.balance), 0)

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      {/* Total */}
      <Card className="bg-gradient-to-br from-green-900/30 to-[#0f1a0f]">
        <CardContent className="p-5">
          <p className="text-sm text-green-600 mb-1">Patrimônio total</p>
          <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-300' : 'text-red-400'}`}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs text-green-700 mt-1">{active.length} conta{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}</p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus size={16} /> Nova conta</Button>
      </div>

      {/* Accounts list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {active.map(acc => {
                const Icon = TYPE_ICONS[acc.type] || Wallet
                return (
                  <Card key={acc.id} className="relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1" style={{ background: acc.color }} />
                    <CardContent className="p-4 pt-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: acc.color + '20', border: `1px solid ${acc.color}40` }}>
                            <Icon size={18} style={{ color: acc.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-200">{acc.name}</p>
                            <p className="text-xs text-green-700">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                          </div>
                        </div>
                        <div className="relative">
                          <button onClick={() => setActiveMenu(activeMenu === acc.id ? null : acc.id)}
                            className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                            <MoreHorizontal size={16} />
                          </button>
                          {activeMenu === acc.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 w-40 bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in">
                                <button onClick={() => { setActiveMenu(null); openEdit(acc) }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-green-400 hover:bg-[#1a2e1a] transition-colors">
                                  <Pencil size={14} /> Editar
                                </button>
                                <button onClick={() => toggleActive(acc)} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-green-400 hover:bg-[#1a2e1a] transition-colors">
                                  <EyeOff size={14} /> Arquivar
                                </button>
                                <button onClick={() => { setActiveMenu(null); setDeleting(acc.id) }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors">
                                  <Trash2 size={14} /> Excluir
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className={`text-xl font-bold tabular-nums ${Number(acc.balance) >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                          {formatCurrency(Number(acc.balance))}
                        </p>
                        {!acc.is_shared && <span className="text-[10px] text-green-800 mt-0.5 block">Conta privada</span>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p className="text-xs text-green-800 mb-2 flex items-center gap-1"><EyeOff size={12} /> Contas arquivadas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {inactive.map(acc => (
                  <div key={acc.id} className="flex items-center gap-3 bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl px-4 py-3 opacity-50">
                    <Wallet size={16} className="text-green-800" />
                    <div className="flex-1">
                      <p className="text-sm text-green-700">{acc.name}</p>
                      <p className="text-xs text-green-900">{formatCurrency(Number(acc.balance))}</p>
                    </div>
                    <button onClick={() => toggleActive(acc)} className="text-xs text-green-700 hover:text-green-400 transition-colors">
                      <Eye size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accounts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Wallet size={32} className="text-green-900" />
                <p className="text-sm text-green-700">Nenhuma conta cadastrada</p>
                <Button onClick={openNew}><Plus size={14} /> Adicionar conta</Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conta' : 'Nova conta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <Input label="Nome da conta" placeholder="Ex: Nubank, Bradesco..." {...register('name', { required: true })} />
          <Select label="Tipo" {...register('type')}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Saldo inicial (R$)" type="number" step="0.01" placeholder="0,00" {...register('balance')} />
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
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('is_shared')} className="w-4 h-4 accent-green-500" />
            <span className="text-sm text-green-300">Conta compartilhada com a família</span>
          </label>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir conta" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-green-400">Isso excluirá a conta permanentemente. As transações vinculadas também serão excluídas.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteAccount(deleting)} className="flex-1">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
