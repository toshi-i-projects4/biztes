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

// レーダーチャート・帳票で分析対象になる「①〜④」の4カテゴリー1（v9でoperator-shared.jsに集約。
// 各画面（company-dashboard.html等）は従来通りローカルにも同じ内容の定数を持つが、
// 代替カテゴリーの解決ロジック（resolveAnalysisCategory1Mapping/loadAdministeredCategory1List）は
// ここで定義するこのリストを基準にする）。
export const FOUR_CATEGORY1_IDS = ["cognitive", "verbal", "logical_thinking", "business_exec"];

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
  invalidateCompanyQuestionCache(companyId);
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
// 問題マスタのキャッシュ（sessionStorage）
//
// 全社共通テンプレート・企業カスタム問題は、受験のたびに毎回変わるものではないのに、
// dashboard・report・report-individual・operator-report・exam・exam-entryなど、ほぼ
// 全ての画面がページを開くたびに読み直していた（①〜⑤・自社追加カテゴリー分の設問を
// 毎回まるごとFirestoreから取得＝1画面で100件以上の読み取りになっていた）。
// ここでは同じタブ内であれば一定時間（CACHE_TTL_MS）は再読み込みしないようにし、
// Firestoreの読み取り件数を大きく減らす。
// 問題管理画面（operator-question-editor.html / operator-template-editor.html）で
// 保存・削除・コピーなどの変更操作を行った直後は、invalidate系の関数で該当キャッシュを
// 明示的に破棄するため、編集した本人はそのタブで即座に最新内容を見られる。他のタブ・
// 他の閲覧者への反映は最大でもCACHE_TTL_MS後になる（二重の安全策として期限切れも設定）。
// =====================================================================
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分
const CACHE_PREFIX = "biztes_qcache_v1:";

function cacheRead(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return undefined;
    }
    return v;
  } catch {
    return undefined; // sessionStorageが使えない環境（プライベートモード等）では素通りする
  }
}
function cacheWrite(key, value) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // 書き込み失敗（容量超過等）はキャッシュ無しとして扱う（動作に影響しない）
  }
}
function cacheClearMatching(predicate) {
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && predicate(k.slice(CACHE_PREFIX.length))) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // 何もしない
  }
}

// 指定企業に関するキャッシュ（自社カスタムカテゴリー一覧・その企業の問題セット）を破棄する。
// operator-question-editor.htmlで、自社の問題・カテゴリー1設定を保存/削除/コピーした直後に呼ぶ。
export function invalidateCompanyQuestionCache(companyId) {
  if (!companyId) return;
  cacheClearMatching((key) => key === `customCategory1s:${companyId}`
    || key === `qsSettingsMap:${companyId}`
    || key.startsWith(`questionSet:${companyId}:`));
}

// 全社共通のテンプレート・カテゴリー定義に関するキャッシュを全て破棄する。
// operator-template-editor.htmlで、テンプレートの問題・カテゴリー1設定を保存/削除した直後に呼ぶ
// （どの企業のタブがどのカテゴリーをキャッシュしているか特定できないため、この端末のタブ内の
// 問題マスタキャッシュを丸ごと破棄する。テンプレート編集は頻繁な操作ではないため影響は小さい）。
export function invalidateGlobalQuestionCache() {
  cacheClearMatching(() => true);
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
  const cached = cacheRead("globalCategory1Defs");
  if (cached) return cached;
  await ensureGlobalCategory1DefinitionsSeeded();
  const snap = await getDocs(query(collection(db, "partDefinitions"), orderBy("order", "asc")));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  cacheWrite("globalCategory1Defs", list);
  return list;
}

