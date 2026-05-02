'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COLORS } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Plus, Tag, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { FinCategory } from '@/types/database'

export default function CategoriesPage() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<FinCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FinCategory | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'expense' | 'income'>('expense')

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { name: '', type: 'expense', color: '#16a34a', icon: 'tag' }
  })
  const selectedColor = watch('color')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: member } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single()
    if (!member) { setLoading(false); return }
    setHouseholdId(member.household_id)
    const { data } = await supabase.from('fin_categories').select('*')
      .or(`household_id.eq.${member.household_id},household_id.is.null`)
      .order('sort_order').order('name')
    setCategories(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    reset({ name: '', type: tab, color: '#16a34a', icon: 'tag' })
    setShowModal(true)
  }

  function openEdit(cat: FinCategory) {
    if (cat.is_default) { toast('Categorias padrão não podem ser editadas', 'warning'); return }
    setEditing(cat)
    reset({ name: cat.name, type: cat.type, color: cat.color, icon: cat.icon })
    setShowModal(true)
  }

  async function onSubmit(data: { name: string; type: string; color: string; icon: string }) {
    if (!householdId) return
    setSaving(true)
    const supabase = createClient()
    if (editing) {
      const { error } = await supabase.from('fin_categories').update({ name: data.name, color: data.color, icon: data.icon }).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Categoria atualizada!')
    } else {
      const { error } = await supabase.from('fin_categories').insert({ household_id: householdId, name: data.name, type: data.type as 'income' | 'expense', color: data.color, icon: data.icon })
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Categoria criada!')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function deleteCategory(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('fin_categories').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Categoria excluída!', 'info'); setDeleting(null); load()
  }

  const filtered = categories.filter(c => c.type === tab)

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto lg:px-6 lg:py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex bg-[#0f1a0f] border border-[#1a2e1a] rounded-xl p-1 gap-1">
          <button onClick={() => setTab('expense')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'expense' ? 'bg-red-900/30 text-red-400' : 'text-green-700'}`}>
            <TrendingDown size={14} /> Despesas
          </button>
          <button onClick={() => setTab('income')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'income' ? 'bg-green-900/30 text-green-400' : 'text-green-700'}`}>
            <TrendingUp size={14} /> Receitas
          </button>
        </div>
        <Button onClick={openNew}><Plus size={16} /> Nova</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-green-700 border-t-green-400 rounded-full animate-spin" />
        </div>
      ) : (
        <Card>
          {filtered.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Tag size={32} className="text-green-900" />
              <p className="text-sm text-green-700">Nenhuma categoria de {tab === 'expense' ? 'despesa' : 'receita'}</p>
              <Button onClick={openNew} size="sm"><Plus size={14} /> Criar categoria</Button>
            </CardContent>
          ) : (
            <ul>
              {filtered.map((cat, i) => (
                <li key={cat.id} className={`flex items-center gap-3 px-4 py-3 group ${i < filtered.length - 1 ? 'border-b border-[#1a2e1a]' : ''}`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.color + '22', border: `1px solid ${cat.color}44` }}>
                    <Tag size={14} style={{ color: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-200">{cat.name}</p>
                    {cat.is_default && <span className="text-[10px] text-green-800">Padrão</span>}
                  </div>
                  {!cat.is_default && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-green-700 hover:text-green-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleting(cat.id)} className="p-1.5 rounded-lg hover:bg-red-900/20 text-green-700 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar categoria' : 'Nova categoria'} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <Input label="Nome" placeholder="Ex: Alimentação, Salário..." {...register('name', { required: true })} />
          {!editing && (
            <Select label="Tipo" {...register('type')}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </Select>
          )}
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

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Excluir categoria" size="sm">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-green-400">Excluir esta categoria? As transações vinculadas perderão a categoria.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => deleting && deleteCategory(deleting)} className="flex-1">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
