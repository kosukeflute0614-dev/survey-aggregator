import { useState } from 'react'
import { DropZone } from './components/DropZone'
import { ColumnConfigPanel } from './components/ColumnConfigPanel'
import { SimpleAggregation } from './components/SimpleAggregation'
import { CrossTabulation } from './components/CrossTabulation'
import { detectColumnConfigs } from './lib/columnTypeDetector'
import type { ColumnConfig, ParsedCSV } from './types'

type AggregateTab = 'simple' | 'cross'

function AggregationScreen({
  csv,
  configs,
  onBackToColumns,
  onReset,
}: {
  csv: ParsedCSV
  configs: ColumnConfig[]
  onBackToColumns: () => void
  onReset: () => void
}) {
  const [tab, setTab] = useState<AggregateTab>('simple')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">集計結果</h2>
        <div className="flex gap-4">
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
        </div>
      </div>

      <div className="border-b flex gap-1 mb-5">
        <TabButton active={tab === 'simple'} onClick={() => setTab('simple')}>
          単純集計
        </TabButton>
        <TabButton active={tab === 'cross'} onClick={() => setTab('cross')}>
          クロス集計
        </TabButton>
      </div>

      {tab === 'simple' && <SimpleAggregation csv={csv} configs={configs} />}
      {tab === 'cross' && <CrossTabulation csv={csv} configs={configs} />}
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

type Screen = 'upload' | 'columns' | 'aggregate'

function App() {
  const [screen, setScreen] = useState<Screen>('upload')
  const [csv, setCsv] = useState<ParsedCSV | null>(null)
  const [configs, setConfigs] = useState<ColumnConfig[]>([])

  const handleCsvLoaded = (loaded: ParsedCSV) => {
    setCsv(loaded)
    setConfigs(detectColumnConfigs(loaded))
    setScreen('columns')
  }

  const handleReset = () => {
    setCsv(null)
    setConfigs([])
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
            onBackToColumns={() => setScreen('columns')}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}

export default App
