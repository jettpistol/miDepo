"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Message, type Action } from "@/components/ScanForm";
import { Select } from "@/components/Select";
import { Icon, type IconName } from "@/components/Icon";
import { hotkey } from "@/lib/hotkeys";
import { isInternal, renderMarkdown, titleOf } from "@/lib/markdown";

type Props = {
  page: string;
  markdown: string;
  original: string;
  edited: boolean;
  outdated: boolean;
  pages: { page: string; title: string }[];
  maxLength: number;
  save: Action;
  restore: Action;
};

/** Text editor for one manual page: Markdown on one side, the page as it will look on the other. */
export function Editor({ page, markdown: initial, original, edited, outdated, pages, maxLength, save, restore }: Props) {
  const [text, setText] = useState(initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [linking, setLinking] = useState<{ start: number; end: number; label: string } | null>(null);
  const [saveStatus, submitSave, saving] = useActionState(save, {});
  const [restoreStatus, submitRestore, restoring] = useActionState(restore, {});
  const area = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const html = useMemo(() => renderMarkdown(text), [text]);
  const dirty = text !== initial;
  const known = useMemo(() => new Set(pages.map((p) => p.page)), [pages]);

  // Problems shown while typing; the server checks the same before saving.
  const brokenLinks = useMemo(
    () => [...new Set([...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((href) => isInternal(href) && !known.has(href.split("#")[0]) && href.split("#")[0] !== ""))],
    [text, known],
  );
  const reason = !titleOf(text)
    ? "Falta el título: una línea que empiece con # y un espacio."
    : text.length > maxLength
      ? `Sobran ${(text.length - maxLength).toLocaleString("es-AR")} caracteres.`
      : !dirty
        ? "Todavía no hay cambios."
        : undefined;

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  /** Replaces a range of the text the way typing would, so Ctrl+Z still undoes it. */
  function replace(start: number, end: number, insert: string, select: [number, number]) {
    const el = area.current!;
    el.focus();
    el.setSelectionRange(start, end);
    if (!document.execCommand("insertText", false, insert)) {
      el.setRangeText(insert, start, end, "end");
      setText(el.value);
    }
    el.setSelectionRange(start + select[0], start + select[1]);
  }

  /** Bold, italic, code: wraps the selection, or unwraps it if it is already wrapped. */
  function wrap(mark: string, placeholder: string) {
    const el = area.current!;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const chosen = value.slice(s, e);
    if (value.slice(s - mark.length, s) === mark && value.slice(e, e + mark.length) === mark) {
      replace(s - mark.length, e + mark.length, chosen, [0, chosen.length]);
      return;
    }
    const inner = chosen || placeholder;
    replace(s, e, mark + inner + mark, [mark.length, mark.length + inner.length]);
  }

  /** Headings, lists, notes: puts a prefix on every selected line, or takes it off. */
  function lines(prefix: (i: number) => string, strip: RegExp) {
    const el = area.current!;
    const { value } = el;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const endBreak = value.indexOf("\n", el.selectionEnd);
    const end = endBreak === -1 ? value.length : endBreak;
    const block = value.slice(start, end).split("\n");
    const all = block.every((l) => strip.test(l));
    const out = block.map((l, i) => (all ? l.replace(strip, "") : prefix(i) + l.replace(/^(#{1,6} |[-*] |\d+\. |> )/, ""))).join("\n");
    replace(start, end, out, [out.length, out.length]);
  }

  function insertBlock(snippet: string, select: [number, number]) {
    const el = area.current!;
    const { selectionStart: s, value } = el;
    const before = s === 0 || value.slice(s - 2, s) === "\n\n" ? "" : value[s - 1] === "\n" ? "\n" : "\n\n";
    replace(s, el.selectionEnd, before + snippet, [before.length + select[0], before.length + select[1]]);
  }

  function openLink() {
    const el = area.current!;
    setLinking({ start: el.selectionStart, end: el.selectionEnd, label: el.value.slice(el.selectionStart, el.selectionEnd) });
  }

  const tools: { label: string; keys?: string; icon?: IconName; glyph?: string; run: () => void }[][] = [
    [
      { label: "Título de sección", glyph: "H2", run: () => lines(() => "## ", /^## /) },
      { label: "Subtítulo", glyph: "H3", run: () => lines(() => "### ", /^### /) },
    ],
    [
      { label: "Negrita", keys: "Ctrl+B", glyph: "B", run: () => wrap("**", "texto") },
      { label: "Cursiva", keys: "Ctrl+I", glyph: "I", run: () => wrap("*", "texto") },
      { label: "Código o nombre de botón", icon: "code", run: () => wrap("`", "A-01-1") },
      { label: "Enlace", keys: "Ctrl+K", icon: "link", run: openLink },
    ],
    [
      { label: "Lista", icon: "bullets", run: () => lines(() => "- ", /^[-*] /) },
      { label: "Lista numerada", icon: "numbers", run: () => lines((i) => `${i + 1}. `, /^\d+\. /) },
      { label: "Nota destacada", icon: "note", run: () => lines(() => "> ", /^> /) },
      { label: "Tabla", icon: "table", run: () => insertBlock("| Columna | Columna |\n|---|---|\n| Dato | Dato |\n", [2, 9]) },
    ],
  ];

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const run = { b: () => wrap("**", "texto"), i: () => wrap("*", "texto"), k: openLink, s: () => !reason && !saving && form.current?.requestSubmit() }[k];
    if (run) {
      e.preventDefault();
      run();
    }
  }

  return (
    <div>
      {outdated && (
        <div className="mb-4 rounded-control border border-warn/30 bg-warn-soft px-3 py-2 text-sm">
          <p className="font-semibold text-warn">El manual original de esta página cambió después de la última edición.</p>
          <details className="mt-1">
            <summary className="cursor-pointer font-medium text-ink">Ver el original actual</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-label border border-line bg-surface p-2 font-mono text-xs whitespace-pre-wrap">{original}</pre>
          </details>
        </div>
      )}

      <div className="rounded-control border border-line-strong bg-surface">
        <div className="sticky top-12 z-20 flex flex-wrap items-center gap-1 border-b border-line bg-surface px-1.5 py-1" role="toolbar" aria-label="Formato">
          {tools.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5 border-line pr-1 not-last:border-r">
              {group.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  title={t.keys ? `${t.label} · ${t.keys}` : t.label}
                  aria-label={t.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTab("write");
                    requestAnimationFrame(t.run);
                  }}
                  className={`grid size-11 cursor-pointer place-items-center rounded-control text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink lg:size-8 ${t.glyph === "I" ? "font-serif italic" : "font-bold"} text-sm`}
                >
                  {t.icon ? <Icon name={t.icon} className="size-4" /> : t.glyph}
                </button>
              ))}
            </div>
          ))}
          <div className="ml-auto flex gap-4 px-1 lg:hidden">
            {(["write", "preview"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`-mb-1 min-h-11 cursor-pointer border-b-2 text-sm ${tab === t ? "border-accent-text font-bold text-accent-text" : "border-transparent font-medium text-muted"}`}>
                {t === "write" ? "Escribir" : "Vista previa"}
              </button>
            ))}
          </div>
        </div>

        {linking && (
          <LinkPanel
            pages={pages}
            label={linking.label}
            onCancel={() => {
              setLinking(null);
              area.current?.focus();
            }}
            onInsert={(label, href) => {
              const { start, end } = linking;
              setLinking(null);
              requestAnimationFrame(() => replace(start, end, `[${label}](${href})`, [label.length + href.length + 4, label.length + href.length + 4]));
            }}
          />
        )}

        <div className="grid lg:grid-cols-2">
          <label className={`${tab === "write" ? "block" : "hidden"} lg:block`}>
            <span className="sr-only">Texto de la página, en Markdown</span>
            <textarea
              ref={area}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck
              lang="es"
              className="block h-[calc(100dvh-14rem)] min-h-80 w-full resize-none bg-surface p-3 font-mono text-[13px] leading-relaxed text-ink focus:outline-none lg:border-r lg:border-line"
            />
          </label>
          <div className={`${tab === "preview" ? "block" : "hidden"} h-[calc(100dvh-14rem)] min-h-80 overflow-y-auto p-4 lg:block`} aria-label="Vista previa" role="region">
            <article className="manual" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>

      {brokenLinks.length > 0 && (
        <p className="mt-2 text-sm text-warn">
          {brokenLinks.length === 1 ? "Este enlace no lleva a ninguna página del manual: " : "Estos enlaces no llevan a ninguna página del manual: "}
          {brokenLinks.map((l, i) => (
            <span key={l}>
              {i > 0 && ", "}
              <code className="font-mono">{l}</code>
            </span>
          ))}
          .
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form ref={form} action={submitSave} className="contents">
          <input type="hidden" name="page" value={page} />
          <input type="hidden" name="markdown" value={text} />
          <button className="btn" disabled={saving || Boolean(reason)} {...hotkey("primary", "Guardar")}>
            {saving ? "Un momento…" : "Guardar"}
          </button>
        </form>
        <Link href={`/ayuda/${page}`} className="btn-soft" {...hotkey("back", "Cancelar")}>
          Cancelar
        </Link>
        {reason && <span className="text-sm text-muted">{reason}</span>}
        <span className="ml-auto text-xs text-muted tabular-nums">{`${text.length.toLocaleString("es-AR")} caracteres`}</span>
        {edited && (
          <form
            action={submitRestore}
            onSubmit={(e) => {
              if (!window.confirm("¿Volver al texto original del manual? Se pierde la versión de tu empresa.")) e.preventDefault();
            }}
            className="contents"
          >
            <input type="hidden" name="page" value={page} />
            <button className="btn-soft text-danger" disabled={restoring}>
              {restoring ? "Un momento…" : "Volver al original"}
            </button>
          </form>
        )}
        <div className="basis-full">
          <Message status={saveStatus.error ? saveStatus : restoreStatus} />
        </div>
      </div>
    </div>
  );
}

/** Link to another manual page (picked from the list) or to a web address. */
function LinkPanel({ pages, label: initialLabel, onInsert, onCancel }: { pages: { page: string; title: string }[]; label: string; onInsert: (label: string, href: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(initialLabel);
  const [target, setTarget] = useState("");
  const [web, setWeb] = useState("");
  const webOk = /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(web.trim());
  const href = target || (webOk ? web.trim() : "");
  const title = pages.find((p) => p.page === target)?.title;
  const finalLabel = label.trim() || title || web.trim();
  const reason = web.trim() && !webOk ? "La dirección web empieza con https:// o http://." : !href ? "Elige una página o escribe una dirección web." : undefined;

  return (
    <div className="grid gap-3 border-b border-line bg-sunken p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div>
        <label htmlFor="link-label" className="field-label">
          Texto
        </label>
        <input id="link-label" value={label} onChange={(e) => setLabel(e.target.value)} className="field" placeholder={title ?? "Texto del enlace"} autoFocus={!initialLabel} />
      </div>
      <div>
        <label htmlFor="link-page" className="field-label">
          Página del manual
        </label>
        <Select
          id="link-page"
          options={pages.map((p) => ({ value: p.page, label: p.title }))}
          value={target}
          onChange={(v) => {
            setTarget(v);
            setWeb("");
          }}
          placeholder="Elige una página"
          searchPlaceholder="Buscar página…"
        />
      </div>
      <div>
        <label htmlFor="link-web" className="field-label">
          O una dirección web
        </label>
        <input
          id="link-web"
          type="url"
          value={web}
          onChange={(e) => {
            setWeb(e.target.value);
            if (e.target.value) setTarget("");
          }}
          className="field"
          placeholder="https://"
        />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn" disabled={Boolean(reason)} onClick={() => onInsert(finalLabel, href)}>
          Insertar
        </button>
        <button type="button" className="btn-soft" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {reason && <p className="text-sm text-muted sm:col-span-4">{reason}</p>}
    </div>
  );
}
