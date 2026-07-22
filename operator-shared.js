// ビズてす オペレーター画面共通ロジック
import { db, CATEGORY1_IDS, CATEGORY1_LABELS } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// カテゴリー1ごとのデフォルト設定。v7で新5大分類（scripts/seed-new-categories.mjs が投入する
// templates/{category1Id}の設定と同じ内容）に合わせている。
export const DEFAULT_CATEGORY1_SETTINGS = {
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

// 企業作成時に5カテゴリー1分のquestionSets設定ドキュメントを用意する
export async function ensureCompanyQuestionSets(companyId) {
  for (const category1Id of CATEGORY1_IDS) {
    const ref = doc(db, "companies", companyId, "questionSets", category1Id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...DEFAULT_CATEGORY1_SETTINGS[category1Id],
        updatedAt: serverTimestamp(),
        updatedBy: "system:ensureCompanyQuestionSets",
      });
    }
  }
}

// templates/{category1Id}/items の内容を companies/{companyId}/questionSets/{category1Id}/items にコピーする
export async function copyTemplateItemsToCompany(companyId, category1Id) {
  const templateItemsRef = collection(db, "templates", category1Id, "items");
  const snap = await getDocs(templateItemsRef);
  let count = 0;
  for (const itemDoc of snap.docs) {
    const data = itemDoc.data();
    const targetRef = doc(db, "companies", companyId, "questionSets", category1Id, "items", itemDoc.id);
    await setDoc(targetRef, { ...data, updatedAt: serverTimestamp() });
    count++;
  }
  return count;
}

