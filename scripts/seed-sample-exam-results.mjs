// ビズてす サンプル受験結果 投入スクリプト
//
// 目的:
//   ダッシュボード設計の検証用に、CSV（sample-exam-results.csv）に書かれた「目標値」
//   （パートごとの正答率・タイピング目標誤り数・5段階評価の平均目標）をもとに、
//   実際の出題内容（companies/{companyId}配下の自社問題、無ければtemplatesの共通問題）を
//   1問ずつ解いたことにした受験結果（examInvites・examResults）をFirestoreに書き込みます。
//   得点計算は company-report.html / exam.html と同じロジック（タイピングは編集距離ベースの
//   誤り数から0〜10点、5段階評価は選択値がそのまま1〜5点、択一・複数選択・空欄補充は
//   正誤に応じてitem.score点）で行うため、投入後にレポート画面を開けばそのまま正しい点数で
//   表示されます。
//
// 使い方:
//   1. Firebaseコンソール → プロジェクトの設定 → サービスアカウント → 新しい秘密鍵の生成 で
//      サービスアカウントJSONをダウンロードする（他のseedスクリプトで使ったものと同じでよい）
//   2. npm install（初回のみ。firebase-adminが入っていない場合は npm install firebase-admin）
//   3. このファイルと sample-exam-results.csv を scripts/ フォルダに置く
//   4. 下記のように実行（<companyId>は投入したい企業のドキュメントID。運営ホームやURLの
//      ?company=xxxx から確認できます）:
//        GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json ^
//          node scripts/seed-sample-exam-results.mjs <companyId> scripts/sample-exam-results.csv
//
// 注意:
//   - このスクリプトは指定した企業（companyId）配下の examInvites / examResults に
//     新しいドキュメントを追加します。既存データは変更・削除しません。
//   - 何度も実行するとその都度100件ずつ追加されるため、テスト投入後に不要になったら
//     企業管理画面の「受験結果サマリー」の削除ボタン（1件ずつ、確認2回）で削除するか、
//     Firebaseコンソールから該当ドキュメントをまとめて削除してください。
//   - CSVの「目標値」はあくまで目標（正答率・平均値）であり、実際に1問ずつランダムに
//     正誤・評価値を生成するため、実際の集計スコアは目標値と完全には一致しません
//     （少人数の設問だと特にブレます）。

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyPath && existsSync(keyPath)) {
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
} else {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

const companyId = process.argv[2];
const csvPath = process.argv[3] || "scripts/sample-exam-results.csv";
if (!companyId) {
  console.error("使い方: node scripts/seed-sample-exam-results.mjs <companyId> [CSVパス]");
  process.exit(1);
}
if (!existsSync(csvPath)) {
  console.error("CSVファイルが見つかりません: " + csvPath);
  process.exit(1);
}

// ---------- CSVパース（ダブルクォート・カンマ区切り。BOM除去つき） ----------
function parseCsv(text) {
  const rows = [];
  let field = "", row = [], inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const raw = readFileSync(csvPath, "utf8");
const table = parseCsv(raw);
const headers = table[0];
const dataRows = table.slice(1).map((r) => {
  const o = {};
  headers.forEach((h, i) => { o[h] = r[i] ?? ""; });
  return o;
});
console.log(`${csvPath} から ${dataRows.length} 件を読み込みました。`);

// ---------- 日時パース（CSVは "YYYY-MM-DD HH:mm" 形式） ----------
function parseDT(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

// ---------- パート・問題マスタの読み込み（app側のloadEffectivePartList/loadEffectiveQuestionSetと同じ考え方） ----------
async function loadGlobalPartDefs() {
  const snap = await db.collection("partDefinitions").orderBy("order", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, scope: "global", ...d.data() }));
}
async function loadCompanyCustomParts(companyId) {
  const snap = await db.collection("companies").doc(companyId).collection("customParts").orderBy("order", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, scope: "custom", ...d.data() }));
}
async function loadEffectiveItems(companyId, part) {
  const companySnap = await db.collection("companies").doc(companyId)
    .collection("questionSets").doc(part.id).collection("items").orderBy("order", "asc").get();
  if (!companySnap.empty) return companySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (part.scope === "global") {
    const tplSnap = await db.collection("templates").doc(part.id).collection("items").orderBy("order", "asc").get();
    return tplSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return [];
}

// ---------- タイピング採点（exam.html / company-report.htmlと同じロジック） ----------
function diffTyping(sample, typed) {
  const a = sample || "", b = typed || "";
  const n = a.length, m = b.length;
  if (n === 0 && m === 0) return { matched: 0, errors: 0 };
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  let i = n, j = m, matched = 0, errors = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { matched++; i--; j--; }
    else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { errors++; i--; j--; }
    else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { errors++; i--; }
    else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) { errors++; j--; }
    else if (i > 0) { errors++; i--; } else { errors++; j--; }
  }
  return { matched, errors };
}
function typingErrorScore(errors) {
  const e = Math.max(0, Math.floor(Number(errors) || 0));
  return Math.max(0, 10 - e);
}
// お手本文字列に、目標誤り数に近づくようランダムな置換・削除・挿入を加えて「入力文字列」を作る
function mangleText(sample, targetErrors) {
  const chars = Array.from(sample || "");
  const RANDOM_CHARS = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほんABCDEFG12345".split("");
  let n = Math.max(0, Math.round(targetErrors));
  n = Math.min(n, Math.max(3, chars.length)); // 文章の長さを大きく超える誤り数は作らない
  for (let k = 0; k < n; k++) {
    if (!chars.length) { chars.push(RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]); continue; }
    const pos = Math.floor(Math.random() * chars.length);
    const op = Math.floor(Math.random() * 3);
    if (op === 0) chars[pos] = RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]; // 置換
    else if (op === 1) chars.splice(pos, 1); // 削除
    else chars.splice(pos, 0, RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]); // 挿入
  }
  return chars.join("");
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------- 1件分の回答生成 ----------
// scoreableRate: choice/multi_select/fill_blankを正解にする確率（0-100）
// typingTargetErrors: そのパート内のtyping_passage設問1問あたりの目標誤り数
// likertAvgOf: subcategory名 -> 平均目標値(1-5) を返す関数
function buildAnswersForPart(items, scoreableRate, typingTargetErrors, likertAvgOf) {
  let score = 0, correctCount = 0, totalCount = 0;
  const answers = items.map((item) => {
    if (item.type === "typing_passage") {
      const sample = item.questionText || "";
      const errTarget = Math.max(0, typingTargetErrors + randInt(-2, 2));
      const typed = mangleText(sample, errTarget);
      const stat = diffTyping(sample, typed);
      const s = typingErrorScore(stat.errors);
      score += s;
      return {
        itemId: item.id, type: item.type, subcategory: item.subcategory || "",
        typedText: typed, matched: stat.matched, errorCount: stat.errors,
        charsPerMinute: randInt(80, 260), rawInputLength: typed.length, score: s,
      };
    }
    if (item.type === "likert") {
      const avg = likertAvgOf(item.subcategory || "");
      const value = clamp(Math.round(avg + (Math.random() - 0.5) * 1.6), 1, 5);
      score += value;
      return { itemId: item.id, type: item.type, subcategory: item.subcategory || "", value, score: value };
    }
    if (item.type === "sentence_completion") {
      return {
        itemId: item.id, type: item.type, subcategory: item.subcategory || "",
        questionText: item.questionText || "", freeText: "（サンプルデータのため自由記述は省略しています）",
      };
    }
    // choice / multi_select / fill_blank
    totalCount++;
    const isCorrect = Math.random() * 100 < scoreableRate;
    const max = typeof item.score === "number" ? item.score : 1;
    let selected;
    const correct = item.correctAnswer;
    if (item.type === "multi_select") {
      const correctArr = Array.isArray(correct) ? correct : [correct];
      if (isCorrect) selected = correctArr;
      else {
        const keys = (item.choices || []).map((c) => c.key);
        selected = keys.filter((k) => !correctArr.includes(k)).slice(0, Math.max(1, correctArr.length)) ;
        if (!selected.length) selected = keys.slice(0, 1);
      }
    } else {
      const keys = (item.choices || []).map((c) => c.key);
      if (isCorrect || !keys.length) selected = correct;
      else selected = keys.find((k) => k !== correct) || correct;
    }
    if (isCorrect) { score += max; correctCount++; }
    return {
      itemId: item.id, type: item.type, subcategory: item.subcategory || "",
      selected, correct, isCorrect,
    };
  });
  return { score, correctCount, totalCount, answers };
}

