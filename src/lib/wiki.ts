import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, wikiEdits } from "@/db/schema";
import { UserError } from "./errors";
import type { Ctx } from "./flows/common";
import { renderMarkdown, slug, titleOf } from "./markdown";

/**
 * The manual lives in the /wiki folder in GitHub wiki format (Home.md, _Sidebar.md,
 * one page per file). It is read here to show it inside miDepo at /ayuda.
 *
 * An administrator can rewrite any page for their company: the edit is stored in `wiki_edits`
 * and replaces the file for that company's users. Visitors who are not logged in read the files.
 */
const FOLDER = path.join(process.cwd(), "wiki");

export function pages() {
  return readdirSync(FOLDER).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => f.slice(0, -3));
}

const exists = (name: string) => /^[\w-]+$/.test(name) && pages().includes(name);
const fileText = (name: string) => readFileSync(path.join(FOLDER, `${name}.md`), "utf8");
const hash = (md: string) => createHash("sha256").update(md).digest("hex").slice(0, 16);
const fallbackTitle = (name: string) => name.replace(/-/g, " ");

async function editsOf(companyId: number | undefined) {
  if (!companyId) return new Map<string, string>();
  const db = await getDb();
  const rows = await db.select({ page: wikiEdits.page, markdown: wikiEdits.markdown }).from(wikiEdits).where(eq(wikiEdits.companyId, companyId));
  return new Map(rows.map((r) => [r.page, r.markdown]));
}

/** A page as the given company reads it, with who last edited it, if anyone did. */
export async function readPage(name: string, companyId?: number) {
  if (!exists(name)) return null;
  const original = fileText(name);
  const db = companyId ? await getDb() : null;
  const [edit] = db
    ? await db
        .select({ markdown: wikiEdits.markdown, baseHash: wikiEdits.baseHash, updatedAt: wikiEdits.updatedAt, by: users.name })
        .from(wikiEdits)
        .innerJoin(users, eq(users.id, wikiEdits.updatedBy))
        .where(and(eq(wikiEdits.companyId, companyId!), eq(wikiEdits.page, name)))
    : [];
  const markdown = edit?.markdown ?? original;
  return {
    name,
    title: titleOf(markdown) ?? fallbackTitle(name),
    markdown,
    original,
    html: renderMarkdown(markdown),
    /** Set when the company reads its own version. `outdated`: the file changed after the edit. */
    edit: edit ? { at: edit.updatedAt, by: edit.by, outdated: edit.baseHash !== hash(original) } : null,
  };
}

/** Every page with its title, for the editor's link picker. */
export async function pageTitles(companyId?: number) {
  const edits = await editsOf(companyId);
  return pages().map((page) => ({ page, title: titleOf(edits.get(page) ?? fileText(page)) ?? fallbackTitle(page) }));
}

export function readIndex() {
  return renderMarkdown(fileText("_Sidebar"));
}

export function readFooter() {
  return renderMarkdown(fileText("_Footer"));
}

// ───────────── Editing ─────────────

export const MAX_PAGE_LENGTH = 100_000;

/** Saves the company's version of a page. Saving the original text unchanged removes the edit. */
export async function saveEdit(c: Ctx, name: string, markdown: string) {
  if (!exists(name)) throw new UserError("WIKI-01", "Esa página del manual no existe.");
  const md = markdown.replace(/\r\n/g, "\n").trimEnd() + "\n";
  if (!titleOf(md)) throw new UserError("WIKI-02", "La página necesita un título: una línea que empiece con # y un espacio.");
  if (md.length > MAX_PAGE_LENGTH) throw new UserError("WIKI-03", `La página es demasiado larga: el máximo es ${MAX_PAGE_LENGTH.toLocaleString("es-AR")} caracteres.`);
  const original = fileText(name);
  if (md === original.replace(/\r\n/g, "\n").trimEnd() + "\n") return restoreOriginal(c, name);
  const values = { markdown: md, baseHash: hash(original), updatedBy: c.userId, updatedAt: new Date() };
  await c.db
    .insert(wikiEdits)
    .values({ companyId: c.companyId, page: name, ...values })
    .onConflictDoUpdate({ target: [wikiEdits.companyId, wikiEdits.page], set: values });
}

/** Drops the company's version: its users read the manual's original page again. */
export async function restoreOriginal(c: Ctx, name: string) {
  if (!exists(name)) throw new UserError("WIKI-04", "Esa página del manual no existe.");
  await c.db.delete(wikiEdits).where(and(eq(wikiEdits.companyId, c.companyId), eq(wikiEdits.page, name)));
}

