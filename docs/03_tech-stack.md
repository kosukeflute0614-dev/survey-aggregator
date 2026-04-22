---
owner: app-dev
created: 2026-04-22
updated: 2026-04-22
review_by: 2026-07-22
status: active
---

# システム設計書（技術スタック・アーキテクチャ） - Survey Aggregator

## 技術選定の基本方針

1. **データを外部サーバーに送信しない**（ブラウザ内完結）
2. **データベース・認証サービスを使わない**
3. **シンプルな静的ホスティングで動く**
4. **友人が使うため、ダウンロード・インストール不要**
5. **開発・運用コストを最小化**（オーバースペックを避ける）

## 技術スタック

| カテゴリ | 技術 | バージョン（目安） | 選定理由 |
|---------|------|-----------|---------|
| フレームワーク | Vite + React | Vite 5.x / React 18.x | SPAとして作るのに軽量かつ実績豊富。ビルド後は静的ファイルのみ |
| 言語 | TypeScript | 5.x | 型安全性により列タイプ・集計ロジックのバグを減らせる |
| UIライブラリ | なし（素のReact）またはTailwind CSS | Tailwind 3.x | シンプルUI用に軽量CSSで十分。Tailwindは学習コスト低く調整しやすい |
| CSVパース | PapaParse | 5.x | JavaScriptのCSVパーサーのデファクト。エラー耐性・文字コード対応に優れる |
| Excel出力 | SheetJS (xlsx) または ExcelJS | SheetJS v0.18.5 / ExcelJS 4.x | ブラウザ内で.xlsxファイルを生成。採用時にバンドルサイズとライセンス制約を確認（下記「代替案の検討」参照） |
| DB | なし | - | データ保存しない設計 |
| 認証 | なし | - | アクセス制御を実施しない設計 |
| ホスティング | GitHub Pages | - | 無料・静的ホスティング・git pushで自動デプロイ |
| その他 | - | - | - |

## 代替案の検討

### フレームワーク
- **素のHTML+JavaScript**: 機能的には可能だが、状態管理（列設定、クロス集計UI）が複雑になるためReact採用
- **Next.js**: SSR/APIルート不要なのでViteの方が軽い
- **Vue/Svelte**: 可だが、社長・app-devの経験度に応じReactが無難

### Excel出力ライブラリ
- **SheetJS (xlsx)**: デファクト標準。ただし2022年以降、**npm公開版はv0.18.5で更新停止**しており、最新版はSheetJSの独自CDNでのみ配布（商用版も別料金）。セキュリティ更新はCDN版のみ。バンドルサイズ約800KB〜1MB
- **ExcelJS**: MITライセンス、npm上で継続メンテナンスされている。SheetJSよりやや機能特化型だが、xlsx出力には十分。バンドルサイズは同等〜やや大きい
- **xlsx-populate**: SheetJSよりシンプルだが機能制限あり

→ **MVPではExcelJSを優先候補**とする。理由: npm管理で依存更新が素直、ライセンスが明快、機能的にも要件（シート追加、セル書き込み、ファイル名指定ダウンロード）を満たす。実装着手時に最終決定する。

### ホスティング
- **Cloudflare Pages**: GitHub Pagesの代替として遜色なし。CDN速度が速い。要件次第で切替可
- **Vercel**: 静的サイト配信は可能だが、認証・DB無しならGitHub Pagesで十分

## システム構成図

```
[ユーザーのブラウザ]
    │
    │ ① URL アクセス
    ▼
[GitHub Pages]  ← 静的HTML/JS/CSSのみを配信
    │
    │ ② ブラウザにHTML/JS/CSSをロード
    ▼
[ブラウザ内 React SPA]
    │
    │ ③ CSVファイル読み込み（ユーザー操作）
    │    → ブラウザのFileReader APIで読み込み
    │    → PapaParseでパース
    │    → メモリ上で集計・クロス集計処理
    │
    │ ④ Excel出力
    │    → ExcelJS（優先候補）または SheetJS で .xlsx を生成
    │    → ブラウザのDownload APIでユーザーPCに保存
    ▼
[ユーザーPCのローカルファイル]

※ CSVデータは GitHub Pages サーバーには一切送信されない
※ 外部API・外部サービスとの通信なし
```

## ディレクトリ構成（想定）

