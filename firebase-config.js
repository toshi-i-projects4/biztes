// ビズてす 共通Firebase初期化モジュール
//
// Firebaseプロジェクト: biztes-660ed（ビズてす専用、ビズもんとは別プロジェクト）
// 有効化済みの機能:
//  - Authentication: メール/パスワード（オペレーター用）、匿名（応募者用）
//  - Firestore Database（本番モード）

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDrIECUVLDVFtCtLfDB7Yl0JLZBAR6-uHE",
  authDomain: "biztes-660ed.firebaseapp.com",
  projectId: "biztes-660ed",
  storageBucket: "biztes-660ed.firebasestorage.app",
  messagingSenderId: "802102508147",
  appId: "1:802102508147:web:a52185943027f1df4ac806",
  measurementId: "G-J4MJ2TQTCC",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// v7: 出題カテゴリー1構成を、旧4カテゴリー1（タイピング試験／リーディングスキル／
// ロジカルシンキング／仕事観アセスメント）から、以下の新5大分類に置き換えた。
// 「注意力」「記憶力」などの小分類（カテゴリー2）は、カテゴリー1を分けず各問題のsubcategoryタグとして持たせている
// （分析・ダッシュボード側でカテゴリー2ごとの集計に使う想定）。
// 実際に受験フローへ組み込まれるカテゴリー1一覧は、Firestore の partDefinitions
// （運営が追加する全社共通カテゴリー）と companies/{companyId}/customParts（各企業が追加する
// 自社限定カテゴリー）を動的に読み込んだものになる。CATEGORY1_IDS/CATEGORY1_LABELSは、
// partDefinitionsが空の場合に初回だけ自動投入する初期データとして operator-shared.js から使う
// （通常は scripts/seed-new-categories.mjs による一括投入で作成されるため、この初期値が使われるのは
// 万一partDefinitionsが空の状態でoperator-template-editor.htmlを開いた場合のみ）。
export const CATEGORY1_IDS = ["cognitive", "verbal", "logical_thinking", "business_exec", "personality"];
export const CATEGORY1_LABELS = {
  cognitive: "①認知能力",
  verbal: "②言語理解能力",
  logical_thinking: "③論理思考能力",
  business_exec: "④実務遂行能力",
  personality: "⑤行動特性・性格",
};
// 新カテゴリーはいずれも複数の出題形式が混在するため、カテゴリー1ごとの形式固定は行わない
// （typeOptionsForCurrentCategory1() はCATEGORY1_TYPESに無いカテゴリー1に対してALL_TYPESを返す）。
export const CATEGORY1_TYPES = {};
// 運営・企業が新しく追加するカテゴリー1では、出題形式を固定せず
// 以下の全形式から自由に選べるようにする。
// likert: 5段階評価（行動特性・性格アセスメント用）。正解の概念がなく、選んだ度合い（1〜5）をそのまま記録する。
// survey_choice / survey_multi_select: アンケート形式（択一選択／複数選択）。選択肢は最大10個まで登録でき、
// 選択肢とは別に自由記述欄が自動的に付く。likert・sentence_completionと同様、正解の概念はない。
export const ALL_TYPES = ["typing_passage", "choice", "multi_select", "fill_blank", "sentence_completion", "likert", "survey_choice", "survey_multi_select"];

// likert（5段階評価）の固定選択肢。左から順に値1〜5として記録する。
export const LIKERT_LABELS = [
  "全くそう思わない",
  "あまりそう思わない",
  "どちらともいえない",
  "ややそう思う",
  "非常にそう思う",
];
