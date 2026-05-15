import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { api } from '../../api/client'

interface ResolvedLine {
  bom_line_id: number; line_order: number; line_type: string
  material_id: number | null; material_name: string | null; mat_id_code: string | null
  section: string | null; source_name: string | null; collection_code: string | null; color_code: string | null
  unit: string | null; quantity: number | null; unit_price: number | null; line_cost: number | null
  price_date: string | null; is_overridden: boolean; qty_formula_used: boolean
}
interface ResolvedBom {
  variant_id: number; sku: string; product_name: string | null; bom_number: string | null
  variant_width: number | null; standard_width: number | null
  lines: ResolvedLine[]
  total_material_cost: number
  overhead_rate: number | null; overhead_cost: number | null; total_estimated_cost: number
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2 })
}
function fmtB(n: number | null | undefined) {
  if (n == null) return '—'
  return `฿${fmt(n)}`
}

export default function ResolvedBomPage() {
  const { variantId } = useParams<{ variantId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ResolvedBom | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ResolvedBom>(`/variants/${variantId}/resolved-bom`)
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [variantId])

  const exportCsv = () => {
    if (!data) return
    const rows = [
      ['Line', 'Type', 'Material/Upholster', 'Code', 'Unit', 'Qty', 'Unit Price', 'Line Cost', 'Price Date', 'Override'],
      ...data.lines.map(l => [
        l.line_order,
        l.line_type,
        l.line_type === 'MATERIAL' ? (l.material_name ?? '') : `${l.source_name} | ${l.collection_code} | ${l.color_code} (${l.section})`,
        l.line_type === 'MATERIAL' ? (l.mat_id_code ?? '') : '',
        l.unit ?? '',
        l.quantity ?? '',
        l.unit_price ?? '',
        l.line_cost ?? '',
        l.price_date ?? '',
        l.is_overridden ? 'YES' : '',
      ]),
      [],
      ['', '', '', '', '', '', 'Total Material Cost', data.total_material_cost],
      ['', '', '', '', '', '', `Overhead (${data.overhead_rate}%)`, data.overhead_cost ?? ''],
      ['', '', '', '', '', '', 'Total Estimated Cost', data.total_estimated_cost],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${data.sku}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-48 text-red-500">{error}</div>
  if (!data) return null

  const matLines = data.lines.filter(l => l.line_type === 'MATERIAL')
  const uphLines = data.lines.filter(l => l.line_type === 'UPHOLSTER')

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-0.5">
        <button onClick={() => navigate(-1)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-semibold text-gray-900">Resolved BOM</h1>
      </div>
      <div className="ml-9 mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">{data.product_name}</p>
          <p className="text-xs font-mono text-sky-700 mt-0.5">{data.sku}</p>
          <div className="flex gap-3 mt-1 text-xs text-gray-400">
            <span>BOM: <span className="font-mono text-gray-600">{data.bom_number}</span></span>
            {data.variant_width
              ? <span>Width: <span className="font-mono text-amber-600">{data.variant_width} cm</span> <span className="text-gray-300">(override จาก {data.standard_width})</span></span>
              : <span>Width: <span className="font-mono text-gray-600">{data.standard_width} cm</span> <span className="text-gray-300">(standard)</span></span>
            }
          </div>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Material Lines */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">วัสดุหลัก</span>
          <span className="text-xs text-gray-400">({matLines.length} รายการ)</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {['#', 'Material', 'Unit', 'Qty', 'ราคา/หน่วย', 'ต้นทุน', ''].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {matLines.map(l => (
              <tr key={l.bom_line_id} className={l.is_overridden ? 'bg-amber-50/40' : ''}>
                <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{l.line_order}</td>
                <td className="px-4 py-2.5">
                  <p className="text-sm text-gray-800">{l.material_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{l.mat_id_code}</p>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{l.unit}</td>
                <td className="px-4 py-2.5 text-sm font-mono text-gray-700">{l.quantity}</td>
                <td className="px-4 py-2.5 text-sm font-mono text-gray-700">{fmtB(l.unit_price)}</td>
                <td className="px-4 py-2.5 text-sm font-mono font-semibold text-gray-800">{fmtB(l.line_cost)}</td>
                <td className="px-4 py-2.5">{l.is_overridden && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Override</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upholster Lines */}
      {uphLines.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl overflow-hidden mb-3">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">ผ้าหุ้ม</span>
            <span className="text-xs text-amber-500">({uphLines.length} รายการ)</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-100">
                {['Section', 'Source | Collection | Color', 'Unit', 'Qty', 'ราคา/หน่วย', 'ต้นทุน'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-amber-600/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {uphLines.map(l => (
                <tr key={l.bom_line_id}>
                  <td className="px-4 py-2.5 text-sm text-gray-700 font-medium">{l.section}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-gray-800">{l.source_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{l.collection_code} | {l.color_code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.unit}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-mono text-gray-700">{l.quantity}</span>
                    {l.qty_formula_used && <span className="ml-1 text-xs text-sky-500">(Linear Step)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-mono text-gray-700">{fmtB(l.unit_price)}</td>
                  <td className="px-4 py-2.5 text-sm font-mono font-semibold text-gray-800">{fmtB(l.line_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost Summary */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">ต้นทุนวัสดุหลัก + ผ้าหุ้ม</span>
          <span className="font-mono font-medium text-gray-800">{fmtB(data.total_material_cost)}</span>
        </div>
        {data.overhead_rate != null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Overhead General Material ({data.overhead_rate}%)</span>
            <span className="font-mono text-gray-600">{fmtB(data.overhead_cost)}</span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-2 flex justify-between">
          <span className="text-sm font-medium text-gray-700">ประมาณการต้นทุนรวมต่อ SKU</span>
          <span className="text-xl font-bold text-gray-900">{fmtB(data.total_estimated_cost)}</span>
        </div>
      </div>
    </div>
  )
}
