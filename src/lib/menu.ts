import type { Role } from "@/db/schema";
import type { IconName } from "@/components/Icon";

/** `control`: shown only while Control is in use: the step is on (Organización) or a customer always goes through it. */
export type MenuItem = { href: string; name: string; icon: IconName; help: string; minRole?: Role; needs?: "control" };

export const MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: "Trabajo del día",
    items: [
      { href: "/", name: "Inicio", icon: "home", help: "Qué hay para hacer ahora" },
      { href: "/recepcion", name: "Recepción", icon: "receiving", help: "Contar lo que llega" },
      { href: "/reposicion", name: "Reposición", icon: "putaway", help: "Llevar lo recibido a su ubicación" },
      { href: "/picking", name: "Picking", icon: "picking", help: "Preparar pedidos" },
      { href: "/control", name: "Control", icon: "check", help: "Revisar lo preparado", needs: "control" },
      { href: "/empaque", name: "Empaque", icon: "packing", help: "Preparar las cajas" },
      { href: "/devoluciones", name: "Devoluciones", icon: "return", help: "Revisar artículos que vuelven" },
      { href: "/conteos", name: "Conteos", icon: "count", help: "Contar ubicaciones" },
      { href: "/mover", name: "Mover", icon: "move", help: "Cambiar artículos de ubicación" },
      { href: "/stock", name: "Stock", icon: "stock", help: "Buscar un artículo o una ubicación" },
    ],
  },
  {
    group: "Registros",
    items: [
      { href: "/pedidos", name: "Pedidos", icon: "orders", help: "Todos los pedidos, en cualquier estado" },
      { href: "/proveedores", name: "Proveedores", icon: "supplier", help: "Quién envía mercadería y sus recepciones" },
      { href: "/clientes", name: "Clientes", icon: "customer", help: "Clientes, sus pedidos y devoluciones" },
      { href: "/movimientos", name: "Movimientos", icon: "history", help: "Cada entrada, salida y cambio de lugar" },
    ],
  },
  {
    group: "Gestión",
    items: [
      { href: "/ubicaciones", name: "Ubicaciones", icon: "locations", help: "Nombres y etiquetas de ubicaciones", minRole: "supervisor" },
      { href: "/bajas", name: "Bajas", icon: "writeoff", help: "Faltantes, dañados y su historial", minRole: "supervisor" },
      { href: "/fierro", name: "Fierro", icon: "fierro", help: "Sincronizar y cargar documentos", minRole: "supervisor" },
    ],
  },
  {
    // The whole company's settings, apart from each person's own (Ajustes).
    group: "Organización",
    items: [
      { href: "/organizacion", name: "Organización", icon: "organization", help: "Nombre, código de empresa, control de pedidos y lotes", minRole: "supervisor" },
      { href: "/usuarios", name: "Usuarios", icon: "users", help: "Altas, roles y PIN", minRole: "admin" },
    ],
  },
  {
    group: "Ayuda y ajustes",
    items: [
      { href: "/ayuda", name: "Manual", icon: "help", help: "Paso a paso, con buscador" },
      // Also opens from the person's name and photo in the top bar.
      { href: "/cuenta", name: "Ajustes", icon: "settings", help: "Tema claro u oscuro, color, tipografía, foto, contraseña y PIN" },
    ],
  },
];

/** The menu this person sees: their role, and the steps their company has on. */
export function menuFor(role: Role, controlOn: boolean, can: (role: Role, min: Role) => boolean) {
  return MENU.map((g) => ({ ...g, items: g.items.filter((i) => can(role, i.minRole ?? "operator") && (i.needs !== "control" || controlOn)) })).filter((g) => g.items.length > 0);
}
