import type { Role } from "@/db/schema";
import type { IconName } from "@/components/Icon";

export type MenuItem = { href: string; name: string; icon: IconName; help: string; minRole?: Role };

export const MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: "Trabajo del día",
    items: [
      { href: "/", name: "Inicio", icon: "home", help: "Qué hay para hacer ahora" },
      { href: "/recepcion", name: "Recepción", icon: "receiving", help: "Contar lo que llega" },
      { href: "/reposicion", name: "Reposición", icon: "putaway", help: "Llevar lo recibido a su estante" },
      { href: "/picking", name: "Picking", icon: "picking", help: "Preparar pedidos" },
      { href: "/empaque", name: "Empaque", icon: "packing", help: "Armar las cajas" },
      { href: "/devoluciones", name: "Devoluciones", icon: "return", help: "Revisar libros que vuelven" },
      { href: "/conteos", name: "Conteos", icon: "count", help: "Contar ubicaciones" },
      { href: "/mover", name: "Mover", icon: "move", help: "Cambiar libros de lugar" },
      { href: "/stock", name: "Stock", icon: "stock", help: "Buscar un título o una ubicación" },
    ],
  },
  {
    group: "Gestión",
    items: [
      { href: "/ubicaciones", name: "Ubicaciones", icon: "locations", help: "Nombres y etiquetas de estantes", minRole: "supervisor" },
      { href: "/fierro", name: "Fierro", icon: "fierro", help: "Sincronizar y enviar documentos", minRole: "supervisor" },
      { href: "/usuarios", name: "Usuarios", icon: "users", help: "Altas, roles y PIN", minRole: "admin" },
    ],
  },
  {
    group: "Ayuda",
    // "Mi cuenta" is not here: it opens by tapping the person's name and photo.
    items: [{ href: "/ayuda", name: "Manual", icon: "help", help: "Paso a paso, con buscador" }],
  },
];
