import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // GitHub Pages向けの静的モックビルド(NEXT_PUBLIC_MOCK_MODE=1)は
  // サーバーを持たない静的出力にする。rewrites/画像最適化サーバーは使えないため無効化する。
  ...(isMock
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath || undefined,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${backendUrl}/api/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
