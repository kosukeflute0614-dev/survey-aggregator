import Papa from 'papaparse'
import type { ParsedCSV } from '../types'

export interface CsvParseError {
  message: string
}

const PARSE_FAIL_MESSAGE =
  'このファイルは読み込めません。Googleフォームからエクスポートした.csv（UTF-8）を投入してください。'
const EMPTY_FILE_MESSAGE =
  '列が検出されませんでした。ファイルが空の可能性があります。'

export async function parseCsvFile(file: File): Promise<ParsedCSV> {
  return new Promise<ParsedCSV>((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        try {
          const rawRows = results.data as string[][]
          if (rawRows.length === 0) {
            reject(makeError(EMPTY_FILE_MESSAGE))
            return
          }

          const headers = stripBomFromHeader(rawRows[0] ?? [])
          const rows = rawRows.slice(1)

          if (headers.length === 0 || headers.every((h) => h.trim() === '')) {
            reject(makeError(EMPTY_FILE_MESSAGE))
            return
          }

          // 列数がヘッダーより少ない行を空文字でパディング、多い場合は切り詰め
          const normalizedRows = rows.map((row) => {
            const copy = row.slice(0, headers.length)
            while (copy.length < headers.length) copy.push('')
            return copy
          })

          resolve({ headers, rows: normalizedRows })
        } catch {
          reject(makeError(PARSE_FAIL_MESSAGE))
        }
      },
      error: () => {
        reject(makeError(PARSE_FAIL_MESSAGE))
      },
    })
  })
}

function makeError(message: string): CsvParseError {
  return { message }
}

function stripBomFromHeader(headers: string[]): string[] {
  if (headers.length === 0) return headers
  const first = headers[0]
  // UTF-8 BOM (﻿) が先頭に付いている場合を除去
  if (first.charCodeAt(0) === 0xfeff) {
    const cleaned = [...headers]
    cleaned[0] = first.slice(1)
    return cleaned
  }
  return headers
}
