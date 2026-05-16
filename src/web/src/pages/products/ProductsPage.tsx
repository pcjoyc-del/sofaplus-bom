import { useState, useEffect } from 'react'
import { Plus, FileText, CheckCircle2, Layers, Copy, CheckCheck, XCircle } from 'lucide-react'
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
  bom_status: 'NONE' | 'DRAFT' | 'ACTIVE'
}
interface CopyToResult {
  product_id: number; product_name: string | null
  success: boolean; bom_number: string | null; error: string | null
}
interface CopyToResponse { copied: number; failed: number; results: CopyToResult[] }

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
  const bed = p.standard_bed_depth ? parseFloat(p.standard_bed_depth) : 0
  if (bed > 0) parts.push(`Bed${bed.toFixed(0)}`)
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

  // Copy TO state
  const [copyToSource, setCopyToSource] = useState<Product | null>(null)
  const [copyToOpen, setCopyToOpen] = useState(false)
  const [copyToSelected, setCopyToSelected] = useState<Set<number>>(new Set())
  const [copyToSaving, setCopyToSaving] = useState(false)
  const [copyToError, setCopyToError] = useState('')
  const [copyToResult, setCopyToResult] = useState<CopyToResponse | null>(null)

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

  // Copy TO handlers
  const openCopyTo = (source: Product) => {
    setCopyToSource(source)
    setCopyToSelected(new Set())
    setCopyToError('')
    setCopyToResult(null)
    setCopyToOpen(true)
  }
  const toggleCopyTarget = (id: number) => {
    setCopyToSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
    setCopyToResult(null)
  }
  const handleCopyTo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (copyToSelected.size === 0) { setCopyToError('เลือก Product ปลายทางอย่างน้อย 1 รายการ'); return }
    setCopyToSaving(true); setCopyToError('')
    try {
      const res = await api.post<CopyToResponse>(
        `/products/${copyToSource!.id}/bom/copy-to`,
        { target_product_ids: [...copyToSelected] }
      )
      setCopyToResult(res)
      await load()
    } catch (e: unknown) { setCopyToError((e as Error).message) }
    finally { setCopyToSaving(false) }
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
          {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
      </div>

      <DataTable<Product>
        columns={[
          { key: 'display_name', header: 'Product', render: r => r.display_name ?? r.code },
          { key: 'category_id',  header: 'Category',      width: '100px', render: r => catMap[r.category_id]?.name ?? '-' },
          { key: 'type_id',      header: 'Type',          width: '100px', render: r => typeMap[r.type_id]?.code  ?? '-' },
          { key: 'model_id',     header: 'Model',         width: '100px', render: r => modelMap[r.model_id]?.code ?? '-' },
          { key: 'size',      header: 'Standard Size', width: '130px', render: formatSize },
          { key: 'bom_status', header: 'BOM',          width: '150px', render: r => {
            if (r.bom_status === 'ACTIVE') return (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium">
                  <CheckCircle2 size={12} /> Active
                </span>
                <button onClick={() => navigate(`/products/${r.id}/bom`)}
                  className="text-xs text-sky-600 hover:text-sky-800 hover:underline font-medium">
                  View
                </button>
              </div>
            )
            if (r.bom_status === 'DRAFT') return (
              <button onClick={() => navigate(`/products/${r.id}/bom`)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors">
                <FileText size={12} /> กรอก BOM ▶
              </button>
            )
            return (
              <button onClick={() => navigate(`/products/${r.id}/bom`)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-400 border border-dashed border-gray-200 rounded-lg text-xs font-medium hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-colors">
                <Plus size={12} /> สร้าง BOM
              </button>
            )
          }},
          { key: 'variants', header: 'Variants', width: '90px', render: r => (
            r.bom_status === 'ACTIVE'
              ? <button onClick={() => navigate(`/products/${r.id}/variants`)} className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-xs font-medium"><Layers size={13} /> SKUs</button>
              : <span className="text-xs text-gray-300">—</span>
          )},
          { key: 'copy_to', header: '', width: '100px', render: r => (
            r.bom_status === 'ACTIVE'
              ? <button onClick={() => openCopyTo(r)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded transition-colors font-medium">
                  <Copy size={12} /> Copy TO
                </button>
              : null
          )},
          { key: 'status',    header: 'Status',      width: '90px',  render: r => <TagBadge label={r.status} color={STATUS_COLORS[r.status] ?? 'gray'} /> },
        ]}
        data={filteredData} loading={loading} onEdit={openEdit} onDelete={handleDelete}
      />

      {/* ── Copy TO Dialog ─────────────────────────────────────────── */}
      <FormDialog
        open={copyToOpen}
        onClose={() => { setCopyToOpen(false); setCopyToResult(null) }}
        title="Copy BOM ไปยัง Products อื่น"
        onSubmit={copyToResult ? (e) => { e.preventDefault(); setCopyToOpen(false); setCopyToResult(null) } : handleCopyTo}
        saving={copyToSaving}
        error={copyToError}
        submitLabel={copyToResult ? 'ปิด' : `Copy ไปยัง ${copyToSelected.size} Product${copyToSelected.size !== 1 ? 's' : ''}`}
        width="max-w-lg">

        {/* Source */}
        <div className="px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-lg text-sm">
          <p className="text-xs text-violet-500 font-medium mb-0.5">Copy FROM (ต้นฉบับ)</p>
          <p className="text-gray-800 font-medium">{copyToSource?.display_name ?? copyToSource?.code}</p>
        </div>

        {/* Result panel */}
        {copyToResult ? (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm px-1">
              <span className="flex items-center gap-1 text-green-700"><CheckCheck size={14} /> สำเร็จ {copyToResult.copied} รายการ</span>
              {copyToResult.failed > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle size={14} /> ล้มเหลว {copyToResult.failed} รายการ</span>}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {copyToResult.results.map(r => (
                <div key={r.product_id} className={`flex items-center justify-between px-3 py-2 text-sm ${r.success ? '' : 'bg-red-50'}`}>
                  <span className="text-gray-700">{r.product_name ?? `Product #${r.product_id}`}</span>
                  {r.success
                    ? <span className="flex items-center gap-1 text-green-600 text-xs font-mono"><CheckCheck size={12} />{r.bom_number}</span>
                    : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={12} />{r.error}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Target selection */
          <div>
            <Label required>เลือก Products ปลายทาง (Copy TO)</Label>
            <p className="text-xs text-gray-400 mb-2">สามารถเลือกหลาย Product พร้อมกันได้ — ระบบจะสร้าง Draft BOM ให้แต่ละตัว</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {filteredData.filter(p => p.id !== copyToSource?.id && p.is_active).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">ไม่มี Product อื่น</p>
              ) : (
                filteredData
                  .filter(p => p.id !== copyToSource?.id && p.is_active)
                  .map(p => (
                    <label key={p.id}
                      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 ${copyToSelected.has(p.id) ? 'bg-violet-50/50' : ''}`}>
                      <input type="checkbox" checked={copyToSelected.has(p.id)}
                        onChange={() => toggleCopyTarget(p.id)} className="rounded accent-violet-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">
                          {p.display_name ?? p.code}
                          {(p.standard_width || p.standard_depth) && (
                            <span className="ml-1.5 font-mono text-xs text-gray-400">
                              {p.standard_width ? `W${parseFloat(p.standard_width).toFixed(0)}` : ''}
                              {p.standard_depth ? ` × D${parseFloat(p.standard_depth).toFixed(0)}` : ''}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {p.bom_status === 'ACTIVE' ? '⚠ มี Active BOM แล้ว — จะสร้าง Draft ใหม่ทับ'
                            : p.bom_status === 'DRAFT' ? 'มี Draft BOM อยู่ — จะเพิ่ม Draft ใหม่'
                            : 'ยังไม่มี BOM'}
                        </p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.bom_status === 'ACTIVE' ? 'bg-green-50 text-green-700'
                        : p.bom_status === 'DRAFT' ? 'bg-amber-50 text-amber-600'
                        : 'bg-gray-100 text-gray-400'}`}>
                        {p.bom_status}
                      </span>
                    </label>
                  ))
              )}
            </div>
          </div>
        )}
      </FormDialog>

      {/* ── Add/Edit Product Dialog ────────────────────────────────── */}
      <FormDialog open={open} onClose={() => setOpen(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        onSubmit={handleSubmit} saving={saving} error={error} width="max-w-lg">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label required>Category</Label>
            <Select required value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: +e.target.value, type_id: 0, model_id: 0 }))}>
              <option value={0} disabled>Select</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
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
