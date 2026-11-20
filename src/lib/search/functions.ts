import type { Role } from "@/db/schema";
import type { IconName } from "@/components/Icon";
import { MENU } from "@/lib/menu";
import { KEYS, NAV } from "@/lib/hotkeys";
import { can } from "@/lib/session";
import { distance, plain } from "@/lib/text";

/**
 * Everything the "Funciones" tab of the top search can open: screens, actions on a screen and
 * settings. Screens come from MENU so they cannot drift from the sidebar. `words` are the other
 * ways people say it (warehouse words, English, common slips); they are matched but not shown.
 */
export type Feature = {
  title: string;
  /** Where it lives, shown under the title: ["Mi cuenta", "Apariencia"]. */
  path: string[];
  href: string;
  icon: IconName;
  words?: string;
  minRole?: Role;
  /** Its keyboard shortcut, shown at the right ("Alt + 3", "F10"). */
  keys?: string;
};

const screenKeys = Object.fromEntries(Object.entries(NAV).map(([d, href]) => [href, `Alt + ${d}`]));

const SCREEN_WORDS: Record<string, string> = {
  "/": "inicio home tablero resumen hoy",
  "/recepcion": "recibir ingreso entrada llegada proveedor remito compra mercaderia",
  "/reposicion": "guardar ubicar acomodar estante put away putaway",
  "/picking": "pedidos preparar sacar recoger orden ventas",
  "/empaque": "empacar cajas embalar despacho envio packing",
  "/devoluciones": "devolucion retorno vuelve cliente consignacion",
  "/conteos": "contar inventario recuento ciclico auditoria",
  "/mover": "transferir trasladar cambiar lugar reubicar",
  "/stock": "existencias inventario articulos libros titulos buscar disponible",
  "/ubicaciones": "estantes tejuelos lugares zonas etiquetas",
  "/bajas": "faltantes danados roturas perdidas ajustes write off",
  "/fierro": "sincronizar exportar csv enviar documentos integracion erp",
  "/usuarios": "personas empleados roles permisos pin altas operadores",
  "/ayuda": "manual guia ayuda documentacion",
};

const screens: Feature[] = MENU.flatMap((g) =>
  g.items.map((i) => ({ title: i.name, path: [g.group], href: i.href, icon: i.icon, words: `${i.help} ${SCREEN_WORDS[i.href] ?? ""}`, minRole: i.minRole, keys: screenKeys[i.href] })),
);

