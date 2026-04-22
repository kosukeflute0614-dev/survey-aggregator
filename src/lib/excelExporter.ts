import ExcelJS from 'exceljs'
import type {
  AggregationResult,
  CrossTabFilter,
  CrossTabResult,
} from '../types'

/**
 * 単純集計のExcelをダウンロードさせる
 */
export async function exportSimpleAggregation(
  results: AggregationResult[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Survey Aggregator'
  workbook.created = new Date()

  buildSummarySheet(workbook, results)
  buildFreeTextSheets(workbook, results)

  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(buffer, `単純集計_${todayStamp()}.xlsx`)
}

/**
 * クロス集計のExcelをダウンロードさせる
 */
export async function exportCrossTabulation(
  result: CrossTabResult
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Survey Aggregator'
  workbook.created = new Date()

  buildCrossTabSheet(workbook, result)

  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(buffer, `クロス集計_${timestampStamp()}.xlsx`)
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  results: AggregationResult[]
) {
  const sheet = workbook.addWorksheet('集計結果')

  sheet.columns = [
    { width: 50 },
    { width: 12 },
    { width: 10 },
  ]

  const headerRow = sheet.addRow(['設問 / 選択肢', '件数', '割合'])
  headerRow.font = { bold: true }

  for (const r of results) {
    if (r.type === 'excluded') continue
    sheet.addRow([])
    writeAggregationBlock(sheet, r)
  }
}

function writeAggregationBlock(
  sheet: ExcelJS.Worksheet,
  r: AggregationResult
) {
  const titleRow = sheet.addRow([`Q: ${r.columnName}`])
  titleRow.font = { bold: true }
  sheet.mergeCells(
    `A${titleRow.number}:C${titleRow.number}`
  )

  switch (r.type) {
    case 'single': {
      sheet.addRow([`有効回答数: ${r.totalResponses}件`])
      sheet.addRow(['選択肢', '件数', '割合'])
      for (const c of r.counts ?? []) {
        sheet.addRow([c.value, c.count, formatPercentage(c.percentage)])
      }
      break
    }
    case 'multiple': {
      sheet.addRow([`回答総数: ${r.totalResponses}件（複数回答・合計100%）`])
      sheet.addRow(['選択肢', '件数', '割合'])
      for (const c of r.counts ?? []) {
        sheet.addRow([c.value, c.count, formatPercentage(c.percentage)])
      }
      break
    }
    case 'numeric': {
      const s = r.stats
      sheet.addRow([`有効回答数: ${r.totalResponses}件`])
      if (s) {
        sheet.addRow(['統計量', '値', ''])
        sheet.addRow(['平均値', roundNum(s.mean)])
        sheet.addRow(['中央値', roundNum(s.median)])
        sheet.addRow(['最小値', s.min])
        sheet.addRow(['最大値', s.max])
      }
      break
    }
    case 'free_text': {
      sheet.addRow([
        `自由記述（全 ${r.totalResponses} 件）— 別シート「自由記述_${safeSheetName(r.columnName)}」を参照`,
      ])
      break
    }
  }
}

function buildFreeTextSheets(
  workbook: ExcelJS.Workbook,
  results: AggregationResult[]
) {
  for (const r of results) {
    if (r.type !== 'free_text') continue
    const name = uniqueSheetName(workbook, `自由記述_${safeSheetName(r.columnName)}`)
    const sheet = workbook.addWorksheet(name)
    sheet.columns = [{ width: 10 }, { width: 80 }]
    const headerRow = sheet.addRow(['#', r.columnName])
    headerRow.font = { bold: true }
    const texts = r.freeTexts ?? []
    texts.forEach((t, i) => {
      sheet.addRow([i + 1, t])
    })
    if (texts.length === 0) {
      sheet.addRow(['', '（自由記述の回答はありません）'])
    }
  }
}

function buildCrossTabSheet(
  workbook: ExcelJS.Workbook,
  result: CrossTabResult
) {
  const sheet = workbook.addWorksheet('クロス集計結果')
  sheet.columns = [{ width: 50 }, { width: 12 }, { width: 10 }]

  const titleRow = sheet.addRow(['クロス集計結果'])
  titleRow.font = { bold: true, size: 14 }

  sheet.addRow([])
  const filtersTitle = sheet.addRow(['【フィルタ条件（AND結合）】'])
  filtersTitle.font = { bold: true }
  if (result.filters.length === 0) {
    sheet.addRow(['（条件なし）'])
  } else {
    for (const f of result.filters) {
      sheet.addRow([formatFilter(f)])
    }
  }

  sheet.addRow([])
  const matchedTitle = sheet.addRow(['【該当者】'])
  matchedTitle.font = { bold: true }
  sheet.addRow([`${result.matchedCount}人 / 全${result.totalCount}人中`])

  sheet.addRow([])
  if (result.matchedCount === 0 || result.aggregation === null) {
    const noResult = sheet.addRow(['該当者なし — 集計できませんでした'])
    noResult.font = { italic: true, color: { argb: 'FF888888' } }
    return
  }

  const aggTitle = sheet.addRow([`【集計: ${result.aggregation.columnName}】`])
  aggTitle.font = { bold: true }
  writeAggregationBlock(sheet, result.aggregation)
}

function formatFilter(f: CrossTabFilter): string {
  return `${f.columnName} = ${f.value}`
}

function formatPercentage(p: number): string {
  return `${p.toFixed(1)}%`
}

function roundNum(n: number): number {
  return Math.round(n * 100) / 100
}

function todayStamp(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function timestampStamp(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`
}

/**
 * Excelのシート名制約: 最大31文字、[]:*?/\ を含まない
 */
function safeSheetName(raw: string): string {
  let name = raw.replace(/[\[\]\:\*\?\/\\]/g, '_')
  if (name.length > 20) name = name.slice(0, 20)
  return name || '無題'
}

function uniqueSheetName(workbook: ExcelJS.Workbook, base: string): string {
  if (!workbook.getWorksheet(base)) return base
  let i = 2
  while (workbook.getWorksheet(`${base}_${i}`)) i++
  return `${base}_${i}`
}

function triggerDownload(
  buffer: ExcelJS.Buffer,
  filename: string
) {
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // ダウンロード開始を待ってからURLを解放（Safari等でのタイミング問題回避）
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
