"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * A short text that appears beside its trigger on hover, keyboard focus or a tap, instead of
 * taking room on the screen. Used for why a button is disabled and for notes the user only
 * sometimes needs. The bubble is fixed-positioned and kept inside the viewport, so it never
 * makes a phone screen scroll sideways.
 */
export function Hint({ text, children, className = "inline-flex", focusable = false }: { text: ReactNode; children: ReactNode; className?: string; focusable?: boolean }) {
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = hover || focus || pinned;

  useLayoutEffect(() => {
    if (!open || !wrap.current || !bubble.current) return setPos(null);
    const r = wrap.current.getBoundingClientRect();
    const b = bubble.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const below = r.bottom + 6 + b.height < window.innerHeight - 8;
    setPos({
      top: below ? r.bottom + 6 : r.top - 6 - b.height,
      left: Math.max(8, Math.min(r.left + r.width / 2 - b.width / 2, vw - b.width - 8)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
      } else if (e.type === "pointerdown" && wrap.current?.contains(e.target as Node)) return;
      setPinned(false);
      setHover(false);
      setFocus(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span
      ref={wrap}
      className={className}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onClick={() => setPinned((p) => !p)}
      aria-describedby={id}
      tabIndex={focusable ? 0 : undefined}
    >
      {children}
      <span
        ref={bubble}
        id={id}
        role="tooltip"
        style={pos ? { top: pos.top, left: pos.left } : undefined}
        className={`pointer-events-none fixed top-0 left-0 z-50 w-max max-w-64 rounded-control border border-line bg-surface px-2.5 py-1.5 text-left text-[13px] leading-snug font-normal text-ink shadow-floating ${open && pos ? "" : "invisible"}`}
      >
        {text}
      </span>
    </span>
  );
}

/** An info mark that shows a note on hover or tap. */
export function InfoHint({ text, label = "Más información" }: { text: ReactNode; label?: string }) {
  return (
    <Hint text={text} className="inline-flex self-center align-middle">
      <button
        type="button"
        aria-label={label}
        className="grid size-5 cursor-help place-items-center rounded-full align-middle text-muted transition-colors duration-150 hover:text-ink"
        // Inside a <label>, a tap on the mark should show the note, not pick the option.
        onClick={(e) => e.preventDefault()}
      >
        <Icon name="info" className="size-4" />
      </button>
    </Hint>
  );
}

/**
 * A button that cannot work yet: disabled, with the reason in a hint. Taps reach the wrapper
 * because the disabled button lets pointer events through, and the wrapper is focusable so the
 * reason can be read from the keyboard.
 */
export function DisabledReason({ reason, children, className = "inline-flex" }: { reason?: string; children: ReactNode; className?: string }) {
  if (!reason) return <>{children}</>;
  return (
    <Hint text={reason} focusable className={`${className} cursor-not-allowed rounded-control [&_button]:pointer-events-none`}>
      {children}
    </Hint>
  );
}
