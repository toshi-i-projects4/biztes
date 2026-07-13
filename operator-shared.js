// ビズてす オペレーター画面共通ロジック
import { db, PART_IDS } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, collection, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// パートごとのデフォルト設定（出題設計仕様書ドラフトの時間配分に基づく）
export const DEFAULT_PART_SETTINGS = {
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
    instructions: "基本的な計算・図形・グラフの問題です。電卓の使用を推奨します。制限時間内に出題される問題に回答してください。",
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

// 企業作成時に4パート分のquestionSets設定ドキュメントを用意する
export async function ensureCompanyQuestionSets(companyId) {
  for (const partId of PART_IDS) {
    const ref = doc(db, "companies", companyId, "questionSets", partId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...DEFAULT_PART_SETTINGS[partId],
        updatedAt: serverTimestamp(),
        updatedBy: "system:ensureCompanyQuestionSets",
      });
    }
  }
}

// templates/{partId}/items の内容を companies/{companyId}/questionSets/{partId}/items にコピーする
export async function copyTemplateItemsToCompany(companyId, partId) {
  const templateItemsRef = collection(db, "templates", partId, "items");
  const snap = await getDocs(templateItemsRef);
  let count = 0;
  for (const itemDoc of snap.docs) {
    const data = itemDoc.data();
    const targetRef = doc(db, "companies", companyId, "questionSets", partId, "items", itemDoc.id);
    await setDoc(targetRef, { ...data, updatedAt: serverTimestamp() });
    count++;
  }
  return count;
}

export async function copyAllTemplatesToCompany(companyId) {
  const results = {};
  for (const partId of PART_IDS) {
    results[partId] = await copyTemplateItemsToCompany(companyId, partId);
  }
  return results;
}

export function escapeHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
