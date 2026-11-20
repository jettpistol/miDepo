/**
 * What this browser has seen of barcode scanners. A keyboard-wedge scanner is a keyboard to the
 * browser, so it can never be "detected": a fast burst of keys that ends in Enter is only a hint
 * that one was used (docs/hardware/README.md, "Detection heuristic"). Never used to refuse a value.
 * Kept in this browser only (localStorage), shown in Dispositivos.
 */

export type ScanSource = "scanner" | "camera" | "demo";
export type ScannerMemory = { lastAt: number; count: number; source: ScanSource; lastCode: string; noEnterAt?: number };

const KEY = "midepo-scanner";
export const SCANNER_EVENT = "midepo:scanner";
/** The demo scanner (test mode) sends its reads with this event; ScanForm takes them like a camera read. */
export const DEMO_SCAN_EVENT = "midepo:demo-scan";
export type DemoScan = { target: HTMLInputElement; code: string; enter: boolean };

/** Shorter gaps than this, between keys, are faster than people type. Bluetooth and DataWedge stay under it. */
export const SCANNER_GAP_MS = 50;
export const MIN_SCAN_LENGTH = 4;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Whether key times (ms) look like a scanner: at least 4 keys, median gap under 50 ms. */
export function looksScanned(times: number[]) {
  if (times.length < MIN_SCAN_LENGTH) return false;
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  return median(gaps) < SCANNER_GAP_MS;
}

export function readScanner(): ScannerMemory | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScannerMemory) : null;
  } catch {
    return null;
  }
}

function save(m: ScannerMemory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* sin almacenamiento, sin memoria */
  }
  window.dispatchEvent(new Event(SCANNER_EVENT));
}

export function rememberScan(code: string, source: ScanSource) {
  const before = readScanner();
  save({ lastAt: Date.now(), count: (before?.count ?? 0) + 1, source, lastCode: code.slice(0, 40), noEnterAt: before?.noEnterAt });
}

/** A scanner-fast burst that never got its Enter: the scanner's suffix is not set. */
export function rememberNoEnter(code: string) {
  const before = readScanner();
  save({ lastAt: Date.now(), count: before?.count ?? 0, source: "scanner", lastCode: code.slice(0, 40), noEnterAt: Date.now() });
}

export function forgetScanner() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada */
  }
  window.dispatchEvent(new Event(SCANNER_EVENT));
}
