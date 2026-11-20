import type { PrinterLanguage } from "@/db/schema";

/**
 * Printer models the manual lists (wiki/Impresoras-y-lectores.md), from the hardware research
 * (docs/hardware/README.md, "Supported-models table"). None has been tested with miDepo yet:
 * `status` says what the claim rests on. Keep the manual's table in step with this list.
 */
export type PrinterModel = { id: string; name: string; language: PrinterLanguage; dpi: number; status: "fabricante" | "emulación" | "vendedor" | "sin confirmar" | "solo diálogo" };

export const PRINTER_MODELS: PrinterModel[] = [
  { id: "zebra-zd230", name: "Zebra ZD230", language: "zpl", dpi: 203, status: "fabricante" },
  { id: "zebra-zd220", name: "Zebra ZD220", language: "zpl", dpi: 203, status: "fabricante" },
  { id: "zebra-zd421", name: "Zebra ZD421 / ZD411", language: "zpl", dpi: 203, status: "fabricante" },
  { id: "zebra-gk420", name: "Zebra GC420 / GK420", language: "zpl", dpi: 203, status: "fabricante" },
  { id: "zebra-zq521", name: "Zebra ZQ521", language: "zpl", dpi: 203, status: "vendedor" },
  { id: "tsc-te200", name: "TSC TE200 / TE210", language: "tspl", dpi: 203, status: "fabricante" },
  { id: "tsc-ttp244", name: "TSC TTP-244 Pro", language: "tspl", dpi: 203, status: "fabricante" },
  { id: "honeywell-pc42", name: "Honeywell PC42t / PC42d", language: "zpl", dpi: 203, status: "emulación" },
  { id: "godex-g500", name: "Godex G500 / RT200", language: "zpl", dpi: 203, status: "emulación" },
  { id: "citizen-cls621", name: "Citizen CL-S621", language: "zpl", dpi: 203, status: "emulación" },
  { id: "xprinter-420b", name: "Xprinter XP-420B", language: "tspl", dpi: 203, status: "vendedor" },
  { id: "xprinter-365b", name: "Xprinter XP-365B", language: "tspl", dpi: 203, status: "fabricante" },
  { id: "xprinter-470b", name: "Xprinter XP-470B", language: "tspl", dpi: 203, status: "sin confirmar" },
  { id: "3nstar-ltt204", name: "3nStar LTT204", language: "tspl", dpi: 203, status: "fabricante" },
  { id: "idprt-sp460", name: "iDPRT SP460BT", language: "tspl", dpi: 203, status: "sin confirmar" },
  { id: "zebra-zq220", name: "Zebra ZQ220", language: "page", dpi: 203, status: "solo diálogo" },
  { id: "brother-ql", name: "Brother QL-800 / QL-820NWB", language: "page", dpi: 300, status: "solo diálogo" },
  { id: "dymo-550", name: "Dymo LabelWriter 550", language: "page", dpi: 300, status: "solo diálogo" },
  { id: "a4", name: "Impresora común (A4)", language: "page", dpi: 300, status: "solo diálogo" },
];

/** The demo printers test mode adds: one of each language, at both resolutions. */
export const DEMO_PRINTERS = [
  { name: "Zebra ZD421 (demo)", model: "Zebra ZD421 / ZD411", language: "zpl" as const, dpi: 203 },
  { name: "TSC TE210 (demo)", model: "TSC TE200 / TE210", language: "tspl" as const, dpi: 300 },
  { name: "Xprinter XP-420B (demo)", model: "Xprinter XP-420B", language: "tspl" as const, dpi: 203 },
];

/** USB vendor IDs of label printer and scanner makers, to name what this browser was granted. */
export const USB_VENDORS: Record<number, string> = {
  0x0a5f: "Zebra",
  0x1203: "TSC",
  0x0b0b: "Datamax-O'Neil",
  0x10ac: "Honeywell",
  0x0c2e: "Honeywell",
  0x067e: "Intermec",
  0x0828: "SATO",
  0x04f9: "Brother",
  0x0922: "Dymo",
  0x1504: "Bixolon",
  0x08a6: "Toshiba TEC",
  0x1343: "Citizen",
  0x08bd: "Citizen",
  0x04b8: "Epson",
  0x154f: "SNBC",
  0x05e0: "Zebra (Symbol)",
  0x05f9: "Datalogic",
  0x1a86: "Adaptador serie (WCH)",
  0x067b: "Adaptador serie (Prolific)",
  0x0403: "Adaptador serie (FTDI)",
  0x10c4: "Adaptador serie (Silicon Labs)",
};

export const LANGUAGE_NAME: Record<PrinterLanguage, string> = { page: "Página", zpl: "ZPL", tspl: "TSPL" };
