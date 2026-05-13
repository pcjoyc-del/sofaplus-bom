import { useState, useEffect } from 'react'
import { Plus, DollarSign } from 'lucide-react'
import { api } from '../../api/client'
import { DataTable } from '../../components/ui/DataTable'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

interface MaterialGroup { id: number; code: string; name: string; is_general: boolean }
interface Material { id: number; mat_id: string; group_id: number; name: string; unit: string; description: string | null; is_active: boolean }
interface Price { id: number; price: string; effective_date: string; note: string | null }

const EMPTY_MAT = { mat_id: '', group_id: 0, name: '', unit: '', description: '' }
const EMPTY_PRICE = { price: '', effective_date: new Date().toISOString().slice(0, 10), note: '' }

export default function MaterialsPage() {
  const [groups, setGroups] = useState<MaterialGroup[]>([])
  const [data, setData] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filterGroup, setFilterGroup] = useState(0)
  const [open, setOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [priceMat, setPriceMat] = useState<Material | null>(null)
  const [form, setForm] = useState(EMPTY_MAT)
  const [priceForm, setPriceForm] = useState(EMPTY_PRICE)
  const [prices, setPrices] = useState<Price[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => { setLoading(true); try { setData(await api.get<Material[]>('/materials?include_inactive=true')) } finally { setLoading(false) } }
  useEffect(() => { api.get<MaterialGroup[]>('/material-groups').then(setGroups); load() }, [])

  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))
  const filtered = filterGroup ? data.filter(m => m.group_id === filterGroup) : data

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_MAT, group_id: filterGroup || (groups[0]?.id ?? 0) }); setError(''); setOpen(true) }
  const openEdit = (row: Material) => { setEditing(row); setForm({ mat_id: row.mat_id, group_id: row.group_id, name: row.name, unit: row.unit, description: row.description ?? '' }); setError(''); setOpen(true) }

  const openPrice = async (row: Material) => {
    setPriceMat(row); setPriceForm(EMPTY_PRICE); setError('')
    setPrices(await api.get<Price[]>(`/materials/${row.id}/prices`))
    setPriceOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, description: form.description || null }
      editing ? await api.put(`/materials/${editing.id}`, payload) : await api.post('/materials', payload)
      setOpen(false); await load()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/materials/${priceMat!.id}/prices`, { ...priceForm, price: parseFloat(priceForm.price), note: priceForm.note || null })
      setPrices(await api.get<Price[]>(`/materials/${priceMat!.id}/prices`))
      setPriceForm(EMPTY_PRICE)
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (row: Material) => {
    if (!confirm(`Deactivate "${row.name}"?`)) return
    await api.delete(`/materials/${row.id}`); await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Materials</h1>
          <p className="text-sm text-gray-500 mt-0.5">วัตถุดิบหลัก (ฟองน้ำ, ไม้, ขา, สปริง, ...)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 transition-colors">
          <Plus size={15} /> Add Material
        </button>
      </div>

      <div className="mb-4">
        <Select value={filterGroup} onChange={e => setFilterGroup(+e.target.value)} className="w-56">
          <option value={0}>All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'mat_id', header: 'Mat ID', width: '130px' },
          { key: 'name', header: 'Name' },
          { key: 'unit', header: 'Unit', width: '80px' },
          { key: 'group_id', header: 'Group', width: '140px', render: r => groupMap[r.group_id]?.name ?? '-' },
          { key: 'is_active', header: 'Status', width: '90px', render: r => <Badge active={r.is_active} /> },
          { key: 'price', header: 'Price', width: '90px', render: r => (
            <button onClick={() => openPrice(r)} className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-xs">
              <DollarSign size={12} /> Prices
            </button>
          )},
        ]}
        data={filtered} loading={loading} onEdit={openEdit} onDelete={handleDelete}
      />

      {/* Material Form Dialog */}
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Material' : 'Add Material'} onSubmit={handleSubmit} saving={saving} error={error}>
        <div>
          <Label required>Group</Label>
          <Select required value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: +e.target.value }))}>
            <option value={0} disabled>Select group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
        <div><Label required>Material ID</Label><Input required value={form.mat_id} onChange={e => setForm(f => ({ ...f, mat_id: e.target.value }))} placeholder="FO-ST20-1" maxLength={30} /></div>
        <div><Label required>Name</Label><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ฟองน้ำ ST20 1 นิ้ว" /></div>
        <div><Label required>Unit</Label><Input required value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="แผ่น" maxLength={20} /></div>
        <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
      </FormDialog>

      {/* Price Dialog */}
      <FormDialog open={priceOpen} onClose={() => setPriceOpen(false)} title={`Prices — ${priceMat?.name ?? ''}`} onSubmit={handleAddPrice} saving={saving} error={error} width="max-w-lg">
        {prices.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-2">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b"><th className="px-3 py-2 text-left text-gray-500">Date</th><th className="px-3 py-2 text-right text-gray-500">Price (฿)</th><th className="px-3 py-2 text-left text-gray-500">Note</th></tr></thead>
              <tbody>{prices.map(p => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-mono">{p.effective_date}</td>
                  <td className="px-3 py-2 text-right font-mono">{parseFloat(p.price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-gray-400">{p.note ?? '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="text-xs font-medium text-gray-600 mb-2">Add New Price</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label required>Price (฿)</Label><Input required type="number" step="0.01" min="0" value={priceForm.price} onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))} placeholder="150.00" /></div>
          <div><Label required>Effective Date</Label><Input required type="date" value={priceForm.effective_date} onChange={e => setPriceForm(f => ({ ...f, effective_date: e.target.value }))} /></div>
        </div>
        <div><Label>Note</Label><Input value={priceForm.note} onChange={e => setPriceForm(f => ({ ...f, note: e.target.value }))} placeholder="ขึ้นราคา 5%" /></div>
      </FormDialog>
    </div>
  )
}
