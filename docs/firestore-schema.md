# ビズてす Firestore データモデル（v2：企業管理者ロール追加版）

対象プロジェクト：ビズもんとは別の、ビズてす専用の新規Firebaseプロジェクトを想定。

## コレクション構成

```
operators/{uid}
  name: string
  email: string
  role: "operator"
  createdAt: timestamp
  createdBy: string                 # 自己登録の場合は自分のuid、既存の企業管理者への
                                     # 権限付与の場合はそれを行ったオペレーターのuid

pendingOperators/{email}
  # 運営専任メンバーの招待（セルフサインアップ待ち）。ドキュメントIDは招待先メールアドレス。
  # 既に企業管理者として登録済みの人に運営権限を追加する場合はこのコレクションを使わず、
  # operators/{uid} を直接作成する（companyAdmins側の登録は維持したまま権限だけを追加する）。
  email: string
  name: string
  note: string                      # 任意
  status: "pending" | "registered" | "cancelled"
  createdAt: timestamp
  createdBy: string                 # operators/{uid}
  updatedAt: timestamp
  updatedBy: string
  registeredAt: timestamp | null
  registeredUid: string | null        # 本登録完了時に operators/{uid} のuidを記録

companyAdmins/{uid}
  # 企業側の担当者アカウント（1社に複数人を紐づけ可能）。
  # ビズもんの users/{uid}（role: "admin"）に相当する、ビズてす版の企業管理者。
  # ドキュメントIDがそのままFirebase AuthのUIDであり、uidフィールドにも同じ値を持つ。
  uid: string                       # このドキュメントのID（Firebase AuthのUID）と同じ値
  companyId: string                 # companies/{companyId} への紐付け
  employeeCode: string              # 社員コード（任意入力・空文字可）
  name: string                      # 氏名
  department: string                # 部署（任意入力・空文字可）
  position: string                  # 役職（任意入力・空文字可）
  email: string                     # メールアドレス
  role: "companyAdmin"              # ビズてす権限。現状は企業管理者のみ（将来の権限追加に備えて予約）
  status: "active" | "inactive"     # 無効化はstatus変更のみ（ドキュメント自体は削除しない）
  isApplicant: boolean              # ビズてす申込者（この企業がビズてすを申し込んだ本人）かどうか
  note: string                      # 備考（任意）
  createdAt: timestamp
  createdBy: string                 # operators/{uid} または companyAdmins/{uid}（自社招待の場合）
  updatedAt: timestamp
  updatedBy: string

pendingCompanyAdmins/{email}
  # 企業管理者の招待（セルフサインアップ待ち）。ドキュメントIDは招待先メールアドレス。
  # ここで設定した employeeCode / department / position / isApplicant は、本登録時に
  # そのまま companyAdmins/{uid} にコピーされる（本人が登録時に変更することはできない）。
  email: string
  name: string
  companyId: string
  companyName: string
  employeeCode: string              # 任意（空文字可）
  department: string                # 任意（空文字可）
  position: string                  # 任意（空文字可）
  isApplicant: boolean              # ビズてす申込者かどうか
  note: string                      # 任意
  status: "pending" | "registered" | "cancelled"
  createdAt: timestamp
  createdBy: string                 # operators/{uid} または companyAdmins/{uid}
  updatedAt: timestamp
  updatedBy: string
  registeredAt: timestamp | null
  registeredUid: string | null       # 本登録完了時に companyAdmins/{uid} のuidを記録

templates/{partId}
  # partId は "typing" | "reading" | "logical" | "worklife"
  # 企業を新規登録する際にコピーするデフォルト問題セット（scripts/seed-templates.mjs で投入）
  partLabel: string
  instructions: string
  practiceTimeLimitSec: number
  realTimeLimitSec: number
  updatedAt: timestamp

templates/{partId}/items/{itemId}
  # companies/{companyId}/questionSets/{partId}/items/{itemId} と同一スキーマ

companies/{companyId}
  # companyId はオペレーターが operator-new-application.html で手入力する
  # 半角英数字・ハイフン・アンダースコアの識別子（例：C001）。ドキュメントIDそのものが
  # companyId であり、companyId フィールドにも同じ値を重複して持たせている
  # （firestore.rulesでの検証をしやすくするため。ビズもんの companies/{companyId} と同じ設計）。
  companyId: string                 # このドキュメントのID（会社ID）と同じ値
  companyName: string
  plan: string                      # ご希望プラン（任意入力、例："スタンダード"）
  employeeCountPlan: string         # 想定従業員数（任意入力、例："50名"）
  status: "active" | "suspended"
  termsAccepted: boolean            # 申込者が利用規約に同意したか（初期値false）
  serviceEnabled: boolean           # サービス利用が有効か（初期値false。利用規約同意と同時にtrueになる）
  termsAcceptedAt: timestamp        # 同意日時（未同意の間は存在しない）
  termsAcceptedBy: string           # 同意した companyAdmins/{uid} のuid
  termsAcceptedByName: string       # 同意した申込者の氏名（記録用）
  termsAcceptedSource: "applicant_web_agreement"  # 同意経路（現状はWeb画面のみ）
  termsAcceptedNote: string         # 同意経路の補足メモ
  termsVersion: string              # 同意した時点の利用規約バージョン（例："2026-07-16"）
  contactName: string               # 最初の管理者（申込者）の氏名
  contactEmail: string              # 最初の管理者（申込者）のメールアドレス
  contactPhone: string              # 最初の管理者（申込者）の電話番号（任意入力）
  note: string                      # 申込時の備考（任意入力）
  appliedAt: timestamp              # 申込登録日時
  createdAt: timestamp
  updatedAt: timestamp

companies/{companyId}/questionSets/{partId}
  # partId は "typing" | "reading" | "logical" | "worklife" の固定4種
  partLabel: string                 # 画面表示名（例：リーディングスキル）
  instructions: string              # 受験画面に出す説明文
  practiceTimeLimitSec: number      # 練習パートの制限時間（0 = 無制限）
  realTimeLimitSec: number          # 本番パートの制限時間
  updatedAt: timestamp
  updatedBy: string                 # operators/{uid} または companyAdmins/{uid}

companies/{companyId}/questionSets/{partId}/items/{itemId}
  order: number                     # 表示順
  stage: "practice" | "real"
  type: "typing_passage" | "choice" | "multi_select" | "fill_blank" | "sentence_completion"
  questionText: string
  choices: [ { key: "A", text: "..." }, ... ]   # choice / multi_select のみ
  correctAnswer: string | string[]  # choice="A" / multi_select=["1","2","3"] / fill_blank="6"
  score: number
  explanation: string               # 任意
  imageUrl: string                  # 任意（図形・グラフ問題用。Firebase Storage等のURL）
  measurementIntent: string         # 仕事観アセスメント用（測定意図メモ、運用者向け）
  active: boolean
  createdAt: timestamp
  updatedAt: timestamp

companies/{companyId}/examInvites/{token}
  # token はURLに含める推測困難なランダム文字列（ドキュメントIDとして利用）
  applicantName: string
  applicantEmail: string
  employeeCode: string               # 社員コード（任意入力・空文字可。v7で追加）
  department: string                 # 部署（任意入力・空文字可。v7で追加）
  position: string                   # 役職（任意入力・空文字可。v7で追加）
  note: string                       # 備考（任意入力・空文字可。v7で追加）
  status: "not_started" | "in_progress" | "completed" | "expired"
  createdAt: timestamp
  expiresAt: timestamp
  startedAt: timestamp | null
  completedAt: timestamp | null
  anonUid: string | null            # 受験開始時にひもづく匿名認証UID

companies/{companyId}/examResults/{token}
  # ドキュメントIDはexamInvitesと同じtokenを使う（1招待=1受験=1結果）
  applicantName: string
  applicantEmail: string
  startedAt: timestamp
  completedAt: timestamp
  parts:
    typing:   { score, charsPerMinute, errorCount, missCount, rawInputLength }
    reading:  { score, correctCount, totalCount, answers: [{itemId, selected, correct, isCorrect}] }
    logical:  { score, correctCount, totalCount, answers: [{itemId, answerValue, isCorrect}] }
    worklife: { answers: [{itemId, questionText, freeText}] }   # 採点は正誤ではなく後で人が確認
  totalScore: number                # 思考力(reading)+ロジカル(logical)の合計点想定。worklifeは別集計
  status: "completed"

# 将来拡張（今回は未実装・スキーマのみ予約）
companies/{companyId}/employeeBenchmarks/{partId}
  # 既存社員に同一試験を受けてもらった際の集計値（平均・分布・パーセンタイル計算用）
  sampleSize: number
  scoreDistribution: number[]       # もしくは percentile: {p10, p25, p50, p75, p90}
  updatedAt: timestamp
```

