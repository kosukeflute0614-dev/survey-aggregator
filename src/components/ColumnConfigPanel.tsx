import type { ColumnConfig, ColumnType, ParsedCSV } from '../types'

interface ColumnConfigPanelProps {
  csv: ParsedCSV
  configs: ColumnConfig[]
  onChange: (configs: ColumnConfig[]) => void
  onProceed: () => void
  onReset: () => void
}

const TYPE_LABELS: Record<ColumnType, string> = {
  single: '単一選択',
  multiple: '複数選択',
  numeric: '数値',
  free_text: '自由記述',
  excluded: '集計対象外',
}

const TYPE_OPTIONS: ColumnType[] = [
  'single',
  'multiple',
  'numeric',
  'free_text',
  'excluded',
]

export function ColumnConfigPanel({
  csv,
  configs,
  onChange,
  onProceed,
  onReset,
}: ColumnConfigPanelProps) {
  const updateConfig = (index: number, patch: Partial<ColumnConfig>) => {
    const next = configs.map((c, i) => (i === index ? { ...c, ...patch } : c))
    onChange(next)
  }

  const onTypeChange = (index: number, type: ColumnType) => {
    updateConfig(index, {
      type,
      // excludedに変更したら自動でOFF、その他に変更したら集計対象に戻す
      included: type !== 'excluded',
    })
  }

  const onIncludedChange = (index: number, included: boolean) => {
    updateConfig(index, { included })
  }

  const getSampleValue = (colIdx: number): string => {
    for (const row of csv.rows) {
      const v = row[colIdx]
      if (v && v.trim() !== '') return v
    }
    return ''
  }

  const includedCount = configs.filter((c) => c.included).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">列設定</h2>
          <p className="text-sm text-gray-600 mt-1">
            {csv.headers.length}列 / {csv.rows.length}件の回答（集計対象:{' '}
            {includedCount}列）
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:underline"
        >
          ← CSVを差し替える
        </button>
      </div>

      <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
        列タイプは自動判定されますが、<strong>複数選択（カンマ区切り）の列が「自由記述」になっている場合</strong>は、列タイプのドロップダウンで「複数選択」に手動切替してください。
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">列名</th>
              <th className="px-4 py-3 text-left w-36">列タイプ</th>
              <th className="px-4 py-3 text-center w-24">集計対象</th>
              <th className="px-4 py-3 text-left">サンプル値</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {configs.map((config, index) => {
              const sample = getSampleValue(index)
              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-gray-900 break-all">
                    {config.name || <span className="text-gray-400">（名前なし）</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={config.type}
                      onChange={(e) =>
                        onTypeChange(index, e.target.value as ColumnType)
                      }
                      className="border rounded px-2 py-1 bg-white text-sm w-full"
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={config.included}
                      onChange={(e) =>
                        onIncludedChange(index, e.target.checked)
                      }
                      disabled={config.type === 'excluded'}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500 break-all max-w-md">
                    {sample || <span className="text-gray-300">（空）</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onProceed}
          disabled={includedCount === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          集計画面へ進む
        </button>
      </div>
    </div>
  )
}