async function main() {
  const globalParts = await loadGlobalPartDefs();
  const customParts = await loadCompanyCustomParts(companyId);
  const partList = [...globalParts, ...customParts];
  if (!partList.length) {
    console.error("パート定義が見つかりません（partDefinitionsが未投入の可能性があります）。");
    process.exit(1);
  }
  const itemsByPart = {};
  for (const part of partList) {
    itemsByPart[part.id] = await loadEffectiveItems(companyId, part);
  }
  console.log("対象パート:", partList.map((p) => `${p.label || p.id}(${(itemsByPart[p.id] || []).length}問)`).join(" / "));

  const RATE_COL = {
    cognitive: "認知能力正答率目標(%)",
    verbal: "言語理解能力正答率目標(%)",
    logical_thinking: "論理思考能力正答率目標(%)",
    business_exec: "実務遂行能力正答率目標(%)",
  };
  const SUBCAT_COL = {
    "協調性": "協調性平均目標(1-5)", "主体性": "主体性平均目標(1-5)", "ストレス耐性": "ストレス耐性平均目標(1-5)",
    "モチベーション": "モチベーション平均目標(1-5)", "行動傾向": "行動傾向平均目標(1-5)", "外向性": "外向性平均目標(1-5)",
    "勤勉性・計画性": "勤勉性計画性平均目標(1-5)", "開放性": "開放性平均目標(1-5)",
  };

  let batch = db.batch();
  let opCount = 0;
  let created = 0;
  const flush = async () => { if (opCount > 0) { await batch.commit(); batch = db.batch(); opCount = 0; } };
  const set = (ref, data) => { batch.set(ref, data); opCount++; if (opCount >= 400) return flush(); };

  for (const row of dataRows) {
    const token = randomBytes(12).toString("hex");
    const status = (row["状態"] || "not_started").trim();
    const createdAt = parseDT(row["招待発行日時"]) || new Date();
    const startedAt = parseDT(row["受験開始日時"]);
    const completedAt = parseDT(row["受験完了日時"]);

    const inviteRef = db.collection("companies").doc(companyId).collection("examInvites").doc(token);
    const inviteData = {
      applicantName: row["氏名"] || "",
      applicantEmail: row["メールアドレス"] || "",
      employeeCode: row["社員コード"] || "",
      department: row["部署"] || "",
      position: row["役職"] || "",
      note: row["備考"] || "",
      status,
      createdAt: Timestamp.fromDate(createdAt),
      anonUid: "sample_" + token,
    };
    if (startedAt) inviteData.startedAt = Timestamp.fromDate(startedAt);
    if (completedAt) inviteData.completedAt = Timestamp.fromDate(completedAt);
    await set(inviteRef, inviteData);

    if (status === "completed") {
      const parts = {};
      let totalScore = 0;
      for (const part of partList) {
        const items = itemsByPart[part.id] || [];
        if (!items.length) continue;
        const rateCol = RATE_COL[part.id];
        const scoreableRate = rateCol && row[rateCol] !== "" ? Number(row[rateCol]) : 60;
        const typingTarget = row["タイピング目標誤り数"] !== "" ? Number(row["タイピング目標誤り数"]) : 8;
        const likertAvgOf = (subcat) => {
          const col = SUBCAT_COL[subcat];
          const v = col && row[col] !== "" ? Number(row[col]) : 3;
          return clamp(v, 1, 5);
        };
        const built = buildAnswersForPart(items, scoreableRate, typingTarget, likertAvgOf);
        parts[part.id] = { score: built.score, correctCount: built.correctCount, totalCount: built.totalCount, answers: built.answers };
        totalScore += built.score;
      }
      const resultRef = db.collection("companies").doc(companyId).collection("examResults").doc(token);
      await set(resultRef, {
        applicantName: row["氏名"] || "",
        applicantEmail: row["メールアドレス"] || "",
        startedAt: startedAt ? Timestamp.fromDate(startedAt) : Timestamp.fromDate(createdAt),
        completedAt: completedAt ? Timestamp.fromDate(completedAt) : Timestamp.fromDate(createdAt),
        parts,
        totalScore,
        status: "completed",
      });
    }
    created++;
    if (created % 20 === 0) console.log(`${created}/${dataRows.length} 件処理しました…`);
  }
  await flush();
  console.log(`完了しました。${dataRows.length} 件の招待データを companies/${companyId} に投入しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
