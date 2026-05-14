import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react'
import { api } from '../../api/client'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { TagBadge } from '../../components/ui/Badge'

interface Product { id: number; display_name: string | null; code: string; bom_status: string }
interface Variant {
  id: number; sku: string; product_id: number; upholster_color_id: number
  width: string | null; selling_price: string | null; status: string
  source_code: string | null; source_name: string | null
  collection_code: string | null; color_code: string | null
}
interface Source { id: number; code: string; name: string; is_active: boolean }
interface Collection { id: number; source_id: number; code: string; is_active: boolean }
interface Color { id: number; collection_id: number; code: string; is_active: boolean }
interface PreviewItem {
  upholster_color_id: number; sku: string
  source_name: string; collection_code: string; color_code: string
  already_exists: boolean
}

function fmt(n: string | null | undefined) {
  if (!n) return '—'
  return parseFloat(n).toLocaleString('th-TH', { minimumFractionDigits: 2 })
}

export default function VariantsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const productId = Number(id)

  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [allCollections, setAllCollections] = useState<Collection[]>([])
  const [allColors, setAllColors] = useState<Color[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selSource, setSelSource] = useState(0)
  const [selCollection, setSelCollection] = useState(0)
  const [selColorIds, setSelColorIds] = useState<Set<number>>(new Set())
  const [price, setPrice] = useState('')
  const [width, setWidth] = useState('')
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const collections = allCollections.filter(c => c.source_id === selSource && c.is_active)
  const colors = allColors.filter(c => c.collection_id === selCollection && c.is_active)

  const load = async () => {
    setLoading(true)
    try {
      const [prod, vars] = await Promise.all([
        api.get<Product>(`/products/${productId}`),
        api.get<Variant[]>(`/products/${productId}/variants`),
      ])
      setProduct(prod); setVariants(vars)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    Promise.all([
      api.get<Source[]>('/upholster/sources').then(setSources),
      api.get<Collection[]>('/upholster/collections').then(setAllCollections),
      api.get<Color[]>('/upholster/colors').then(setAllColors),
    ])
  }, [productId])

  const openDialog = () => {
    setSelSource(0); setSelCollection(0); setSelColorIds(new Set())
    setPrice(''); setWidth(''); setPreview(null); setError(''); setOpen(true)
  }

  const toggleColor = (id: number) => {
    setSelColorIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setPreview(null)
  }

  const handlePreview = async () => {
    if (selColorIds.size === 0) { setError('เลือก Color อย่างน้อย 1 รายการ'); return }
    setPreviewing(true); setError('')
    try {
      const items = await api.post<PreviewItem[]>(
        `/products/${productId}/variants/preview`,
        { color_ids: [...selColorIds] }
      )
      setPreview(items)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setPreviewing(false) }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preview) { setError('กด Preview ก่อนครับ'); return }
    const newItems = preview.filter(p => !p.already_exists)
    if (newItems.length === 0) { setError('ทุก Variant ที่เลือกมีอยู่แล้ว'); return }
    setSaving(true); setError('')
    try {
      await api.post(`/products/${productId}/variants/bulk`, {
        color_ids: newItems.map(p => p.upholster_color_id),
        selling_price: price ? parseFloat(price) : null,
        width: width ? parseFloat(width) : null,
      })
      setOpen(false); await load()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (v: Variant) => {
    if (!confirm(`ลบ ${v.sku}?`)) return
    await api.delete(`/variants/${v.id}`); await load()
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>

  const hasActiveBom = product?.bom_status === 'ACTIVE'

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-0.5">
        <button onClick={() => navigate('/products')} className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-semibold text-gray-900">Variants</h1>
      </div>
      <div className="ml-9 mb-4">
        <p className="text-sm font-medium text-gray-700">{product?.display_name ?? product?.code}</p>
        <p className="text-xs text-gray-400 mt-0.5">{variants.length} SKU</p>
      </div>

      {/* No Active BOM warning */}
      {!hasActiveBom && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle size={15} />
          Product นี้ยังไม่มี Active BOM — <button onClick={() => navigate(`/products/${productId}/bom`)} className="font-medium underline">สร้าง BOM ก่อน</button>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end mb-3">
        {hasActiveBom && (
          <button onClick={openDialog} className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800">
            <Plus size={15} /> Generate Variants
          </button>
        )}
      </div>

      {/* Variants Table */}
      {variants.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl flex items-center justify-center h-32 text-gray-400 text-sm">
          ยังไม่มี Variant — กด "Generate Variants" เพื่อเริ่ม
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['SKU', 'Source', 'Collection', 'Color', 'Width (cm)', 'Selling Price', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {variants.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-800 font-medium">{v.sku}</td>
                  <td className="px-4 py-3 text-gray-600">{v.source_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{v.collection_code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{v.color_code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{v.width ? `${parseFloat(v.width).toFixed(0)} cm` : <span className="text-gray-300 italic text-xs">standard</span>}</td>
                  <td className="px-4 py-3 font-mono text-gray-800">{v.selling_price ? `฿${fmt(v.selling_price)}` : '—'}</td>
                  <td className="px-4 py-3"><TagBadge label={v.status} color={v.status === 'ACTIVE' ? 'blue' : 'gray'} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(v)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Generator Dialog */}
      <FormDialog open={open} onClose={() => setOpen(false)} title="Generate Variants"
        onSubmit={handleGenerate} saving={saving} error={error}
        submitLabel={preview ? `Confirm สร้าง ${preview.filter(p => !p.already_exists).length} Variants` : 'Preview ก่อน'}
        width="max-w-2xl">

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label required>Source</Label>
            <Select value={selSource} onChange={e => { setSelSource(+e.target.value); setSelCollection(0); setSelColorIds(new Set()); setPreview(null) }}>
              <option value={0} disabled>เลือก Source</option>
              {sources.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <Label required>Collection</Label>
            <Select value={selCollection} onChange={e => { setSelCollection(+e.target.value); setSelColorIds(new Set()); setPreview(null) }} disabled={!selSource}>
              <option value={0} disabled>เลือก Collection</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </Select>
          </div>
        </div>

        {/* Color checkboxes */}
        {selCollection > 0 && (
          <div>
            <Label required>Colors <span className="text-gray-400 font-normal">({selColorIds.size} เลือก)</span></Label>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
              {colors.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">ไม่มี Color ใน Collection นี้</p>
              ) : colors.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selColorIds.has(c.id)} onChange={() => toggleColor(c.id)} className="rounded" />
                  <span className="text-sm font-mono text-gray-700">{c.code}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Selling Price (บาท)</Label>
            <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="25000" />
          </div>
          <div>
            <Label>Width Override (cm) <span className="text-gray-400 font-normal text-xs">ว่าง = ใช้ Standard</span></Label>
            <Input type="number" step="0.01" value={width} onChange={e => setWidth(e.target.value)} placeholder="200" />
          </div>
        </div>

        {/* Preview button */}
        {selColorIds.size > 0 && !preview && (
          <button type="button" onClick={handlePreview} disabled={previewing}
            className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50">
            {previewing ? 'Loading...' : `Preview ${selColorIds.size} Variants`}
          </button>
        )}

        {/* Preview table */}
        {preview && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
              Preview — {preview.filter(p => !p.already_exists).length} ใหม่ / {preview.filter(p => p.already_exists).length} มีอยู่แล้ว
            </div>
            <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {preview.map(item => (
                <div key={item.upholster_color_id} className={`flex items-center justify-between px-3 py-2 ${item.already_exists ? 'opacity-40' : ''}`}>
                  <span className="font-mono text-xs text-gray-800">{item.sku}</span>
                  {item.already_exists
                    ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">มีอยู่แล้ว</span>
                    : <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">ใหม่</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  )
}
