import type { ColumnConfig, ColumnType, ParsedCSV } from '../types'

// 判定用の調整可能な定数
export const DETECTOR_THRESHOLDS = {
  /**
   * 複数選択と判定するための「カンマ+スペース」を含む行の割合
   * 実データでは「複数選んだ人」の割合は少ないことがあるため、10%で検出する。
   * 誤判定を感じたら列設定画面で手動切替可能
   */
  MULTIPLE_CHOICE_RATIO: 0.1,
  /** 単一選択と判定するためのユニーク値の最大個数 */
  SINGLE_CHOICE_UNIQUE_MAX: 5,
  /** 複数選択の区切り文字 */
  MULTIPLE_DELIMITER: ', ',
} as const

const TIMESTAMP_NAME_KEYWORDS = ['タイムスタンプ', 'timestamp', '送信日時']
const EMAIL_NAME_KEYWORDS = ['メール', 'メールアドレス', 'email', 'mail', 'e-mail']

// メールアドレス形式の判定（簡易）
const EMAIL_VALUE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 日時形式の判定（YYYY/MM/DD HH:MM:SS、YYYY-MM-DD HH:MM:SS 等の複数パターン）
const DATETIME_VALUE_REGEX = /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+\-]\d{2}:?\d{2})?)?$/

/**
 * 全列の自動判定を行い、ColumnConfig配列を返す
 */
export function detectColumnConfigs(csv: ParsedCSV): ColumnConfig[] {
  return csv.headers.map((header, colIdx) => {
    const values = extractColumnValues(csv.rows, colIdx)
    const type = detectColumnType(header, values)
    const included = type !== 'excluded'
    return { name: header, type, included }
  })
}

/**
 * 単一列の型判定（要件定義書の優先順位に従う）
 */
export function detectColumnType(header: string, values: string[]): ColumnType {
  const nonEmptyValues = values.filter((v) => v.trim() !== '')

  // 1. タイムスタンプ列
  if (matchesTimestampColumn(header, nonEmptyValues)) return 'excluded'

  // 2. メールアドレス列
  if (matchesEmailColumn(header, nonEmptyValues)) return 'excluded'

  // 3. 複数選択（区切り文字を一定割合以上の行に含む）
  if (nonEmptyValues.length > 0) {
    const withDelimiter = nonEmptyValues.filter((v) =>
      v.includes(DETECTOR_THRESHOLDS.MULTIPLE_DELIMITER)
    ).length
    const ratio = withDelimiter / nonEmptyValues.length
    if (ratio >= DETECTOR_THRESHOLDS.MULTIPLE_CHOICE_RATIO) return 'multiple'
  }

  // 4. 単一選択（ユニーク値が閾値以下）
  if (nonEmptyValues.length > 0) {
    const unique = new Set(nonEmptyValues)
    if (unique.size <= DETECTOR_THRESHOLDS.SINGLE_CHOICE_UNIQUE_MAX) return 'single'
  }

  // 5. 数値（全非空セルが数値として解釈できる）
  if (nonEmptyValues.length > 0 && nonEmptyValues.every(isNumericString)) {
    return 'numeric'
  }

  // 6. それ以外は自由記述
  return 'free_text'
}

function extractColumnValues(rows: string[][], colIdx: number): string[] {
  return rows.map((row) => row[colIdx] ?? '')
}

function matchesTimestampColumn(header: string, values: string[]): boolean {
  const lowerHeader = header.toLowerCase()
  if (TIMESTAMP_NAME_KEYWORDS.some((kw) => lowerHeader.includes(kw.toLowerCase()))) {
    return true
  }
  // 全非空値が日時形式
  if (values.length > 0 && values.every((v) => DATETIME_VALUE_REGEX.test(v))) {
    return true
  }
  return false
}

function matchesEmailColumn(header: string, values: string[]): boolean {
  const lowerHeader = header.toLowerCase()
  if (EMAIL_NAME_KEYWORDS.some((kw) => lowerHeader.includes(kw.toLowerCase()))) {
    return true
  }
  if (values.length > 0 && values.every((v) => EMAIL_VALUE_REGEX.test(v))) {
    return true
  }
  return false
}

function isNumericString(v: string): boolean {
  if (v.trim() === '') return false
  // 全角数字や空白を含む文字列はfalse、半角の整数/小数のみtrue
  const n = Number(v)
  return Number.isFinite(n)
}
