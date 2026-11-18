/**
 * Keyboard shortcuts for desktop keyboards.
 *
 * - Alt + a digit opens a daily-work screen (NAV below).
 * - F-keys press whatever the current screen marks with `data-hotkey="F2"` etc. Screens use
 *   the same key for the same kind of action (KEYS below), so the F1 list is read from the page
 *   itself and can never disagree with it.
 * - F5, F11 and F12 are left to the browser (reload, full screen, developer tools).
 */

/** Alt + digit → screen. Digits follow the order of the "Trabajo del día" menu. */
export const NAV: Record<string, string> = {
  "0": "/",
  "1": "/recepcion",
  "2": "/reposicion",
  "3": "/picking",
  "4": "/empaque",
  "5": "/devoluciones",
  "6": "/conteos",
  "7": "/mover",
  "8": "/stock",
};

/** What each F-key means on every screen. Only the keys a screen marks do anything there. */
export const KEYS = {
  help: "F1",
  /** The screen's main button: confirm the scan, take the order, go to the next step. */
  primary: "F2",
  /** Back to the list the screen came from. */
  back: "F3",
  /** Fill the suggested quantity ("Todas: 60"). */
  quantity: "F4",
  /** Change an option of the scan (the condition of a returned book). */
  option: "F6",
  /** Fill the suggested shelf ("Está en A-01-1", "Ya hay en…"). */
  shelf: "F7",
  /** The screen's other action: shortage, close the box, finish the shelf, switch tab. */
  secondary: "F8",
  /** Close the whole task: close the receipt or return, finish the order, approve the count. */
  finish: "F9",
  /** "+ Nueva" on list screens. */
  create: "F10",
} as const;

export type HotkeyName = keyof typeof KEYS;

/** Props that mark an element as the target of a key. */
export function hotkey(name: HotkeyName, label?: string) {
  return { "data-hotkey": KEYS[name], ...(label ? { "data-hotkey-label": label } : {}) };
}
