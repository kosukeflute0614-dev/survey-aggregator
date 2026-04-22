import type {
  AggregationResult,
  ColumnConfig,
  ColumnType,
  CountEntry,
  NumericStats,
  ParsedCSV,
} from '../types'
import { DETECTOR_THRESHOLDS } from './columnTypeDetector'

/**
 * 複数選択セルを区切り文字で分解して、空白除去後の選択肢配列を返す
 */
export function splitMultipleChoice(value: string): string[] {
  if (!value || value.trim() === '') return []
  return value
    .split(DETECTOR_THRESHOLDS.MULTIPLE_DELIMITER)
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

/**
 * 単一列の単純集計を実行
 */
export function aggregateColumn(
  csv: ParsedCSV,
  config: ColumnConfig,
  columnIndex: number
): AggregationResult {
  const rawValues = csv.rows.map((row) => row[columnIndex] ?? '')

  switch (config.type) {
    case 'single':
      return aggregateSingle(config.name, rawValues)
    case 'multiple':
      return aggregateMultiple(config.name, rawValues)
    case 'numeric':
      return aggregateNumeric(config.name, rawValues)
    case 'free_text':
      return aggregateFreeText(config.name, rawValues)
    case 'excluded':
      return {
        columnName: config.name,
        type: 'excluded',
        totalResponses: 0,
      }
    default:
      return {
        columnName: config.name,
        type: config.type as ColumnType,
        totalResponses: 0,
      }
  }
}

/**
 * 全ての集計対象列を集計
 */
export function aggregateAll(
  csv: ParsedCSV,
  configs: ColumnConfig[]
): AggregationResult[] {
  return configs
    .map((config, index) => ({ config, index }))
    .filter(({ config }) => config.included && config.type !== 'excluded')
    .map(({ config, index }) => aggregateColumn(csv, config, index))
}

/**
 * 単一選択列: 分母は有効回答者数
 */
function aggregateSingle(
  columnName: string,
  rawValues: string[]
): AggregationResult {
  const nonEmpty = rawValues.filter((v) => v.trim() !== '')
  const totalResponses = nonEmpty.length

  const counts = tallyValues(nonEmpty)
  const entries: CountEntry[] = Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      count,
      percentage: totalResponses > 0 ? (count / totalResponses) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    columnName,
    type: 'single',
    totalResponses,
    counts: entries,
  }
}

/**
 * 複数選択列: 分母は回答総数ベース（分解後の選択件数の合計）
 */
function aggregateMultiple(
  columnName: string,
  rawValues: string[]
): AggregationResult {
  const expanded: string[] = []
  for (const v of rawValues) {
    expanded.push(...splitMultipleChoice(v))
  }
  const totalSelections = expanded.length

  const counts = tallyValues(expanded)
  const entries: CountEntry[] = Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      count,
      percentage: totalSelections > 0 ? (count / totalSelections) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    columnName,
    type: 'multiple',
    totalResponses: totalSelections,
    counts: entries,
  }
}

/**
 * 数値列: 統計量を算出
 */
function aggregateNumeric(
  columnName: string,
  rawValues: string[]
): AggregationResult {
  const nums: number[] = []
  for (const v of rawValues) {
    if (v.trim() === '') continue
    const n = Number(v)
    if (Number.isFinite(n)) nums.push(n)
  }

  const stats: NumericStats = {
    count: nums.length,
    mean: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
    median: calcMedian(nums),
    min: nums.length > 0 ? nums.reduce((a, b) => Math.min(a, b)) : 0,
    max: nums.length > 0 ? nums.reduce((a, b) => Math.max(a, b)) : 0,
  }

  return {
    columnName,
    type: 'numeric',
    totalResponses: nums.length,
    stats,
  }
}

/**
 * 自由記述: 空欄を除いた全回答を一覧として返す
 */
function aggregateFreeText(
  columnName: string,
  rawValues: string[]
): AggregationResult {
  const texts = rawValues.map((v) => v.trim()).filter((v) => v !== '')
  return {
    columnName,
    type: 'free_text',
    totalResponses: texts.length,
    freeTexts: texts,
  }
}

function tallyValues(values: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const v of values) {
    map.set(v, (map.get(v) ?? 0) + 1)
  }
  return map
}

function calcMedian(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * 複数選択列の全ユニーク選択肢（クロス集計のフィルタ選択肢生成用）
 */
export function extractMultipleOptions(
  rawValues: string[]
): string[] {
  const set = new Set<string>()
  for (const v of rawValues) {
    for (const option of splitMultipleChoice(v)) {
      set.add(option)
    }
  }
  return Array.from(set).sort()
}

/**
 * 単一選択列の全ユニーク値
 */
export function extractSingleOptions(rawValues: string[]): string[] {
  const set = new Set<string>()
  for (const v of rawValues) {
    const trimmed = v.trim()
    if (trimmed !== '') set.add(trimmed)
  }
  return Array.from(set).sort()
}
