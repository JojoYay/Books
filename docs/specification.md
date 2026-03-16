# ScoutBooks アプリケーション仕様書

## 1. アプリ概要

スカウト活動における「本の閲覧」と「課題管理」を一元化するWebアプリケーション。
隊員（子供）は親のスマートフォンから本を読み、課題を提出する。隊長は課題の確認・管理・進捗把握を行う。

---

## 2. 技術スタック

| 項目 | 技術 |
|------|------|
| ホスティング | Firebase App Hosting |
| 認証 | Firebase Authentication |
| データベース | Cloud Firestore |
| ファイルストレージ | Firebase Storage |
| フロントエンド | Next.js（最新版） |
| メール通知 | Resend + Cloud Functions |
| バージョン管理 | GitHub（パブリックリポジトリ） |
| オフライン対応 | PWA（Service Worker によるページキャッシュ） |

---

## 3. ユーザーロール

### 3-1. 隊長（Leader）
- スカウト隊の指導者。複数名存在する。
- 自身も隊員の子供を持つ場合がある。
- 管理権限を持つ。

### 3-2. 隊員（Member）
- スカウト隊の子供メンバー。
- 親がスマートフォンから子供のアカウントで操作する。
- 複数の子供がいる場合、それぞれのアカウントを切り替えて利用する（ブラウザのアカウント切り替え）。

> **Note:** 親専用アカウントは存在しない。子供アカウントを親が代理操作するモデル。

---

## 4. 権限マトリックス

| 機能 | 隊長 | 隊員 |
|------|------|------|
| 本の一覧表示 | ✅ | ✅（割り当てられた本のみ） |
| 本のページ閲覧 | ✅ | ✅ |
| しおり機能 | ✅ | ✅ |
| メモ機能 | ✅ | ✅ |
| 隊員の達成率確認 | ✅（全隊員） | ✅（自分のみ） |
| 課題への提出 | ✅ | ✅ |
| 課題の完了サイン・フィードバック | ✅ | ❌ |
| 親パスワードによる完了確認 | ❌ | ✅（親が操作） |
| 隊員への本の割り当て | ✅ | ❌ |
| ダッシュボード（全隊員） | ✅ | ❌ |

---

## 5. 機能仕様

### 5-1. 認証

- Firebase Authentication によるメール＆パスワード認証
- アカウント作成は隊長が管理画面から直接行う（自由登録不可）
- ロール（隊長／隊員）は Firestore のユーザードキュメントで管理

---

### 5-2. 本の管理

#### データ構造（概念）
```
books/
  {bookId}/
    title: string
    description: string
    coverImage: string (Storage URL)
    pages: [
      { pageNumber: int, imageUrl: string (Storage URL) }
    ]
    tasks: [
      { taskId, pageNumber, title, description }
    ]
    createdAt: timestamp

bookAssignments/
  {bookId}_members: [ {memberId}, ... ]
```

#### 機能
- 本はJPEG画像をページ順に並べた構成
- 隊長が管理画面から本を登録し、閲覧対象の隊員を設定する
- 隊員には割り当てられた本のみ表示される

---

### 5-3. 本のビューワー

- 本一覧画面から本を選択してページビューワーへ遷移
- ページは1枚ずつ表示（前後ナビゲーション）
- 課題があるページには課題アイコンを表示
- スマートフォン対応（タップ・スワイプ操作）
- 一度閲覧したページはService Workerがキャッシュし、オフラインでも再閲覧できる

---

### 5-4. しおり機能

- 任意のページに「しおり」を挟むことができる
- しおりはユーザー個人に紐づく（他のユーザーには見えない）
- しおり一覧から該当ページへジャンプできる

---

### 5-5. メモ機能

- 任意のページに自由テキストのメモを残せる
- メモはユーザー個人に紐づく
- メモ一覧から該当ページへジャンプできる

---

### 5-6. 課題管理

#### 課題の構成
- 課題は本の特定ページに紐づく
- 1ページに複数の課題が存在する場合がある

#### 課題への提出（隊員・隊長どちらも可）
提出物として以下を登録できる：
- 写真（画像ファイル）
- ファイル（PDF等）
- コメント（テキスト）

提出後は「提出済み・確認待ち」状態になる。

#### 課題の完了確認

完了確認は以下の**いずれか一方**で成立する：

**① 隊長によるサイン**
- 隊長アカウントから対象課題を確認
- 完了ボタン押下 ＋ フィードバックコメント（任意）
- 完了日として当日が記録される

