import type { NextConfig } from "next";

const config: NextConfig = {
  // PGlite (la base embebida para pruebas locales) trae archivos WASM que no deben empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "bwip-js"],
  // El manual se lee de la carpeta /wiki al mostrar /ayuda: tiene que viajar con el despliegue.
  outputFileTracingIncludes: { "/*": ["./wiki/**/*"] },
};

export default config;
