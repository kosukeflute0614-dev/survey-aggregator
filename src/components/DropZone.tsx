import { useRef, useState } from 'react'
import { parseCsvFile } from '../lib/csvParser'
import type { ParsedCSV } from '../types'

interface DropZoneProps {
  onLoaded: (csv: ParsedCSV) => void
}

export function DropZone({ onLoaded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw { message: '.csv ファイルを選択してください。' } satisfies {
          message: string
        }
      }
      const csv = await parseCsvFile(file)
      onLoaded(csv)
    } catch (err) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'このファイルは読み込めません。Googleフォームからエクスポートした.csv（UTF-8）を投入してください。'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-lg py-16 px-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onChange}
          className="hidden"
        />
        {loading ? (
          <p className="text-gray-600">読み込み中...</p>
        ) : (
          <>
            <p className="text-lg text-gray-700 mb-2">
              CSVファイルをここにドラッグ&ドロップ
            </p>
            <p className="text-sm text-gray-500">
              またはクリックしてファイルを選択
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Googleフォームからエクスポートした .csv (UTF-8) に対応
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      <p className="mt-6 text-xs text-gray-400 text-center">
        ※ このツールはCSVデータをサーバーに送信しません。全てブラウザ内で処理されます。
      </p>
    </div>
  )
}
