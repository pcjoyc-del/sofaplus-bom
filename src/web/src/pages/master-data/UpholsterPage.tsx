import { useState, useEffect } from 'react'
import { Plus, DollarSign } from 'lucide-react'
import { api } from '../../api/client'
import { DataTable } from '../../components/ui/DataTable'
import { FormDialog } from '../../components/ui/FormDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

type Tab = 'sources' | 'collections' | 'colors'

interface Source { id: number; code: string; name: string; default_unit: string; material_type: string; is_active: boolean }
interface Collection { id: number; source_id: number; code: string; name: string | null; is_active: boolean }
interface Color { id: number; collection_id: number; code: string; name: string | null; is_active: boolean }
interface Price { id: number; price: string; effective_date: string; note: string | null }

export default function UpholsterPage() {
  const [tab, setTab] = useState<Tab>('sources')
  const [sources, setSources] = useState<Source[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [filterSource, setFilterSource] = useState(0)
  const [filterCollection, setFilterCollection] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [editing, setEditing] = useState<Source | Collection | Color | null>(null)
  const [priceColor, setPriceColor] = useState<Color | null>(null)
  const [prices, setPrices] = useState<Price[]>([])
  const [form, setForm] = useState<Record<string, string | number>>({})
  const [priceForm, setPriceForm] = useState({ price: '', effective_date: new Date().toISOString().slice(0, 10), note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadSources = async () => setSources(await api.get<Source[]>('/upholster/sources?include_inactive=true'))
  const loadCollections = async () => setCollections(await api.get<Collection[]>('/upholster/collections?include_inactive=true'))
  const loadColors = async () => setColors(await api.get<Color[]>('/upholster/colors?include_inactive=true'))

  useEffect(() => { loadSources(); loadCollections(); loadColors() }, [])

  const sourceMap = Object.fromEntries(sources.map(s => [s.id, s]))
  const collectionMap = Object.fromEntries(collections.map(c => [c.id, c]))

  const filteredCollections = filterSource ? collections.filter(c => c.source_id === filterSource) : collections
  const filteredColors = colors.filter(c => {
    const coll = collectionMap[c.collection_id]
    if (filterCollection && c.collection_id !== filterCollection) return false
    if (filterSource && coll?.source_id !== filterSource) return false
    return true
  })

  // ── Sources ────────────────────────────────────────────────────────────────

  const openCreateSource = () => { setEditing(null); setForm({ code: '', name: '', default_unit: 'เมตร', material_type: 'ผ้า' }); setError(''); setOpen(true) }
  const openEditSource = (r: Source) => { setEditing(r); setForm({ code: r.code, name: r.name, default_unit: r.default_unit, material_type: r.material_type ?? 'ผ้า' }); setError(''); setOpen(true) }
  const handleSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      editing ? await api.put(`/upholster/sources/${editing.id}`, form) : await api.post('/upholster/sources', form)
      setOpen(false); await loadSources()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const deleteSource = async (r: Source) => { if (!confirm(`Deactivate "${r.name}"?`)) return; await api.delete(`/upholster/sources/${r.id}`); await loadSources() }

  // ── Collections ────────────────────────────────────────────────────────────

  const openCreateCollection = () => { setEditing(null); setForm({ source_id: filterSource || (sources[0]?.id ?? 0), code: '', name: '' }); setError(''); setOpen(true) }
  const openEditCollection = (r: Collection) => { setEditing(r); setForm({ source_id: r.source_id, code: r.code, name: r.name ?? '' }); setError(''); setOpen(true) }
  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, name: form.name || null }
      editing ? await api.put(`/upholster/collections/${editing.id}`, payload) : await api.post('/upholster/collections', payload)
      setOpen(false); await loadCollections()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const deleteCollection = async (r: Collection) => { if (!confirm(`Deactivate "${r.code}"?`)) return; await api.delete(`/upholster/collections/${r.id}`); await loadCollections() }

  // ── Colors ─────────────────────────────────────────────────────────────────

  const openCreateColor = () => { setEditing(null); setForm({ collection_id: filterCollection || (collections[0]?.id ?? 0), code: '', name: '' }); setError(''); setOpen(true) }
  const openEditColor = (r: Color) => { setEditing(r); setForm({ collection_id: r.collection_id, code: r.code, name: r.name ?? '' }); setError(''); setOpen(true) }
  const handleColorSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, name: form.name || null }
      editing ? await api.put(`/upholster/colors/${editing.id}`, payload) : await api.post('/upholster/colors', payload)
      setOpen(false); await loadColors()
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }
  const deleteColor = async (r: Color) => { if (!confirm(`Deactivate "${r.code}"?`)) return; await api.delete(`/upholster/colors/${r.id}`); await loadColors() }

  const openColorPrice = async (r: Color) => {
    setPriceColor(r); setPriceForm({ price: '', effective_date: new Date().toISOString().slice(0, 10), note: '' }); setError('')
    setPrices(await api.get<Price[]>(`/upholster/colors/${r.id}/prices`)); setPriceOpen(true)
  }
  const handleAddColorPrice = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/upholster/colors/${priceColor!.id}/prices`, { ...priceForm, price: parseFloat(priceForm.price), note: priceForm.note || null })
      setPrices(await api.get<Price[]>(`/upholster/colors/${priceColor!.id}/prices`))
      setPriceForm(f => ({ ...f, price: '', note: '' }))
    } catch (err: unknown) { setError((err as Error).message) }
    finally { setSaving(false) }
  }

  // ── Submit dispatcher ──────────────────────────────────────────────────────
  const handleSubmit = tab === 'sources' ? handleSourceSubmit : tab === 'collections' ? handleCollectionSubmit : handleColorSubmit

  const TABS: { key: Tab; label: string }[] = [
    { key: 'sources', label: 'Sources' },
    { key: 'collections', label: 'Collections' },
    { key: 'colors', label: 'Colors' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Upholster</h1>
          <p className="text-sm text-gray-500 mt-0.5">ผ้าหุ้ม/หนัง — Source › Collection › Color</p>
        </div>
        <button
          onClick={tab === 'sources' ? openCreateSource : tab === 'collections' ? openCreateCollection : openCreateColor}
          className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 transition-colors"
        >
          <Plus size={15} /> Add {tab === 'sources' ? 'Source' : tab === 'collections' ? 'Collection' : 'Color'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sources Tab */}
      {tab === 'sources' && (
        <DataTable<Source>
          columns={[
            { key: 'code', header: 'Code', width: '100px' },
            { key: 'name', header: 'Name' },
            { key: 'material_type', header: 'ประเภท', width: '110px', render: (r: Source) => (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.material_type === 'หนัง' ? 'bg-amber-100 text-amber-700' : r.material_type === 'หนังเทียม' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{r.material_type ?? 'ผ้า'}</span>
            )},
            { key: 'default_unit', header: 'Unit', width: '80px' },
            { key: 'is_active', header: 'Status', width: '90px', render: r => <Badge active={r.is_active} /> },
          ]}
          data={sources} loading={loading} onEdit={openEditSource} onDelete={deleteSource}
        />
      )}

      {/* Collections Tab */}
      {tab === 'collections' && (
        <>
          <div className="mb-4">
            <Select value={filterSource} onChange={e => setFilterSource(+e.target.value)} className="w-48">
              <option value={0}>All Sources</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <DataTable<Collection>
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Name', render: r => r.name ?? <span className="text-gray-400 italic">—</span> },
              { key: 'source_id', header: 'Source', width: '120px', render: r => sourceMap[r.source_id]?.name ?? '-' },
              { key: 'is_active', header: 'Status', width: '100px', render: r => <Badge active={r.is_active} /> },
            ]}
            data={filteredCollections} loading={loading} onEdit={openEditCollection} onDelete={deleteCollection}
          />
        </>
      )}

      {/* Colors Tab */}
      {tab === 'colors' && (
        <>
          <div className="flex gap-3 mb-4">
            <Select value={filterSource} onChange={e => { setFilterSource(+e.target.value); setFilterCollection(0) }} className="w-40">
              <option value={0}>All Sources</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select value={filterCollection} onChange={e => setFilterCollection(+e.target.value)} className="w-56">
              <option value={0}>All Collections</option>
              {(filterSource ? collections.filter(c => c.source_id === filterSource) : collections).map(c => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </Select>
          </div>
          <DataTable<Color>
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Name', render: r => r.name ?? <span className="text-gray-400 italic">—</span> },
              { key: 'collection_id', header: 'Collection', width: '160px', render: r => collectionMap[r.collection_id]?.code ?? '-' },
              { key: 'is_active', header: 'Status', width: '90px', render: r => <Badge active={r.is_active} /> },
              { key: 'price', header: 'Price', width: '80px', render: r => (
                <button onClick={() => openColorPrice(r)} className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-xs">
                  <DollarSign size={12} /> Prices
                </button>
              )},
            ]}
            data={filteredColors} loading={loading} onEdit={openEditColor} onDelete={deleteColor}
          />
        </>
      )}

      {/* Source/Collection/Color Form Dialog */}
      <FormDialog open={open} onClose={() => setOpen(false)}
        title={`${editing ? 'Edit' : 'Add'} ${tab === 'sources' ? 'Source' : tab === 'collections' ? 'Collection' : 'Color'}`}
        onSubmit={handleSubmit} saving={saving} error={error}>
        {tab === 'collections' && (
          <div>
            <Label required>Source</Label>
            <Select required value={form.source_id as number} onChange={e => setForm(f => ({ ...f, source_id: +e.target.value }))}>
              <option value={0} disabled>Select source</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        )}
        {tab === 'colors' && (
          <div>
            <Label required>Collection</Label>
            <Select required value={form.collection_id as number} onChange={e => setForm(f => ({ ...f, collection_id: +e.target.value }))}>
              <option value={0} disabled>Select collection</option>
              {collections.map(c => <option key={c.id} value={c.id}>{sourceMap[c.source_id]?.name} › {c.code}</option>)}
            </Select>
          </div>
        )}
        <div><Label required>Code</Label><Input required value={form.code as string} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} maxLength={50} /></div>
        <div><Label>Name (optional)</Label><Input value={form.name as string} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        {tab === 'sources' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>ประเภทวัสดุ</Label>
                <Select required value={form.material_type as string ?? 'ผ้า'} onChange={e => setForm(f => ({ ...f, material_type: e.target.value }))}>
                  <option value="ผ้า">ผ้า</option>
                  <option value="หนัง">หนัง</option>
                  <option value="หนังเทียม">หนังเทียม</option>
                </Select>
              </div>
              <div><Label required>Default Unit</Label><Input required value={form.default_unit as string} onChange={e => setForm(f => ({ ...f, default_unit: e.target.value }))} placeholder="เมตร / หลา / ตร.ฟุต" /></div>
            </div>
          </>
        )}
      </FormDialog>

      {/* Color Price Dialog */}
      <FormDialog open={priceOpen} onClose={() => setPriceOpen(false)}
        title={`Prices — ${priceColor?.code ?? ''}`}
        onSubmit={handleAddColorPrice} saving={saving} error={error} width="max-w-lg">
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
          <div><Label required>Price (฿)</Label><Input required type="number" step="0.01" min="0" value={priceForm.price} onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))} /></div>
          <div><Label required>Effective Date</Label><Input required type="date" value={priceForm.effective_date} onChange={e => setPriceForm(f => ({ ...f, effective_date: e.target.value }))} /></div>
        </div>
        <div><Label>Note</Label><Input value={priceForm.note} onChange={e => setPriceForm(f => ({ ...f, note: e.target.value }))} /></div>
      </FormDialog>
    </div>
  )
}
