import type { Role } from "@/db/schema";
import type { IconName } from "@/components/Icon";

export type MenuItem = { href: string; name: string; icon: IconName; help: string; minRole?: Role };

export const MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: "Trabajo del día",
    items: [
      { href: "/", name: "Inicio", icon: "home", help: "Qué hay para hacer ahora" },
      { href: "/recepcion", name: "Recepción", icon: "receiving", help: "Contar lo que llega" },
      { href: "/reposicion", name: "Reposición", icon: "putaway", help: "Llevar lo recibido a su ubicación" },
      { href: "/picking", name: "Picking", icon: "picking", help: "Preparar pedidos" },
      { href: "/empaque", name: "Empaque", icon: "packing", help: "Preparar las cajas" },
      { href: "/devoluciones", name: "Devoluciones", icon: "return", help: "Revisar artículos que vuelven" },
      { href: "/conteos", name: "Conteos", icon: "count", help: "Contar ubicaciones" },
      { href: "/mover", name: "Mover", icon: "move", help: "Cambiar artículos de ubicación" },
      { href: "/stock", name: "Stock", icon: "stock", help: "Buscar un artículo o una ubicación" },
    ],
  },
  {
    group: "Gestión",
    items: [
      { href: "/ubicaciones", name: "Ubicaciones", icon: "locations", help: "Nombres y etiquetas de ubicaciones", minRole: "supervisor" },
      { href: "/bajas", name: "Bajas", icon: "writeoff", help: "Faltantes, dañados y su historial", minRole: "supervisor" },
      { href: "/fierro", name: "Fierro", icon: "fierro", help: "Sincronizar y cargar documentos", minRole: "supervisor" },
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