const more: Feature[] = [
  // Actions on a screen. "#nueva" opens that screen's "+ Nueva" panel.
  { title: "Nueva recepción sin aviso", path: ["Recepción", "+ Nueva"], href: "/recepcion#nueva", icon: "plus", words: "crear recepcion ingreso sin aviso", keys: KEYS.create },
  { title: "Nueva devolución", path: ["Devoluciones", "+ Nueva"], href: "/devoluciones#nueva", icon: "plus", words: "crear devolucion retorno", keys: KEYS.create },
  { title: "Nuevo conteo", path: ["Conteos"], href: "/conteos#nuevo", icon: "plus", words: "crear conteo contar rango inventario", minRole: "supervisor" },
  { title: "Generar ubicaciones", path: ["Ubicaciones", "Generador de ubicaciones"], href: "/ubicaciones#generador", icon: "locations", words: "crear estantes pasillos niveles", minRole: "supervisor" },
  { title: "Agregar una ubicación suelta", path: ["Ubicaciones"], href: "/ubicaciones#suelta", icon: "plus", words: "crear ubicacion estante", minRole: "supervisor" },
  { title: "Imprimir etiquetas de ubicaciones", path: ["Ubicaciones"], href: "/imprimir/ubicaciones", icon: "print", words: "tejuelos etiquetas imprimir estantes", minRole: "supervisor" },
  { title: "Imprimir etiquetas sin ISBN", path: ["Ubicaciones"], href: "/imprimir/productos", icon: "print", words: "codigo interno barras grapas etiquetas", minRole: "supervisor" },
  { title: "Traer novedades de Fierro", path: ["Fierro"], href: "/fierro#traer", icon: "fierro", words: "sincronizar actualizar catalogo pedidos", minRole: "supervisor" },
  { title: "Documentos para cargar en Fierro", path: ["Fierro"], href: "/fierro#cargar", icon: "download", words: "exportar csv enviar informar", minRole: "supervisor" },
  { title: "Conciliación con Fierro", path: ["Fierro", "Conciliación"], href: "/fierro/conciliacion", icon: "fierro", words: "diferencias comparar stock conciliar", minRole: "supervisor" },
  { title: "Sumar a alguien", path: ["Usuarios"], href: "/usuarios#sumar", icon: "users", words: "crear usuario alta persona empleado", minRole: "admin" },
  // Settings: "Mi cuenta" opens from the person's name, so it is only reachable from here and the menu.
  { title: "Mi cuenta", path: ["Configuración"], href: "/cuenta", icon: "account", words: "perfil configuracion ajustes preferencias settings" },
  { title: "Foto de perfil", path: ["Mi cuenta"], href: "/cuenta#foto", icon: "camera", words: "avatar imagen cara" },
  { title: "Color de acento", path: ["Mi cuenta", "Apariencia"], href: "/cuenta#apariencia", icon: "account", words: "colores tema personalizar" },
  { title: "Letra", path: ["Mi cuenta", "Apariencia"], href: "/cuenta#apariencia", icon: "account", words: "fuente tipografia tamano texto font" },
  { title: "Tema claro u oscuro", path: ["Mi cuenta", "Apariencia"], href: "/cuenta#apariencia", icon: "account", words: "modo oscuro noche dark light" },
  { title: "Huella, rostro o llave", path: ["Mi cuenta"], href: "/cuenta#llaves", icon: "account", words: "passkey llave de acceso biometria touch id face id" },
  { title: "Cambiar contraseña", path: ["Mi cuenta", "Contraseña"], href: "/cuenta#contrasena", icon: "account", words: "clave password" },
  { title: "PIN del depósito", path: ["Mi cuenta", "PIN"], href: "/cuenta#pin", icon: "account", words: "codigo numerico clave" },
  { title: "Cambiar de cuenta", path: ["Configuración"], href: "/mas", icon: "users", words: "otra cuenta usuario salir cerrar sesion logout" },
  { title: "Atajos de teclado", path: ["Manual"], href: "/ayuda/Atajos-de-teclado", icon: "help", words: "teclas f1 shortcuts", keys: KEYS.help },
];

export const FEATURES: Feature[] = [...screens, ...more];

/** The words of a text, without accents or capitals. */
const words = (s: string) => plain(s).split(/[^a-z0-9ñ]+/).filter(Boolean);

/**
 * How well one typed word matches a list of words: the start of a word counts most, a word
 * inside another less, and one wrong letter in a longer word still counts ("recpcion").
 */
function wordScore(typed: string, against: string[]) {
  let best = 0;
  for (const w of against) {
    if (w === typed) return 3;
    if (w.startsWith(typed)) best = Math.max(best, 2.5);
    else if (typed.length >= 3 && w.includes(typed)) best = Math.max(best, 1.5);
    else if (typed.length >= 4 && Math.abs(w.length - typed.length) <= 1 && distance(w, typed) <= 1) best = Math.max(best, 1);
  }
  return best;
}

/** Features the role may use that match every typed word, best first. */
export function searchFeatures(q: string, role: Role, limit = 12): Feature[] {
  const typed = words(q);
  if (typed.length === 0) return [];
  const scored: { f: Feature; points: number }[] = [];
  for (const f of FEATURES) {
    if (!can(role, f.minRole ?? "operator")) continue;
    const title = words(f.title);
    const rest = words(`${f.path.join(" ")} ${f.words ?? ""}`);
    let points = 0;
    for (const t of typed) {
      const s = Math.max(wordScore(t, title) * 2, wordScore(t, rest));
      if (s === 0) {
        points = 0;
        break;
      }
      points += s;
    }
    // A screen ranks over an action or setting with the same score.
    if (points > 0) scored.push({ f, points: points + (f.path.length === 1 && screens.includes(f) ? 0.5 : 0) });
  }
  return scored.sort((a, b) => b.points - a.points).slice(0, limit).map((s) => s.f);
}