// 指定企業の自社限定カテゴリー1一覧（表示順）
export async function loadCompanyCustomCategory1s(companyId) {
  const cacheKey = `customCategory1s:${companyId}`;
  const cached = cacheRead(cacheKey);
  if (cached) return cached;
  const snap = await getDocs(query(collection(db, "companies", companyId, "customParts"), orderBy("order", "asc")));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  cacheWrite(cacheKey, list);
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

// 指定企業の questionSets コレクション全体（カテゴリー1ごとの設定：実施可否・説明文・制限時間など）を
// 1回のクエリでまとめて取得する（v9で追加）。「実施する/しない」の判定・代替解決に使う
// （items本体は含まない。問題内容は別途 loadEffectiveQuestionSet で取得する）。
async function loadCompanyQuestionSetSettingsMap(companyId) {
  const cacheKey = `qsSettingsMap:${companyId}`;
  const cached = cacheRead(cacheKey);
  if (cached) return cached;
  const snap = await getDocs(collection(db, "companies", companyId, "questionSets"));
  const map = {};
  snap.forEach((d) => { map[d.id] = d.data(); });
  cacheWrite(cacheKey, map);
  return map;
}

// questionSets設定マップ上で、指定カテゴリー1が「実施する」設定になっているかどうか。
// enabledフィールドが無い（v9より前に作成されたドキュメント・未作成のドキュメント）場合は、
// 既存企業の受験フローを変えないよう true（実施する）扱いにする。
function isCategory1Enabled(settingsMap, category1Id) {
  const s = settingsMap[category1Id];
  return !s || s.enabled !== false;
}

// カテゴリー1（全社共通・自社限定いずれも）の「実施する/しない」を切り替える（v9で追加）。
// 全社共通カテゴリーはFirestoreルール上、自社管理者はこのenabledフィールドしか書き込めない。
export async function setCategory1Enabled(companyId, category1Id, enabled) {
  const ref = doc(db, "companies", companyId, "questionSets", category1Id);
  await setDoc(ref, { enabled: !!enabled, updatedAt: serverTimestamp() }, { merge: true });
  invalidateCompanyQuestionCache(companyId);
}

// 自社限定カテゴリーが①〜④のどれかの「代替」かどうかを運営が設定する（v9で追加）。
// nullish/空文字を渡すと「単なる追加」（代替なし）に戻す。企業管理者はこの値を変更できない
// （FirestoreルールでcustomParts書き込みは運営限定にしている）。
export async function setCustomCategory1Substitution(companyId, category1Id, substitutesFor) {
  const ref = doc(db, "companies", companyId, "customParts", category1Id);
  await setDoc(ref, { substitutesFor: substitutesFor || null, updatedAt: serverTimestamp() }, { merge: true });
  invalidateCompanyQuestionCache(companyId);
}

// 実際に受験フローに出題されるカテゴリー1一覧（v9で追加）。
// loadEffectiveCategory1List との違い：
//   - enabled === false のカテゴリーを除外する。
//   - ①〜④のいずれかについて、有効な代替カテゴリー（自社限定・substitutesFor設定済み・実施ON）が
//     存在する場合、代替元の標準カテゴリー自体を除外する（同じ能力を二重に出題しないため）。
// exam.html（実際の出題）はこちらを使う。operator-question-editor.htmlのタブ一覧のように、
// 無効化中のカテゴリーも含めて全件表示したい画面は、引き続き loadEffectiveCategory1List を使う。
export async function loadAdministeredCategory1List(companyId) {
  const [allCategory1s, customCategory1s, settingsMap] = await Promise.all([
    loadEffectiveCategory1List(companyId),
    loadCompanyCustomCategory1s(companyId),
    loadCompanyQuestionSetSettingsMap(companyId),
  ]);
  const substitutedSlots = new Set(
    customCategory1s
      .filter((c) => c.substitutesFor && FOUR_CATEGORY1_IDS.includes(c.substitutesFor) && isCategory1Enabled(settingsMap, c.id))
      .map((c) => c.substitutesFor)
  );
  return allCategory1s.filter((category1) => {
    if (substitutedSlots.has(category1.id)) return false;
    return isCategory1Enabled(settingsMap, category1.id);
  });
}

// ①〜④それぞれについて、分析（レーダーチャート・帳票）で実際にスコアを参照すべきカテゴリー1IDを
// 返す（v9で追加）。有効な代替カテゴリーが設定されていればそちらのID、なければ元のスロットIDのまま。
// 例: { cognitive: "cognitive", verbal: "custom_abc123", logical_thinking: "logical_thinking",
//       business_exec: "business_exec" }
// 呼び出し側（company-dashboard.html等）は、表示ラベル（①認知能力 等）は従来通り固定のスロットID
// （オブジェクトのキー）に紐づけたまま使い、スコア・問題データの参照だけこのマッピング経由の
// IDに差し替える。
export async function resolveAnalysisCategory1Mapping(companyId) {
  const [customCategory1s, settingsMap] = await Promise.all([
    loadCompanyCustomCategory1s(companyId),
    loadCompanyQuestionSetSettingsMap(companyId),
  ]);
  const mapping = {};
  FOUR_CATEGORY1_IDS.forEach((slotId) => { mapping[slotId] = slotId; });
  customCategory1s.forEach((c) => {
    if (c.substitutesFor && FOUR_CATEGORY1_IDS.includes(c.substitutesFor) && isCategory1Enabled(settingsMap, c.id)) {
      mapping[c.substitutesFor] = c.id;
    }
  });
  return mapping;
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
  invalidateGlobalQuestionCache();
  return category1Id;
}

// 運営が追加した全社共通カテゴリーを削除する（初期から用意されている固定カテゴリー[builtin:true]は対象外）。
// 登録済みのデフォルト問題（templates/{category1Id}/items）・カテゴリー設定（templates/{category1Id}）・
// カテゴリー定義（partDefinitions/{category1Id}）をすべて削除する。Firestoreクライアントには再帰削除が
// 無いため、items を1件ずつ削除してから親ドキュメントを削除する。
// なお、既にこのカテゴリーの問題を自社にコピー済みの企業がある場合、そのコピー済みデータ
// （companies/{companyId}/questionSets/{category1Id} 以下）自体は削除されない。ただし
// partDefinitionsから削除されるため、削除後はどの企業の受験フローにもこのカテゴリーは
// 表示されなくなる（loadEffectiveCategory1List が partDefinitions を参照しているため）。
export async function deleteGlobalCategory1Def(category1Id) {
  const itemsRef = collection(db, "templates", category1Id, "items");
  const itemsSnap = await getDocs(itemsRef);
  for (const itemDoc of itemsSnap.docs) {
    await deleteDoc(doc(db, "templates", category1Id, "items", itemDoc.id));
  }
  await deleteDoc(doc(db, "templates", category1Id)).catch(() => {});
  await deleteDoc(doc(db, "partDefinitions", category1Id));
  invalidateGlobalQuestionCache();
}

// 自社限定の新しいカテゴリーを追加する。
// v9より、企業側のセルフサービス作成は廃止し、運営が申込対応時に代理作成する運用に変更した
// （Firestoreルールでも customParts の書き込みを運営限定にしている）。この関数自体はそのまま
// 残し、operator-question-editor.html の運営モードからのみ呼び出す。
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
  invalidateCompanyQuestionCache(companyId);
  return category1Id;
}

