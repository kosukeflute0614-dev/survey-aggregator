import type {
  AggregationResult,
  ColumnConfig,
  CrossTabConfig,
  CrossTabFilter,
  CrossTabResult,
  ParsedCSV,
} from '../types'
import { aggregateColumn, splitMultipleChoice } from './aggregator'

/**
 * フィルタ条件（AND結合）と集計対象列から、クロス集計を実行する
 */
export function runCrossTabulation(
  csv: ParsedCSV,
  configs: ColumnConfig[],
  config: CrossTabConfig
): CrossTabResult {
  const totalCount = csv.rows.length

  // 対象列のインデックスを取得
  const targetIndex = configs.findIndex((c) => c.name === config.targetColumn)
  if (targetIndex < 0) {
    return {
      filters: config.filters,
      targetColumn: config.targetColumn,
      matchedCount: 0,
      totalCount,
      aggregation: null,
    }
  }

  // フィルタ用の各条件のインデックスを事前に解決
  const resolvedFilters = config.filters.map((f) => {
    const idx = configs.findIndex((c) => c.name === f.columnName)
    return { filter: f, index: idx, config: configs[idx] ?? null }
  })

  // 条件のいずれかが解決できない場合はエラー扱い
  if (resolvedFilters.some((r) => r.index < 0 || r.config === null)) {
    return {
      filters: config.filters,
      targetColumn: config.targetColumn,
      matchedCount: 0,
      totalCount,
      aggregation: null,
    }
  }

  // 全行に対してAND条件をチェック
  const matchedRows: string[][] = []
  for (const row of csv.rows) {
    const allMatch = resolvedFilters.every((r) => {
      const cell = row[r.index] ?? ''
      return matchesFilter(r.config!.type, cell, r.filter.value)
    })
    if (allMatch) matchedRows.push(row)
  }

  // 該当者0人の場合はaggregationをnullで返す
  if (matchedRows.length === 0) {
    return {
      filters: config.filters,
      targetColumn: config.targetColumn,
      matchedCount: 0,
      totalCount,
      aggregation: null,
    }
  }

  const filteredCsv: ParsedCSV = { headers: csv.headers, rows: matchedRows }
  const targetConfig = configs[targetIndex]
  const aggregation = aggregateColumn(filteredCsv, targetConfig, targetIndex)

  return {
    filters: config.filters,
    targetColumn: config.targetColumn,
    matchedCount: matchedRows.length,
    totalCount,
    aggregation,
  }
}

/**
 * 指定列・値がフィルタにマッチするか判定
 * - single/numeric/free_text: 完全一致
 * - multiple: 分解後のリストに含む
 * - excluded: 常にfalse
 */
function matchesFilter(
  columnType: ColumnConfig['type'],
  cell: string,
  filterValue: string
): boolean {
  const trimmed = cell.trim()
  const target = filterValue.trim()

  if (columnType === 'multiple') {
    const options = splitMultipleChoice(cell)
    return options.includes(target)
  }

  // single, numeric, free_text は等号比較
  if (columnType === 'excluded') return false
  return trimmed === target
}

/**
 * 条件が1件も設定されていない場合のバリデーション
 */
export function validateCrossTabConfig(config: CrossTabConfig): string | null {
  if (config.filters.length === 0) {
    return '条件を1つ以上追加してください'
  }
  if (!config.targetColumn) {
    return '集計対象の設問を選択してください'
  }
  for (const f of config.filters) {
    if (!f.columnName || !f.value) {
      return '全ての条件に設問と選択肢を設定してください'
    }
  }
  return null
}

/**
 * フィルタ条件に使える選択肢（single / multiple列）の列名一覧
 */
export function getFilterableColumns(configs: ColumnConfig[]): ColumnConfig[] {
  return configs.filter(
    (c) => c.included && (c.type === 'single' || c.type === 'multiple')
  )
}

/**
 * 集計対象にできる列（excluded以外で集計対象ON）
 */
export function getAggregatableColumns(
  configs: ColumnConfig[]
): ColumnConfig[] {
  return configs.filter((c) => c.included && c.type !== 'excluded')
}

/**
 * フィルタ選択肢リストを取得
 * - single: ユニーク値
 * - multiple: 分解後のユニーク値
 */
export function getFilterValues(
  csv: ParsedCSV,
  configs: ColumnConfig[],
  columnName: string
): string[] {
  const index = configs.findIndex((c) => c.name === columnName)
  if (index < 0) return []
  const config = configs[index]
  const rawValues = csv.rows.map((row) => row[index] ?? '')

  if (config.type === 'multiple') {
    const set = new Set<string>()
    for (const v of rawValues) {
      for (const opt of splitMultipleChoice(v)) set.add(opt)
    }
    return Array.from(set).sort()
  }

  // single
  const set = new Set<string>()
  for (const v of rawValues) {
    const trimmed = v.trim()
    if (trimmed !== '') set.add(trimmed)
  }
  return Array.from(set).sort()
}

// 再エクスポート（呼び出し側の便利のため）
export type { CrossTabConfig, CrossTabFilter, CrossTabResult, AggregationResult }
