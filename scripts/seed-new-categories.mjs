// ビズてす 新カテゴリー（5大分類）投入・旧4パート削除スクリプト
//
// 背景:
//   これまでの①タイピング試験②リーディングスキル③ロジカルシンキング④仕事観アセスメントの
//   4パート構成を廃止し、以下の新5大分類に置き換える。
//     1. 認知能力（cognitive）      … 注意力/記憶力/語彙力/計算力/直観力/言語応用力/基礎推理力
//     2. 言語理解能力（verbal）      … 構造理解力/照応理解力/同義理解力/文章推論力/認識力/照合力/要点抽出力/文脈理解力
//     3. 論理思考能力（logical_thinking） … MECE/因果関係/仮説思考/構造化/問題解決
//     4. 実務遂行能力（business_exec）    … 処理力/判断力/コミュニケーション力
//     5. 行動特性・性格（personality）    … 協調性/主体性/ストレス耐性/モチベーション/行動傾向/外向性/勤勉性・計画性/開放性（5段階評価）
//   各問題には小分類名を subcategory として持たせている（将来の分析・ダッシュボード集計用）。
//
// 使い方:
//   1. Firebaseコンソール → プロジェクトの設定 → サービスアカウント → 新しい秘密鍵の生成 で
//      サービスアカウントJSONをダウンロードする（seed-templates.mjsで使ったものと同じでよい）
//   2. npm install（初回のみ）
//   3. GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json npm run seed-new-categories
//
// 注意（実行前に必ずご確認ください）:
//   - このスクリプトは、旧4パート（typing/reading/logical/worklife）の partDefinitions と
//     templates（設定＋配下のitems全問）を再帰的に削除したうえで、新5パートを投入します。
//     既に企業側で「テンプレートの初期問題をコピー」していた企業のデータ（companies/{id}/questionSets 配下）は
//     削除されません。旧パートに紐づく過去の受験結果（examResults）もそのまま残ります。
//   - 記憶力の問題（4〜6問目）は、原文では「5秒間記憶してから回答」という出題形式ですが、
//     現在の受験画面には「記憶用の文字列を5秒後に自動で隠す」機能がありません。そのため、
//     記憶対象の文字列は画面に表示されたままになります（本来の記憶力測定としては制限があります。
//     自動非表示機能が必要な場合は別途ご相談ください）。
//   - 言語理解能力の問題30（認識力）は、原文に正解の明記がなかったため、文章の内容から
//     B（桜並木は右側、ベンチは左側）と判断して登録しています。念のためご確認ください。
//   - 照合力の問題36は、原文の正解表記が「練和数である」でしたが、問題文中で定義されている
//     用語は「連和数」のため、"連和数である" として登録しています。
//   - 得点（score）は、正誤判定のある問題（択一・複数選択・空欄補充）はすべて1点、
//     タイピング・5段階評価は0点（採点対象外）としています。配点は運営画面から後で調整できます。
//   - このスクリプトは既存のtemplatesデータを同じIDで上書きします。複数回実行しても安全です。

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyPath && existsSync(keyPath)) {
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
} else {
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();

const OLD_PART_IDS = ["typing", "reading", "logical", "worklife"];

const PART_DEFS = [
  { id: "cognitive", label: "①認知能力", order: 1 },
  { id: "verbal", label: "②言語理解能力", order: 2 },
  { id: "logical_thinking", label: "③論理思考能力", order: 3 },
  { id: "business_exec", label: "④実務遂行能力", order: 4 },
  { id: "personality", label: "⑤行動特性・性格", order: 5 },
];

const PART_SETTINGS = {
  cognitive: {
    partLabel: "①認知能力",
    instructions: "注意力・記憶力・語彙力・計算力・直観力・言語応用力・基礎推理力を測定するテストです。タイピング問題も含まれます。制限時間内に出題される問題に回答してください。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 900,
  },
  verbal: {
    partLabel: "②言語理解能力",
    instructions: "文章の構造理解・読解・推論力を測定するテストです。制限時間内に出題される問題に回答してください。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 900,
  },
  logical_thinking: {
    partLabel: "③論理思考能力",
    instructions: "MECE・因果関係・仮説思考・構造化・問題解決の考え方を測定するテストです。制限時間内に出題される問題に回答してください。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 300,
  },
  business_exec: {
    partLabel: "④実務遂行能力",
    instructions: "実務における処理力・判断力・コミュニケーション力を測定するテストです。制限時間内に出題される問題に回答してください。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 240,
  },
  personality: {
    partLabel: "⑤行動特性・性格",
    instructions: "行動特性・性格に関するアセスメントです。正解はありません。各質問について、最も当てはまるものを1つ選んでください。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 0,
  },
};

const choices = (pairs) => pairs.map(([key, text]) => ({ key, text }));

function objItem(id, order, subcategory, type, questionText, extra) {
  return { id, stage: "real", order, subcategory, type, questionText, score: 1, choices: [], correctAnswer: "", explanation: "", active: true, ...extra };
}

// ---------------- 1. 認知能力（cognitive） ----------------
const COGNITIVE_ITEMS = [
  // 注意力
  objItem("cognitive_1", 1, "注意力", "typing_passage",
    "7月20日（月）14:00より、東京本社の第3会議室にて、新商品「ビズてす」の発売に関する打合せを実施いたします。ご不明点がございましたら、担当 萩野までEメールにてご連絡ください。",
    { score: 0 }),
  objItem("cognitive_2", 2, "注意力", "typing_passage",
    "2026年度第2四半期の売上は、前年同期比＋12.8％となりました。内訳は、国内事業が¥1,280,000、海外事業が$98,500です。詳細データは「Report_Q2_Final.xlsx」にまとめています。",
    { score: 0 }),
  objItem("cognitive_3", 3, "注意力", "typing_passage",
    "次回のオンライン会議は、Microsoft Teamsを使用して実施します。参加URLは「https://meet.microsoft.com/ABC-1234-XYZ」です。参加者は、加藤、田中、髙橋の3名です。開始時刻は10:30AMです。",
    { score: 0 }),
  // 記憶力
  objItem("cognitive_4", 4, "記憶力", "choice",
    "次の記号列を5秒間記憶してください。\n★ △ ◎ ◆ ◇ ○\n5番目は？",
    { choices: choices([["A", "◆"], ["B", "◎"], ["C", "○"], ["D", "◇"], ["E", "△"]]), correctAnswer: "D" }),
  objItem("cognitive_5", 5, "記憶力", "choice",
    "次の数字列を5秒間記憶してください。\n4 2 1 3 5 6\n3番目は？",
    { choices: choices([["A", "3"], ["B", "4"], ["C", "1"], ["D", "5"], ["E", "2"]]), correctAnswer: "C" }),
  objItem("cognitive_6", 6, "記憶力", "fill_blank",
    "次のアルファベット列を5秒間記憶してください。\nA D F C E B\n4番目は？",
    { correctAnswer: "C" }),
  // 語彙力
  objItem("cognitive_7", 7, "語彙力", "choice", "「簡潔」に最も近い意味は？",
    { choices: choices([["A", "丁寧でわかりやすい"], ["B", "短く要点がまとまっている"], ["C", "内容が少なく物足りない"], ["D", "細部まで詳しく説明している"]]), correctAnswer: "B" }),
  objItem("cognitive_8", 8, "語彙力", "choice", "「厳密」に最も近い意味は？",
    { choices: choices([["A", "慎重に考えるさま"], ["B", "細部まで正確で、誤りがないさま"], ["C", "融通がきかず、かたくななさま"], ["D", "細かくて、理解しづらいさま"]]), correctAnswer: "B" }),
  objItem("cognitive_9", 9, "語彙力", "choice", "「迅速」に最も近い意味は？",
    { choices: choices([["A", "早すぎて雑になるさま"], ["B", "素早く、かつ手際よく物事を行うさま"], ["C", "丁寧だが時間がかかるさま"], ["D", "強引に物事を進めるさま"]]), correctAnswer: "B" }),
  objItem("cognitive_10", 10, "語彙力", "choice", "「的確」に最も近い意味は？",
    { choices: choices([["A", "だいたい合っているが細部は違うさま"], ["B", "状況に応じて柔軟に対応するさま"], ["C", "ポイントを外さず、正しく妥当であるさま"], ["D", "慎重すぎて決めきれないさま"]]), correctAnswer: "C" }),
  // 計算力
  objItem("cognitive_11", 11, "計算力", "fill_blank", "8＋6＋7－3＝", { correctAnswer: "18" }),
  objItem("cognitive_12", 12, "計算力", "fill_blank", "12×8＋7－6＝", { correctAnswer: "97" }),
  objItem("cognitive_13", 13, "計算力", "fill_blank", "56÷7－3＋7＝", { correctAnswer: "12" }),
  objItem("cognitive_14", 14, "計算力", "fill_blank", "8＋13－42÷6＝", { correctAnswer: "14" }),
  // 直観力
  objItem("cognitive_15", 15, "直観力", "choice", "次の記号列の「？」に入るのは？\n○→×→○→×→○→？",
    { choices: choices([["A", "○"], ["B", "×"]]), correctAnswer: "B" }),
  objItem("cognitive_16", 16, "直観力", "choice", "次の記号列の「？」に入るのは？\n○→×→？→○→×→？→○→×→△",
    { choices: choices([["A", "○"], ["B", "×"], ["C", "△"]]), correctAnswer: "C" }),
  objItem("cognitive_17", 17, "直観力", "choice", "次の記号列の「？」に入るのは？\n○→×→○→○→×→×→○→○→○→？",
    { choices: choices([["A", "○"], ["B", "×"]]), correctAnswer: "B" }),
  // 言語応用力
  objItem("cognitive_18", 18, "言語応用力", "fill_blank", "次の文字を並び替えて意味のある単語をつくると1文字あまります。どれ？\nし く む す て", { correctAnswer: "く" }),
  objItem("cognitive_19", 19, "言語応用力", "fill_blank", "次の文字を並び替えて意味のある単語をつくると1文字あまります。どれ？\nせ し か う び と", { correctAnswer: "か" }),
  objItem("cognitive_20", 20, "言語応用力", "fill_blank", "次の文字を並び替えて意味のある単語をつくると最後の文字は？\nよ う さ ん し う ん", { correctAnswer: "う" }),
  objItem("cognitive_21", 21, "言語応用力", "fill_blank", "次の文字を並び替えて意味のある単語をつくると最後の文字は？\nう た う ひ よ こ か い", { correctAnswer: "か" }),
  // 基礎推理力
  objItem("cognitive_22", 22, "基礎推理力", "fill_blank",
    "AさんはBさんより背が高い。\nCさんはAさんより背が低いが、Bさんよりは高い。\nDさんはCさんより背が高いが、Aさんよりは低い。\n最も背が高いのは？",
    { correctAnswer: "A" }),
  objItem("cognitive_23", 23, "基礎推理力", "fill_blank",
    "営業・企画・人事・経理の4つの担当を\nAさん、Bさん、Cさん、Dさんがそれぞれ1つずつ担当している。\nAさんは経理ではないし、営業でもない。\nBさんは経理もしくは、営業を担当している。\nCさんは人事もしくは、企画を担当している。\nDさんは企画ではないし、営業でもない。\nDさんの担当は？",
    { correctAnswer: "経理" }),
];

// ---------------- 2. 言語理解能力（verbal） ----------------
const VERBAL_ITEMS = [
  objItem("verbal_1", 1, "構造理解力", "choice",
    "鉄を主成分としながらニッケルおよびコバルトを含む金属材料の一種が、鉄を主成分としつつ炭素を含むことでフェライトやパーライトと呼ばれる組織を示す金属には付着する一方で、同じく鉄を主成分としながらクロムおよびニッケルを含むことでオーステナイト組織を示す金属には、付着しない（あるいは付着しにくい）という性質が存在することが知られているが、この性質の背景には、フェライトが（　）と比較した際に電子スピンの配向および結晶構造の様式に差異を持つという点が関係している。\n空欄（　）に当てはまるものは？",
    { choices: choices([["A", "パーライト"], ["B", "オーステナイト"], ["C", "スピン"], ["D", "コバルト"]]), correctAnswer: "B" }),
  objItem("verbal_2", 2, "照応理解力", "choice",
    "トルコのイスタンブールは、長年にわたり観光都市として発展してきたが、2018年に新イスタンブール空港が開港したことで、国際便の受け入れ能力が大幅に向上した。その結果、翌年には観光客数が過去最高を記録し、ホテルの宿泊者数も急増し、市内の商業施設や飲食店の売上が大きく伸びるなど、地域経済が活性化した。\nこの文脈において、以下の空欄に当てはまるものは？\n宿泊者数が大幅に増えたのは（　）である。",
    { choices: choices([["A", "新イスタンブール空港"], ["B", "トルコ政府"], ["C", "イスタンブール"], ["D", "観光客"]]), correctAnswer: "C" }),
  objItem("verbal_3", 3, "同義理解力", "choice",
    "次の（1）（2）の文が示す内容は一致しているか。「同じである」「異なる」のいずれかを選びなさい。\n（1）ある惑星では、表面温度が非常に低いため、大気中の水蒸気が凍結して雲が形成される。\n（2）この惑星では、雲が形成されるため、表面温度が非常に低くなる。",
    { choices: choices([["A", "同じである"], ["B", "異なる"]]), correctAnswer: "B" }),
  objItem("verbal_4", 4, "同義理解力", "choice",
    "次の（1）（2）の文が示す内容は一致しているか。「同じである」「異なる」のいずれかを選びなさい。\n（1）「政府は、新しい法律を制定し、企業には環境対策の強化を求めた。」\n（2）「新しい法律が制定され、政府は企業から環境対策の強化を求められた。」",
    { choices: choices([["A", "同じである"], ["B", "異なる"]]), correctAnswer: "B" }),
  objItem("verbal_5", 5, "文章推論力", "choice",
    "2000年から2020年までの20年間にわたり、世界全体で毎年失われた氷河の面積は、グリーンランドに広がる氷床および氷河の総面積（約170万平方キロメートル）を基準にすると、その0.4％に相当する量であったと報告されている。なお、この割合は各年でほぼ一定であったと仮定する。\n上記の記述が正しいとき、次の文は正しいか？\n2000年から20年間に、世界全体で融解した氷河の面積は、グリーンランドの氷床・氷河面積の5％以上に達した。",
    { choices: choices([["A", "正しい"], ["B", "正しくない"]]), correctAnswer: "A" }),
  objItem("verbal_6", 6, "文章推論力", "choice",
    "次の文中の（ ）に当てはまる適切なものを、「高い」「低い」から選びなさい。\n標高が高い山は気圧が低いため、水は平地より低い温度で沸騰する。標高が高い山での水の沸点は、平地に比べて（ ）。",
    { choices: choices([["A", "高い"], ["B", "低い"]]), correctAnswer: "B" }),
  objItem("verbal_7", 7, "認識力", "choice",
    "以下の文章を読み、頭の中で情景をイメージしてください。\n「川沿いの遊歩道を歩いていると、右側には桜並木が続き、左側にはベンチが等間隔に並んでいる。ベンチの向こうには小さな噴水があり、その周りを子どもたちが走り回っている。」\nこの文章の情景として正しいものを選びなさい。",
    {
      choices: choices([
        ["A", "桜並木は左側にあり、ベンチは右側にある"],
        ["B", "桜並木は右側にあり、ベンチは左側にある"],
        ["C", "桜並木とベンチはどちらも右側にある"],
        ["D", "桜並木とベンチはどちらも左側にある"],
      ]),
      correctAnswer: "B",
      explanation: "原文に正解の明記がなかったため、文章の内容（右側に桜並木、左側にベンチ）からBと判断して登録しています。",
    }),
  objItem("verbal_8", 8, "認識力", "multi_select",
    "青いボール8個、黄色いボール5個が入っている箱から、ボールを同時に7個取り出した。この状況で起こりうる事象を、次のA～Dからすべて選びなさい。",
    {
      choices: choices([
        ["A", "取り出したのは青いボール6個であった。"],
        ["B", "取り出したのは黄色いボール4個と青いボール3個であった。"],
        ["C", "取り出したのは黄色いボール6個と青いボール1個であった。"],
        ["D", "取り出したのは青いボール6個と黄色いボール1個であった。"],
      ]),
      correctAnswer: ["B", "D"],
    }),
  objItem("verbal_9", 9, "照合力", "multi_select",
    "ある取引において、相手に対してお金や物の支払いを請求できる権利を債権といい、反対に、相手からお金や物の支払いを求められる義務を債務という。債権の例には「貸したお金を返してもらう権利」などがある。\n債権が含まれているものはどれか？（正解は複数あり）",
    {
      choices: choices([
        ["A", "友人から3万円を借りている。はやく返さなきゃ！"],
        ["B", "自分のオンラインショップで商品が売れた。やったー！来月には代金が振り込まれる！"],
        ["C", "いくつものサブスクサービスを契約している。毎月の支払いが大変になってきた！"],
        ["D", "仕事で使った消耗品の領収書が溜まってしまった。立替ている分を月末までに会社に請求しなきゃ！"],
        ["E", "知人に1万円を貸している。返してほしいので連絡した。"],
      ]),
      correctAnswer: ["B", "D", "E"],
    }),
  objItem("verbal_10", 10, "照合力", "choice",
    "小麦の生産は北アメリカ、ヨーロッパ、オーストラリアで盛んであり、米の生産は東アジア、東南アジア、南アジアで多く、トウモロコシの生産は南北アメリカ、アフリカ、中国で広く行われている。オーストラリアで盛んであるのは（ ）の生産である。",
    { choices: choices([["A", "南北アメリカ"], ["B", "東アジア"], ["C", "米"], ["D", "小麦"]]), correctAnswer: "D" }),
  objItem("verbal_11", 11, "照合力", "choice",
    "南アメリカと中央アメリカの多くの国では、日常的にスペイン語（Spanish）が使われており公用語とされている。南アメリカのBolivia、Chile、Colombiaなどでは、スペイン語（Spanish）が日常的に使われており公用語とされていて、Brazilでは公用語がポルトガル語（Portuguese）とされており日常的に使われている。また、中央アメリカのHonduras、Costa Rica、Panamaなどでは、公用語がスペイン語（Spanish）とされており日常的に使われていて、北アメリカのCanadaでは、日常的に英語（English）とフランス語（French）が公用語として使われている。Spanishを公用語としているのは（ ）である。",
    { choices: choices([["A", "Costa Rica"], ["B", "Canada"], ["C", "Brazil"], ["D", "北アメリカ"]]), correctAnswer: "A" }),
  objItem("verbal_12", 12, "照合力", "choice",
    "地球の中心は、温度が約5,000℃から6,000℃に達するが非常に高い圧力（約360GPa以上）のため、鉄とニッケルからなる核が液体ではなく個体の状態で存在すると考えられている。地球の中心にあると考えられているのは（ ）である。",
    { choices: choices([["A", "鉄"], ["B", "核"], ["C", "液体"], ["D", "マントル"]]), correctAnswer: "B" }),
  objItem("verbal_13", 13, "照合力", "fill_blank",
    "ある整数が2つの連続する整数の和で表せるとき、その整数を連和数と呼ぶ。\n例えば、7 = 3 + 4なので連和数。\nでは、15は連和数か。",
    { correctAnswer: "連和数である", explanation: "原文の表記「練和数である」は、問題文中で定義されている用語「連和数」の誤字と判断し、修正して登録しています。" }),
  objItem("verbal_14", 14, "要点抽出力", "choice",
    "以下の文章の要点として最も適切なものを選びなさい。\n「大学ではオンライン授業の導入が進み、学生は場所を問わず講義を受けられるようになった。一方で、対面授業に比べて質問の機会が減ったり、学習意欲の維持が難しくなるといった指摘もある。また、大学側も設備投資や教員研修の負担が増しており、オンライン化は必ずしも効率化につながるとは限らない。」",
    {
      choices: choices([
        ["A", "オンライン授業は学生がどこでも受講できるようにするために導入されている"],
        ["B", "オンライン授業には学生・大学双方にメリットと課題がある"],
        ["C", "大学はオンライン授業のために設備投資を増やしている"],
        ["D", "オンライン授業は対面授業より学習意欲を高める効果がある"],
      ]),
      correctAnswer: "B",
    }),
  objItem("verbal_15", 15, "文脈理解力", "choice",
    "次の文を読み、文中の（ ）に当てはまる適切な言葉を選びなさい。\nフランスとイギリスはそれぞれアメリカに植民地を築き、アメリカでの支配権を巡って戦争を繰り広げました。その後、フランスと同盟を結んだアメリカで独立を求める植民地軍は、イギリスからの独立を求めて戦いを開始しました。このアメリカ独立戦争では、ヨークタウンの戦いでアメリカで独立を求める植民地軍がイギリスに決定的な勝利を収め、その後、イギリスはアメリカの独立を正式に承認することになりました。アメリカで独立を求める植民地軍と戦ったのは（ ）である。",
    { choices: choices([["A", "フランス"], ["B", "イギリス"], ["C", "アメリカ独立戦争"], ["D", "ヨークタウンの戦い"]]), correctAnswer: "B" }),
  objItem("verbal_16", 16, "文脈理解力", "choice",
    "以下の文章を読み、下線部の語句が指す内容として最も適切なものを選びなさい。\n「新しいプロジェクト管理ツールを導入した結果、作業の進捗が可視化され、チーム全体の効率が向上した。しかし、これには慣れるまで時間がかかるため、最初の数週間は混乱が生じた。」\n「これ」が指すものはどれか？",
    {
      choices: choices([
        ["A", "プロジェクト管理ツールそのもの"],
        ["B", "作業の進捗が可視化されたこと"],
        ["C", "チーム全体の効率が向上したこと"],
        ["D", "混乱が生じたこと"],
      ]),
      correctAnswer: "A",
    }),
];

// ---------------- 3. 論理思考能力（logical_thinking） ----------------
const LOGICAL_THINKING_ITEMS = [
  objItem("logical_thinking_1", 1, "MECE", "choice",
    "あなたは営業部長です。新規顧客獲得が伸び悩んでいる原因をMECEに整理してください。以下の4つの案のうち、最もMECEになっているものを選びなさい。",
    {
      choices: choices([
        ["A", "営業スキル不足／競合が強い／価格が高い"],
        ["B", "営業スキル不足／営業人数不足／営業のモチベーション低下"],
        ["C", "商品力不足／営業力不足／マーケティング不足"],
        ["D", "営業スキル不足／営業人数不足／営業の教育不足"],
      ]),
      correctAnswer: "C",
    }),
  objItem("logical_thinking_2", 2, "因果関係", "choice",
    "以下の文章の中で「原因」と「結果」を正しく識別しているものを選びなさい。\n文章：「問い合わせ数が減ったため、売上が減少した。」",
    {
      choices: choices([
        ["A", "原因：売上減少／結果：問い合わせ減少"],
        ["B", "原因：問い合わせ減少／結果：売上減少"],
        ["C", "原因：営業活動減少／結果：問い合わせ減少"],
        ["D", "原因：売上減少／結果：営業活動減少"],
      ]),
      correctAnswer: "B",
    }),
  objItem("logical_thinking_3", 3, "仮説思考", "choice",
    "あなたはECサイトの担当者です。昨日から急に売上が30%減少しました。まだ詳細データは見られません。最も妥当な「一次仮説」を選びなさい。",
    {
      choices: choices([
        ["A", "サイトが一時的にアクセスできなくなった可能性"],
        ["B", "全ての顧客が競合に流れた可能性"],
        ["C", "社内の誰かが価格設定を間違えた可能性"],
        ["D", "全商品が市場から不要になった可能性"],
      ]),
      correctAnswer: "A",
    }),
  objItem("logical_thinking_4", 4, "構造化", "choice",
    "「顧客満足度が低下している理由」を分解したロジックツリーとして最も適切なものを選びなさい。\nA：顧客満足度低下 ├ 商品の質 ├ 営業の質 └ 社内の人間関係\nB：顧客満足度低下 ├ 商品の質（機能／価格） └ サービスの質（対応速度／対応品質）\nC：顧客満足度低下 ├ 営業の質 ├ 営業の人数 └ 営業のモチベーション\nD：顧客満足度低下 ├ 商品の質 ├ 営業の質 ├ マーケティングの質 ├ 経営陣の質",
    { choices: choices([["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]]), correctAnswer: "B" }),
  objItem("logical_thinking_5", 5, "問題解決", "choice",
    "以下のうち、問題解決プロセスとして正しい順番になっているものを選びなさい。",
    {
      choices: choices([
        ["A", "打ち手 → 課題 → 原因"],
        ["B", "原因 → 課題 → 打ち手"],
        ["C", "課題 → 原因 → 打ち手"],
        ["D", "原因 → 打ち手 → 課題"],
      ]),
      correctAnswer: "C",
    }),
];

// ---------------- 4. 実務遂行能力（business_exec） ----------------
const BUSINESS_EXEC_ITEMS = [
  objItem("business_exec_1", 1, "処理力", "choice",
    "ある商品の売上は以下の通りである。1月：120万円 2月：180万円 3月：150万円\n3ヶ月の平均売上として正しいものを選びなさい。",
    { choices: choices([["A", "140万円"], ["B", "150万円"], ["C", "160万円"], ["D", "170万円"]]), correctAnswer: "B" }),
  objItem("business_exec_2", 2, "処理力", "choice",
    "ある商品の売上は以下の通りである。1月：120万円 2月：180万円 3月：210万円\n3ヶ月の売上の中央値として正しいものを選びなさい。",
    { choices: choices([["A", "平均値と同じになる"], ["B", "160万円"], ["C", "170万円"], ["D", "180万円"]]), correctAnswer: "D" }),
  objItem("business_exec_3", 3, "判断力", "choice",
    "あなたは営業マネージャーです。顧客から「納期を1週間早めてほしい」と依頼がありました。現状のリソースでは対応が難しい状況です。最も適切な対応を選びなさい。",
    {
      choices: choices([
        ["A", "無条件で納期短縮を約束する"],
        ["B", "納期短縮は不可能と即答する"],
        ["C", "社内調整の可能性を確認した上で、対応可否を伝える"],
        ["D", "顧客に追加料金を請求する"],
      ]),
      correctAnswer: "C",
    }),
  objItem("business_exec_4", 4, "コミュニケーション力", "choice",
    "以下のメール文の誤りとして最も重大なものを選びなさい。\n「お世話になっております。昨日ご依頼いただいた資料ですが、まだ完成していません。急ぎで対応しますので、しばらくお待ちください。」",
    {
      choices: choices([
        ["A", "件名がない"],
        ["B", "完成していない理由が書かれていない"],
        ["C", "納期が明確でない"],
        ["D", "挨拶が不適切"],
      ]),
      correctAnswer: "C",
    }),
];

// ---------------- 5. 行動特性・性格（personality／5段階評価） ----------------
const LIKERT_QUESTIONS = [
  ["協調性", "周囲の意見を尊重して行動する方だ"],
  ["協調性", "対立を避けるために調整することが多い"],
  ["協調性", "チームの雰囲気を大切にする"],
  ["協調性", "他者の気持ちを考えて行動する"],
  ["協調性", "人の相談に乗ることが多い"],
  ["主体性", "自ら課題を見つけて行動する"],
  ["主体性", "意思決定を任されることが多い"],
  ["主体性", "自分の意見を積極的に発信する"],
  ["主体性", "物事をリードする役割を担うことが多い"],
  ["主体性", "指示がなくても動けるタイプだ"],
  ["ストレス耐性", "プレッシャーのある状況でも集中できる"],
  ["ストレス耐性", "感情の起伏は少ない"],
  ["ストレス耐性", "ストレスがかかっても冷静でいられる"],
  ["ストレス耐性", "困難な状況でも前向きに対処できる"],
  ["ストレス耐性", "不安を感じても行動に支障が出にくい"],
  ["モチベーション", "成長機会が多い環境を好む"],
  ["モチベーション", "新しいことに挑戦したいと思う"],
  ["モチベーション", "仕事に対して前向きな姿勢を持っている"],
  ["モチベーション", "自分の成果を高めたいという意欲が強い"],
  ["モチベーション", "会社のビジョンに共感できることを重視する"],
  ["行動傾向", "すぐに行動に移すタイプだ"],
  ["行動傾向", "慎重に検討してから動く方だ"],
  ["行動傾向", "計画を立てて物事を進める"],
  ["行動傾向", "状況に応じて柔軟に対応できる"],
  ["行動傾向", "スピードより正確性を重視する"],
  ["外向性", "初対面の人と話すことに抵抗がない"],
  ["外向性", "人と一緒にいるとエネルギーが湧く"],
  ["外向性", "会議では積極的に発言する"],
  ["外向性", "大人数の場でも緊張しにくい"],
  ["外向性", "周囲を巻き込んで物事を進めるのが得意だ"],
  ["勤勉性・計画性", "締め切りを守ることが得意だ"],
  ["勤勉性・計画性", "ミスを減らすための工夫をする"],
  ["勤勉性・計画性", "整理整頓が得意だ"],
  ["勤勉性・計画性", "長期的な目標を設定する"],
  ["勤勉性・計画性", "計画通りに物事を進める"],
  ["開放性", "新しいアイデアを考えるのが好きだ"],
  ["開放性", "新しい方法を試すことに抵抗がない"],
  ["開放性", "変化のある環境を好む"],
  ["開放性", "多様な価値観を受け入れられる"],
  ["開放性", "クリエイティブな活動が好きだ"],
];

const PERSONALITY_ITEMS = LIKERT_QUESTIONS.map(([subcategory, questionText], i) => ({
  id: `personality_${i + 1}`,
  stage: "real",
  order: i + 1,
  subcategory,
  type: "likert",
  questionText,
  score: 0,
  choices: [],
  correctAnswer: "",
  explanation: "",
  active: true,
}));

const ITEMS_BY_PART = {
  cognitive: COGNITIVE_ITEMS,
  verbal: VERBAL_ITEMS,
  logical_thinking: LOGICAL_THINKING_ITEMS,
  business_exec: BUSINESS_EXEC_ITEMS,
  personality: PERSONALITY_ITEMS,
};

async function deleteOldParts() {
  for (const partId of OLD_PART_IDS) {
    const partDefRef = db.doc(`partDefinitions/${partId}`);
    const templateRef = db.doc(`templates/${partId}`);
    console.log(`旧パート「${partId}」を削除しています…`);
    await db.recursiveDelete(templateRef);
    await partDefRef.delete().catch(() => {});
  }
}

async function seedNewParts() {
  for (const part of PART_DEFS) {
    await db.doc(`partDefinitions/${part.id}`).set({
      label: part.label,
      order: part.order,
      builtin: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.doc(`templates/${part.id}`).set({
      ...PART_SETTINGS[part.id],
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const items = ITEMS_BY_PART[part.id];
    let batch = db.batch();
    let count = 0;
    for (const item of items) {
      const { id, ...data } = item;
      const ref = db.doc(`templates/${part.id}/items/${id}`);
      batch.set(ref, { ...data, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
      count++;
      if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    console.log(`「${part.label}」に ${items.length} 問を投入しました。`);
  }
}

async function main() {
  await deleteOldParts();
  await seedNewParts();
  console.log("完了しました。運営ホーム →「問題編集」から内容をご確認ください。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
