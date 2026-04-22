import { useMemo, useState } from 'react'
import type {
  ColumnConfig,
  CrossTabConfig,
  CrossTabFilter,
  CrossTabResult,
  ParsedCSV,
} from '../types'
import {
  getAggregatableColumns,
  getFilterValues,
  getFilterableColumns,
  runCrossTabulation,
  validateCrossTabConfig,
} from '../lib/crossTabulator'
import { exportCrossTabulation } from '../lib/excelExporter'
import { AggregationBody } from './SimpleAggregation'

interface CrossTabulationProps {
  csv: ParsedCSV
  configs: ColumnConfig[]
}

interface FilterRowState extends CrossTabFilter {
  id: string
}

function newFilterId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function CrossTabulation({ csv, configs }: CrossTabulationProps) {
  const [filters, setFilters] = useState<FilterRowState[]>([])
  const [targetColumn, setTargetColumn] = useState<string>('')
  const [result, setResult] = useState<CrossTabResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const filterableColumns = useMemo(
    () => getFilterableColumns(configs),
    [configs]
  )
  const aggregatableColumns = useMemo(
    () => getAggregatableColumns(configs),
    [configs]
  )

  const invalidateResult = () => {
    setResult(null)
    setError(null)
  }

  const addFilter = () => {
    invalidateResult()
    setFilters((prev) => [
      ...prev,
      { id: newFilterId(), columnName: '', value: '' },
    ])
  }

  const updateFilter = (id: string, patch: Partial<CrossTabFilter>) => {
    invalidateResult()
    setFilters((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const merged = { ...f, ...patch }
        if (patch.columnName !== undefined && patch.columnName !== f.columnName) {
          merged.value = ''
        }
        return merged
      })
    )
  }

  const removeFilter = (id: string) => {
    invalidateResult()
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  const onTargetChange = (value: string) => {
    invalidateResult()
    setTargetColumn(value)
  }

  const onRunCrossTab = () => {
    setError(null)
    const config: CrossTabConfig = {
      filters: filters.map(({ columnName, value }) => ({ columnName, value })),
      targetColumn,
    }
    const validationError = validateCrossTabConfig(config)
    if (validationError) {
      setError(validationError)
      setResult(null)
      return
    }
    const r = runCrossTabulation(csv, configs, config)
    setResult(r)
  }

  const onExport = async () => {
    if (!result) return
    setError(null)
    setExporting(true)
    try {
      await exportCrossTabulation(result)
    } catch (e) {
      console.error(e)
      setError('集計中にエラーが発生しました。ページを再読み込みしてお試しください')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">フィルタ条件（AND結合）</h3>

        {filters.length === 0 && (
          <p className="text-sm text-gray-500 mb-3">
            条件が設定されていません。「＋ 条件を追加」から追加してください
          </p>
        )}

        <div className="space-y-2">
          {filters.map((f, i) => (
            <FilterRow
              key={f.id}
              filter={f}
              index={i}
              filterableColumns={filterableColumns}
              csv={csv}
              configs={configs}
              onChange={(patch) => updateFilter(f.id, patch)}
              onRemove={() => removeFilter(f.id)}
            />
          ))}
        </div>

        <button
          onClick={addFilter}
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          ＋ 条件を追加
        </button>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">集計対象設問</h3>
        <select
          value={targetColumn}
          onChange={(e) => onTargetChange(e.target.value)}
          className="border rounded px-3 py-2 bg-white text-sm w-full max-w-lg"
        >
          <option value="">-- 設問を選択 --</option>
          {aggregatableColumns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={onRunCrossTab}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          集計実行
        </button>
        {result && (
          <button
            onClick={onExport}
            disabled={exporting}
            className="px-5 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
          >
            {exporting ? '出力中...' : 'Excel出力'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && <CrossTabResultCard result={result} />}
    </div>
  )
}

function FilterRow({
  filter,
  index,
  filterableColumns,
  csv,
  configs,
  onChange,
  onRemove,
}: {
  filter: CrossTabFilter
  index: number
  filterableColumns: ColumnConfig[]
  csv: ParsedCSV
  configs: ColumnConfig[]
  onChange: (patch: Partial<CrossTabFilter>) => void
  onRemove: () => void
}) {
  const values = useMemo(() => {
    if (!filter.columnName) return []
    return getFilterValues(csv, configs, filter.columnName)
  }, [csv, configs, filter.columnName])

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-500 w-16 shrink-0">条件{index + 1}:</span>
      <select
        value={filter.columnName}
        onChange={(e) => onChange({ columnName: e.target.value })}
        className="border rounded px-2 py-1 bg-white flex-1 min-w-[200px]"
      >
        <option value="">-- 設問を選択 --</option>
        {filterableColumns.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <span className="text-gray-500">=</span>
      <select
        value={filter.value}
        onChange={(e) => onChange({ value: e.target.value })}
        disabled={!filter.columnName}
        className="border rounded px-2 py-1 bg-white flex-1 min-w-[180px] disabled:bg-gray-100 disabled:text-gray-400"
      >
        <option value="">-- 選択肢を選択 --</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <button
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 px-2"
        aria-label="条件を削除"
      >
        ×
      </button>
    </div>
  )
}

function CrossTabResultCard({ result }: { result: CrossTabResult }) {
  return (
    <section className="bg-white rounded-lg shadow p-5">
      <h3 className="font-semibold mb-3">結果</h3>
      <p className="text-sm text-gray-700 mb-4">
        該当者: <strong>{result.matchedCount}人</strong> / 全
        {result.totalCount}人中
      </p>
      {result.matchedCount === 0 || !result.aggregation ? (
        <p className="text-gray-500 italic">該当者なし</p>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            集計対象: <strong>{result.aggregation.columnName}</strong>
          </p>
          <AggregationBody result={result.aggregation} />
        </div>
      )}
    </section>
  )
}
