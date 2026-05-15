import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, AlertCircle, FileText } from 'lucide-react'
import { api } from '../../api/client'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label } from '../../components/ui/Input'
import { TagBadge } from '../../components/ui/Badge'

interface Product { id: number; display_name: string | null; code: string; bom_status: string }
interface Variant {
  id: number; sku: string; product_id: number; upholster_color_id: number
  width: string | null; selling_price: string | null; status: string
  source_code: string | null; source_name: string | null
  collection_code: string | null; color_code: string | null
}
interface Source { id: number; code: string; name: string; material_type: string; is_active: boolean }
interface Collection { id: number; source_id: number; code: string; is_active: boolean }
interface Color { id: number; collection_id: number; code: string; is_active: boolean }
interface PreviewItem {
  upholster_color_id: number; sku: string
  source_name: string; collection_code: string; color_code: string; already_exists: boolean
}
interface BomLine { line_type: string; upholster_type: string | null }

const ALL_MATERIAL_TYPES = ['ผ้า', 'หนัง', 'หนังเทียม']

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
  const [bomLines, setBomLines] = useState<BomLine[]>([])

  // Dialog state
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selMaterialType, setSelMaterialType] = useState('ผ้า')
  const [selColorIds, setSelColorIds] = useState<Set<number>>(new Set())
  const [price, setPrice] = useState('')
  const [width, setWidth] = useState('')
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // ข้อ 3: ดึง upholster types จาก BOM — แสดง tab เฉพาะประเภทที่ใช้จริง
  const allowedMaterialTypes = useMemo(() => {
    const types = bomLines
      .filter(l => l.line_type === 'UPHOLSTER_PLACEHOLDER' && l.upholster_type)
      .map(l => l.upholster_type as string)
    const unique = [...new Set(types)]
    return unique.length > 0 ? unique : ALL_MATERIAL_TYPES
  }, [bomLines])

  // Build tree: sources filtered by material_type → collections → colors
  const tree = useMemo(() => {
    const filteredSources = sources.filter(s => s.is_active && s.material_type === selMaterialType)
    return filteredSources.map(src => {
      const colls = allCollections.filter(c => c.source_id === src.id && c.is_active)
      return {
        source: src,
        collections: colls.map(coll => ({
          collection: coll,
          colors: allColors.filter(c => c.collection_id === coll.id && c.is_active),
        })),
      }
    })
  }, [sources, allCollections, allColors, selMaterialType])

  // All color ids in current tree
  const allTreeColorIds = useMemo(
    () => tree.flatMap(s => s.collections.flatMap(c => c.colors.map(cl => cl.id))),
    [tree]
  )

  // Source-level color ids
  const sourceColorIds = (srcId: number) =>
    tree.find(s => s.source.id === srcId)?.collections.flatMap(c => c.colors.map(cl => cl.id)) ?? []

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
      api.get<{lines: BomLine[]}>(`/products/${productId}/bom`)
        .then(d => setBomLines(d.lines ?? []))
        .catch(() => setBomLines([])),
    ])
  }, [productId])

  const openDialog = () => {
    setSelMaterialType(allowedMaterialTypes[0] ?? 'ผ้า'); setSelColorIds(new Set())
    setPrice(''); setWidth(''); setPreview(null); setError(''); setOpen(true)
  }

  const toggleColor = (colorId: number) => {
    setSelColorIds(prev => { const n = new Set(prev); n.has(colorId) ? n.delete(colorId) : n.add(colorId); return n })
    setPreview(null)
  }

  const toggleSource = (srcId: number) => {
    const ids = sourceColorIds(srcId)
    const allSelected = ids.every(id => selColorIds.has(id))
    setSelColorIds(prev => {
      const n = new Set(prev)
      allSelected ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id))
      return n
    })
    setPreview(null)
  }

  const toggleAll = () => {
    const allSelected = allTreeColorIds.every(id => selColorIds.has(id))
    setSelColorIds(allSelected ? new Set() : new Set(allTreeColorIds))
    setPreview(null)
  }

  const handlePreview = async () => {
    if (selColorIds.size === 0) { setError('เลือก Color อย่างน้อย 1 รายการ'); return }
    setPreviewing(true); setError('')
    try {
      const items = await api.post<PreviewItem[]>(`/products/${productId}/variants/preview`, { color_ids: [...selColorIds] })
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
      <div className="flex items-center gap-3 mb-0.5">
        <button onClick={() => navigate('/products')} className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-semibold text-gray-900">Variants</h1>
      </div>
      <div className="ml-9 mb-4">
        <p className="text-sm font-medium text-gray-700">{product?.display_name ?? product?.code}</p>
        <p className="text-xs text-gray-400 mt-0.5">{variants.length} SKU</p>
      </div>

      {!hasActiveBom && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle size={15} />
          Product นี้ยังไม่มี Active BOM —
          <button onClick={() => navigate(`/products/${productId}/bom`)} className="font-medium underline">สร้าง BOM ก่อน</button>
        </div>
      )}

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
                    <div className="flex items-center gap-1">
                      <button onClick={() => navigate(`/variants/${v.id}/bom`)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded transition-colors">
                        <FileText size={12} /> View BOM
                      </button>
                      <button onClick={() => handleDelete(v)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Variants Dialog */}
      <FormDialog open={open} onClose={() => setOpen(false)} title="Generate Variants"
        onSubmit={handleGenerate} saving={saving} error={error}
        submitLabel={preview ? `Confirm สร้าง ${preview.filter(p => !p.already_exists).length} Variants` : `Preview ${selColorIds.size} Variants`}
        width="max-w-2xl">

        {/* Step 1: Material Type */}
        <div>
          <Label required>ประเภทวัสดุหุ้ม</Label>
          <div className="flex gap-2 mt-1">
            {allowedMaterialTypes.map(t => (
              <button key={t} type="button"
                onClick={() => { setSelMaterialType(t); setSelColorIds(new Set()); setPreview(null) }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selMaterialType === t
                    ? 'bg-sky-700 text-white border-sky-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-600'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Color Tree */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label required>Colors <span className="text-gray-400 font-normal">({selColorIds.size} เลือก)</span></Label>
            {allTreeColorIds.length > 0 && (
              <button type="button" onClick={toggleAll}
                className="text-xs text-sky-600 hover:text-sky-800 font-medium">
                {allTreeColorIds.every(id => selColorIds.has(id)) ? 'ยกเลิกทั้งหมด' : `เลือกทั้งหมด (${allTreeColorIds.length})`}
              </button>
            )}
          </div>

          {tree.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
              ไม่มี Source ประเภท {selMaterialType}
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {tree.map(({ source, collections }) => {
                const srcIds = collections.flatMap(c => c.colors.map(cl => cl.id))
                const allSrcSelected = srcIds.length > 0 && srcIds.every(id => selColorIds.has(id))
                return (
                  <div key={source.id} className="border-b border-gray-100 last:border-0">
                    {/* Source header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                      <span className="text-xs font-semibold text-gray-700">{source.name}</span>
                      <button type="button" onClick={() => toggleSource(source.id)}
                        className="text-xs text-sky-600 hover:text-sky-800">
                        {allSrcSelected ? 'ยกเลิก' : `เลือกทั้งหมด (${srcIds.length})`}
                      </button>
                    </div>
                    {/* Collections + Colors */}
                    {collections.map(({ collection, colors }) => (
                      <div key={collection.id}>
                        {colors.length > 0 && (
                          <div className="px-3 pt-1.5 pb-0.5">
                            <span className="text-xs text-gray-400 font-mono">{collection.code}</span>
                          </div>
                        )}
                        {colors.map(color => (
                          <label key={color.id}
                            className="flex items-center gap-2 px-5 py-1.5 hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={selColorIds.has(color.id)}
                              onChange={() => toggleColor(color.id)} className="rounded" />
                            <span className="text-sm font-mono text-gray-700">{color.code}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Price + Width */}
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
        {selColorIds.size > 0 && (
          <button type="button" onClick={handlePreview} disabled={previewing}
            className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors">
            {previewing ? 'Loading...' : `Preview ${selColorIds.size} Variants ที่เลือก`}
          </button>
        )}

        {/* Preview table */}
        {preview && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 flex justify-between">
              <span>Preview</span>
              <span>{preview.filter(p => !p.already_exists).length} ใหม่ / {preview.filter(p => p.already_exists).length} มีอยู่แล้ว</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-44 overflow-y-auto">
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
