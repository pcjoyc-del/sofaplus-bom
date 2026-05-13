import { useState, useEffect } from 'react'

interface HealthStatus {
  status: string
  environment: string
  database: string
  version: string
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-400'}`}
    />
  )
}

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => { setHealth(data); setLoading(false) })
      .catch(() => {
        setHealth({ status: 'error', environment: '-', database: 'unreachable', version: '-' })
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Sofa Plus+ BOM</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bill of Materials Management System</p>
        </div>

        {/* Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">API</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="text-xs text-gray-400">checking...</span>
              ) : (
                <>
                  <StatusDot ok={health?.status === 'ok'} />
                  <span className="text-sm font-mono text-gray-700">{health?.status}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Database</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="text-xs text-gray-400">checking...</span>
              ) : (
                <>
                  <StatusDot ok={health?.database === 'connected'} />
                  <span className="text-sm font-mono text-gray-700">{health?.database}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Environment</span>
            <span className="text-sm font-mono text-gray-700">{health?.environment ?? '-'}</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 mt-6 text-center">
          v{health?.version ?? '...'} · Sprint 0
        </p>
      </div>
    </div>
  )
}
