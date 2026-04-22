import { useMemo, useState } from 'react'
import { DropZone } from './components/DropZone'
import { ColumnConfigPanel } from './components/ColumnConfigPanel'
import { SimpleAggregation } from './components/SimpleAggregation'
import { CrossTabulation } from './components/CrossTabulation'
import { detectColumnConfigs } from './lib/columnTypeDetector'
import { aggregateAll } from './lib/aggregator'
import { runCrossTabulation, validateCrossTabConfig } from './lib/crossTabulator'
import { exportCombinedAggregation } from './lib/excelExporter'
import type {
  ColumnConfig,
  CrossTabPattern,
  CrossTabResult,
  ParsedCSV,
} from './types'

type Screen = 'upload' | 'columns' | 'aggregate'
type AggregateTab = 'simple' | 'cross'

function App() {
  const [screen, setScreen] = useState<Screen>('upload')
  const [csv, setCsv] = useState<ParsedCSV | null>(null)
  const [configs, setConfigs] = useState<ColumnConfig[]>([])
  const [patterns, setPatterns] = useState<CrossTabPattern[]>([])

  const handleCsvLoaded = (loaded: ParsedCSV) => {
    setCsv(loaded)
    setConfigs(detectColumnConfigs(loaded))
    setPatterns([])
    setScreen('columns')
  }

  const handleReset = () => {
    setCsv(null)
    setConfigs([])
    setPatterns([])
    setScreen('upload')
  }

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl font-bold">Survey Aggregator</h1>
        <p className="text-gray-600 text-sm mt-1">
          CSVをドロップするだけで集計できるアンケート集計ツール
        </p>
      </header>
      <main className="max-w-5xl mx-auto">
        {screen === 'upload' && <DropZone onLoaded={handleCsvLoaded} />}
        {screen === 'columns' && csv && (
          <ColumnConfigPanel
            csv={csv}
            configs={configs}
            onChange={setConfigs}
            onProceed={() => setScreen('aggregate')}
            onReset={handleReset}
          />
        )}
        {screen === 'aggregate' && csv && (
          <AggregationScreen
            csv={csv}
            configs={configs}
            patterns={patterns}
            onPatternsChange={setPatterns}
            onBackToColumns={() => setScreen('columns')}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}

function AggregationScreen({
  csv,
  configs,
  patterns,
  onPatternsChange,
  onBackToColumns,
  onReset,
}: {
  csv: ParsedCSV
  configs: ColumnConfig[]
  patterns: CrossTabPattern[]
  onPatternsChange: (patterns: CrossTabPattern[]) => void
  onBackToColumns: () => void
  onReset: () => void
}) {
  const [tab, setTab] = useState<AggregateTab>('simple')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const simpleResults = useMemo(
    () => aggregateAll(csv, configs),
    [csv, configs]
  )

  const onExport = async () => {
    setError(null)
    setExporting(true)
    try {
      // 各パターンを集計結果に変換（不完全なパターンはスキップ）
      const crossResults: Array<{ patternName: string; result: CrossTabResult }> =
        []
      for (const p of patterns) {
        const config = {
          filters: p.filters.map(({ columnName, value }) => ({
            columnName,
            value,
          })),
          targetColumn: p.targetColumn,
        }
        if (validateCrossTabConfig(config) !== null) continue
        const result = runCrossTabulation(csv, configs, config)
        crossResults.push({ patternName: p.name || '無題', result })
      }

      await exportCombinedAggregation(simpleResults, crossResults)
    } catch (e) {
      console.error(e)
      setError('集計中にエラーが発生しました。ページを再読み込みしてお試しください')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">集計結果</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToColumns}
            className="text-sm text-blue-600 hover:underline"
          >
            ← 列設定に戻る
          </button>
          <button
            onClick={onReset}
            className="text-sm text-blue-600 hover:underline"
          >
            CSVを差し替える
          </button>
          <button
            onClick={onExport}
            disabled={exporting}
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {exporting ? '出力中...' : '全集計をExcel出力'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="border-b flex gap-1 mb-5">
        <TabButton active={tab === 'simple'} onClick={() => setTab('simple')}>
          単純集計
        </TabButton>
        <TabButton active={tab === 'cross'} onClick={() => setTab('cross')}>
          クロス集計
        </TabButton>
      </div>

      {tab === 'simple' && <SimpleAggregation csv={csv} configs={configs} />}
      {tab === 'cross' && (
        <CrossTabulation
          csv={csv}
          configs={configs}
          patterns={patterns}
          onPatternsChange={onPatternsChange}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 text-sm border-b-2 -mb-px',
        active
          ? 'border-blue-600 text-blue-600 font-semibold'
          : 'border-transparent text-gray-600 hover:text-gray-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default App