// 自社限定カテゴリーを削除する（全社共通カテゴリーは対象外）。
// 登録済みの問題（items）・カテゴリー設定（questionSets）・カテゴリー定義（customParts）を
// すべて削除する。Firestoreクライアントには再帰削除が無いため、items を1件ずつ削除してから
// 親ドキュメントを削除する。v9より運営限定の操作（FirestoreルールでcustomParts書き込みを
// 運営限定にしているため、企業管理者からの呼び出しは権限エラーになる）。
export async function deleteCompanyCustomCategory1(companyId, category1Id) {
  const itemsRef = collection(db, "companies", companyId, "questionSets", category1Id, "items");
  const itemsSnap = await getDocs(itemsRef);
  for (const itemDoc of itemsSnap.docs) {
    await deleteDoc(doc(db, "companies", companyId, "questionSets", category1Id, "items", itemDoc.id));
  }
  await deleteDoc(doc(db, "companies", companyId, "questionSets", category1Id)).catch(() => {});
  await deleteDoc(doc(db, "companies", companyId, "customParts", category1Id));
  invalidateCompanyQuestionCache(companyId);
}

// 指定カテゴリー1について、実際に出題する設定・問題一覧を返す。
// 企業が自社の問題を1問でも登録していればそちらを優先し、登録が無い全社共通カテゴリーは
// 運営のデフォルト問題（templates）をそのまま使う。自社限定カテゴリーで未登録の場合は0問扱い。
export async function loadEffectiveQuestionSet(companyId, category1) {
  const cacheKey = `questionSet:${companyId}:${category1.id}:${category1.scope}`;
  const cached = cacheRead(cacheKey);
  if (cached) return cached;

  const companyItemsSnap = await getDocs(
    query(collection(db, "companies", companyId, "questionSets", category1.id, "items"), orderBy("order", "asc"))
  );

  if (!companyItemsSnap.empty) {
    const setSnap = await getDoc(doc(db, "companies", companyId, "questionSets", category1.id));
    const items = [];
    companyItemsSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    const result = { source: "company", settings: setSnap.exists() ? setSnap.data() : {}, items };
    cacheWrite(cacheKey, result);
    return result;
  }

  if (category1.scope === "global") {
    const setSnap = await getDoc(doc(db, "templates", category1.id));
    const itemsSnap = await getDocs(query(collection(db, "templates", category1.id, "items"), orderBy("order", "asc")));
    const items = [];
    itemsSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    const result = { source: "template", settings: setSnap.exists() ? setSnap.data() : {}, items };
    cacheWrite(cacheKey, result);
    return result;
  }

  const result = { source: "none", settings: {}, items: [] };
  cacheWrite(cacheKey, result);
  return result;
}

