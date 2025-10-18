import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface SSLHealthButtonProps {
  assetId: string
  host: string
  port: number
  onSuccess?: () => void
}

export default function SSLHealthButton({ assetId, host, port, onSuccess }: SSLHealthButtonProps) {
  const [loading, setLoading] = useState(false)
  const [lastScore, setLastScore] = useState<number | null>(null)

  async function runCheck() {
    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('ssl-health-check', {
        body: { asset_id: assetId, host, port }
      })

      if (error) throw error

      if (data?.success) {
        setLastScore(data.data.overall_score)
        
        // Zeige Erfolg
        const grade = getGrade(data.data.overall_score)
        alert(`✅ SSL Health Check abgeschlossen!\n\nHost: ${host}:${port}\nScore: ${data.data.overall_score}/100\nGrade: ${grade}`)
        
        if (onSuccess) onSuccess()
      } else {
        throw new Error(data?.error || 'Check fehlgeschlagen')
      }
    } catch (error: any) {
      console.error('Health Check Error:', error)
      alert(`❌ SSL Health Check fehlgeschlagen:\n\n${error.message || 'Unbekannter Fehler'}`)
    } finally {
      setLoading(false)
    }
  }

  function getGrade(score: number): string {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'F'
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={runCheck}
        disabled={loading}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="SSL Health Check durchführen"
      >
        {loading ? '⏳ Prüfe...' : '🔐 SSL Check'}
      </button>

      {lastScore !== null && (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${getScoreColor(lastScore)}`}>
          {lastScore}/100 ({getGrade(lastScore)})
        </span>
      )}
    </div>
  )
}

