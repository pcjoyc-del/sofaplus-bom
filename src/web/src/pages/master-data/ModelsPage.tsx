import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../api/client'
import { DataTable } from '../../components/ui/DataTable'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

interface Category { id: number; code: string; name: string }
interface ProductModel { id: number; category_id: number; code: string; name: string | null; is_active: boolean }
const EMPTY = { category_id: 0, code: '', name: '' }

export default function ModelsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [data, setData] = useState<ProductModel[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductModel | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => { setLoading(true); try { setData(await api.get<ProductModel[]>('/models?include_inactive=true')) } finally { setLoading(false) } }
  useEffect(() => { api.get<Category[]>('/categories').then(setCategories); load() }, [])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const filtered = filterCat ? data.filter(m => m.category_id === filterCat) : data

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY, category_id: filterCat || (categories[0]?.id ?? 0) }); setError(''); setOpen(true) }
  const openEdit = (row: ProductModel) => { setEditing(row); setForm({ category_id: row.category_id, code: row.code, name: row.name ?? '' }); setError(''); setOpen(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, name: form.name || null }
      editing ? await api.put(`/models/${editing.id}`, payload) : await api.post('/models', payload)
      setOpen(false); await load()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const handleDelete = async (row: ProductModel) => {
    if (!confirm(`Deactivate "${row.code}"?`)) return
    await api.delete(`/models/${row.id}`); await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Models</h1>
          <p className="text-sm text-gray-500 mt-0.5">รุ่นโซฟา ผูกกับ Category (CHANA, BOKEH, IOWA, ...)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 transition-colors">
          <Plus size={15} /> Add Model
        </button>
      </div>

      <div className="mb-4">
        <Select value={filterCat} onChange={e => setFilterCat(+e.target.value)} className="w-48">
          <option value={0}>All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'code', header: 'Code', width: '140px' },
          { key: 'name', header: 'Name', render: r => r.name ?? <span className="text-gray-400 italic">—</span> },
          { key: 'category_id', header: 'Category', width: '120px', render: r => catMap[r.category_id]?.name ?? '-' },
          { key: 'is_active', header: 'Status', width: '100px', render: r => <Badge active={r.is_active} /> },
        ]}
        data={filtered} loading={loading} onEdit={openEdit} onDelete={handleDelete}
      />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Model' : 'Add Model'} onSubmit={handleSubmit} saving={saving} error={error}>
        <div>
          <Label required>Category</Label>
          <Select required value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: +e.target.value }))}>
            <option value={0} disabled>Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div><Label required>Code</Label><Input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CHANA" maxLength={30} /></div>
        <div><Label>Name (optional)</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Same as code if empty" /></div>
      </FormDialog>
    </div>
  )
}
