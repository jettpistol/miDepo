import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { ACENTO_DE_FABRICA, variablesDeAcento } from "@/lib/color";
import { sesionActual } from "@/lib/sesion";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "miDepo", template: "%s · miDepo" },
  description: "El depósito de libros, ordenado. Funciona junto a Fierro.",
  appleWebApp: { capable: true, title: "miDepo", statusBarStyle: "default" },
};

export async function generateViewport(): Promise<Viewport> {
  const s = await sesionActual();
  return { themeColor: s?.usuario.acento ?? ACENTO_DE_FABRICA, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function Raiz({ children }: { children: ReactNode }) {
  const s = await sesionActual();
  // El color y el tema son de cada usuario: se aplican acá y tiñen todo el sitio.
  return (
    <html lang="es-AR" data-tema={s?.usuario.tema ?? "sistema"} style={variablesDeAcento(s?.usuario.acento ?? ACENTO_DE_FABRICA) as CSSProperties}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