```
survey-aggregator/
├── docs/                # 設計書類（このディレクトリ）
│   ├── 01_requirements.md
│   ├── 02_screen-design.md
│   └── 03_tech-stack.md
├── src/
│   ├── main.tsx         # エントリポイント
│   ├── App.tsx          # ルートコンポーネント
│   ├── components/      # UIコンポーネント
│   │   ├── DropZone.tsx
│   │   ├── ColumnConfig.tsx
│   │   ├── SimpleAggregation.tsx
│   │   └── CrossTabulation.tsx
│   ├── lib/             # 集計・パース・出力ロジック
│   │   ├── csvParser.ts
│   │   ├── columnTypeDetector.ts
│   │   ├── aggregator.ts
│   │   ├── crossTabulator.ts
│   │   └── excelExporter.ts
│   ├── types/           # 型定義
│   │   └── index.ts
│   └── styles/          # Tailwind等のスタイル
├── public/              # 静的アセット
├── index.html           # Viteのエントリ
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .github/
│   └── workflows/
│       └── deploy.yml   # GitHub Actionsで自動デプロイ
└── README.md
```

## データフロー（状態管理）

Reactのstate管理は **React標準のuseState/useContextで十分**。Reduxやzustand等は不要。

### 主要な状態

```typescript
// CSVパース結果
interface ParsedCSV {
  headers: string[]       // 列名配列
  rows: string[][]        // 全行データ
}

// 列設定
interface ColumnConfig {
  name: string
  type: 'single' | 'multiple' | 'free_text' | 'numeric' | 'excluded'
  included: boolean       // 集計対象かどうか
}

// 単純集計結果
interface AggregationResult {
  columnName: string
  type: ColumnConfig['type']
  totalResponses: number
  counts: Array<{ value: string; count: number; percentage: number }>
  // 自由記述の場合はテキスト一覧
  freeTexts?: string[]
  // 数値の場合は統計量
  stats?: { mean: number; median: number; min: number; max: number }
}

// クロス集計条件
interface CrossTabFilter {
  columnName: string
  value: string
}

interface CrossTabConfig {
  filters: CrossTabFilter[]   // AND結合
  targetColumn: string
}
```

## コアロジック設計

### 列タイプ自動判定（columnTypeDetector.ts）

優先順位で判定（要件定義 01_requirements.md と完全整合。ステップ番号も揃える）:
1. 列名に「タイムスタンプ」「timestamp」を含む、または値が日時形式 → `excluded`
2. 列名に「メール」「email」「mail」を含む、または値がメアド形式 → `excluded`
3. 全有効行の **20%以上** に `, ` (カンマ+スペース) を含む → `multiple`
4. ユニーク値が **5個以下** かつ上記に該当しない → `single`
5. 全ての非空セルが数値として解釈できる → `numeric`
6. それ以外 → `free_text`

**閾値（20%、5個）は定数として定義し、調整可能にすること。**
複数選択を数値より先に判定するのは、「選択肢が数字のみの複数選択列（例: `1, 2, 3`）」を数値と誤判定するのを避けるため。

### 単純集計（aggregator.ts）

- `single`: ユニーク値ごとにカウント、分母=有効回答数
- `multiple`: 各セルを `, ` でsplitして全展開、選択肢ごとにカウント、分母=展開後の総数
- `numeric`: mean/median/min/max を算出
- `free_text`: 空欄除外で全回答を返す

### クロス集計（crossTabulator.ts）

1. 全行に対して、フィルタ条件を全てANDで適用
   - `single`: 値が等しい
   - `multiple`: 選択肢を含む（splitしてincludes）
2. フィルタ後の行集合に対して、対象列の単純集計を実行

### Excel出力（excelExporter.ts）

実装ライブラリは **ExcelJSを優先採用**（技術スタック表・代替案の検討セクション参照）。実装着手時に最終決定する。

#### ExcelJS採用の場合のAPIイメージ
- `new ExcelJS.Workbook()` でワークブック作成
- `workbook.addWorksheet('集計結果')` でシート追加
- `sheet.addRow([...])` / `sheet.getCell(...)` でデータ書き込み
- `workbook.xlsx.writeBuffer()` → `Blob` → `URL.createObjectURL` でダウンロード

#### SheetJS採用の場合のAPIイメージ
- `XLSX.utils.aoa_to_sheet` でシート作成
- `XLSX.utils.book_append_sheet` でシート追加
- `XLSX.writeFile` でダウンロード

※ どちらを採用しても、出力フォーマット（シート構成・レイアウト）は 02_screen-design.md のExcel出力フォーマットに従うこと。

