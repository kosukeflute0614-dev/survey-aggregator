export type ColumnType =
  | 'single'
  | 'multiple'
  | 'free_text'
  | 'numeric'
  | 'excluded'

export interface ParsedCSV {
  headers: string[]
  rows: string[][]
}

export interface ColumnConfig {
  name: string
  type: ColumnType
  included: boolean
}

export interface CountEntry {
  value: string
  count: number
  percentage: number
}

export interface NumericStats {
  count: number
  mean: number
  median: number
  min: number
  max: number
}

export interface AggregationResult {
  columnName: string
  type: ColumnType
  totalResponses: number
  counts?: CountEntry[]
  freeTexts?: string[]
  stats?: NumericStats
}

export interface CrossTabFilter {
  columnName: string
  value: string
}

export interface CrossTabConfig {
  filters: CrossTabFilter[]
  targetColumn: string
}

export interface CrossTabResult {
  filters: CrossTabFilter[]
  targetColumn: string
  matchedCount: number
  totalCount: number
  aggregation: AggregationResult | null
}
