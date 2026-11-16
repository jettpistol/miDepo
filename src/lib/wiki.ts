import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Marked } from "marked";

/**
 * El manual vive en la carpeta /wiki con formato de wiki de GitHub (Home.md, _Sidebar.md,
 * una página por archivo). Acá se lee para mostrarlo dentro de miDepo en /ayuda.
 */
const CARPETA = path.join(process.cwd(), "wiki");

export function paginas() {
  return readdirSync(CARPETA).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => f.slice(0, -3));
}

const esInterno = (href: string) => !/^([a-z]+:|\/|#)/i.test(href);

function render(md: string) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      // Los enlaces entre páginas del wiki ("Picking") pasan a ser /ayuda/Picking.
      link({ href, tokens }) {
        const destino = esInterno(href) ? `/ayuda/${href}` : href;
        const externo = /^https?:/i.test(destino) ? ' target="_blank" rel="noreferrer"' : "";
        return `<a href="${destino}"${externo}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
  return marked.parse(md, { async: false });
}

export function leerPagina(nombre: string) {
  if (!/^[\w-]+$/.test(nombre) || !paginas().includes(nombre)) return null;
  const md = readFileSync(path.join(CARPETA, `${nombre}.md`), "utf8");
  const titulo = md.match(/^#\s+(.+)$/m)?.[1] ?? nombre.replace(/-/g, " ");
  return { titulo, html: render(md) };
}

export function leerIndice() {
  return render(readFileSync(path.join(CARPETA, "_Sidebar.md"), "utf8"));
}

// ───────────── Búsqueda ─────────────

/** Sin acentos ni mayúsculas, para que "recepcion" encuentre "Recepción". */
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Quita el formato Markdown y deja solo el texto que lee una persona. */
function soloTexto(md: string) {
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

export type Hallazgo = { pagina: string; titulo: string; extractoHtml: string };

/** Busca en todo el manual. Todas las palabras tienen que aparecer en la página. */
export function buscar(consulta: string): Hallazgo[] {
  const palabras = plano(consulta).split(/\s+/).filter((p) => p.length > 1).slice(0, 6);
  if (palabras.length === 0) return [];
  const resultados: (Hallazgo & { puntos: number })[] = [];
  for (const pagina of paginas()) {
    const md = readFileSync(path.join(CARPETA, `${pagina}.md`), "utf8");
    const titulo = md.match(/^#\s+(.+)$/m)?.[1] ?? pagina.replace(/-/g, " ");
    const texto = soloTexto(md);
    const [tituloPlano, textoPlano] = [plano(titulo), plano(texto)];
    if (!palabras.every((p) => tituloPlano.includes(p) || textoPlano.includes(p))) continue;
    // Una coincidencia en el título vale mucho más que una en el cuerpo.
    const puntos = palabras.reduce((s, p) => s + (tituloPlano.includes(p) ? 20 : 0) + Math.min(10, textoPlano.split(p).length - 1), 0);
    const donde = Math.max(0, ...palabras.map((p) => textoPlano.indexOf(p)).filter((i) => i >= 0).slice(0, 1));
    const desde = Math.max(0, texto.lastIndexOf(" ", Math.max(0, donde - 70)));
    const trozo = (desde > 0 ? "… " : "") + texto.slice(desde, desde + 210).trim() + (desde + 210 < texto.length ? " …" : "");
    // El resaltado se hace sobre el texto ya escapado, comparando sin acentos letra por letra.
    let html = "";
    const trozoPlano = plano(trozo);
    for (let i = 0; i < trozo.length; ) {
      const p = trozoPlano.length === trozo.length ? palabras.find((w) => trozoPlano.startsWith(w, i)) : undefined;
      if (p) {
        html += `<mark>${escapar(trozo.slice(i, i + p.length))}</mark>`;
        i += p.length;
      } else html += escapar(trozo[i++]);
    }
    resultados.push({ pagina, titulo, extractoHtml: html, puntos });
  }
  return resultados.sort((a, b) => b.puntos - a.puntos || a.titulo.localeCompare(b.titulo));
}

export function leerPie() {
  return render(readFileSync(path.join(CARPETA, "_Footer.md"), "utf8"));
}
