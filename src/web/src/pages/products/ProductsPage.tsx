import { useState, useEffect } from 'react'
import { Plus, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { DataTable } from '../../components/ui/DataTable'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { TagBadge } from '../../components/ui/Badge'

interface Category { id: number; code: string; name: string }
interface ProductType { id: number; category_id: number; code: string; name: string }
interface ProductModel { id: number; category_id: number; code: string; name: string | null }
interface Product {
  id: number; code: string; category_id: number; type_id: number; model_id: number
  display_name: string | null; standard_width: string | null; standard_depth: string | null
  standard_bed_depth: string | null; status: string; is_active: boolean
}

const EMPTY = {
  category_id: 0, type_id: 0, model_id: 0,
  display_name: '', standard_width: '', standard_depth: '', standard_bed_depth: '',
  status: 'ACTIVE', notes: '',
}

const STATUS_COLORS: Record<string, 'blue' | 'amber' | 'gray'> = {
  ACTIVE: 'blue', DRAFT: 'amber', DISCONTINUED: 'gray',
}

function formatSize(p: Product) {
  if (!p.standard_width && !p.standard_depth) return <span className="text-gray-400">—</span>
  const parts = [`W${parseFloat(p.standard_width ?? '0').toFixed(0)}`]
  if (p.standard_depth) parts.push(`D${parseFloat(p.standard_depth).toFixed(0)}`)
  if (p.standard_bed_depth) parts.push(`Bed${parseFloat(p.standard_bed_depth).toFixed(0)}`)
  return <span className="font-mono text-xs">{parts.join(' × ')}</span>
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [allTypes, setAllTypes] = useState<ProductType[]>([])
  const [allModels, setAllModels] = useState<ProductModel[]>([])
  const [data, setData] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try { setData(await api.get<Product[]>('/products?include_inactive=true')) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    Promise.all([
      api.get<Category[]>('/categories').then(setCategories),
      api.get<ProductType[]>('/types').then(setAllTypes),
      api.get<ProductModel[]>('/models').then(setAllModels),
    ])
    load()
  }, [])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const typeMap = Object.fromEntries(allTypes.map(t => [t.id, t]))
  const modelMap = Object.fromEntries(allModels.map(m => [m.id, m]))
  const filteredTypes = form.category_id ? allTypes.filter(t => t.category_id === form.category_id) : allTypes
  const filteredModels = form.category_id ? allModels.filter(m => m.category_id === form.category_id) : allModels
  const filteredData = filterCat ? data.filter(p => p.category_id === filterCat) : data

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, category_id: filterCat || (categories[0]?.id ?? 0) })
    setError(''); setOpen(true)
  }
  const openEdit = (row: Product) => {
    setEditing(row)
    setForm({
      category_id: row.category_id, type_id: row.type_id, model_id: row.model_id,
      display_name: row.display_name ?? '',
      standard_width: row.standard_width ?? '', standard_depth: row.standard_depth ?? '',
      standard_bed_depth: row.standard_bed_depth ?? '', status: row.status, notes: '',
    })
    setError(''); setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        standard_width:     form.standard_width     ? parseFloat(form.standard_width)     : null,
        standard_depth:     form.standard_depth     ? parseFloat(form.standard_depth)     : null,
        standard_bed_depth: form.standard_bed_depth ? parseFloat(form.standard_bed_depth) : null,
        display_name: form.display_name || null,
        notes: form.notes || null,
      }
      editing ? await api.put(`/products/${editing.id}`, payload) : await api.post('/products', payload)
      setOpen(false); await load()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (row: Product) => {
    if (!confirm(`Deactivate "${row.display_name ?? row.code}"?`)) return
    await api.delete(`/products/${row.id}`); await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">Product Catalog — Category × Type × Model × Standard Size</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 transition-colors">
          <Plus size={15} /> Add Product
        </button>
      </div>

      <div className="mb-4">
        <Select value={filterCat} onChange={e => setFilterCat(+e.target.value)} className="w-48">
          <option value={0}>All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <DataTable<Product>
        columns={[
          { key: 'display_name', header: 'Product', render: r => r.display_name ?? r.code },
          { key: 'category_id',  header: 'Category',      width: '100px', render: r => catMap[r.category_id]?.name ?? '-' },
          { key: 'type_id',      header: 'Type',          width: '100px', render: r => typeMap[r.type_id]?.code  ?? '-' },
          { key: 'model_id',     header: 'Model',         width: '100px', render: r => modelMap[r.model_id]?.code ?? '-' },
          { key: 'size',         header: 'Standard Size', width: '140px', render: formatSize },
          { key: 'status',       header: 'Status',        width: '90px',  render: r => <TagBadge label={r.status} color={STATUS_COLORS[r.status] ?? 'gray'} /> },
          { key: 'bom',          header: 'BOM',           width: '70px',  render: r => (
            <button onClick={() => navigate(`/products/${r.id}/bom`)} className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-xs font-medium">
              <FileText size={13} /> Build
            </button>
          )},
        ]}
        data={filteredData} loading={loading} onEdit={openEdit} onDelete={handleDelete}
      />

      <FormDialog open={open} onClose={() => setOpen(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        onSubmit={handleSubmit} saving={saving} error={error} width="max-w-lg">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label required>Category</Label>
            <Select required value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: +e.target.value, type_id: 0, model_id: 0 }))}>
              <option value={0} disabled>Select</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label required>Type</Label>
            <Select required value={form.type_id} onChange={e => setForm(f => ({ ...f, type_id: +e.target.value }))}>
              <option value={0} disabled>Select</option>
              {filteredTypes.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
            </Select>
          </div>
          <div>
            <Label required>Model</Label>
            <Select required value={form.model_id} onChange={e => setForm(f => ({ ...f, model_id: +e.target.value }))}>
              <option value={0} disabled>Select</option>
              {filteredModels.map(m => <option key={m.id} value={m.id}>{m.code}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <Label>Display Name <span className="text-gray-400 font-normal">(auto: "Sofa | 2S | CHANA")</span></Label>
          <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Leave empty to auto-generate" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Standard Size (cm)</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label required>Width</Label><Input required type="number" step="0.01" value={form.standard_width} onChange={e => setForm(f => ({ ...f, standard_width: e.target.value }))} placeholder="200" /></div>
            <div><Label required>Depth</Label><Input required type="number" step="0.01" value={form.standard_depth} onChange={e => setForm(f => ({ ...f, standard_depth: e.target.value }))} placeholder="90" /></div>
            <div><Label>Bed Depth</Label><Input type="number" step="0.01" value={form.standard_bed_depth} onChange={e => setForm(f => ({ ...f, standard_bed_depth: e.target.value }))} placeholder="— (Bed only)" /></div>
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="DISCONTINUED">Discontinued</option>
          </Select>
        </div>
      </FormDialog>
    </div>
  )
}
