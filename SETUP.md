# ビズてす セットアップ手順（v1ドラフト）

このフォルダは、ビズもんと同じ構成（Vercelでの静的ホスティング＋Firebase/Firestore）を想定した、
ビズてすの運営側（問題管理・招待発行）と受験側（4パートのテスト画面）の一式です。
ビルド不要のプレーンなHTML／JSファイルなので、Vercelへはそのままデプロイできます。

## 0. できること／まだできないこと

**このドラフトでできること**
- オペレーター（ビズてす運営者）が企業を登録し、企業ごとに4パート（タイピング／リーディング／ロジカル／仕事観）の問題を1問ずつ追加・編集・削除できる（`operator-question-editor.html`）
- 企業登録時に、あらかじめ用意したデフォルト問題（リーディング11問・ロジカル20問・仕事観27項目・タイピング文例）をテンプレートとしてコピーできる
- オペレーターが応募者ごとに受験招待リンクを発行できる（`operator-invites.html`）
- 応募者が招待リンクから、練習→本番の流れで4パートを通しで受験し、結果がFirestoreに保存される（`exam-entry.html` → `exam.html` → `exam-complete.html`）

**まだ実装していない／今後の相談ポイント**
- 既存社員（ビズもん利用者）への同一試験の展開・スコア比較機能（Firestoreのスキーマは`employeeBenchmarks`として予約済み、UI・集計ロジックは未実装）
- 問5・問7（図形・グラフ選択問題）の画像は、Firebase Storage等にアップロードした上でURLを問題編集画面から設定する必要があります（自動アップロードは未実装）
- 図形・グラフの追加問題案（出題設計仕様書シート③の案1〜5）は未実装
- 結果の詳細レポート画面（応募者ごとの得点内訳やレーダーチャート表示）は未実装。現状はFirestoreの `examResults` を直接確認する形です
- 招待リンクの有効期限（`expiresAt`）は項目のみ用意し、実際のチェック処理は未実装です

## 1. Firebaseプロジェクトを作成する

ビズもんとは別の、ビズてす専用の新規Firebaseプロジェクトを作成する方針で進めています。

1. https://console.firebase.google.com/ で新規プロジェクトを作成（例：`biztest-xxxxx`）
2. 「Authentication」を有効化し、Sign-in method で以下を有効にする
   - メール/パスワード（オペレーター用）
   - 匿名（応募者の受験用）
3. 「Firestore Database」を本番モードで作成（リージョンは asia-northeast1 = 東京 を推奨）
4. 「プロジェクトの設定」→「全般」→「マイアプリ」でウェブアプリを追加し、表示された設定値（`firebaseConfig`）をコピーする
5. このフォルダの `firebase-config.js` を開き、`TODO_REPLACE_ME` の部分をすべて実際の値に置き換える

## 2. セキュリティルールを反映する

`firestore.rules` の内容を、Firebaseコンソールの「Firestore Database」→「ルール」に貼り付けて公開してください
（Firebase CLIをお使いの場合は `firebase deploy --only firestore:rules` でも構いません）。

## 3. 最初のオペレーターアカウントを作る

1. Firebaseコンソール → プロジェクトの設定 → サービスアカウント → 「新しい秘密鍵の生成」でJSONをダウンロード
2. ローカル環境（このファイル一式がある場所）で:
   ```
   npm install
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
     node scripts/create-operator.mjs "あなたの名前" "iwaya4@gmail.com" "十分に強いパスワード"
   ```
3. 作成後、`operator-login.html` からログインできるようになります。

## 4. デフォルト問題（テンプレート）を投入する

```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json node scripts/seed-templates.mjs
```

これで `templates/{typing|reading|logical|worklife}/items` にデフォルト問題が投入されます。
以後、運営ホーム画面で企業を新規登録する際、「テンプレートの初期問題をコピーする」にチェックを入れると
その企業にコピーされ、そこから個社別に編集していけます。

## 5. Vercelにデプロイする

ビズもんと同様、ビルド不要の静的サイトとしてそのままVercelにデプロイできます。

1. このフォルダをGitリポジトリ化する（またはビズてす_vercelフォルダに配置する）
2. Vercelで「Add New Project」→ リポジトリを選択 → Framework Preset は "Other"（ビルドコマンドなし）
3. デプロイ後、`https://<your-project>.vercel.app/operator-login.html` にアクセスして動作確認する

## 6. 動作確認の流れ

1. `operator-login.html` でログイン
2. `operator-home.html` で企業を登録（テンプレートコピーにチェック）
3. `operator-question-editor.html` で問題内容を確認・調整
4. `operator-invites.html` で応募者向けの受験招待リンクを発行
5. 発行したリンク（`exam-entry.html?company=...&token=...`）を別ブラウザ／シークレットウィンドウで開いて受験してみる
6. 受験完了後、`operator-invites.html` の一覧に合計スコアが表示されることを確認する

## 次にご相談したいこと

- Firebaseプロジェクトを作成されましたら、`firebaseConfig` の値を教えてください（このセッションで直接ファイルに反映します）
- 応募者への招待リンクの送り方（メール送信機能を作るか、オペレーターがコピーして手動送付する運用で十分か）
- 結果レポート画面（レーダーチャートでの可視化など）の必要度・優先度
