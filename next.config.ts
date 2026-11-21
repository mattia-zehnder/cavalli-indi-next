import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No floating "N" dev badge on the bar's TV
  devIndicators: false,
  // There is another package-lock.json higher up (~/Desktop), which makes
  // Turbopack pick the wrong workspace root and crash. Pin it to this project.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
