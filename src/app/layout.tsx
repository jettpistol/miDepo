import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { DEFAULT_ACCENT, accentVariables } from "@/lib/color";
import { currentSession } from "@/lib/session";
import { Courier_Prime, Libre_Franklin } from "next/font/google";
import "./globals.css";

// Libre Franklin for the interface; Courier Prime, as if typed on a label, for codes only.
const sans = Libre_Franklin({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const code = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  title: { default: "miDepo", template: "%s · miDepo" },
  description: "El depósito de libros, ordenado. Funciona junto a Fierro.",
  appleWebApp: { capable: true, title: "miDepo", statusBarStyle: "default" },
};

export async function generateViewport(): Promise<Viewport> {
  const s = await currentSession();
  return { themeColor: s?.user.accent ?? DEFAULT_ACCENT, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await currentSession();
  // Colour and theme belong to each user: they are applied here and tint the whole site.
  return (
    <html lang="es-AR" className={`${sans.variable} ${code.variable}`} data-theme={s?.user.theme ?? "system"} style={accentVariables(s?.user.accent ?? DEFAULT_ACCENT) as CSSProperties}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