// =====================================================================
// 招待メール（v8で追加）
//
// 「受験招待メール作成」（operator-invite-mail.html）で、企業ごとに件名・本文の
// ひな形を1つ保存できるようにする（companies/{companyId}/mailTemplates/inviteMail）。
// 個別招待（operator-invites.html）・一括招待（operator-invites-bulk.html）どちらも、
// 招待メール案内を表示するときにこのテンプレートを読み込んで使う。企業がまだ一度も
// 保存していない場合は、これまで通りの自動生成文面（buildDefaultInviteMailTemplate）に
// フォールバックする。
//
// テンプレート中のプレースホルダーは {{氏名}} / {{受験リンク}} / {{社員コード}} /
// {{部署}} / {{役職}} / {{備考}} の二重中かっこ形式。差し込み印刷用CSVの列名や、
// 一括招待の「まとめてメールを送るには」で案内している書式とそろえている。
// =====================================================================

const ZENKAKU_NUM = ["０", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
function toZenkakuNumber(n) {
  return String(n).split("").map((d) => ZENKAKU_NUM[Number(d)]).join("");
}

// 実際に受験フローへ組み込まれる各カテゴリーの制限時間・出題形式から、
// 案内メールに載せる「所要時間の目安」と「タイピング問題の有無」を求める。
// exam-entry.html が受験者に表示する内容と同じ実効設定（企業が自社で問題を
// 差し替えている場合はそちらを優先）を参照するため、表示される時間と齟齬が出ない。
// v9より、実施OFF・代替により除外されたカテゴリーは所要時間に含めない（loadAdministeredCategory1List）。
export async function loadExamSummary(companyId) {
  const category1Order = await loadAdministeredCategory1List(companyId);
  let totalSec = 0;
  let hasTyping = false;
  for (const category1 of category1Order) {
    const eff = await loadEffectiveQuestionSet(companyId, category1);
    totalSec += eff.settings ? (eff.settings.realTimeLimitSec || 0) : 0;
    if (eff.items && eff.items.some((it) => it.type === "typing_passage")) hasTyping = true;
  }
  return { totalSec, hasTyping };
}

// 企業が「受験招待メール作成」で文面を保存する前・保存をリセットしたい場合に使う初期文面。
// これまで個別招待・一括招待にべた書きしていた自動生成ロジックをそのまま移設したもの。
export async function buildDefaultInviteMailTemplate(companyId) {
  const { hasTyping } = await loadExamSummary(companyId);

  const noteBlocks = [
    [
      "受験を開始すると、途中で中断・やり直しはできません。",
      "通信環境の良い場所で、時間に余裕をもってご受験ください。",
    ],
    ["静かで集中できる環境でのご受験をお願いいたします。"],
  ];
  if (hasTyping) {
    noteBlocks.push([
      "タイピング形式の問題が含まれます。",
      "パソコン（PC）でのご受験を推奨します。",
    ]);
  }
  noteBlocks.push(["Google Chrome または Microsoft Edge の最新版を推奨します。"]);

  const lines = [
    "{{氏名}} 様",
    "",
    "ビズてすの受験のご案内です。",
    "",
    "以下のURLを開き、内容をご確認のうえ受験を開始してください。",
    "",
    "{{受験リンク}}",
    "",
    "所要時間の目安：【　　】",
    "実施期限：【　　】",
    "",
  ];
  noteBlocks.forEach((block, i) => {
    lines.push(`※${toZenkakuNumber(i + 1)}`, ...block, "");
  });
  lines.push(
    "ご不明な点がございましたら、下記の担当者までご連絡ください。",
    "担当者：【　　】",
    "連絡先：【　　】",
    "",
    "ビズてす"
  );

  return { subject: "【ビズてす】受験のご案内", body: lines.join("\n") };
}

// 企業が保存済みの招待メールテンプレートを読み込む（未保存ならnull）
export async function loadInviteMailTemplate(companyId) {
  const snap = await getDoc(doc(db, "companies", companyId, "mailTemplates", "inviteMail"));
  return snap.exists() ? snap.data() : null;
}

// 招待メールテンプレートを保存する（operator-invite-mail.html から呼ぶ）
export async function saveInviteMailTemplate(companyId, template, user) {
  await setDoc(doc(db, "companies", companyId, "mailTemplates", "inviteMail"), {
    subject: (template && template.subject) || "",
    body: (template && template.body) || "",
    updatedAt: serverTimestamp(),
    updatedBy: user ? user.uid : "",
    updatedByEmail: user ? (user.email || "") : "",
  });
}

// テンプレート中の {{氏名}} 等のプレースホルダーを、実際の対象者データに置き換える
export function fillInviteMailPlaceholders(text, data) {
  data = data || {};
  const map = {
    "{{氏名}}": data.applicantName || "対象者",
    "{{受験リンク}}": data.link || "",
    "{{社員コード}}": data.employeeCode || "",
    "{{部署}}": data.department || "",
    "{{役職}}": data.position || "",
    "{{備考}}": data.note || "",
  };
  let result = String(text || "");
  Object.keys(map).forEach((key) => {
    result = result.split(key).join(map[key]);
  });
  return result;
}

// 個別招待・一括招待の「招待メール案内」が呼ぶ、実際に表示する件名・本文の組み立て。
// 企業が「受験招待メール作成」で文面を保存済みならそれを、未保存ならこれまで通りの
// 自動生成文面（buildDefaultInviteMailTemplate）にフォールバックして使う。
export async function buildInviteMailContent(companyId, data, link) {
  const saved = await loadInviteMailTemplate(companyId);
  const template = saved && (saved.subject || saved.body) ? saved : await buildDefaultInviteMailTemplate(companyId);
  const filled = { ...data, link };
  return {
    email: data.applicantEmail || "",
    subject: fillInviteMailPlaceholders(template.subject, filled),
    body: fillInviteMailPlaceholders(template.body, filled),
  };
}
