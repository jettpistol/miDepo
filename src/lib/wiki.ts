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
