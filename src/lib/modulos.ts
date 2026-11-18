import type { ModoEmpresa } from "@/db/schema";

/**
 * Partes de miDepo que cada empresa puede encender o apagar. Sirven para arrancar de a poco
 * (por ejemplo, solo recepción y conteos) en vez de cambiar todo el depósito un lunes.
 * Stock, ubicaciones y usuarios no se apagan.
 */
export const MODULOS = [
  { id: "recepcion", nombre: "Recepción", ayuda: "Contar lo que llega contra el aviso" },
  { id: "guardar", nombre: "Guardar", ayuda: "Llevar lo recibido a su estante" },
  { id: "picking", nombre: "Picking", ayuda: "Preparar pedidos" },
  { id: "empaque", nombre: "Empaque", ayuda: "Armar y cerrar las cajas" },
  { id: "devoluciones", nombre: "Devoluciones", ayuda: "Revisar y clasificar lo que vuelve" },
  { id: "conteos", nombre: "Conteos", ayuda: "Conteo cíclico por ubicaciones" },
  { id: "mover", nombre: "Mover", ayuda: "Cambiar libros de ubicación" },
  { id: "fierro", nombre: "Fierro", ayuda: "Sincronizar con Fierro y cargarle documentos" },
] as const;

export type IdModulo = (typeof MODULOS)[number]["id"];

type Config = { modo: ModoEmpresa; modulos: Record<string, boolean> | null };

/**
 * Sin configuración, todo está encendido, salvo la conexión con Fierro en una empresa
 * independiente (que no tiene Fierro). Lo que el administrador fijó a mano manda.
 */
export function moduloActivo(empresa: Config, id: string) {
  const fijado = empresa.modulos?.[id];
  if (typeof fijado === "boolean") return fijado;
  return id === "fierro" ? empresa.modo === "fierro" : true;
}
