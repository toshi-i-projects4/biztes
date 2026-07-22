// 最初のオペレーターアカウントを作成するスクリプト
//
// operators/{uid} への書き込みはセキュリティルール上コンソール/Admin SDKからのみ許可しているため、
// 最初の1人目はこのスクリプトで作成してください（2人目以降は同じ要領でこのスクリプトを再実行するか、
// Firebase ConsoleでAuthenticationユーザーを作り、Firestoreに operators/{uid} ドキュメントを手動追加してください）。
//
// 使い方:
//   npm install firebase-admin
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
//     node scripts/create-operator.mjs "運用担当者の名前" "email@example.com" "初期パスワード"

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('使い方: node scripts/create-operator.mjs "名前" "email@example.com" "パスワード（8文字以上）"');
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyPath && existsSync(keyPath)) {
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
} else {
  initializeApp({ credential: applicationDefault() });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  let user;
  try {
    user = await auth.createUser({ email, password, displayName: name });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      user = await auth.getUserByEmail(email);
      console.log("既存のAuthユーザーを使用します:", user.uid);
    } else {
      throw err;
    }
  }
  await db.doc(`operators/${user.uid}`).set({
    name, email, role: "operator", createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`オペレーターアカウントを作成しました: ${email} (uid: ${user.uid})`);
  console.log("operator-login.html からこのメールアドレスとパスワードでログインできます。");
  process.exit(0);
}

main().catch((err) => {
  console.error("作成中にエラーが発生しました:", err);
  process.exit(1);
});