## デプロイ

### 方法
- GitHub Actionsで `main` ブランチへのpush時に自動ビルド&デプロイ
- ビルド成果物（`dist/`）をGitHub Pagesに配信

### 手順（初回セットアップ）
1. GitHubに新規リポジトリ作成（public推奨、Pagesが無料で使える）
2. `.github/workflows/deploy.yml` を配置（Vite + GitHub Pagesのテンプレートあり）
3. リポジトリのSettings > Pagesで「GitHub Actions」をソースに設定
4. `main` ブランチにpush → 数分後に公開URLが有効化

### 公開URL例
- `https://<username>.github.io/survey-aggregator/`
- カスタムドメインを使いたい場合は CNAME 設定で対応可（MVPでは不要）

### 環境変数
なし（外部サービス連携がないため）

## 開発手順の目安

1. **スキャフォールド**: Vite + React + TypeScript のテンプレート作成（5分）
2. **CSVパース**: PapaParseで動作確認、サンプルCSVを読み込めることを確認（1〜2時間）
3. **列タイプ自動判定**: 各種タイプのサンプルで判定ロジックをテスト（2〜3時間）
4. **列設定UI**: テーブル表示とドロップダウン・チェックボックス実装（2〜3時間）
5. **単純集計ロジック**: 各タイプの集計計算、Excel出力（3〜4時間）
6. **クロス集計UI**: 条件追加・削除、連動ドロップダウン、結果表示（3〜4時間）
7. **クロス集計Excel出力**: フィルタ条件明細付きの出力（1〜2時間）
8. **UIスタイル調整**: Tailwindでシンプルに整える（1〜2時間）
9. **GitHub Pagesデプロイ**: Actions設定、動作確認（30分〜1時間）

**合計目安**: 15〜25時間程度（開発経験・AIアシスト活用度による）

## テスト戦略

MVPの範囲では、以下の軽いテストで十分:

- **手動テスト**: サンプルCSVでの動作確認
  - Googleフォーム標準形式（タイムスタンプ付き、メアド付き）
  - 複数選択列を含む
  - 自由記述列を含む
  - 数値列を含む
- **ユニットテスト**（任意・推奨）: 集計ロジックのみ
  - `aggregator.ts` / `crossTabulator.ts` / `columnTypeDetector.ts`
  - Vitest（Viteとの親和性高い）
- **E2Eテスト**: 不要（MVP段階では手動で十分）

## 想定されるリスクと対応

| リスク | 対応 |
|--------|------|
| 巨大CSVでブラウザがフリーズ | 想定外の大サイズは非対応と明記。将来的にはWeb Workerへ移行可 |
| 文字コードがShift-JISのCSVが来る | PapaParseでエンコーディング指定オプション。UTF-8以外はエラー表示 |
| **BOM付きUTF-8 CSV（Excel/スプレッドシート由来）** | **1列目の列名先頭に `﻿` が付くリスクあり。PapaParseのBOM自動除去オプション、または手動ストリップ処理を実装する** |
| 複数選択の区切り文字がカンマ以外 | MVPではカンマ+スペース固定。将来的にカスタム区切りを対応 |
| 列名の重複・空列名 | パース時にバリデーション、ユーザーにエラー表示 |
| 選択肢の揺れ（全角/半角スペース等） | MVP段階では別の選択肢として扱う。将来的に正規化オプション検討 |
| **SheetJS(npm版)の更新停止・ライセンス制約** | **初回セットアップ時にExcelJSを優先採用。SheetJS採用の場合はCDN版かv0.18.5固定、バンドルサイズも確認** |
| クロス集計で条件が0件のまま実行される | UI側で「条件を1つ以上追加してください」と案内、集計を実行しない |

## 開発時の留意事項

- **CSVの文字コードはUTF-8**を前提（GoogleフォームのエクスポートはUTF-8）。BOM付き/BOMなし両対応にする
- **列名にカンマを含む選択肢**は、複数選択判定が誤作動する可能性あり → 手動上書きで対処
- **GitHub Pagesのサブパス**: リポジトリ名がパスに入るため、Viteの `base` 設定で対応（例: `base: '/survey-aggregator/'`）
- **ブラウザキャッシュ**: Viteのビルドでファイルにハッシュが自動付与されるため、通常の再アクセスで最新版に更新される。ただし `index.html` 側のキャッシュが問題になる場合があり、その時は Cmd+Shift+R のスーパーリロードで解決する旨を友人に案内する
