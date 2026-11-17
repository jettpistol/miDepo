import type { NextConfig } from "next";

const config: NextConfig = {
  // PGlite (the embedded database for local testing) ships WASM files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "bwip-js"],
  // The manual is read from the /wiki folder when /ayuda is rendered, so it has to travel with the deployment.
  outputFileTracingIncludes: { "/*": ["./wiki/**/*"] },
};

export default config;
