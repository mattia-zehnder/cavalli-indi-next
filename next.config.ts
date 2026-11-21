import type { NextConfig } from "next";

// GitHub Pages build: static export served from https://<user>.github.io/<repo>/
// (set GITHUB_PAGES=true and PAGES_BASE_PATH=/<repo>, see .github/workflows/pages.yml).
// Local `npm run dev` / `npm run build && npm start` are unaffected.
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = isPages ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  // No floating "N" dev badge on the bar's TV
  devIndicators: false,
  // There is another package-lock.json higher up (~/Desktop), which makes
  // Turbopack pick the wrong workspace root and crash. Pin it to this project.
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  ...(isPages
    ? {
        output: "export" as const,
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
