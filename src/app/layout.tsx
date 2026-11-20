import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { DEFAULT_ACCENT, accentVariables } from "@/lib/color";
import { currentSession } from "@/lib/session";
import { DEFAULT_FONT, fontVar } from "@/lib/fonts";
import { fontClasses } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "miDepo", template: "%s · miDepo" },
  description: "El depósito, en orden. Funciona junto a Fierro.",
  appleWebApp: { capable: true, title: "miDepo", statusBarStyle: "default" },
};

export async function generateViewport(): Promise<Viewport> {
  const s = await currentSession();
  return { themeColor: s?.user.accent ?? DEFAULT_ACCENT, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await currentSession();
  // Colour, theme and font belong to each user: they are applied here and reach the whole site.
  return (
    <html lang="es-AR" className={fontClasses} data-theme={s?.user.theme ?? "system"} style={{ ...accentVariables(s?.user.accent ?? DEFAULT_ACCENT), "--font-ui": fontVar(s?.user.font ?? DEFAULT_FONT) } as CSSProperties}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
