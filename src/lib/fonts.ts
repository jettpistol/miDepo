/** Interface fonts each user can pick in Mi cuenta. Codes always stay in Courier Prime. */
export const FONTS = [
  { id: "libre-franklin", name: "Libre Franklin", note: "La de siempre" },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", note: "Técnica, de ingeniería" },
  { id: "archivo", name: "Archivo", note: "Grotesca firme" },
  { id: "barlow", name: "Barlow", note: "Recta, de carteles de ruta" },
  { id: "sofia-sans", name: "Sofia Sans", note: "Angulosa, tipo DIN" },
  { id: "overpass", name: "Overpass", note: "De señalización vial" },
  { id: "titillium-web", name: "Titillium Web", note: "Cuadrada, técnica" },
  { id: "saira", name: "Saira", note: "Cuadrada, ancha" },
  { id: "chivo", name: "Chivo", note: "Grotesca con peso" },
  { id: "schibsted-grotesk", name: "Schibsted Grotesk", note: "Grotesca de diario" },
  { id: "public-sans", name: "Public Sans", note: "Neutra, institucional" },
  { id: "source-sans-3", name: "Source Sans 3", note: "Clara, de documentación" },
  { id: "red-hat-text", name: "Red Hat Text", note: "Sobria" },
  { id: "inter", name: "Inter", note: "Neutra, de interfaz" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];
export const DEFAULT_FONT: FontId = "libre-franklin";
export const isFont = (id: string): id is FontId => FONTS.some((f) => f.id === id);
/** The CSS that points the interface at a font; every font defines its own variable on <html>. */
export const fontVar = (id: string) => `var(--font-${isFont(id) ? id : DEFAULT_FONT})`;
