import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, ArrowLeft, CheckCircle, Copy, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { api } from '../../api/client'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { TagBadge } from '../../components/ui/Badge'
import { BulkMaterialDialog } from './BulkMaterialDialog'

interface Product {
  id: number; code: string; display_name: string | null
  standard_width: string | null; standard_depth: string | null; standard_bed_depth: string | null
  status: string
}
interface BomVersion { id: number; product_id: number; version_number: string; status: string; notes: string | null }
interface BomLine {
  id: number; bom_version_id: number; line_order: number; line_type: string
  material_id: number | null; section: string | null
  quantity_fixed: string | null; quantity_formula: string | null; unit: string | null; note: string | null
  qty_base: string | null; qty_width_step: string | null; qty_step_increment: string | null
}
interface Material { id: number; mat_id: string; name: string; unit: string }
interface BomFull { version: BomVersion; lines: BomLine[] }

const UPHOLSTER_EMPTY = {
  line_order: 0, section: '', quantity_formula: '',
  qty_base: '', qty_width_step: '', qty_step_increment: '',
  quantity_fixed: '', unit: 'เมตร', note: '',
}

function formatSize(p: Product) {
  const parts: string[] = []
  if (p.standard_width) parts.push(`W${parseFloat(p.standard_width).toFixed(0)}`)
  if (p.standard_depth) parts.push(`D${parseFloat(p.standard_depth).toFixed(0)}`)
  if (p.standard_bed_depth) parts.push(`Bed${parseFloat(p.standard_bed_depth).toFixed(0)}`)
  return parts.join(' × ')
}