// templates/{category1Id} のカテゴリー1設定（受験画面の説明文・練習/本番の制限時間）を取得する。
// 「テンプレートの初期問題をこのカテゴリー1にコピー」実行時に、入力欄へ反映するためだけに使う
// （このドキュメントを直接companies側へ保存するわけではない。保存は「カテゴリー1設定を保存」ボタン経由）。
export async function loadTemplateCategory1Settings(category1Id) {
  const ref = doc(db, "templates", category1Id);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function copyAllTemplatesToCompany(companyId) {
  const globalCategory1s = await loadGlobalCategory1Defs();
  const results = {};
  for (const category1 of globalCategory1s) {
    results[category1.id] = await copyTemplateItemsToCompany(companyId, category1.id);
  }
  return results;
}

export function escapeHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// =====================================================================
// カテゴリー1管理（v6で追加）
//
// 「カテゴリー1」はもともとtyping/reading/logical/worklifeの4つ固定だったが、
// 運営が全社共通の新しいカテゴリーを、各企業が自社限定の新しいカテゴリーを、
// それぞれ追加できるようにする。
//   - 全社共通カテゴリー: partDefinitions/{category1Id}（運営のみ書き込み可）
//   - 自社限定カテゴリー: companies/{companyId}/customParts/{category1Id}（運営 or 自社管理者）
// 実際の受験フローに含まれる「有効なカテゴリー1一覧」は、この2つを合わせたもの。
// （Firestoreのコレクション名 partDefinitions / customParts は本番データの
// スキーマそのものであり、既存データとの互換性を保つため名称を変更していない）
// =====================================================================

// partDefinitions が一度も投入されていない場合、既存の固定4カテゴリー1を初回だけ自動投入する
// （旧バージョンからの移行）。同一セッション内での重複実行を避けるためPromiseをキャッシュする。
let category1DefsSeedPromise = null;
export function ensureGlobalCategory1DefinitionsSeeded() {
  if (!category1DefsSeedPromise) {
    category1DefsSeedPromise = (async () => {
      const snap = await getDocs(collection(db, "partDefinitions"));
      if (!snap.empty) return;
      let order = 1;
      for (const category1Id of CATEGORY1_IDS) {
        await setDoc(doc(db, "partDefinitions", category1Id), {
          label: CATEGORY1_LABELS[category1Id],
          order,
          builtin: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        order++;
      }
    })().catch((e) => {
      // シード失敗時は次回呼び出しで再試行できるようキャッシュをクリアする
      category1DefsSeedPromise = null;
      throw e;
    });
  }
  return category1DefsSeedPromise;
}

// 全社共通のカテゴリー1一覧（表示順）
export async function loadGlobalCategory1Defs() {
  await ensureGlobalCategory1DefinitionsSeeded();
  const snap = await getDocs(query(collection(db, "partDefinitions"), orderBy("order", "asc")));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

// 指定企業の自社限定カテゴリー1一覧（表示順）
export async function loadCompanyCustomCategory1s(companyId) {
  const snap = await getDocs(query(collection(db, "companies", companyId, "customParts"), orderBy("order", "asc")));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

// 指定企業の受験フローに実際に含まれる、有効なカテゴリー1一覧
// （全社共通カテゴリーが先、自社限定カテゴリーがその後ろに続く）
export async function loadEffectiveCategory1List(companyId) {
  const [globalCategory1s, customCategory1s] = await Promise.all([
    loadGlobalCategory1Defs(),
    loadCompanyCustomCategory1s(companyId),
  ]);
  return [
    ...globalCategory1s.map((p) => ({ ...p, scope: "global" })),
    ...customCategory1s.map((p) => ({ ...p, scope: "custom" })),
  ];
}

function generateCategory1Id(prefix) {
  const rand = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, "").slice(0, 12);
  return `${prefix}_${rand}`;
}

// 運営が新しい「全社共通カテゴリー」を追加する
export async function createGlobalCategory1Def(label) {
  const existing = await loadGlobalCategory1Defs();
  const nextOrder = existing.length ? Math.max(...existing.map((p) => p.order || 0)) + 1 : 1;
  const category1Id = generateCategory1Id("part");
  await setDoc(doc(db, "partDefinitions", category1Id), {
    label,
    order: nextOrder,
    builtin: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // テンプレート側にも空のカテゴリー1設定を用意しておく（問題管理画面ですぐ編集できるように）
  await setDoc(doc(db, "templates", category1Id), {
    partLabel: label,
    instructions: "",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 0,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return category1Id;
}

// 企業が自社限定の新しいカテゴリーを追加する
export async function createCompanyCustomCategory1(companyId, label) {
  const existing = await loadCompanyCustomCategory1s(companyId);
  const nextOrder = existing.length ? Math.max(...existing.map((p) => p.order || 0)) + 1 : 1000;
  const category1Id = generateCategory1Id("custom");
  await setDoc(doc(db, "companies", companyId, "customParts", category1Id), {
    label,
    order: nextOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "companies", companyId, "questionSets", category1Id), {
    partLabel: label,
    instructions: "",
    practiceTimeLimitSec: 0,
    realTimeLimitSec: 0,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return category1Id;
}

// 企業が追加した自社限定カテゴリーを削除する（全社共通カテゴリーは対象外）。
// 登録済みの問題（items）・カテゴリー設定（questionSets）・カテゴリー定義（customParts）を
// すべて削除する。Firestoreクライアントには再帰削除が無いため、items を1件ずつ削除してから
// 親ドキュメントを削除する。
export async function deleteCompanyCustomCategory1(companyId, category1Id) {
  const itemsRef = collection(db, "companies", companyId, "questionSets", category1Id, "items");
  const itemsSnap = await getDocs(itemsRef);
  for (const itemDoc of itemsSnap.docs) {
    await deleteDoc(doc(db, "companies", companyId, "questionSets", category1Id, "items", itemDoc.id));
  }
  await deleteDoc(doc(db, "companies", companyId, "questionSets", category1Id)).catch(() => {});
  await deleteDoc(doc(db, "companies", companyId, "customParts", category1Id));
}

// 指定カテゴリー1について、実際に出題する設定・問題一覧を返す。
// 企業が自社の問題を1問でも登録していればそちらを優先し、登録が無い全社共通カテゴリーは
// 運営のデフォルト問題（templates）をそのまま使う。自社限定カテゴリーで未登録の場合は0問扱い。
export async function loadEffectiveQuestionSet(companyId, category1) {
  const companyItemsSnap = await getDocs(
    query(collection(db, "companies", companyId, "questionSets", category1.id, "items"), orderBy("order", "asc"))
  );

  if (!companyItemsSnap.empty) {
    const setSnap = await getDoc(doc(db, "companies", companyId, "questionSets", category1.id));
    const items = [];
    companyItemsSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    return { source: "company", settings: setSnap.exists() ? setSnap.data() : {}, items };
  }

  if (category1.scope === "global") {
    const setSnap = await getDoc(doc(db, "templates", category1.id));
    const itemsSnap = await getDocs(query(collection(db, "templates", category1.id, "items"), orderBy("order", "asc")));
    const items = [];
    itemsSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    return { source: "template", settings: setSnap.exists() ? setSnap.data() : {}, items };
  }

  return { source: "none", settings: {}, items: [] };
}
