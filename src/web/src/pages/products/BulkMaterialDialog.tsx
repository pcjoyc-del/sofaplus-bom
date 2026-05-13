import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'

interface MaterialGroup { id: number; code: string; name: string; is_general: boolean }
interface Material { id: number; mat_id: string; name: string; unit: string; group_id: number }

interface Selection {
  checked: boolean
  qty: string
  unit: string
}

interface Props {
  open: boolean
  onClose: () => void
  bomVersionId: number
  onSuccess: () => void
}

export function BulkMaterialDialog({ open, onClose, bomVersionId, onSuccess }: Props) {
  const [groups, setGroups] = useState<MaterialGroup[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [groupId, setGroupId] = useState(0)
  const [selections, setSelections] = useState<Record<number, Selection>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    api.get<MaterialGroup[]>('/material-groups?include_general=false').then(gs => {
      setGroups(gs)
      if (gs.length > 0) setGroupId(gs[0].id)
    })
    api.get<Material[]>('/materials').then(setMaterials)
    setSelections({})
    setError('')
  }, [open])

  const filtered = groupId ? materials.filter(m => m.group_id === groupId) : materials

  const toggle = (m: Material) => {
    setSelections(prev => {
      if (prev[m.id]?.checked) {
        const next = { ...prev }
        delete next[m.id]
        return next
      }
      return { ...prev, [m.id]: { checked: true, qty: '', unit: m.unit } }
    })
  }

  const setQty = (id: number, qty: string) =>
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], qty } }))

  const setUnit = (id: number, unit: string) =>
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], unit } }))

  const selectedCount = Object.values(selections).filter(s => s.checked).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const lines = Object.entries(selections)
      .filter(([, s]) => s.checked && s.qty)
      .map(([id, s]) => ({
        material_id: Number(id),
        quantity_fixed: parseFloat(s.qty),
        unit: s.unit || null,
      }))

    if (lines.length === 0) { setError('เลือกอย่างน้อย 1 รายการและใส่จำนวน'); return }

    setSaving(true); setError('')
    try {
      await api.post(`/products/bom/versions/${bomVersionId}/lines/bulk`, { lines })
      onClose(); onSuccess()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <FormDialog
      open={open} onClose={onClose}
      title="Add Materials"
      onSubmit={handleSubmit}
      saving={saving} error={error}
      width="max-w-xl"
    >
      {/* Group filter */}
      <div>
        <Label>Material Group</Label>
        <Select value={groupId} onChange={e => { setGroupId(+e.target.value); setSelections({}) }}>
          <option value={0}>All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </div>

      {/* Material list */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 grid grid-cols-12 gap-2">
          <div className="col-span-1" />
          <div className="col-span-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</div>
          <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</div>
          <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</div>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-gray-400 text-sm">No materials in this group</div>
          )}
          {filtered.map(m => {
            const sel = selections[m.id]
            const checked = !!sel?.checked
            return (
              <div key={m.id} className={`grid grid-cols-12 gap-2 px-3 py-2 items-center transition-colors ${checked ? 'bg-sky-50' : 'hover:bg-gray-50'}`}>
                <div className="col-span-1">
                  <input
                    type="checkbox" checked={checked}
                    onChange={() => toggle(m)}
                    className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                  />
                </div>
                <div className="col-span-5">
                  <p className="text-sm text-gray-800 truncate">{m.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{m.mat_id}</p>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number" step="0.0001" min="0"
                    placeholder="0"
                    disabled={!checked}
                    value={sel?.qty ?? ''}
                    onChange={e => setQty(m.id, e.target.value)}
                    className={`text-sm py-1.5 ${!checked ? 'opacity-30' : ''}`}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    disabled={!checked}
                    value={sel?.unit ?? m.unit}
                    onChange={e => setUnit(m.id, e.target.value)}
                    className={`text-sm py-1.5 ${!checked ? 'opacity-30' : ''}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedCount > 0 && (
        <p className="text-xs text-sky-600 font-medium">
          {selectedCount} material{selectedCount > 1 ? 's' : ''} selected — จะเพิ่ม {selectedCount} line{selectedCount > 1 ? 's' : ''} เข้า BOM
        </p>
      )}
    </FormDialog>
  )
}
