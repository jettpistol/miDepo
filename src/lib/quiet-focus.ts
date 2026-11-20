/**
 * Puts the cursor in a field when a screen opens without highlighting it. Scan screens need the
 * cursor ready (a handheld scanner types into whatever field has focus), but nothing should look
 * selected until the person acts: the highlight comes back with the first click, tap or key,
 * including a scanner's first character.
 */
export function focusQuietly(el: HTMLElement | null | undefined) {
  if (!el) return;
  const root = document.documentElement;
  root.classList.add("focus-quiet");
  el.focus({ preventScroll: true });
  const wake = () => {
    root.classList.remove("focus-quiet");
    window.removeEventListener("pointerdown", wake, true);
    window.removeEventListener("keydown", wake, true);
  };
  window.addEventListener("pointerdown", wake, true);
  window.addEventListener("keydown", wake, true);
}
