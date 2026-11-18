import type { Rol } from "@/db/schema";
import type { NombreIcono } from "@/components/Icono";

export type ItemMenu = { href: string; nombre: string; icono: NombreIcono; ayuda: string; minimo?: Rol; /** Módulo que puede apagarse (ver src/lib/modulos.ts). */ modulo?: string };

export const MENU: { grupo: string; items: ItemMenu[] }[] = [
  {
    grupo: "Trabajo del día",
    items: [
      { href: "/", nombre: "Inicio", icono: "inicio", ayuda: "Qué hay para hacer ahora" },
      { href: "/recepcion", nombre: "Recepción", icono: "recepcion", ayuda: "Contar lo que llega", modulo: "recepcion" },
      { href: "/guardar", nombre: "Guardar", icono: "guardar", ayuda: "Llevar lo recibido a su estante", modulo: "guardar" },
      { href: "/picking", nombre: "Picking", icono: "picking", ayuda: "Preparar pedidos", modulo: "picking" },
      { href: "/empaque", nombre: "Empaque", icono: "empaque", ayuda: "Armar las cajas", modulo: "empaque" },
      { href: "/devoluciones", nombre: "Devoluciones", icono: "devolucion", ayuda: "Revisar libros que vuelven", modulo: "devoluciones" },
      { href: "/conteos", nombre: "Conteos", icono: "conteo", ayuda: "Contar ubicaciones", modulo: "conteos" },
      { href: "/mover", nombre: "Mover", icono: "mover", ayuda: "Cambiar libros de lugar", modulo: "mover" },
      { href: "/stock", nombre: "Stock", icono: "stock", ayuda: "Buscar un título o una ubicación" },
    ],
  },
  {
    grupo: "Gestión",
    items: [
      { href: "/ubicaciones", nombre: "Ubicaciones", icono: "ubicaciones", ayuda: "Nombres y etiquetas de estantes", minimo: "supervisor" },
      { href: "/fierro", nombre: "Fierro", icono: "fierro", ayuda: "Sincronizar y enviar documentos", minimo: "supervisor", modulo: "fierro" },
      { href: "/usuarios", nombre: "Usuarios", icono: "usuarios", ayuda: "Altas, roles y PIN", minimo: "admin" },
      { href: "/ajustes", nombre: "Ajustes", icono: "ubicaciones", ayuda: "Modo de trabajo y módulos activos", minimo: "admin" },
    ],
  },
  {
    grupo: "Ayuda",
    // "Mi cuenta" no está acá: se abre tocando el nombre y la foto de la persona.
    items: [{ href: "/ayuda", nombre: "Manual", icono: "ayuda", ayuda: "Paso a paso, con buscador" }],
  },
];
