import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../api/client'
import { DataTable } from '../../components/ui/DataTable'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

interface Category {
  id: number; code: string; name: string; display_order: number; is_active: boolean
}
const EMPTY = { code: '', name: '', display_order: 0 }

export default function CategoriesPage() {
  const [data, setData] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try { setData(await api.get<Category[]>('/categories?include_inactive=true')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setOpen(true) }
  const openEdit = (row: Category) => { setEditing(row); setForm({ code: row.code, name: row.name, display_order: row.display_order }); setError(''); setOpen(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      editing ? await api.put(`/categories/${editing.id}`, form) : await api.post('/categories', form)
      setOpen(false); await load()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (row: Category) => {
    if (!confirm(`Deactivate "${row.name}"?`)) return
    await api.delete(`/categories/${row.id}`); await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">หมวดสินค้าระดับสูงสุด (Sofa, Recliner, Bed, Chair)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 transition-colors">
          <Plus size={15} /> Add Category
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'code', header: 'Code', width: '100px' },
          { key: 'name', header: 'Name' },
          { key: 'display_order', header: 'Order', width: '80px' },
          { key: 'is_active', header: 'Status', width: '100px', render: r => <Badge active={r.is_active} /> },
        ]}
        data={data} loading={loading} onEdit={openEdit} onDelete={handleDelete}
      />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Category' : 'Add Category'} onSubmit={handleSubmit} saving={saving} error={error}>
        <div><Label required>Code</Label><Input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SF" maxLength={10} /></div>
        <div><Label required>Name</Label><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sofa" /></div>
        <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: +e.target.value }))} /></div>
      </FormDialog>
    </div>
  )
}
