import type { Rol } from "@/db/schema";
import type { NombreIcono } from "@/components/Icono";

export type ItemMenu = { href: string; nombre: string; icono: NombreIcono; ayuda: string; minimo?: Rol };

export const MENU: { grupo: string; items: ItemMenu[] }[] = [
  {
    grupo: "Trabajo del día",
    items: [
      { href: "/", nombre: "Inicio", icono: "inicio", ayuda: "Qué hay para hacer ahora" },
      { href: "/recepcion", nombre: "Recepción", icono: "recepcion", ayuda: "Contar lo que llega" },
      { href: "/guardar", nombre: "Guardar", icono: "guardar", ayuda: "Llevar lo recibido a su estante" },
      { href: "/picking", nombre: "Picking", icono: "picking", ayuda: "Preparar pedidos" },
      { href: "/empaque", nombre: "Empaque", icono: "empaque", ayuda: "Armar las cajas" },
      { href: "/devoluciones", nombre: "Devoluciones", icono: "devolucion", ayuda: "Revisar libros que vuelven" },
      { href: "/conteos", nombre: "Conteos", icono: "conteo", ayuda: "Contar ubicaciones" },
      { href: "/mover", nombre: "Mover", icono: "mover", ayuda: "Cambiar libros de lugar" },
      { href: "/stock", nombre: "Stock", icono: "stock", ayuda: "Buscar un título o una ubicación" },
    ],
  },
  {
    grupo: "Gestión",
    items: [
      { href: "/ubicaciones", nombre: "Ubicaciones", icono: "ubicaciones", ayuda: "Nombres y etiquetas de estantes", minimo: "supervisor" },
      { href: "/fierro", nombre: "Fierro", icono: "fierro", ayuda: "Sincronizar y enviar documentos", minimo: "supervisor" },
      { href: "/usuarios", nombre: "Usuarios", icono: "usuarios", ayuda: "Altas, roles y PIN", minimo: "admin" },
    ],
  },
  {
    grupo: "Vos",
    items: [
      { href: "/ayuda", nombre: "Ayuda", icono: "ayuda", ayuda: "Manual paso a paso" },
      { href: "/cuenta", nombre: "Mi cuenta", icono: "cuenta", ayuda: "Colores, clave y huella" },
    ],
  },
];
