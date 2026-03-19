import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import { copyFileSync, existsSync } from "fs";
import { join } from "path";

// pdfjs-dist worker を public にコピー（ビルド時・開発時に必要）
try {
  const src = join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
  const dest = join(process.cwd(), "public/pdf.worker.min.mjs");
  if (existsSync(src)) copyFileSync(src, dest);
} catch {
  // コピー失敗時は既存ファイルを使用
}

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
