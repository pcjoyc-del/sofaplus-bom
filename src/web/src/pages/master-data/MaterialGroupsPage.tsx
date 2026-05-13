import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../api/client'
import { DataTable } from '../../components/ui/DataTable'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label } from '../../components/ui/Input'
import { Badge, TagBadge } from '../../components/ui/Badge'

interface MaterialGroup { id: number; code: string; name: string; is_general: boolean; is_active: boolean }
const EMPTY = { code: '', name: '', is_general: false }

export default function MaterialGroupsPage() {
  const [data, setData] = useState<MaterialGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialGroup | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => { setLoading(true); try { setData(await api.get<MaterialGroup[]>('/material-groups?include_inactive=true')) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setOpen(true) }
  const openEdit = (row: MaterialGroup) => { setEditing(row); setForm({ code: row.code, name: row.name, is_general: row.is_general }); setError(''); setOpen(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      editing ? await api.put(`/material-groups/${editing.id}`, form) : await api.post('/material-groups', form)
      setOpen(false); await load()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const handleDelete = async (row: MaterialGroup) => {
    if (!confirm(`Deactivate "${row.name}"?`)) return
    await api.delete(`/material-groups/${row.id}`); await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Material Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">กลุ่มวัตถุดิบ (ฟองน้ำ, ไม้, ขา, General)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 transition-colors">
          <Plus size={15} /> Add Group
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'code', header: 'Code', width: '120px' },
          { key: 'name', header: 'Name' },
          { key: 'is_general', header: 'Type', width: '120px', render: r => r.is_general ? <TagBadge label="General (Overhead)" color="amber" /> : <TagBadge label="Main Material" color="blue" /> },
          { key: 'is_active', header: 'Status', width: '100px', render: r => <Badge active={r.is_active} /> },
        ]}
        data={data} loading={loading} onEdit={openEdit} onDelete={handleDelete}
      />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Material Group' : 'Add Material Group'} onSubmit={handleSubmit} saving={saving} error={error}>
        <div><Label required>Code</Label><Input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="FOAM" maxLength={30} /></div>
        <div><Label required>Name</Label><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ฟองน้ำ / ยางพารา" /></div>
        <div className="flex items-center gap-3 pt-1">
          <input type="checkbox" id="is_general" checked={form.is_general} onChange={e => setForm(f => ({ ...f, is_general: e.target.checked }))} className="w-4 h-4 rounded accent-sky-600" />
          <label htmlFor="is_general" className="text-sm text-gray-700">
            General Material <span className="text-gray-400">(นับเป็น Overhead — ไม่อยู่ใน BOM)</span>
          </label>
        </div>
      </FormDialog>
    </div>
  )
}