**② 親による確認（簡易パスワード）**
- 子供アカウントで課題を表示
- 「保護者確認」ボタンを押す
- 簡易パスワード（PIN）を入力して送信
- 認証成功 → 完了日として当日が記録される

> **Note:** 簡易パスワードは隊全体で1つ。隊長が管理画面から設定・変更できる。

#### 課題ステータス
| ステータス | 説明 |
|-----------|------|
| 未着手 | 提出物なし |
| 提出済み | 提出済み、完了確認待ち |
| 完了 | 隊長または親が完了確認済み |

---

### 5-7. 達成率・進捗

- 達成率 ＝ 完了済み課題数 ／ 本の全課題数 × 100
- 本ごとに達成率を表示
- 各課題の完了日を一覧で確認できる

---

### 5-8. ダッシュボード（隊長向け）

- 全隊員の一覧
- 各隊員の本ごとの達成率をダッシュボード形式で表示
- 未提出・提出待ち・完了数の集計表示
- 隊員を選択して詳細確認（課題ごとの提出内容・完了日）

---

### 5-9. 管理機能（隊長向け）

- 隊員アカウントの作成・無効化
- 本の登録・編集（タイトル・説明・カバー画像）
- 本のページ画像のアップロード（JPEG）
- 課題の設定（ページ番号・タイトル・説明文）
- 隊員への本の割り当て設定
- 親用簡易パスワード（隊全体で1つ）の設定・変更

---

### 5-10. 通知機能

- 隊員が課題を提出したとき、**全隊長のメールアドレスに通知メールを送信**する
- 実装方式: Resend API ＋ Cloud Functions（課題提出時にトリガー）
- メール内容: 隊員名・本のタイトル・課題名・提出日時・アプリへのリンク
- 通知の送信はサーバーサイド（Cloud Functions）で行う（フロントエンドからは直接送信しない）

---

## 6. 画面一覧

### 共通
| 画面名 | 概要 |
|--------|------|
| ログイン画面 | メール＆パスワード認証 |
| ホーム（本一覧） | 割り当てられた本の一覧 |
| 本ビューワー | ページ閲覧・課題アイコン表示 |
| 課題詳細 | 課題内容・提出・完了確認 |
| しおり一覧 | しおり管理・ページジャンプ |
| メモ一覧 | メモ管理・ページジャンプ |
| 自分の達成率 | 本ごとの課題進捗 |

### 隊長専用
| 画面名 | 概要 |
|--------|------|
| ダッシュボード | 全隊員の達成率一覧 |
| 隊員詳細 | 特定隊員の課題一覧・提出内容確認 |
| 管理 > 隊員管理 | アカウント作成・無効化 |
| 管理 > 本管理 | 本の登録・編集・割り当て設定 |
| 管理 > 課題管理 | 課題の追加・編集 |

---

## 7. 運用メモ

- 本のページ数・ストレージ容量の上限はアプリ側では設けない（運用で管理）

---

## 8. Firestore データ設計（ドラフト）

```
users/{userId}
  - name: string
  - email: string
  - role: "leader" | "member"
  - createdAt: timestamp

books/{bookId}
  - title: string
  - description: string
  - coverImageUrl: string
  - totalPages: int
  - createdAt: timestamp
  - assignedMembers: string[]  // userId array

pages/{bookId}/pages/{pageNumber}
  - imageUrl: string
  - pageNumber: int

tasks/{taskId}
  - bookId: string
  - pageNumber: int
  - title: string
  - description: string
  - order: int

taskSubmissions/{submissionId}
  - taskId: string
  - memberId: string
  - photos: string[]       // Storage URLs
  - files: string[]        // Storage URLs
  - comment: string
  - status: "submitted" | "completed"
  - submittedAt: timestamp
  - completedAt: timestamp | null
  - completedBy: string    // userId (leader) or "parent"
  - leaderFeedback: string | null

bookmarks/{userId}/bookmarks/{bookmarkId}
  - bookId: string
  - pageNumber: int
  - createdAt: timestamp

memos/{userId}/memos/{memoId}
  - bookId: string
  - pageNumber: int
  - text: string
  - createdAt: timestamp
  - updatedAt: timestamp

settings/parentPin
  - pin: string  // 簡易パスワード（隊全体で1つの場合）
```

---

*作成日: 2026-03-16*
*ステータス: 確定 v1.0*
