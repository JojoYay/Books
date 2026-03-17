// 最初の隊長アカウントを作成するスクリプト
// 使い方: node scripts/create-leader.mjs
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// .env.local から環境変数を読み込む
const envFile = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  // クォートを除去
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const projectId = env["FIREBASE_PROJECT_ID"];
const clientEmail = env["FIREBASE_CLIENT_EMAIL"];
const privateKey = env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

console.log("📋 設定確認:");
console.log("  projectId:", projectId);
console.log("  clientEmail:", clientEmail);
console.log("  privateKey:", privateKey ? "✅ 読み込み済み" : "❌ 未設定");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ .env.local の Firebase Admin SDK の設定が不足しています");
  process.exit(1);
}

// Firebase Admin 初期化
const app = getApps().length === 0
  ? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  : getApps()[0];

const auth = getAuth(app);
const db = getFirestore(app);

// ここを変更してください ↓
const NAME = "山田CS隊長";
const EMAIL = "jpscout1singaporecs@gmail.com";
const PASSWORD = "HandsomeJohji";
// ここを変更してください ↑

async function createLeader() {
  try {
    // Firebase Auth にユーザー作成
    const user = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: NAME,
    });
    console.log(`✅ Firebase Auth ユーザー作成: ${user.uid}`);

    // Firestore にユーザードキュメント作成
    await db.collection("users").doc(user.uid).set({
      name: NAME,
      email: EMAIL,
      role: "leader",
      createdAt: new Date(),
    });
    console.log(`✅ Firestore ドキュメント作成完了`);
    console.log(`\n🎉 隊長アカウント作成完了！`);
    console.log(`   メール: ${EMAIL}`);
    console.log(`   パスワード: ${PASSWORD}`);
    console.log(`   ログインURL: ${env["NEXT_PUBLIC_APP_URL"]}/login`);
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      console.log("⚠️  このメールアドレスはすでに登録されています");
      // Firestore だけ更新する
      const existing = await auth.getUserByEmail(EMAIL);
      await db.collection("users").doc(existing.uid).set({
        name: NAME,
        email: EMAIL,
        role: "leader",
        createdAt: new Date(),
      }, { merge: true });
      console.log(`✅ Firestore ドキュメントを更新しました (uid: ${existing.uid})`);
    } else {
      console.error("❌ エラー:", err.message);
    }
  }
  process.exit(0);
}

createLeader();
