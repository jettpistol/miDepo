import { Marked } from "marked";

/**
 * Turns a manual page (GitHub wiki Markdown) into HTML. Runs on the server for /ayuda and in the
 * browser for the editor's preview, so both show exactly the same thing.
 *
 * Pages can be written by administrators, so nothing in them may run in the reader's browser:
 * raw HTML is shown as text and only ordinary link and image addresses are kept.
 */

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A link to another manual page: "Picking" or "Picking#atajos". */
export const isInternal = (href: string) => /^[\w-]+(#[\w-]*)?$/.test(href);
const SAFE = /^(https?:|mailto:|\/(?!\/)|#)/i;

/** "Si el libro no está" → "si-el-libro-no-esta": the anchor of a section. */
export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function renderMarkdown(md: string) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      html: ({ text }) => escapeHtml(text),
      // Section headings get an id, so the top search can open a page at the right section.
      heading({ tokens, depth, text }) {
        const id = depth === 2 ? ` id="${slug(text)}"` : "";
        return `<h${depth}${id}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      // Links between wiki pages ("Picking") become /ayuda/Picking.
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const destination = isInternal(href) ? `/ayuda/${href}` : SAFE.test(href) ? href : null;
        if (!destination) return inner;
        const external = /^https?:/i.test(destination) ? ' target="_blank" rel="noreferrer"' : "";
        return `<a href="${escapeHtml(destination)}"${external}>${inner}</a>`;
      },
      image({ href, text }) {
        return /^(https?:|\/(?!\/))/i.test(href) ? `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}">` : escapeHtml(text);
      },
    },
  });
  return marked.parse(md, { async: false });
}

/** The page title: its first "# " line. */
export const titleOf = (md: string) => md.match(/^#\s+(.+)$/m)?.[1].trim() ?? null;
