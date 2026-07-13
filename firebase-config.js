// ビズてす 共通Firebase初期化モジュール
//
// 【重要】下記 firebaseConfig はプレースホルダーです。
// Firebaseコンソールで「ビズてす」専用の新規プロジェクトを作成し、
// ウェブアプリを追加した際に表示される設定値に置き換えてください。
// （Firebaseコンソール → プロジェクトの設定 → 全般 → マイアプリ → SDK の設定と構成）
//
// 有効化しておく機能:
//  - Authentication: メール/パスワード（オペレーター用）、匿名（応募者用）
//  - Firestore Database（本番モードで作成し、firestore.rules を適用）

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TODO_REPLACE_ME",
  authDomain: "TODO_REPLACE_ME.firebaseapp.com",
  projectId: "TODO_REPLACE_ME",
  storageBucket: "TODO_REPLACE_ME.firebasestorage.app",
  messagingSenderId: "TODO_REPLACE_ME",
  appId: "TODO_REPLACE_ME",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// テスト構成の固定パートID・表示ラベル（4パート共通で使う定数）
export const PART_IDS = ["typing", "reading", "logical", "worklife"];
export const PART_LABELS = {
  typing: "①タイピング試験",
  reading: "②リーディングスキル",
  logical: "③ロジカルシンキング",
  worklife: "④仕事観アセスメント",
};
export const PART_TYPES = {
  typing: ["typing_passage"],
  reading: ["choice", "multi_select"],
  logical: ["choice", "fill_blank"],
  worklife: ["sentence_completion"],
};