## 設計メモ

- `questionSets/{partId}/items` をサブコレクションにしたのは、オペレーター画面から「1問ずつ追加・編集・削除」を自然なCRUDとして実装するため（配列フィールドだと編集のたびにドキュメント全体を書き換える必要があり事故りやすい）。
- 応募者はFirebase Authの匿名認証（Anonymous Auth）でサインインし、`examInvites/{token}` の存在確認をセキュリティルールで行うことで、パスワード登録なしに受験できるようにしている。招待リンク（`exam-entry.html?company=xxx&token=yyy`）はURLに知らないと辿り着けない前提。
- `worklife`（仕事観アセスメント）は正解のない自由記述のため、`items.correctAnswer` は使用せず、`examResults.parts.worklife.answers` に自由記述をそのまま保存する。将来的に社員ベンチマークと突き合わせる際は、この自由記述をもとにした分類・タグ付けを別途検討する。
- `employeeBenchmarks` は今回のスコープには含めていないが、将来「既存社員にも同じ問題を受けてもらい比較する」機能を追加しやすいようにコレクション名だけ予約している。

## v2で追加：企業管理者ロールについて（ビズもんのユーザー権限設計を踏襲）

- ビズもんの `users/{uid}`（role: "admin" が自社スコープの企業管理者、`isOperator` フラグが運営権限のスタッキング）に相当する仕組みを、ビズてすでは **オペレーターとは完全に別のコレクション** `companyAdmins/{uid}` として実装した。ビズてすには「一般社員(role:"user")」に相当する概念がなく、オペレーターと企業管理者の2ロールのみのシンプルな構成のため、role文字列で分岐させず、コレクションを分けることで権限判定をシンプルにしている。
- 企業管理者は `companyAdmins/{uid}.companyId` で自社にスコープされ、`firestore.rules` の `sameCompany(companyId)` を通じて、questionSets・examInvites・examResults への読み書きがオペレーターと同等に許可される。ただし `companies/{companyId}` 自体の新規登録・状態変更（有効/停止）は、これまで通りオペレーターのみに限定している。
- 企業管理者アカウントの発行は、ビズもんの `pendingUsers` / `employee-signup.html` と同じ「招待→本人セルフサインアップ」方式を採用（`pendingCompanyAdmins/{email}` → `company-admin-signup.html`）。オペレーターだけでなく、既存の企業管理者自身も自社宛の追加招待を作成できる（1社に複数の企業管理者を持たせたいという要件のため）。
- オペレーターアカウントも同様に、ビズもんの `pendingOperators` / `operator-signup.html` と同じ「招待→本人セルフサインアップ」方式を採用した（`operator-invite.html` の「②」）。加えて、既に企業管理者として登録済みのアカウントに運営権限だけを追加で付与する（`operator-invite.html` の「①」）、あるいは逆に運営権限だけを解除することもできる。ビズもんでは`users/{uid}.isOperator`という真偽値フラグで「企業側と兼務」の運営権限を表現していたが、ビズてすはオペレーターと企業管理者が別コレクションのため、同じuidに対して`operators/{uid}`ドキュメントが存在するかどうかで「兼務」を表現する（companyAdmins側の登録内容は一切変更しない）。
- パスワードのルール・案内文言は、ビズもんの `password-policy.js`（15文字以上・128文字以内、複雑さの強制なし、パスフレーズ推奨）をそのまま踏襲し、`password-policy.js`として移植した。企業管理者・オペレーターいずれの初回登録画面（`company-admin-signup.html` / `operator-signup.html`）でもこのモジュールを共通利用し、ログイン画面（`login.html`）の「パスワードを忘れた場合」の案内文言・パスワード再設定メール送信もビズもんの`login.html`と同じ体裁にしている。
- オペレーターが特定の企業の管理画面（`operator-question-editor.html` / `operator-invites.html` / `company-admin-invite.html`）に `?company=` パラメータ付きで入る際は、ビズもんの `operator-mode.js` に相当する `operator-mode.js`（ビズてす版）がオレンジ色の「運営モード」バナーを表示し、代理操作であることを視覚的に示す。あわせてページのCSSカスタムプロパティ（`--blue` / `--blue-dark`）をオレンジに上書きすることで、運営者が操作しているときはページ全体がオレンジ基調、企業管理者本人が操作しているときは青基調になるよう自動的に切り替わる。

