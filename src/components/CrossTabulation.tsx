import { useMemo } from 'react'
import type {
  ColumnConfig,
  CrossTabConfig,
  CrossTabFilter,
  CrossTabPattern,
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
import { AggregationBody } from './SimpleAggregation'

interface CrossTabulationProps {
  csv: ParsedCSV
  configs: ColumnConfig[]
  patterns: CrossTabPattern[]
  onPatternsChange: (patterns: CrossTabPattern[]) => void
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createPattern(existingPatterns: CrossTabPattern[]): CrossTabPattern {
  // 既存の「クロス集計N」から最大Nを拾って+1を付ける（削除後も重複しないように）
  let maxNum = 0
  for (const p of existingPatterns) {
    const m = p.name.match(/^クロス集計(\d+)$/)
    if (m) {
      const n = Number(m[1])
      if (n > maxNum) maxNum = n
    }
  }
  return {
    id: newId('p'),
    name: `クロス集計${maxNum + 1}`,
    filters: [],
    targetColumn: '',
  }
}

export function CrossTabulation({
  csv,
  configs,
  patterns,
  onPatternsChange,
}: CrossTabulationProps) {
  const filterableColumns = useMemo(
    () => getFilterableColumns(configs),
    [configs]
  )
  const aggregatableColumns = useMemo(
    () => getAggregatableColumns(configs),
    [configs]
  )

  const addPattern = () => {
    onPatternsChange([...patterns, createPattern(patterns)])
  }

  const updatePattern = (id: string, patch: Partial<CrossTabPattern>) => {
    onPatternsChange(
      patterns.map((p) => (p.id === id ? { ...p, ...patch } : p))
    )
  }

  const removePattern = (id: string) => {
    onPatternsChange(patterns.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-5">
      {patterns.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          クロス集計のパターンがまだありません
        </div>
      )}

      {patterns.map((pattern, i) => (
        <PatternCard
          key={pattern.id}
          pattern={pattern}
          defaultName={`クロス集計${i + 1}`}
          csv={csv}
          configs={configs}
          filterableColumns={filterableColumns}
          aggregatableColumns={aggregatableColumns}
          onChange={(patch) => updatePattern(pattern.id, patch)}
          onRemove={() => removePattern(pattern.id)}
        />
      ))}

      <div>
        <button
          onClick={addPattern}
          className="px-4 py-2 border border-dashed border-blue-400 text-blue-600 rounded hover:bg-blue-50 text-sm"
        >
          ＋ パターンを追加
        </button>
      </div>
    </div>
  )
}

function PatternCard({
  pattern,
  defaultName,
  csv,
  configs,
  filterableColumns,
  aggregatableColumns,
  onChange,
  onRemove,
}: {
  pattern: CrossTabPattern
  defaultName: string
  csv: ParsedCSV
  configs: ColumnConfig[]
  filterableColumns: ColumnConfig[]
  aggregatableColumns: ColumnConfig[]
  onChange: (patch: Partial<CrossTabPattern>) => void
  onRemove: () => void
}) {
  // 実行結果をその場で算出（stateで持たずに派生）
  const { result, error } = useMemo(() => {
    const config: CrossTabConfig = {
      filters: pattern.filters.map(({ columnName, value }) => ({
        columnName,
        value,
      })),
      targetColumn: pattern.targetColumn,
    }
    const validationError = validateCrossTabConfig(config)
    if (validationError) {
      return { result: null as CrossTabResult | null, error: validationError }
    }
    return {
      result: runCrossTabulation(csv, configs, config),
      error: null as string | null,
    }
  }, [csv, configs, pattern.filters, pattern.targetColumn])

  const addFilter = () => {
    onChange({
      filters: [
        ...pattern.filters,
        { id: newId('f'), columnName: '', value: '' },
      ],
    })
  }

  const updateFilter = (id: string, patch: Partial<CrossTabFilter>) => {
    onChange({
      filters: pattern.filters.map((f) => {
        if (f.id !== id) return f
        const merged = { ...f, ...patch }
        if (patch.columnName !== undefined && patch.columnName !== f.columnName) {
          merged.value = ''
        }
        return merged
      }),
    })
  }

  const removeFilter = (id: string) => {
    onChange({
      filters: pattern.filters.filter((f) => f.id !== id),
    })
  }

  return (
    <section className="bg-white rounded-lg shadow p-5">
      <div className="flex items-start gap-3 mb-4">
        <input
          type="text"
          value={pattern.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={defaultName}
          className="font-semibold border rounded px-2 py-1 text-base flex-1"
        />
        <button
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
          aria-label="パターンを削除"
        >
          削除
        </button>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          フィルタ条件（AND結合）
        </h4>
        {pattern.filters.length === 0 && (
          <p className="text-sm text-gray-500 mb-2">
            条件を追加してください
          </p>
        )}
        <div className="space-y-2">
          {pattern.filters.map((f, i) => (
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
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          ＋ 条件を追加
        </button>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          集計対象設問
        </h4>
        <select
          value={pattern.targetColumn}
          onChange={(e) => onChange({ targetColumn: e.target.value })}
          className="border rounded px-3 py-2 bg-white text-sm w-full max-w-lg"
        >
          <option value="">-- 設問を選択 --</option>
          {aggregatableColumns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">結果</h4>
        {error && (
          <p className="text-sm text-gray-500 italic">{error}</p>
        )}
        {!error && result && <ResultView result={result} />}
      </div>
    </section>
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

function ResultView({ result }: { result: CrossTabResult }) {
  return (
    <div>
      <p className="text-sm text-gray-700 mb-3">
        該当者: <strong>{result.matchedCount}人</strong> / 全
        {result.totalCount}人中
      </p>
      {result.matchedCount === 0 || !result.aggregation ? (
        <p className="text-gray-500 italic text-sm">該当者なし</p>
      ) : (
        <AggregationBody result={result.aggregation} />
      )}
    </div>
  )
}
