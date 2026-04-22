import { useMemo, useState } from 'react'
import type { AggregationResult, ColumnConfig, ParsedCSV } from '../types'
import { aggregateAll } from '../lib/aggregator'
import { exportSimpleAggregation } from '../lib/excelExporter'

interface SimpleAggregationProps {
  csv: ParsedCSV
  configs: ColumnConfig[]
}

export function SimpleAggregation({ csv, configs }: SimpleAggregationProps) {
  const results = useMemo(() => aggregateAll(csv, configs), [csv, configs])
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onExport = async () => {
    setError(null)
    setExporting(true)
    try {
      await exportSimpleAggregation(results)
    } catch (e) {
      console.error(e)
      setError('集計中にエラーが発生しました。ページを再読み込みしてお試しください')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {results.length}項目の集計結果（対象列のみ）
        </p>
        <button
          onClick={onExport}
          disabled={exporting || results.length === 0}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {exporting ? '出力中...' : 'Excel出力'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {results.map((r, i) => (
          <AggregationCard key={i} result={r} />
        ))}
      </div>
    </div>
  )
}

function AggregationCard({ result }: { result: AggregationResult }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="font-semibold text-gray-800 mb-2 break-all">
        Q: {result.columnName}
      </h3>
      <AggregationBody result={result} />
    </div>
  )
}

export function AggregationBody({ result }: { result: AggregationResult }) {
  if (result.type === 'single') {
    return (
      <>
        <p className="text-xs text-gray-500 mb-2">
          有効回答数: {result.totalResponses}件
        </p>
        <CountsTable counts={result.counts ?? []} unit="件" />
      </>
    )
  }

  if (result.type === 'multiple') {
    return (
      <>
        <p className="text-xs text-gray-500 mb-2">
          回答総数: {result.totalResponses}件（複数回答・合計100%）
        </p>
        <CountsTable counts={result.counts ?? []} unit="件" />
      </>
    )
  }

  if (result.type === 'numeric') {
    const s = result.stats
    if (!s || s.count === 0) {
      return <p className="text-gray-500 text-sm">有効なデータがありません</p>
    }
    return (
      <>
        <p className="text-xs text-gray-500 mb-2">
          有効回答数: {result.totalResponses}件
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <StatItem label="平均値" value={round(s.mean)} />
          <StatItem label="中央値" value={round(s.median)} />
          <StatItem label="最小値" value={s.min} />
          <StatItem label="最大値" value={s.max} />
        </div>
      </>
    )
  }

  if (result.type === 'free_text') {
    return (
      <p className="text-sm text-gray-600">
        自由記述（全 {result.totalResponses} 件）— Excel出力で別シートに一覧
      </p>
    )
  }

  return null
}

function CountsTable({
  counts,
  unit,
}: {
  counts: { value: string; count: number; percentage: number }[]
  unit: string
}) {
  if (counts.length === 0) {
    return <p className="text-gray-500 text-sm">データがありません</p>
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {counts.map((c, i) => (
          <tr key={i} className="border-b last:border-0">
            <td className="py-1 pr-3 break-all">{c.value}</td>
            <td className="py-1 text-right tabular-nums w-20">
              {c.count}
              {unit}
            </td>
            <td className="py-1 text-right tabular-nums w-16 text-gray-500">
              {c.percentage.toFixed(1)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
      <span className="text-gray-600">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  )
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