## v3で追加：企業管理者のプロフィール項目（ビズもんの users スキーマを踏襲）

- ビズもんの `users/{uid}` が持つ、社員コード・氏名・部署・役職・メールアドレス・備考・UID・`isApplicant`（申込者フラグ）といった項目を、ビズてすの `companyAdmins/{uid}` にもそのまま追加した。`role` フィールドは現状 `"companyAdmin"` の固定値のみだが、将来ビズてす側の権限を細分化する場合に備えてフィールド自体は用意している（ビズもんの `role: "admin" | "user"` に相当する拡張の余地）。
- `isApplicant`（ビズてす申込者）は、その企業がビズてすを申し込んだ本人であることを示す情報項目として追加した。v4で、ビズもんと同様にこのフラグが実際の権限（自社の利用規約同意を行える権限）として機能するようになった（詳細はv4の節を参照）。
- これらの項目は `pendingCompanyAdmins/{email}` の招待時点で設定し、本登録（セルフサインアップ）時にそのまま `companyAdmins/{uid}` へコピーされる。本登録後は `company-admin-invite.html` の企業管理者一覧から、同じ企業の企業管理者（オペレーターの場合は任意の企業の企業管理者）のプロフィール項目を編集できる。

## v4で追加：企業の利用規約同意フロー（ビズもんの termsAccepted / serviceEnabled を踏襲）

