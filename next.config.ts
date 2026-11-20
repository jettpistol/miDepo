import type { NextConfig } from "next";

const config: NextConfig = {
  // PGlite (the embedded database for local testing) ships WASM files that must not be bundled.
  // The opening stock file is sent whole to a server action (up to 20,000 rows).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  serverExternalPackages: ["@electric-sql/pglite", "pg", "bwip-js"],
  // The manual is read from the /wiki folder when /ayuda is rendered, so it has to travel with the deployment.
  outputFileTracingIncludes: { "/*": ["./wiki/**/*"] },
  // Renamed screens: old bookmarks and the manual's old pages keep working. The query string is kept.
  async redirects() {
    return [
      { source: "/guardar", destination: "/reposicion", permanent: true },
      { source: "/ayuda/Guardar", destination: "/ayuda/Reposicion", permanent: true },
      // "Mi cuenta" became "Ajustes".
      { source: "/ayuda/Mi-cuenta-y-colores", destination: "/ayuda/Ajustes", permanent: true },
    ];
  },
};

export default config;
