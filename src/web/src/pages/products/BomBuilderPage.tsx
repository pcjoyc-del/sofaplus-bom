import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, ArrowLeft, CheckCircle, Copy, Trash2, ChevronDown, ChevronUp, Pencil, Lock } from 'lucide-react'
import { api } from '../../api/client'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { TagBadge } from '../../components/ui/Badge'
import { BulkMaterialDialog } from './BulkMaterialDialog'

interface Product {
  id: number; code: string; display_name: string | null
  standard_width: string | null; standard_depth: string | null; standard_bed_depth: string | null
}
interface BomVersion { id: number; version_number: string; bom_number: string | null; status: string; notes: string | null }
interface BomLine {
  id: number; bom_version_id: number; line_order: number; line_type: string
  material_id: number | null; section: string | null; upholster_type: string | null
  quantity_fixed: string | null; quantity_formula: string | null; unit: string | null; note: string | null
  qty_base: string | null; qty_width_step: string | null; qty_step_increment: string | null
}
interface Material { id: number; mat_id: string; name: string; unit: string; group_id: number }
interface MaterialGroup { id: number; code: string; name: string }
interface BomFull { version: BomVersion; lines: BomLine[] }
interface CostLine {
  bom_line_id: number; line_type: string; quantity: number | null
  unit_price: number | null; line_cost: number | null; price_date: string | null
}
interface BomCost { bom_version_id: number; lines: CostLine[]; total_material_cost: number }

const SECTIONS = ['ที่นั่ง', 'พนักพิง', 'ข้าง', 'ทั้งหมด']
const UPHOLSTER_TYPES = ['ผ้า', 'หนัง', 'หนังเทียม']
const UPH_EMPTY = { line_order: 0, section: 'ที่นั่ง', upholster_type: 'ผ้า', quantity_fixed: '', unit: 'เมตร', note: '', qty_base: '', qty_width_step: '', qty_step_increment: '' }

function formatSize(p: Product) {
  const parts: string[] = []
  if (p.standard_width) parts.push(`W${parseFloat(p.standard_width).toFixed(0)}`)
  if (p.standard_depth) parts.push(`D${parseFloat(p.standard_depth).toFixed(0)}`)
  const bed = p.standard_bed_depth ? parseFloat(p.standard_bed_depth) : 0
  if (bed > 0) parts.push(`Bed${bed.toFixed(0)}`)
  return parts.join(' × ')
}

function fmt(n: number | string | null | undefined, decimals = 2) {
  if (n == null) return '—'
  return parseFloat(String(n)).toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
}