- `operator-new-application.html` での企業新規登録を、Firestoreドキュメント自動採番から **オペレーターが手入力する `companyId`**（例：`C001`）に変更した。ビズもんの `companies/{companyId}` と同じく、ドキュメントIDそのものを会社IDとして使う設計にそろえている。登録済みの `companyId` かどうかは事前に `getDoc` で重複チェックする。
- 企業新規登録時、`companies/{companyId}` に `termsAccepted: false` / `serviceEnabled: false` を初期値として設定するようになった。以後、自社の「ビズてす申込者」（`companyAdmins/{uid}.isApplicant === true`）が `terms-agreement.html` で同意するまで、`company-admin-home.html` は企業情報の案内のみを表示し、「できること」（問題編集・受験招待・管理者招待などへの導線）を非表示にする。
- 申込者が `terms-agreement.html` で同意すると、`termsAccepted: true` と同時に `serviceEnabled: true` に更新され、以後 `company-admin-home.html` から通常どおり各機能へ進めるようになる。申込者以外の企業管理者（同じ会社に複数管理者がいる場合）がログインした場合は、自動遷移はさせず「申込者にご確認ください」という案内のみを表示する（ビズもんの `getCompanyAvailability()` と同じ考え方）。
- `firestore.rules` には、この同意処理専用の書き込み経路として `canAcceptCompanyTerms(companyId)`（`isApplicantCompanyAdmin() && sameCompany(companyId)`）を追加した。`companies/{companyId}` の `update` は、オペレーターによる全体更新か、この専用経路（`termsAccepted`・`termsAcceptedAt`・`termsAcceptedBy`・`termsAcceptedByName`・`termsAcceptedSource`・`termsAcceptedNote`・`termsVersion`・`serviceEnabled`・`updatedAt` の9フィールドのみを対象とし、`termsAccepted`/`serviceEnabled`をtrueに、`termsAcceptedBy`を自分のuidに、`termsVersion`を現行バージョン文字列に固定する）のいずれかでのみ許可される。
- 移行時の注意：v4より前に（会社IDの手入力・利用規約同意フローなしで）作成済みの `companies/{companyId}` ドキュメントには `termsAccepted` / `serviceEnabled` フィールドが存在しない。この場合 `company-admin-home.html` 側の判定は「未同意」として扱われるため、既存の申込者アカウントでログインすると自動的に `terms-agreement.html` へ案内され、1回同意するだけでそのまま利用可能になる（データの手動移行は不要）。

