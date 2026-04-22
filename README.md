# Survey Aggregator

Googleフォームからエクスポートしたアンケート結果CSVをブラウザ上で集計し、Excel出力できるツール。

## 特徴

- **完全ブラウザ内完結**: CSVデータは一切サーバーに送信されない
- **データベース・認証なし**: 静的ページとして配信
- **単純集計**: 各設問の回答数・割合をExcel出力
- **クロス集計**: 条件フィルタで絞り込んだ集計結果もExcel出力
- **複数選択対応**: カンマ+スペース区切りの複数選択回答を分解して集計

## 技術スタック

- Vite + React + TypeScript
- PapaParse（CSVパース）
- ExcelJS（xlsx出力）
- Tailwind CSS
- GitHub Pages（ホスティング）

## ローカル開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## デプロイ

`main` ブランチへのpushで GitHub Actions が自動ビルド&デプロイ。

## 設計書

`docs/` 配下を参照。