// ───────────── Search ─────────────

/** No accents or capitals, so "recepcion" finds "Recepción". */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escapeText = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Strips the Markdown formatting and leaves only the text a person reads. */
function textOnly(md: string) {
  return md
    .replace(/^#\s+.+$/m, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ")
    .replace(/[*`]/g, "")
    .replace(/[#>|]/g, " ")
    .replace(/^\s*(-|\d+\.)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchHit = { page: string; title: string; excerptHtml: string };

/** Searches the whole manual, as the given company reads it. Every word has to appear on the page. */
export async function search(lookup: string, companyId?: number): Promise<SearchHit[]> {
  const words = plain(lookup).split(/\s+/).filter((p) => p.length > 1).slice(0, 6);
  if (words.length === 0) return [];
  const edits = await editsOf(companyId);
  const results: (SearchHit & { points: number })[] = [];
  for (const page of pages()) {
    const md = edits.get(page) ?? fileText(page);
    const title = titleOf(md) ?? fallbackTitle(page);
    const text = textOnly(md);
    const [plainTitle, plainText] = [plain(title), plain(text)];
    if (!words.every((p) => plainTitle.includes(p) || plainText.includes(p))) continue;
    // A match in the title is worth far more than one in the body.
    const points = words.reduce((s, p) => s + (plainTitle.includes(p) ? 20 : 0) + Math.min(10, plainText.split(p).length - 1), 0);
    const whereabouts = Math.max(0, ...words.map((p) => plainText.indexOf(p)).filter((i) => i >= 0).slice(0, 1));
    const fromLoc = Math.max(0, text.lastIndexOf(" ", Math.max(0, whereabouts - 70)));
    const chunk = (fromLoc > 0 ? "… " : "") + text.slice(fromLoc, fromLoc + 210).trim() + (fromLoc + 210 < text.length ? " …" : "");
    // Highlighting runs on the already-escaped text, comparing without accents letter by letter.
    let html = "";
    const plainChunk = plain(chunk);
    for (let i = 0; i < chunk.length; ) {
      const p = plainChunk.length === chunk.length ? words.find((w) => plainChunk.startsWith(w, i)) : undefined;
      if (p) {
        html += `<mark>${escapeText(chunk.slice(i, i + p.length))}</mark>`;
        i += p.length;
      } else html += escapeText(chunk[i++]);
    }
    results.push({ page, title, excerptHtml: html, points });
  }
  return results.sort((a, b) => b.points - a.points || a.title.localeCompare(b.title));
}

export type SectionHit = { page: string; pageTitle: string; section: string | null; href: string; excerpt: string };

/**
 * Searches the manual section by section, as the given company reads it, for the "Guías" tab of
 * the top search: a hit opens the page at the section where the words are. Every word has to
 * appear in the same section (or in its page's title).
 */
export async function searchSections(lookup: string, companyId?: number, limit = 10): Promise<SectionHit[]> {
  const words = plain(lookup).split(/\s+/).filter((p) => p.length > 1).slice(0, 6);
  if (words.length === 0) return [];
  const edits = await editsOf(companyId);
  const results: (SectionHit & { points: number })[] = [];
  for (const page of pages()) {
    if (page === "Home") continue;
    const md = edits.get(page) ?? fileText(page);
    const pageTitle = titleOf(md) ?? fallbackTitle(page);
    // The text before the first "##" belongs to the page itself.
    md.split(/^##\s+/m).forEach((part, i) => {
      const section = i === 0 ? null : part.split("\n")[0].trim();
      const text = textOnly(i === 0 ? part : part.slice(part.indexOf("\n") + 1));
      const [t, h, body] = [plain(pageTitle), plain(section ?? ""), plain(text)];
      if (!words.every((w) => t.includes(w) || h.includes(w) || body.includes(w))) return;
      const points = words.reduce((s, w) => s + (h.includes(w) ? 12 : 0) + (t.includes(w) ? 8 : 0) + Math.min(5, body.split(w).length - 1), 0) + (i === 0 ? 1 : 0);
      const at = Math.max(0, Math.min(...words.map((w) => body.indexOf(w)).filter((n) => n >= 0), body.length));
      const from = at > 60 ? text.lastIndexOf(" ", at - 40) + 1 : 0;
      const excerpt = (from > 0 ? "… " : "") + text.slice(from, from + 140).trim() + (from + 140 < text.length ? " …" : "");
      results.push({ page, pageTitle, section, href: `/ayuda/${page}${section ? `#${slug(section)}` : ""}`, excerpt, points });
    });
  }
  return results
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map(({ points: _, ...hit }) => hit);
}