## v5で追加：新規申込登録フォームの項目をビズもんに合わせて拡充

- `operator-new-application.html` の「企業情報」に、ビズもんと同じ **ご希望プラン**（`plan`）・**想定従業員数**（`employeeCountPlan`）の任意入力欄を、会社名の直後に追加した。
- 「最初の企業管理者（申込者）情報」の入力順を、ビズもんと同じ **社員コード → 氏名 → メールアドレス → 電話番号 → 部署 → 役職 → 備考** に統一し、新たに **電話番号**（`contactPhone`）欄を追加した。社員コードは、これまでの任意入力から**必須**に変更した。
- 登録時に `companies/{companyId}` へ書き込む内容も、上記の新規項目（`plan` / `employeeCountPlan` / `contactPhone`）と、申込時の備考（`note`）・申込登録日時（`appliedAt`）を含めるように拡張した（ビズもんの企業ドキュメントと同等の情報量にそろえている）。

## v7で追加：受験招待（examInvites）の応募者プロフィール項目をビズもんに合わせて拡充

- `companies/{companyId}/examInvites/{token}` に、ビズもんの `pendingUsers` / `users` と同じ **社員コード**（`employeeCode`）・**部署**（`department`）・**役職**（`position`）・**備考**（`note`）の4項目を追加した（いずれも任意入力・空文字可）。これにより「氏名・メールアドレス・社員コード・部署・役職・備考」の6項目がビズもん・ビズてす双方の招待画面で管理できるようになった。
- `operator-invites.html`（個別招待）のフォームに社員コード・部署・役職・備考の入力欄を追加し、招待・受験状況一覧のテーブルにも同4項目に加えて、これまで一覧には出ていなかった **受験開始日時**（`startedAt`）・**受験完了日時**（`completedAt`）の列を追加した（データ自体はv1から `examInvites` に保存済みで、表示していなかっただけ）。
- `operator-invites-bulk.html`（一括招待）の貼り付けテキスト形式を「氏名,メールアドレス」から「氏名,メールアドレス,社員コード,部署,役職,備考」に拡張した（社員コード以降は省略可・後方互換）。値にカンマを含む場合はダブルクォートで囲むことで区切り文字と区別できるようにした（ビズもんのCSV取込と同じクォート処理）。確認画面・発行結果・結果CSVダウンロードにも同4項目を追加した。
- `company-report.html`（企業管理者向けレポート）のテーブル・CSV出力に、社員コード・部署・役職・備考の4列を追加した。データソースは `examInvites` ドキュメントで、招待発行時に入力した値がそのままレポートに反映される。
- `firestore.rules` の変更は不要だった：`examInvites` の `create` はフィールド単位の制限をしておらず、`update`（応募者が受験を開始する経路）も `applicantName` / `applicantEmail` の不変のみを検証しているため、新規4項目を追加してもルールの追加変更なしでそのまま書き込める。
