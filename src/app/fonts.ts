import { Archivo, Barlow, Chivo, Courier_Prime, IBM_Plex_Sans, Inter, Libre_Franklin, Overpass, Public_Sans, Red_Hat_Text, Saira, Schibsted_Grotesk, Sofia_Sans, Source_Sans_3, Titillium_Web } from "next/font/google";

// Every interface font declares a CSS variable; a file is only downloaded when its font is in use.
// Only the default is preloaded, so pages do not fetch fonts nobody picked.
const libreFranklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-libre-franklin", display: "swap" });
const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ibm-plex-sans", display: "swap", preload: false });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", preload: false });
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow", display: "swap", preload: false });
const sofiaSans = Sofia_Sans({ subsets: ["latin"], variable: "--font-sofia-sans", display: "swap", preload: false });
const overpass = Overpass({ subsets: ["latin"], variable: "--font-overpass", display: "swap", preload: false });
const titilliumWeb = Titillium_Web({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-titillium-web", display: "swap", preload: false });
const saira = Saira({ subsets: ["latin"], variable: "--font-saira", display: "swap", preload: false });
const chivo = Chivo({ subsets: ["latin"], variable: "--font-chivo", display: "swap", preload: false });
const schibstedGrotesk = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted-grotesk", display: "swap", preload: false });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap", preload: false });
const sourceSans3 = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans-3", display: "swap", preload: false });
const redHatText = Red_Hat_Text({ subsets: ["latin"], variable: "--font-red-hat-text", display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });

// Courier Prime, as if typed on a label, for codes only.
const code = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-code", display: "swap" });

export const fontClasses = [libreFranklin, ibmPlexSans, archivo, barlow, sofiaSans, overpass, titilliumWeb, saira, chivo, schibstedGrotesk, publicSans, sourceSans3, redHatText, inter, code].map((f) => f.variable).join(" ");
