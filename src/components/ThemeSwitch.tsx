"use client";

import { useState, useTransition } from "react";
import type { Action } from "./ScanForm";
import { Dropdown } from "./Dropdown";
import { Icon, type IconName } from "./Icon";

export type Theme = "light" | "dark" | "system";

export const THEMES: { id: Theme; name: string; icon: IconName }[] = [
  { id: "light", name: "Claro", icon: "sun" },
  { id: "dark", name: "Oscuro", icon: "moon" },
  { id: "system", name: "Como el dispositivo", icon: "device" },
];

/** Light or dark from the top bar. Changes at once and is saved to the user, like in Ajustes. */
export function ThemeSwitch({ action, theme: initial }: { action: Action; theme: Theme }) {
  const [theme, setTheme] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[2];

  const choose = (next: Theme, close: () => void) => {
    close();
    if (next === theme) return;
    const previous = theme;
    setTheme(next);
    setError(null);
    document.documentElement.dataset.theme = next;
    const f = new FormData();
    f.set("theme", next);
    start(async () => {
      const r = await action({}, f);
      if (r.error) {
        setTheme(previous);
        document.documentElement.dataset.theme = previous;
        setError(r.error);
      }
    });
  };

  return (
    <Dropdown className="relative">
      <summary
        className="grid size-8 cursor-pointer list-none place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink max-lg:size-11 [&::-webkit-details-marker]:hidden"
        title={`Tema: ${current.name}`}
        aria-label={`Tema: ${current.name}. Cambiar`}
      >
        <Icon name={current.icon} className="size-5" />
      </summary>
      <div className="absolute top-full right-0 z-40 mt-1.5 w-56 rounded-control border border-line bg-surface p-1.5 text-ink shadow-floating">
        <p className="px-2.5 pt-1 pb-1.5 text-[13px] font-bold text-muted">Tema</p>
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={theme === t.id}
            onClick={(e) => choose(t.id, () => e.currentTarget.closest("details")?.removeAttribute("open"))}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors duration-150 hover:bg-sunken lg:min-h-8 ${theme === t.id ? "font-semibold text-accent-text" : "font-medium"}`}
          >
            <Icon name={t.icon} className="size-4" />
            <span className="flex-1">{t.name}</span>
            {theme === t.id && <Icon name="ok" className="size-4" />}
          </button>
        ))}
        {error && <p className="px-2.5 py-1.5 text-sm text-danger">{error}</p>}
      </div>
    </Dropdown>
  );
}
