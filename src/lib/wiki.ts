import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Marked } from "marked";

/**
 * The manual lives in the /wiki folder in GitHub wiki format (Home.md, _Sidebar.md,
 * one page per file). It is read here to show it inside miDepo at /ayuda.
 */
const FOLDER = path.join(process.cwd(), "wiki");

export function pages() {
  return readdirSync(FOLDER).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => f.slice(0, -3));
}

const isInternal = (href: string) => !/^([a-z]+:|\/|#)/i.test(href);

function render(md: string) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      // Links between wiki pages ("Picking") become /ayuda/Picking.
      link({ href, tokens }) {
        const destination = isInternal(href) ? `/ayuda/${href}` : href;
        const external = /^https?:/i.test(destination) ? ' target="_blank" rel="noreferrer"' : "";
        return `<a href="${destination}"${external}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
  return marked.parse(md, { async: false });
}

export function readPage(name: string) {
  if (!/^[\w-]+$/.test(name) || !pages().includes(name)) return null;
  const md = readFileSync(path.join(FOLDER, `${name}.md`), "utf8");
  const title = md.match(/^#\s+(.+)$/m)?.[1] ?? name.replace(/-/g, " ");
  return { title, html: render(md) };
}

export function readIndex() {
  return render(readFileSync(path.join(FOLDER, "_Sidebar.md"), "utf8"));
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

/** Searches the whole manual. Every word has to appear on the page. */
export function search(lookup: string): SearchHit[] {
  const words = plain(lookup).split(/\s+/).filter((p) => p.length > 1).slice(0, 6);
  if (words.length === 0) return [];
  const results: (SearchHit & { points: number })[] = [];
  for (const page of pages()) {
    const md = readFileSync(path.join(FOLDER, `${page}.md`), "utf8");
    const title = md.match(/^#\s+(.+)$/m)?.[1] ?? page.replace(/-/g, " ");
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

export function readFooter() {
  return render(readFileSync(path.join(FOLDER, "_Footer.md"), "utf8"));
}