export default function BomBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const productId = Number(id)

  const [product, setProduct] = useState<Product | null>(null)
  const [bom, setBom] = useState<BomFull | null>(null)
  const [versions, setVersions] = useState<BomVersion[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Material bulk dialog
  const [bulkOpen, setBulkOpen] = useState(false)

  // Upholster line dialog
  const [upholsterOpen, setUpholsterOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<BomLine | null>(null)
  const [upholsterForm, setUpholsterForm] = useState(UPHOLSTER_EMPTY)

  // Material edit dialog (single line edit)
  const [matEditOpen, setMatEditOpen] = useState(false)
  const [editingMatLine, setEditingMatLine] = useState<BomLine | null>(null)
  const [matEditForm, setMatEditForm] = useState({ quantity_fixed: '', unit: '', note: '' })

  // Copy dialog
  const [copyOpen, setCopyOpen] = useState(false)
  const [copySourceId, setCopySourceId] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)

  const matMap = Object.fromEntries(materials.map(m => [m.id, m]))

  const loadBom = async () => {
    try { setBom(await api.get<BomFull>(`/products/${productId}/bom`)) }
    catch { setBom(null) }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get<Product>(`/products/${productId}`).then(setProduct),
      api.get<BomVersion[]>(`/products/${productId}/bom/versions`).then(setVersions),
      api.get<Material[]>('/materials').then(setMaterials),
      api.get<Product[]>('/products').then(ps => setAllProducts(ps.filter(p => p.id !== productId))),
    ]).then(loadBom).finally(() => setLoading(false))
  }, [productId])

  const isDraft = bom?.version.status === 'DRAFT'
  const isActive = bom?.version.status === 'ACTIVE'
  const sortedLines = [...(bom?.lines ?? [])].sort((a, b) => a.line_order - b.line_order)

  // ── Upholster handlers ─────────────────────────────────────────────────────
  const openAddUpholster = () => {
    setEditingLine(null)
    setUpholsterForm({ ...UPHOLSTER_EMPTY, line_order: (bom?.lines.length ?? 0) + 1 })
    setError(''); setUpholsterOpen(true)
  }
  const openEditUpholster = (line: BomLine) => {
    setEditingLine(line)
    setUpholsterForm({
      line_order: line.line_order, section: line.section ?? '',
      quantity_formula: line.quantity_formula ?? '',
      qty_base: line.qty_base ?? '', qty_width_step: line.qty_width_step ?? '',
      qty_step_increment: line.qty_step_increment ?? '',
      quantity_fixed: line.quantity_fixed ?? '', unit: line.unit ?? 'เมตร', note: line.note ?? '',
    })
    setError(''); setUpholsterOpen(true)
  }
  const handleUpholsterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        line_type: 'UPHOLSTER_PLACEHOLDER',
        line_order: upholsterForm.line_order,
        section: upholsterForm.section,
        unit: upholsterForm.unit || null,
        note: upholsterForm.note || null,
      }
      if (upholsterForm.qty_base) {
        payload.qty_base = parseFloat(upholsterForm.qty_base)
        payload.qty_width_step = upholsterForm.qty_width_step ? parseFloat(upholsterForm.qty_width_step) : null
        payload.qty_step_increment = upholsterForm.qty_step_increment ? parseFloat(upholsterForm.qty_step_increment) : null
      } else if (upholsterForm.quantity_fixed) {
        payload.quantity_fixed = parseFloat(upholsterForm.quantity_fixed)
      }

      if (editingLine) {
        await api.put(`/products/bom/lines/${editingLine.id}`, payload)
      } else {
        await api.post(`/products/bom/versions/${bom!.version.id}/lines`, payload)
      }
      setUpholsterOpen(false); await loadBom()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  // ── Material edit handler ──────────────────────────────────────────────────
  const openEditMaterial = (line: BomLine) => {
    setEditingMatLine(line)
    setMatEditForm({ quantity_fixed: line.quantity_fixed ?? '', unit: line.unit ?? '', note: line.note ?? '' })
    setError(''); setMatEditOpen(true)
  }
  const handleMatEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/products/bom/lines/${editingMatLine!.id}`, {
        quantity_fixed: parseFloat(matEditForm.quantity_fixed),
        unit: matEditForm.unit || null,
        note: matEditForm.note || null,
      })
      setMatEditOpen(false); await loadBom()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  // ── Other handlers ─────────────────────────────────────────────────────────
  const handleDeleteLine = async (line: BomLine) => {
    if (!confirm('Delete this BOM line?')) return
    await api.delete(`/products/bom/lines/${line.id}`); await loadBom()
  }
  const handleActivate = async () => {
    if (!bom || !confirm(`Activate BOM v${bom.version.version_number}?`)) return
    setActivating(true)
    try { await api.post(`/products/bom/versions/${bom.version.id}/activate`, {}); await loadBom() }
    finally { setActivating(false) }
  }
  const handleCreateDraft = async () => {
    const next = `1.${versions.length}`
    await api.post(`/products/${productId}/bom/versions`, { version_number: next })
    const updated = await api.get<BomVersion[]>(`/products/${productId}/bom/versions`)
    setVersions(updated); await loadBom()
  }
  const handleCopyBom = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/products/${productId}/bom/copy?source_product_id=${copySourceId}`, {})
      setCopyOpen(false)
      const updated = await api.get<BomVersion[]>(`/products/${productId}/bom/versions`)
      setVersions(updated); await loadBom()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const moveOrder = async (line: BomLine, dir: 'up' | 'down') => {
    const lines = [...sortedLines]
    const idx = lines.findIndex(l => l.id === line.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= lines.length) return
    const other = lines[swapIdx]
    await Promise.all([
      api.put(`/products/bom/lines/${line.id}`, { line_order: other.line_order }),
      api.put(`/products/bom/lines/${other.id}`, { line_order: line.line_order }),
    ])
    await loadBom()
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>

  const sizeLabel = product ? formatSize(product) : ''

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-0.5">
        <button onClick={() => navigate('/products')} className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">BOM Builder</h1>
      </div>
      <div className="ml-9 mb-5">
        <p className="text-sm font-medium text-gray-700">{product?.display_name ?? product?.code}</p>
        {sizeLabel && <p className="text-xs text-gray-400 font-mono mt-0.5">Standard Size: {sizeLabel}</p>}
      </div>

      {/* BOM Version bar */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3 mb-5">
        <div className="flex items-center gap-3">
          {bom ? (
            <>
              <TagBadge label={bom.version.status} color={isActive ? 'blue' : 'amber'} />
              <span className="text-sm font-medium text-gray-700">v{bom.version.version_number}</span>
              {bom.version.notes && <span className="text-xs text-gray-400">{bom.version.notes}</span>}
            </>
          ) : (
            <span className="text-sm text-gray-400">No BOM yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!bom && (
            <button onClick={handleCreateDraft} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              <Plus size={14} /> New BOM
            </button>
          )}
          {bom && isDraft && (
            <>
              <button onClick={() => { setCopySourceId(allProducts[0]?.id ?? 0); setError(''); setCopyOpen(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                <Copy size={13} /> Copy from
              </button>
              <button onClick={handleActivate} disabled={activating || sortedLines.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors">
                <CheckCircle size={13} /> Activate
              </button>
            </>
          )}
          {bom && isActive && (
            <button onClick={handleCreateDraft} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              <Plus size={13} /> New Draft
            </button>
          )}
        </div>
      </div>

      {/* Lines */}
      {bom && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">
              BOM Lines <span className="text-gray-400 font-normal">({sortedLines.length})</span>
            </p>
            {isDraft && (
              <div className="flex gap-2">
                <button onClick={() => { setBulkOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition-colors">
                  <Plus size={14} /> Materials
                </button>
                <button onClick={openAddUpholster}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                  <Plus size={14} /> Upholster
                </button>
              </div>
            )}
          </div>

          {sortedLines.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl flex items-center justify-center h-28 text-gray-400 text-sm">
              No BOM lines — click "+ Materials" or "+ Upholster" to start
            </div>
          ) : (
            <div className="space-y-2">
              {sortedLines.map((line, idx) => {
                const mat = line.material_id ? matMap[line.material_id] : null
                const isUpholster = line.line_type === 'UPHOLSTER_PLACEHOLDER'
                return (
                  <div key={line.id} className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 ${isUpholster ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'}`}>
                    <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0 w-6">
                      <span className="text-xs text-gray-400 font-mono">{line.line_order}</span>
                      {isDraft && (
                        <div className="flex flex-col">
                          <button onClick={() => moveOrder(line, 'up')} disabled={idx === 0} className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronUp size={11} /></button>
                          <button onClick={() => moveOrder(line, 'down')} disabled={idx === sortedLines.length - 1} className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronDown size={11} /></button>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TagBadge label={isUpholster ? 'Upholster' : 'Material'} color={isUpholster ? 'amber' : 'blue'} />
                        <span className="text-sm font-medium text-gray-800">
                          {isUpholster ? (line.section ?? '—') : (mat?.name ?? `ID:${line.material_id}`)}
                        </span>
                        {mat && <span className="text-xs text-gray-400 font-mono">[{mat.mat_id}]</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {!isUpholster && line.quantity_fixed && (
                          <span>Qty: <span className="font-mono text-gray-700">{line.quantity_fixed} {line.unit}</span></span>
                        )}
                        {isUpholster && line.qty_base && (
                          <span>Linear Step: <span className="font-mono text-gray-700">base={line.qty_base} / {line.qty_width_step}cm step / +{line.qty_step_increment}</span></span>
                        )}
                        {isUpholster && line.quantity_fixed && !line.qty_base && (
                          <span>Fixed: <span className="font-mono text-gray-700">{line.quantity_fixed} {line.unit}</span></span>
                        )}
                        {line.note && <span className="italic text-gray-400">{line.note}</span>}
                      </div>
                    </div>

                    {isDraft && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => isUpholster ? openEditUpholster(line) : openEditMaterial(line)}
                          className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDeleteLine(line)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Bulk Material Dialog */}
      <BulkMaterialDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        bomVersionId={bom?.version.id ?? 0}
        onSuccess={loadBom}
      />

      {/* Upholster Dialog */}
      <FormDialog open={upholsterOpen} onClose={() => setUpholsterOpen(false)}
        title={editingLine ? 'Edit Upholster Line' : 'Add Upholster Placeholder'}
        onSubmit={handleUpholsterSubmit} saving={saving} error={error} width="max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          <div><Label required>Section</Label>
            <Input required value={upholsterForm.section} onChange={e => setUpholsterForm(f => ({ ...f, section: e.target.value }))} placeholder="ที่นั่ง / พนักพิง / ข้าง" />
          </div>
          <div><Label required>Order</Label>
            <Input type="number" value={upholsterForm.line_order} onChange={e => setUpholsterForm(f => ({ ...f, line_order: +e.target.value }))} />
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
          <p className="text-xs font-medium text-amber-700">Quantity Method</p>
          <div>
            <p className="text-xs text-gray-600 mb-1.5 font-medium">① Linear Step — คำนวณจาก Width</p>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Base qty</Label><Input type="number" step="0.01" value={upholsterForm.qty_base} onChange={e => setUpholsterForm(f => ({ ...f, qty_base: e.target.value }))} placeholder="4.5" /></div>
              <div><Label>Width step (cm)</Label><Input type="number" step="0.01" value={upholsterForm.qty_width_step} onChange={e => setUpholsterForm(f => ({ ...f, qty_width_step: e.target.value }))} placeholder="10" /></div>
              <div><Label>+qty/step</Label><Input type="number" step="0.0001" value={upholsterForm.qty_step_increment} onChange={e => setUpholsterForm(f => ({ ...f, qty_step_increment: e.target.value }))} placeholder="0.3" /></div>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1.5 font-medium">② Fixed Qty</p>
            <Input type="number" step="0.0001" disabled={!!upholsterForm.qty_base}
              value={upholsterForm.qty_base ? '' : upholsterForm.quantity_fixed}
              onChange={e => setUpholsterForm(f => ({ ...f, quantity_fixed: e.target.value }))} placeholder="1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Unit</Label><Input value={upholsterForm.unit} onChange={e => setUpholsterForm(f => ({ ...f, unit: e.target.value }))} placeholder="เมตร" /></div>
          <div><Label>Note</Label><Input value={upholsterForm.note} onChange={e => setUpholsterForm(f => ({ ...f, note: e.target.value }))} /></div>
        </div>
      </FormDialog>

      {/* Material Edit Dialog */}
      <FormDialog open={matEditOpen} onClose={() => setMatEditOpen(false)}
        title="Edit Material Line" onSubmit={handleMatEditSubmit} saving={saving} error={error}>
        <p className="text-sm font-medium text-gray-700">{editingMatLine?.material_id ? matMap[editingMatLine.material_id]?.name : ''}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label required>Quantity</Label><Input required type="number" step="0.0001" value={matEditForm.quantity_fixed} onChange={e => setMatEditForm(f => ({ ...f, quantity_fixed: e.target.value }))} /></div>
          <div><Label>Unit</Label><Input value={matEditForm.unit} onChange={e => setMatEditForm(f => ({ ...f, unit: e.target.value }))} /></div>
        </div>
        <div><Label>Note</Label><Input value={matEditForm.note} onChange={e => setMatEditForm(f => ({ ...f, note: e.target.value }))} /></div>
      </FormDialog>

      {/* Copy BOM Dialog */}
      <FormDialog open={copyOpen} onClose={() => setCopyOpen(false)} title="Copy BOM from Product"
        onSubmit={handleCopyBom} saving={saving} error={error}>
        <p className="text-sm text-gray-500">คัดลอก Active BOM จาก Product อื่น มาเป็น Draft ใหม่</p>
        <div>
          <Label required>Source Product</Label>
          <Select required value={copySourceId} onChange={e => setCopySourceId(+e.target.value)}>
            <option value={0} disabled>Select product</option>
            {allProducts.map(p => <option key={p.id} value={p.id}>{p.display_name ?? p.code}</option>)}
          </Select>
        </div>
      </FormDialog>
    </div>
  )
}
