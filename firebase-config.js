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