export default function BomBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const productId = Number(id)

  const [product, setProduct] = useState<Product | null>(null)
  const [bom, setBom] = useState<BomFull | null>(null)
  const [versions, setVersions] = useState<BomVersion[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [matGroups, setMatGroups] = useState<MaterialGroup[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [costData, setCostData] = useState<BomCost | null>(null)
  const [loading, setLoading] = useState(true)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [uphOpen, setUphOpen] = useState(false)
  const [editingUph, setEditingUph] = useState<BomLine | null>(null)
  const [uphForm, setUphForm] = useState(UPH_EMPTY)
  const [matEditOpen, setMatEditOpen] = useState(false)
  const [editingMat, setEditingMat] = useState<BomLine | null>(null)
  const [matEditForm, setMatEditForm] = useState({ quantity_fixed: '', unit: '', note: '' })
  const [copyOpen, setCopyOpen] = useState(false)
  const [copySourceId, setCopySourceId] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)

  const matMap = useMemo(() => Object.fromEntries(materials.map(m => [m.id, m])), [materials])
  const groupMap = useMemo(() => Object.fromEntries(matGroups.map(g => [g.id, g])), [matGroups])
  const costMap = useMemo(() => Object.fromEntries((costData?.lines ?? []).map(l => [l.bom_line_id, l])), [costData])

  const loadBom = async () => {
    try {
      const data = await api.get<BomFull>(`/products/${productId}/bom`)
      setBom(data)
      const cost = await api.get<BomCost>(`/products/bom/versions/${data.version.id}/cost`)
      setCostData(cost)
    } catch { setBom(null); setCostData(null) }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get<Product>(`/products/${productId}`).then(setProduct),
      api.get<BomVersion[]>(`/products/${productId}/bom/versions`).then(setVersions),
      api.get<Material[]>('/materials').then(setMaterials),
      api.get<MaterialGroup[]>('/material-groups').then(setMatGroups),
      api.get<Product[]>('/products').then(ps => setAllProducts(ps.filter(p => p.id !== productId))),
    ]).then(loadBom).finally(() => setLoading(false))
  }, [productId])

  const isDraft = bom?.version.status === 'DRAFT'
  const isActive = bom?.version.status === 'ACTIVE'
  const sortedLines = useMemo(() => [...(bom?.lines ?? [])].sort((a, b) => a.line_order - b.line_order), [bom])

  const { groupedMaterials, upholsterLines } = useMemo(() => {
    const matLines = sortedLines.filter(l => l.line_type === 'MATERIAL')
    const uphLines = sortedLines.filter(l => l.line_type === 'UPHOLSTER_PLACEHOLDER')
    const grouped: Record<number, { group: MaterialGroup; lines: BomLine[] }> = {}
    matLines.forEach(line => {
      const mat = line.material_id ? matMap[line.material_id] : null
      const gid = mat?.group_id ?? -1
      if (!grouped[gid]) grouped[gid] = { group: groupMap[gid], lines: [] }
      grouped[gid].lines.push(line)
    })
    return { groupedMaterials: Object.values(grouped), upholsterLines: uphLines }
  }, [sortedLines, matMap, groupMap])

  // ── Upholster handlers ─────────────────────────────────────────────────────
  const openAddUph = () => { setEditingUph(null); setUphForm({ ...UPH_EMPTY, line_order: sortedLines.length + 1 }); setError(''); setUphOpen(true) }
  const openEditUph = (line: BomLine) => {
    setEditingUph(line)
    setUphForm({ line_order: line.line_order, section: line.section ?? 'ที่นั่ง', upholster_type: line.upholster_type ?? 'ผ้า', quantity_fixed: line.quantity_fixed ?? '', unit: line.unit ?? 'เมตร', note: line.note ?? '', qty_base: line.qty_base ?? '', qty_width_step: line.qty_width_step ?? '', qty_step_increment: line.qty_step_increment ?? '' })
    setError(''); setUphOpen(true)
  }
  const handleUphSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = { line_type: 'UPHOLSTER_PLACEHOLDER', line_order: uphForm.line_order, section: uphForm.section, upholster_type: uphForm.upholster_type, unit: uphForm.unit || null, note: uphForm.note || null }
      if (uphForm.qty_base) { payload.qty_base = parseFloat(uphForm.qty_base); if (uphForm.qty_width_step) payload.qty_width_step = parseFloat(uphForm.qty_width_step); if (uphForm.qty_step_increment) payload.qty_step_increment = parseFloat(uphForm.qty_step_increment) }
      else if (uphForm.quantity_fixed) payload.quantity_fixed = parseFloat(uphForm.quantity_fixed)
      editingUph ? await api.put(`/products/bom/lines/${editingUph.id}`, payload) : await api.post(`/products/bom/versions/${bom!.version.id}/lines`, payload)
      setUphOpen(false); await loadBom()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  // ── Material edit ──────────────────────────────────────────────────────────
  const openEditMat = (line: BomLine) => { setEditingMat(line); setMatEditForm({ quantity_fixed: line.quantity_fixed ?? '', unit: line.unit ?? '', note: line.note ?? '' }); setError(''); setMatEditOpen(true) }
  const handleMatEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try { await api.put(`/products/bom/lines/${editingMat!.id}`, { quantity_fixed: parseFloat(matEditForm.quantity_fixed), unit: matEditForm.unit || null, note: matEditForm.note || null }); setMatEditOpen(false); await loadBom() }
    catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  const handleDeleteLine = async (line: BomLine) => { if (!confirm('Delete this BOM line?')) return; await api.delete(`/products/bom/lines/${line.id}`); await loadBom() }
  const handleActivate = async () => {
    if (!bom || !confirm(`Activate BOM v${bom.version.version_number}?`)) return
    setActivating(true); try { await api.post(`/products/bom/versions/${bom.version.id}/activate`, {}); await loadBom() } finally { setActivating(false) }
  }
  const handleCreateDraft = async () => {
    const next = `1.${versions.length}`
    await api.post(`/products/${productId}/bom/versions`, { version_number: next })
    setVersions(await api.get<BomVersion[]>(`/products/${productId}/bom/versions`)); await loadBom()
  }
  const handleCopyBom = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try { await api.post(`/products/${productId}/bom/copy?source_product_id=${copySourceId}`, {}); setCopyOpen(false); setVersions(await api.get<BomVersion[]>(`/products/${productId}/bom/versions`)); await loadBom() }
    catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const moveOrder = async (line: BomLine, dir: 'up' | 'down') => {
    const idx = sortedLines.findIndex(l => l.id === line.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedLines.length) return
    const other = sortedLines[swapIdx]
    await Promise.all([api.put(`/products/bom/lines/${line.id}`, { line_order: other.line_order }), api.put(`/products/bom/lines/${other.id}`, { line_order: line.line_order })])
    await loadBom()
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>

  // ── Line row ───────────────────────────────────────────────────────────────
  const LineRow = ({ line }: { line: BomLine }) => {
    const isUph = line.line_type === 'UPHOLSTER_PLACEHOLDER'
    const mat = line.material_id ? matMap[line.material_id] : null
    const cost = costMap[line.id]
    const idx = sortedLines.indexOf(line)
    return (
      <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
        <div className="flex flex-col items-center gap-0.5 shrink-0 w-6 pt-0.5">
          <span className="text-xs text-gray-400 font-mono">{line.line_order}</span>
          {isDraft && (
            <div className="flex flex-col">
              <button onClick={() => moveOrder(line, 'up')} disabled={idx === 0} className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronUp size={11} /></button>
              <button onClick={() => moveOrder(line, 'down')} disabled={idx === sortedLines.length - 1} className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronDown size={11} /></button>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800">
            {isUph ? line.section : (mat?.name ?? `ID:${line.material_id}`)}
            {mat && <span className="ml-2 text-xs text-gray-400 font-mono">[{mat.mat_id}]</span>}
            {isUph && line.upholster_type && <span className="ml-2 text-xs text-gray-500">({line.upholster_type})</span>}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
            {!isUph && line.quantity_fixed && (
              <>
                <span>Qty: <span className="font-mono text-gray-700">{fmt(line.quantity_fixed)} {line.unit}</span></span>
                {cost?.unit_price != null && <span>× <span className="font-mono text-gray-700">{fmtCurrency(cost.unit_price)}</span></span>}
                {cost?.line_cost != null && <span className="font-semibold text-gray-800">= {fmtCurrency(cost.line_cost)}</span>}
                {!cost?.unit_price && <span className="text-amber-500 text-xs">ไม่มีราคา</span>}
              </>
            )}
            {isUph && line.qty_base && <span>Linear Step: base={fmt(line.qty_base)} / {line.qty_width_step}cm / +{line.qty_step_increment}</span>}
            {isUph && !line.qty_base && line.quantity_fixed && <span>Fixed: {fmt(line.quantity_fixed)} {line.unit}</span>}
            {line.note && <span className="italic text-gray-400">{line.note}</span>}
          </div>
        </div>

        {isDraft && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => isUph ? openEditUph(line) : openEditMat(line)} className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"><Pencil size={13} /></button>
            <button onClick={() => handleDeleteLine(line)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-0.5">
        <button onClick={() => navigate('/products')} className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-semibold text-gray-900">BOM Builder</h1>
      </div>
      <div className="ml-9 mb-5">
        <p className="text-sm font-medium text-gray-700">{product?.display_name ?? product?.code}</p>
        {product && formatSize(product) && <p className="text-xs text-gray-400 font-mono mt-0.5">Standard Size: {formatSize(product)}</p>}
      </div>

      {/* BOM Version bar */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3 mb-1">
        <div className="flex items-center gap-3">
          {bom ? (
            <>
              <TagBadge label={bom.version.status} color={isActive ? 'blue' : 'amber'} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold text-gray-800">{bom.version.bom_number ?? `BOM-v${bom.version.version_number}`}</span>
                  <span className="text-xs text-gray-400">v{bom.version.version_number}</span>
                </div>
                {bom.version.notes && <p className="text-xs text-gray-400 mt-0.5">{bom.version.notes}</p>}
              </div>
            </>
          ) : <span className="text-sm text-gray-400">No BOM yet</span>}
        </div>
        <div className="flex items-center gap-2">
          {!bom && <button onClick={handleCreateDraft} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"><Plus size={14} /> New BOM</button>}
          {bom && isDraft && (
            <>
              <button onClick={() => { setCopySourceId(allProducts[0]?.id ?? 0); setError(''); setCopyOpen(true) }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"><Copy size={13} /> Copy from</button>
              <button onClick={handleActivate} disabled={activating || sortedLines.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40"><CheckCircle size={13} /> Activate</button>
            </>
          )}
          {bom && isActive && <button onClick={handleCreateDraft} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"><Plus size={13} /> New Draft</button>}
        </div>
      </div>

      {/* ACTIVE hint */}
      {isActive && (
        <div className="flex items-center gap-2 px-5 py-2 mb-4 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700">
          <Lock size={12} /> BOM นี้ Active แล้ว — กด <strong>New Draft</strong> เพื่อแก้ไข
        </div>
      )}

      {/* Lines */}
      {bom && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">BOM Lines <span className="text-gray-400 font-normal">({sortedLines.length})</span></p>
            {isDraft && (
              <div className="flex gap-2">
                <button onClick={() => setBulkOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sky-700 text-white rounded-lg hover:bg-sky-800"><Plus size={14} /> Materials</button>
                <button onClick={openAddUph} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"><Plus size={14} /> Upholster</button>
              </div>
            )}
          </div>

          {sortedLines.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl flex items-center justify-center h-28 text-gray-400 text-sm">
              No BOM lines — click "+ Materials" or "+ Upholster" to start
            </div>
          ) : (
            <div className="space-y-3">
              {groupedMaterials.map(({ group, lines }) => (
                <div key={group?.id ?? -1} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group?.name ?? 'Unknown Group'}</span>
                    <span className="text-xs text-gray-400">({lines.length})</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {lines.map(line => <LineRow key={line.id} line={line} />)}
                  </div>
                </div>
              ))}

              {upholsterLines.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-100/60 border-b border-amber-200">
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Upholster Placeholders</span>
                    <span className="text-xs text-amber-500">({upholsterLines.length})</span>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {upholsterLines.map(line => <LineRow key={line.id} line={line} />)}
                  </div>
                </div>
              )}

              {/* Cost Summary */}
              {costData && (
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    รวมต้นทุนวัสดุหลัก
                    <span className="ml-2 text-xs text-gray-400">({sortedLines.filter(l => l.line_type === 'MATERIAL').length} รายการ)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{fmtCurrency(costData.total_material_cost)}</p>
                    <p className="text-xs text-gray-400">ไม่รวม Upholster + Overhead</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <BulkMaterialDialog open={bulkOpen} onClose={() => setBulkOpen(false)} bomVersionId={bom?.version.id ?? 0} onSuccess={loadBom} />

      <FormDialog open={uphOpen} onClose={() => setUphOpen(false)} title={editingUph ? 'Edit Upholster Placeholder' : 'Add Upholster Placeholder'} onSubmit={handleUphSubmit} saving={saving} error={error} width="max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          <div><Label required>Section</Label>
            <Select required value={uphForm.section} onChange={e => setUphForm(f => ({ ...f, section: e.target.value }))}>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div><Label required>ประเภท</Label>
            <Select required value={uphForm.upholster_type} onChange={e => setUphForm(f => ({ ...f, upholster_type: e.target.value }))}>
              {UPHOLSTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600">Quantity</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fixed Qty</Label><Input type="number" step="0.01" disabled={!!uphForm.qty_base} value={uphForm.qty_base ? '' : uphForm.quantity_fixed} onChange={e => setUphForm(f => ({ ...f, quantity_fixed: e.target.value }))} placeholder="1.5" /></div>
            <div><Label>Unit</Label><Input value={uphForm.unit} onChange={e => setUphForm(f => ({ ...f, unit: e.target.value }))} placeholder="เมตร" /></div>
          </div>
        </div>
        <details className="rounded-lg border border-gray-200">
          <summary className="px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600">Linear Step Formula (Phase 2)</summary>
          <div className="px-3 pb-3 pt-2 grid grid-cols-3 gap-2 bg-gray-50/50">
            <div><Label>Base qty</Label><Input type="number" step="0.01" value={uphForm.qty_base} onChange={e => setUphForm(f => ({ ...f, qty_base: e.target.value }))} placeholder="4.5" /></div>
            <div><Label>Width step</Label><Input type="number" step="0.01" value={uphForm.qty_width_step} onChange={e => setUphForm(f => ({ ...f, qty_width_step: e.target.value }))} placeholder="10" /></div>
            <div><Label>+qty/step</Label><Input type="number" step="0.0001" value={uphForm.qty_step_increment} onChange={e => setUphForm(f => ({ ...f, qty_step_increment: e.target.value }))} placeholder="0.3" /></div>
          </div>
        </details>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>ลำดับใน BOM</Label><Input type="number" value={uphForm.line_order} onChange={e => setUphForm(f => ({ ...f, line_order: +e.target.value }))} /></div>
          <div><Label>Note</Label><Input value={uphForm.note} onChange={e => setUphForm(f => ({ ...f, note: e.target.value }))} /></div>
        </div>
      </FormDialog>

      <FormDialog open={matEditOpen} onClose={() => setMatEditOpen(false)} title="Edit Material Line" onSubmit={handleMatEditSubmit} saving={saving} error={error}>
        <p className="text-sm font-medium text-gray-700">{editingMat?.material_id ? matMap[editingMat.material_id]?.name : ''}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label required>Quantity</Label><Input required type="number" step="0.01" value={matEditForm.quantity_fixed} onChange={e => setMatEditForm(f => ({ ...f, quantity_fixed: e.target.value }))} /></div>
          <div><Label>Unit</Label><Input value={matEditForm.unit} onChange={e => setMatEditForm(f => ({ ...f, unit: e.target.value }))} /></div>
        </div>
        <div><Label>Note</Label><Input value={matEditForm.note} onChange={e => setMatEditForm(f => ({ ...f, note: e.target.value }))} /></div>
      </FormDialog>

      <FormDialog open={copyOpen} onClose={() => setCopyOpen(false)} title="Copy BOM from Product" onSubmit={handleCopyBom} saving={saving} error={error}>
        <p className="text-sm text-gray-500">คัดลอก Active BOM จาก Product อื่น มาเป็น Draft ใหม่</p>
        <div><Label required>Source Product</Label>
          <Select required value={copySourceId} onChange={e => setCopySourceId(+e.target.value)}>
            <option value={0} disabled>Select product</option>
            {allProducts.map(p => <option key={p.id} value={p.id}>{p.display_name ?? p.code}</option>)}
          </Select>
        </div>
      </FormDialog>
    </div>
  )
}
