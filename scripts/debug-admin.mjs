import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

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

console.log("privateKey first 50:", privateKey?.slice(0, 50));
console.log("privateKey last 50:", privateKey?.slice(-50));
console.log("privateKey includes BEGIN:", privateKey?.includes("BEGIN PRIVATE KEY"));

try {
  const credential = cert({ projectId, clientEmail, privateKey });
  console.log("cert() OK:", typeof credential);

  const app = initializeApp({ credential });
  console.log("initializeApp() OK, name:", app.name);

  const auth = getAuth(app);
  console.log("getAuth() OK:", typeof auth);

  const user = await auth.getUserByEmail("test@test.com").catch(e => {
    if (e.code === "auth/user-not-found") return "user-not-found (正常)";
    return "error: " + e.message;
  });
  console.log("API呼び出し結果:", user);
} catch (e) {
  console.error("エラー:", e.message);
  console.error("スタック:", e.stack?.slice(0, 500));
}
