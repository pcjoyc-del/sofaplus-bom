import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../api/client'
import { DataTable } from '../../components/ui/DataTable'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

interface Category { id: number; code: string; name: string }
interface ProductType { id: number; category_id: number; code: string; name: string; is_active: boolean }
const EMPTY = { category_id: 0, code: '', name: '' }

export default function TypesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [data, setData] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductType | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCats = async () => setCategories(await api.get<Category[]>('/categories'))
  const load = async () => {
    setLoading(true)
    try { setData(await api.get<ProductType[]>('/types?include_inactive=true')) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadCats(); load() }, [])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const filtered = filterCat ? data.filter(t => t.category_id === filterCat) : data

  const openCreate = () => {
    setEditing(null); setError('')
    setForm({ ...EMPTY, category_id: filterCat || (categories[0]?.id ?? 0) })
    setOpen(true)
  }
  const openEdit = (row: ProductType) => {
    setEditing(row); setForm({ category_id: row.category_id, code: row.code, name: row.name }); setError(''); setOpen(true)
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      editing ? await api.put(`/types/${editing.id}`, form) : await api.post('/types', form)
      setOpen(false); await load()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const handleDelete = async (row: ProductType) => {
    if (!confirm(`Deactivate "${row.name}"?`)) return
    await api.delete(`/types/${row.id}`); await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Types</h1>
          <p className="text-sm text-gray-500 mt-0.5">ประเภทย่อยภายใน Category (2S, 3S, BED 6FT, ...)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 transition-colors">
          <Plus size={15} /> Add Type
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
          { key: 'code', header: 'Code', width: '120px' },
          { key: 'name', header: 'Name' },
          { key: 'category_id', header: 'Category', width: '120px', render: r => catMap[r.category_id]?.name ?? '-' },
          { key: 'is_active', header: 'Status', width: '100px', render: r => <Badge active={r.is_active} /> },
        ]}
        data={filtered} loading={loading} onEdit={openEdit} onDelete={handleDelete}
      />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Type' : 'Add Type'} onSubmit={handleSubmit} saving={saving} error={error}>
        <div>
          <Label required>Category</Label>
          <Select required value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: +e.target.value }))}>
            <option value={0} disabled>Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div><Label required>Code</Label><Input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="2S" maxLength={30} /></div>
        <div><Label required>Name</Label><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="2-Seater" /></div>
      </FormDialog>
    </div>
  )
}
