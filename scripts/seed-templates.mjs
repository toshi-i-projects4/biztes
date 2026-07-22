// ビズてす デフォルト問題（テンプレート）投入スクリプト
//
// 使い方:
//   1. Firebaseコンソール → プロジェクトの設定 → サービスアカウント → 新しい秘密鍵の生成 で
//      サービスアカウントJSONをダウンロードする
//   2. このファイルと同じ環境で以下を実行:
//        npm install firebase-admin
//        GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json node scripts/seed-templates.mjs
//   3. 実行後、Firestoreの templates/{typing|reading|logical|worklife}/items 配下に
//      デフォルト問題が投入されます。運営ホーム画面で企業を新規登録する際に
//      「テンプレートの初期問題をコピーする」を選ぶと、この内容が各社にコピーされます。
//
// 注意:
//   - 問5・問7（図形・グラフ選択問題）の imageUrl は空欄で投入しています。
//     Firebase Storage等に q7_circles.png / q9_graphs.png をアップロードし、
//     そのURLを運営画面の問題編集フォームから設定してください
//     （画像ファイルは「ビズてす_出題設計仕様書.xlsx」の②リーディングスキルシートに添付されています）。
//   - このスクリプトは既存のtemplatesデータを同じIDで上書きします。

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyPath && existsSync(keyPath)) {
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
} else {
  // GOOGLE_APPLICATION_CREDENTIALS が正しく設定されていればこちらでも可
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();

const PART_SETTINGS = {
  typing: {
    partLabel: "①タイピング試験",
    instructions: "お手本のテキストと同じ内容を、できるだけ正確かつ速く入力してください。制限時間内であれば最後まで入力しなくても提出されます。",
    practiceTimeLimitSec: 60,
    realTimeLimitSec: 180,
  },
  reading: {
    partLabel: "②リーディングスキル",
    instructions: "読解力を測定するためのテストです。制限時間内に出題される問題に回答してください。受験を開始すると途中でやめることはできません。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 300,
  },
  logical: {
    partLabel: "③ロジカルシンキング",
    instructions: "基本的な計算問題のテストです。電卓の使用を推奨します。制限時間内に出題される問題に回答してください。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 120,
  },
  worklife: {
    partLabel: "④仕事観アセスメント",
    instructions: "文章の続きを自由に記入していただく形式のテストです。正解はありません。思いついたことを率直にご記入ください。",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 900,
  },
};

const choices = (pairs) => pairs.map(([key, text]) => ({ key, text }));

const TYPING_ITEMS = [
  {
    id: "typing_practice_1", stage: "practice", type: "typing_passage", order: 1,
    questionText: "来週の月曜日、AM10時からWeb会議を行います。資料は、PDFファイルでお送りします。参加人数は8名の予定です。",
    score: 0, active: true,
  },
  {
    id: "typing_real_1", stage: "real", type: "typing_passage", order: 1,
    questionText: "株式会社ABCトレーディングは、2026年7月20日（月）14:00より、東京本社の第3会議室にて、新商品「Bizてすシリーズ」の発売に関する打合せを実施いたします。当日は、営業部・マーケティング部・カスタマーサポート部からそれぞれ担当者2名ずつ、計6名が出席予定です。会場には、プロジェクターとホワイトボードをご用意ください。なお、当日の資料代として、お一人あたり2,000円（税込）を頂戴いたします。予算の上限は合計20,000円を想定しております。ご不明点がございましたら、担当（TANAKA）までEメールにてご連絡ください。",
    score: 0, active: true,
  },
];

const READING_ITEMS = [
  { id: "reading_practice_1", stage: "practice", type: "choice", order: 1,
    questionText: "太郎は毎朝6時に起きて、ジョギングをしてから朝食をとる。この文から、太郎が朝食をとる前に行うことは何か。",
    choices: choices([["A","ジョギング"],["B","読書"],["C","掃除"],["D","通勤"]]),
    correctAnswer: "A", score: 0, explanation: "操作確認用の例題です。", active: true },

  { id: "reading_real_1", stage: "real", type: "choice", order: 1,
    questionText: "小麦の生産は北アメリカ、ヨーロッパ、オーストラリアで盛んであり、米の生産は東アジア、東南アジア、南アジアで多く、トウモロコシの生産は南北アメリカ、アフリカ、中国で広く行われている。オーストラリアで盛んであるのは（　）の生産である。",
    choices: choices([["A","小麦"],["B","米"],["C","とうもろこし"],["D","大豆"]]),
    correctAnswer: "A", score: 1, explanation: "", active: true },

  { id: "reading_real_2", stage: "real", type: "choice", order: 2,
    questionText: "南アメリカと中央アメリカの多くの国では、日常的にスペイン語（Spanish）が使われており公用語とされている。南アメリカのBolivia、Chile、Colombiaなどでは、スペイン語（Spanish）が日常的に使われており公用語とされていて、Brazilでは公用語がポルトガル語（Portuguese）とされており日常的に使われている。また、中央アメリカのHonduras、Costa Rica、Panamaなどでは、公用語がスペイン語（Spanish）とされており日常的に使われていて、北アメリカのCanadaでは、日常的に英語（English）とフランス語（French）が公用語として使われている。Spanishを公用語としているのは（　）である。",
    choices: choices([["A","Bolivia、Chile、Colombia、Honduras、Costa Rica、Panama"],["B","Brazil"],["C","Canada"],["D","すべての国"]]),
    correctAnswer: "A", score: 1, explanation: "", active: true },

  { id: "reading_real_3", stage: "real", type: "choice", order: 3,
    questionText: "次の（1）（2）の文が示す内容は一致しているか。「同じである」「異なる」のいずれかを選びなさい。\n（1）政府は、新しい法律を制定し、企業には環境対策の強化を求めた。\n（2）新しい法律が制定され、政府は企業から環境対策の強化を求められた。",
    choices: choices([["A","同じである"],["B","異なる"]]),
    correctAnswer: "B", score: 1, explanation: "(2)は主語と述語の関係が(1)と逆になっている。", active: true },

  { id: "reading_real_4", stage: "real", type: "choice", order: 4,
    questionText: "標高が高い山は気圧が低いため、水は平地より低い温度で沸騰する。標高が高い山での水の沸点は、平地に比べて（　）。",
    choices: choices([["A","高い"],["B","低い"]]),
    correctAnswer: "B", score: 1, explanation: "", active: true },

  { id: "reading_real_5", stage: "real", type: "choice", order: 5,
    questionText: "原点Oと点（1,1）を通る円がy軸と接している図を選びなさい。（図版は運営画面から別途設定してください）",
    choices: choices([["A","図A（中心(0.5,0)、半径0.5）"],["B","図B（中心(1,0)、半径1）"],["C","図C（中心(1,1)、半径1）"],["D","図D（中心(0,1)、半径1）"]]),
    correctAnswer: "B", score: 1, explanation: "中心(1,0)・半径1の円が正解です。", imageUrl: "", active: true },

  { id: "reading_real_6", stage: "real", type: "choice", order: 6,
    questionText: "アミラーゼという酵素はグルコースがつながってできたデンプンを分解するが、同じグルコースからできていても、形が違うセルロースは分解できない。セルロースは（　）と形が違う。",
    choices: choices([["A","デンプン"],["B","グルコース"],["C","アミラーゼ"],["D","酵素"]]),
    correctAnswer: "A", score: 1, explanation: "", active: true },

  { id: "reading_real_7", stage: "real", type: "choice", order: 7,
    questionText: "次の文の内容を表す図として適切なものを、A～Dの中から選びなさい。一定の速さで移動する物体の移動距離を時間ごとに記録したもので、最も移動距離が大きいグラフ。（図版は運営画面から別途設定してください）",
    choices: choices([["A","図A（傾き1）"],["B","図B（傾き3）"],["C","図C（傾き2）"],["D","図D（傾き0.5）"]]),
    correctAnswer: "B", score: 1, explanation: "傾きが最も大きい図Bが正解です。", imageUrl: "", active: true },

  { id: "reading_real_8", stage: "real", type: "multi_select", order: 8,
    questionText: "青いボール8個、黄色いボール5個が入っている箱から、ボールを同時に7個取り出した。この状況で起こりうる事象を、次の1～4からすべて選びなさい。",
    choices: choices([["1","青2個・黄5個"],["2","青4個・黄3個"],["3","青7個・黄0個"],["4","青1個・黄6個"]]),
    correctAnswer: ["1","2","3"], score: 1, explanation: "黄色は在庫5個までのため「4」は成立しません。", active: true },

  { id: "reading_real_9", stage: "real", type: "choice", order: 9,
    questionText: "地球の中心は、温度が約5,000℃から6,000℃に達するが非常に高い圧力（約360GPa以上）のため、鉄とニッケルからなる核が液体ではなく個体の状態で存在すると考えられている。地球の中心にあると考えられているのは（　）である。",
    choices: choices([["A","鉄とニッケルからなる固体の核"],["B","マグマ"],["C","岩石でできた核"],["D","液体の金属"]]),
    correctAnswer: "A", score: 1, explanation: "", active: true },

  { id: "reading_real_10", stage: "real", type: "choice", order: 10,
    questionText: "フランスとイギリスはそれぞれアメリカに植民地を築き、アメリカでの支配権を巡って戦争を繰り広げました。その後、フランスと同盟を結んだアメリカで独立を求める植民地軍は、イギリスからの独立を求めて戦いを開始しました。このアメリカ独立戦争では、ヨークタウンの戦いでアメリカで独立を求める植民地軍がイギリスに決定的な勝利を収め、その後、イギリスはアメリカの独立を正式に承認することになりました。アメリカで独立を求める植民地軍と戦ったのは（　）である。",
    choices: choices([["A","イギリス"],["B","フランス"],["C","フランスとイギリスの同盟軍"],["D","スペイン"]]),
    correctAnswer: "A", score: 1, explanation: "", active: true },

  { id: "reading_real_11", stage: "real", type: "choice", order: 11,
    questionText: "次の（1）（2）の文が表す内容は同じか。「同じである」「異なる」のうちから答えなさい。\n（1）輸出が伸び悩む中でも、和牛が人気の牛肉や、和食ブームを反映した緑茶や日本酒などは好調だ。\n（2）輸出が伸び悩む中でも、和食ブームを反映した日本酒や緑茶、和牛が人気の牛肉などは好調だ。",
    choices: choices([["A","同じである"],["B","異なる"]]),
    correctAnswer: "A", score: 1, explanation: "列挙順が異なるのみで意味内容は同一です。", active: true },
];

const LOGICAL_ITEMS = [
  { id: "logical_practice_1", stage: "practice", type: "fill_blank", order: 1, questionText: "3+5×2＝", correctAnswer: "13", score: 0, active: true },
  { id: "logical_practice_2", stage: "practice", type: "fill_blank", order: 2, questionText: "（10-4）÷3＝", correctAnswer: "2", score: 0, active: true },

  { id: "logical_real_1", stage: "real", type: "fill_blank", order: 1, questionText: "4+8÷4＝", correctAnswer: "6", score: 1, active: true },
  { id: "logical_real_2", stage: "real", type: "fill_blank", order: 2, questionText: "4×5+2＝", correctAnswer: "22", score: 1, active: true },
  { id: "logical_real_3", stage: "real", type: "fill_blank", order: 3, questionText: "（52-4）÷6＝", correctAnswer: "8", score: 1, active: true },
  { id: "logical_real_4", stage: "real", type: "fill_blank", order: 4, questionText: "5+72÷9＝", correctAnswer: "13", score: 1, active: true },
  { id: "logical_real_5", stage: "real", type: "fill_blank", order: 5, questionText: "（6+8）÷7＝", correctAnswer: "2", score: 1, active: true },
  { id: "logical_real_6", stage: "real", type: "fill_blank", order: 6, questionText: "-3+6×2＝", correctAnswer: "9", score: 1, active: true },
  { id: "logical_real_7", stage: "real", type: "fill_blank", order: 7, questionText: "（6+16÷4）×3＝", correctAnswer: "30", score: 1, active: true },
  { id: "logical_real_8", stage: "real", type: "fill_blank", order: 8, questionText: "8+3-5+7＝", correctAnswer: "13", score: 1, active: true },
  { id: "logical_real_9", stage: "real", type: "fill_blank", order: 9, questionText: "30÷6+8×4＝", correctAnswer: "37", score: 1, active: true },
  { id: "logical_real_10", stage: "real", type: "fill_blank", order: 10, questionText: "24-（3+5）÷4＝", correctAnswer: "22", score: 1, active: true },
  { id: "logical_real_11", stage: "real", type: "fill_blank", order: 11, questionText: "42÷｛12÷(5+1)+3×4｝＝", correctAnswer: "3", score: 1, active: true },
  { id: "logical_real_12", stage: "real", type: "fill_blank", order: 12, questionText: "15+□-7＝23　□の値を答えよ", correctAnswer: "15", score: 1, active: true },
  { id: "logical_real_13", stage: "real", type: "fill_blank", order: 13, questionText: "13+□÷5＝20　□の値を答えよ", correctAnswer: "35", score: 1, active: true },
  { id: "logical_real_14", stage: "real", type: "fill_blank", order: 14, questionText: "4-(□-4)＝3　□の値を答えよ", correctAnswer: "5", score: 1, active: true },
  { id: "logical_real_15", stage: "real", type: "fill_blank", order: 15, questionText: "□-6+8＝8×6　□の値を答えよ", correctAnswer: "46", score: 1, active: true },
  { id: "logical_real_16", stage: "real", type: "fill_blank", order: 16, questionText: "28×61-□＝1642　□の値を答えよ", correctAnswer: "66", score: 1, active: true },
  { id: "logical_real_17", stage: "real", type: "fill_blank", order: 17, questionText: "37-□+73＝45　□の値を答えよ", correctAnswer: "65", score: 1, active: true },
  { id: "logical_real_18", stage: "real", type: "fill_blank", order: 18, questionText: "45÷3+□＝33　□の値を答えよ", correctAnswer: "18", score: 1, active: true },
  { id: "logical_real_19", stage: "real", type: "fill_blank", order: 19, questionText: "52×15÷□＝60　□の値を答えよ", correctAnswer: "13", score: 1, active: true },
  { id: "logical_real_20", stage: "real", type: "fill_blank", order: 20, questionText: "9×(□÷5)＝36　□の値を答えよ", correctAnswer: "20", score: 1, active: true },
];

const WORKLIFE_GENERAL = [
  "仕事で一番やりがいを感じるのは（　）。",
  "仕事で一番ストレスに感じるのは（　）。",
  "うまくいかなかったとき、私は（　）。",
  "新しいことに挑戦するとき、私は（　）。",
  "目標を達成するために、私は（　）。",
  "苦手だと感じる作業は（　）。",
  "周りからよく言われるのは（　）。",
  "忙しいとき、私は（　）。",
  "仕事をする上で大事にしている考え方は（　）。",
  "これまでの経験で学んだのは（　）。",
  "将来、仕事を通じて実現したいのは（　）。",
  "意見が対立したとき、私は（　）。",
  "失敗を防ぐために、私が心がけているのは（　）。",
  "誰かに頼るとき、私は（　）。",
  "一人で作業するとき、私は（　）。",
  "予定通りに進まないとき、私は（　）。",
  "評価されることについて、私は（　）。",
  "新しい環境に入るとき、私は（　）。",
  "仕事を選ぶ上で大切にしたいのは（　）。",
];
const WORKLIFE_STYLE = [
  "理想の働き方は（　）。",
  "仕事とプライベートのバランスについて、私は（　）。",
  "チームで進める仕事について、私は（　）。",
  "一人で黙々と進める仕事について、私は（　）。",
  "指示を受けるとき、私が助かるのは（　）。",
  "仕事の進め方を自分で決められるとき、私は（　）。",
  "仕事終わりの飲み会や食事会について、私は（　）。",
  "職場の人間関係について、私が大事にしたいのは（　）。",
];

const WORKLIFE_ITEMS = [
  { id: "worklife_practice_1", stage: "practice", type: "sentence_completion", order: 1,
    questionText: "今日の気分は（　）。", score: 0, measurementIntent: "操作確認用の例題", active: true },
  ...WORKLIFE_GENERAL.map((text, i) => ({
    id: `worklife_real_g${i + 1}`, stage: "real", type: "sentence_completion", order: i + 1,
    questionText: text, score: 0, active: true,
  })),
  ...WORKLIFE_STYLE.map((text, i) => ({
    id: `worklife_real_s${i + 1}`, stage: "real", type: "sentence_completion", order: WORKLIFE_GENERAL.length + i + 1,
    questionText: text, score: 0, active: true,
  })),
];

const TEMPLATE_ITEMS = { typing: TYPING_ITEMS, reading: READING_ITEMS, logical: LOGICAL_ITEMS, worklife: WORKLIFE_ITEMS };

async function main() {
  for (const [partId, settings] of Object.entries(PART_SETTINGS)) {
    await db.doc(`templates/${partId}`).set({ ...settings, updatedAt: FieldValue.serverTimestamp() });
    const items = TEMPLATE_ITEMS[partId];
    for (const item of items) {
      const { id, ...data } = item;
      await db.doc(`templates/${partId}/items/${id}`).set({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    console.log(`templates/${partId}: ${items.length}問を投入しました`);
  }
  console.log("完了しました。");
  process.exit(0);
}

main().catch((err) => {
  console.error("投入中にエラーが発生しました:", err);
  process.exit(1);
});
