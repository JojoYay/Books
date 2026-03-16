# ScoutBooks

スカウト活動向けの本の閲覧・課題管理Webアプリケーション。

## 機能

- **本のビューワー** — スキャンした本のページ（JPEG）をスマートフォンで閲覧
- **しおり・メモ** — ページごとのしおりとメモ機能
- **課題管理** — 課題の提出（写真・ファイル・コメント）と完了確認
- **達成率ダッシュボード** — 隊員の課題進捗を一覧表示
- **PWA対応** — 一度閲覧したページはオフラインでも読める

## 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | Next.js (App Router) + TypeScript + Tailwind CSS |
| ホスティング | Firebase App Hosting |
| 認証 | Firebase Authentication |
| データベース | Cloud Firestore |
| ストレージ | Firebase Storage |
| メール通知 | Resend + Cloud Functions |
| オフライン対応 | PWA (Service Worker) |

## 開発環境のセットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/<your-org>/scoutbooks.git
cd scoutbooks
npm install
```

### 2. 環境変数を設定

```bash
cp .env.local.example .env.local
```

`.env.local` にFirebaseプロジェクトの設定値を記入する。

### 3. 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できます。

## Firebase セットアップ

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Authentication（メール/パスワード）を有効化
3. Cloud Firestore を作成
4. Firebase Storage を作成
5. Firebase App Hosting を設定

## ディレクトリ構成

```
src/
├── app/           # Next.js App Router ページ
├── components/    # UIコンポーネント
│   ├── ui/        # 汎用UI部品
│   ├── book/      # 本・ビューワー関連
│   ├── task/      # 課題関連
│   └── dashboard/ # ダッシュボード関連
├── lib/
│   └── firebase/  # Firebase初期化（client / admin）
├── hooks/         # カスタムフック
├── contexts/      # React Context（認証など）
└── types/         # TypeScript型定義
functions/         # Cloud Functions（メール通知）
docs/              # 仕様書
```
