# ビズてす セットアップ手順（v2：企業管理者ロール追加版）

このフォルダは、ビズもんと同じ構成（Vercelでの静的ホスティング＋Firebase/Firestore）を想定した、
ビズてすの運営側（問題管理・招待発行）と受験側（4パートのテスト画面）の一式です。
ビルド不要のプレーンなHTML／JSファイルなので、Vercelへはそのままデプロイできます。

## 0. できること／まだできないこと

**このドラフトでできること**
- オペレーター（ビズてす運営者）が企業を登録し、企業ごとに4パート（タイピング／リーディング／ロジカル／仕事観）の問題を1問ずつ追加・編集・削除できる（`operator-question-editor.html`）
- 企業登録時に、あらかじめ用意したデフォルト問題（リーディング11問・ロジカル20問・仕事観27項目・タイピング文例）をテンプレートとしてコピーできる
- オペレーターが応募者ごとに受験招待リンクを発行できる（`operator-invites.html`）
- 応募者が招待リンクから、練習→本番の流れで4パートを通しで受験し、結果がFirestoreに保存される（`exam-entry.html` → `exam.html` → `exam-complete.html`）
- **（v2で追加）企業管理者ロール**：オペレーターまたは既存の企業管理者が、自社の担当者を「企業管理者」として招待できる（`company-admin-invite.html`）。招待された本人は `company-admin-signup.html` からセルフサインアップし、以後は自社の問題編集・受験招待発行・受験結果確認だけができる、自社に閉じたアカウントとしてログインできる（`operator-login.html` → `company-admin-home.html`）。1社に複数の企業管理者アカウントを持たせられる。
- **（v2で追加）運営の代理操作モード**：オペレーターが `operator-home.html` の企業一覧から「問題を編集」「受験招待・結果」「企業管理者を招待・管理」のいずれかに入ると、画面上部にオレンジ色の「運営モード」バナーが表示され、どの企業を代理操作しているかが常に分かるようになっている（`operator-mode.js`）。

**まだ実装していない／今後の相談ポイント**
- 既存社員（ビズもん利用者）への同一試験の展開・スコア比較機能（Firestoreのスキーマは`employeeBenchmarks`として予約済み、UI・集計ロジックは未実装）
- 問5・問7（図形・グラフ選択問題）の画像は、Firebase Storage等にアップロードした上でURLを問題編集画面から設定する必要があります（自動アップロードは未実装）
- 図形・グラフの追加問題案（出題設計仕様書シート③の案1〜5）は未実装
- 結果の詳細レポート画面（応募者ごとの得点内訳やレーダーチャート表示）は未実装。現状はFirestoreの `examResults` を直接確認する形です
- 招待リンクの有効期限（`expiresAt`）は項目のみ用意し、実際のチェック処理は未実装です
- 企業管理者の招待メールは、案内メール本文を自動生成した上で「メールを作成（mailto）」「本文をコピー」する運用です（自動送信は未実装。ビズもんの運用と同じ）

## 1. Firebaseプロジェクトを作成する

ビズもんとは別の、ビズてす専用の新規Firebaseプロジェクトを作成する方針で進めています。

1. https://console.firebase.google.com/ で新規プロジェクトを作成（例：`biztest-xxxxx`）
2. 「Authentication」を有効化し、Sign-in method で以下を有効にする
   - メール/パスワード（オペレーター・企業管理者用）
   - 匿名（応募者の受験用）
3. 「Firestore Database」を本番モードで作成（リージョンは asia-northeast1 = 東京 を推奨）
4. 「プロジェクトの設定」→「全般」→「マイアプリ」でウェブアプリを追加し、表示された設定値（`firebaseConfig`）をコピーする
5. このフォルダの `firebase-config.js` を開き、`TODO_REPLACE_ME` の部分をすべて実際の値に置き換える

## 2. セキュリティルールを反映する

`firestore.rules` の内容を、Firebaseコンソールの「Firestore Database」→「ルール」に貼り付けて公開してください
（Firebase CLIをお使いの場合は `firebase deploy --only firestore:rules` でも構いません）。

v2では `companyAdmins` / `pendingCompanyAdmins` コレクションの権限判定が追加されているため、
既存のFirebaseプロジェクトに反映する場合は、必ず最新の `firestore.rules` で上書きしてください。

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

## 5. 企業管理者アカウントを発行する（v2で追加）

企業管理者アカウントは、オペレーターアカウントと違ってスクリプト不要で、画面から招待〜本登録できます。

1. `operator-home.html` の企業一覧から、対象企業の「企業管理者を招待・管理 →」を開く（`company-admin-invite.html?company=企業ID`）
2. 「新しい企業管理者を招待する」フォームに氏名・メールアドレスを入力して「招待する」を押す
3. 表示された案内メールの本文をコピーするか、「メールを作成」でメールソフトを起動して本人に送付する
4. 招待された本人が、案内メール内のURL（`company-admin-signup.html`）からメールアドレス確認＋パスワード設定を行うと、企業管理者アカウントが有効化される
5. 以後は `operator-login.html` から、発行したメールアドレス・パスワードでログインすると `company-admin-home.html` に入り、自社の問題編集・受験招待発行・受験結果確認・自社の追加管理者の招待ができる

同じ企業に複数の企業管理者アカウントを持たせたい場合は、既に登録済みの企業管理者本人が
`company-admin-home.html` → 「自社の管理者を管理する」からも追加招待ができます（オペレーターを介さなくてよい）。

## 6. Vercelにデプロイする

ビズもんと同様、ビルド不要の静的サイトとしてそのままVercelにデプロイできます。

1. このフォルダをGitリポジトリ化する（またはビズてす_vercelフォルダに配置する）
2. Vercelで「Add New Project」→ リポジトリを選択 → Framework Preset は "Other"（ビルドコマンドなし）
3. デプロイ後、`https://<your-project>.vercel.app/operator-login.html` にアクセスして動作確認する

## 7. 動作確認の流れ

1. `operator-login.html` でオペレーターとしてログイン
2. `operator-home.html` で企業を登録（テンプレートコピーにチェック）
3. `operator-question-editor.html` で問題内容を確認・調整
4. `company-admin-invite.html` から、その企業の担当者を企業管理者として招待する
5. 招待された担当者が `company-admin-signup.html` からセルフサインアップし、`operator-login.html` からログインして `company-admin-home.html` に入れることを確認する
6. 企業管理者としてログインした状態で、自社の問題編集・受験招待発行ができ、他社のデータには一切アクセスできないことを確認する
7. `operator-invites.html` で応募者向けの受験招待リンクを発行する
8. 発行したリンク（`exam-entry.html?company=...&token=...`）を別ブラウザ／シークレットウィンドウで開いて受験してみる
9. 受験完了後、`operator-invites.html`（または企業管理者の同画面）の一覧に合計スコアが表示されることを確認する

## 次にご相談したいこと

- Firebaseプロジェクトを作成されましたら、`firebaseConfig` の値を教えてください（このセッションで直接ファイルに反映します）
- 企業管理者への招待リンクの送り方（メール送信機能を作るか、招待した側がコピーして手動送付する運用で十分か）
- 結果レポート画面（レーダーチャートでの可視化など）の必要度・優先度
