// 課題データの title → category, description → question への移行スクリプト
// 使い方: node scripts/migrate-tasks-category.mjs
import { initializeApp, cert, getApps } from "firebase-admin/app";
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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const projectId = env["FIREBASE_PROJECT_ID"];
const clientEmail = env["FIREBASE_CLIENT_EMAIL"];
const privateKey = env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ .env.local の Firebase Admin SDK の設定が不足しています");
  process.exit(1);
}

const app = getApps().length === 0
  ? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  : getApps()[0];

const db = getFirestore(app);

async function migrate() {
  const tasksRef = db.collection("tasks");
  const snapshot = await tasksRef.get();

  console.log(`📋 ${snapshot.size} 件の課題を確認中...`);

  let migrated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // 既に category/question があればスキップ
    if (data.category && data.question) {
      skipped++;
      continue;
    }

    const updates = {};

    // title → category
    if (!data.category && data.title) {
      updates.category = data.title;
    }

    // description → question
    if (!data.question && data.description !== undefined) {
      updates.question = data.description;
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      migrated++;
      console.log(`  ✅ ${doc.id}: title="${data.title}" → category="${updates.category || data.category}"`);
    } else {
      skipped++;
    }
  }

  console.log(`\n🎉 移行完了: ${migrated} 件更新, ${skipped} 件スキップ`);
}

migrate().catch((err) => {
  console.error("❌ 移行エラー:", err);
  process.exit(1);
});
