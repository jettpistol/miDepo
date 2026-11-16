import type { TipoProducto } from "@/db/schema";

/** Lo que miDepo lee de Fierro. Los `id` son los identificadores de Fierro, no los nuestros. */
export type LibroFierro = {
  id: string;
  codigoInterno: string;
  isbn: string | null;
  codigoBarras: string;
  titulo: string;
  autor: string;
  sello: string;
  tipo: TipoProducto;
  precio: number;
  pesoGramos: number;
};
export type ClienteFierro = { id: string; nombre: string; direccion: string; localidad: string; provincia: string };
export type LineaFierro = { libroId: string; cantidad: number };
export type PedidoFierro = {
  id: string;
  numero: string;
  clienteId: string;
  modalidad: "firme" | "consignacion";
  fecha: Date;
  lineas: LineaFierro[];
};
export type IngresoFierro = { id: string; numero: string; proveedor: string; fecha: Date; lineas: LineaFierro[] };

/** Lo que miDepo le devuelve a Fierro: cuánto cambió el stock de cada título y por qué. */
export type DocumentoFierro = {
  tipo: "despacho" | "recepcion" | "devolucion" | "conteo";
  referencia: string;
  lineas: { productoId: number; delta: number }[];
};

/**
 * Frontera con Fierro. Hoy la única implementación es la simulada; el conector real
 * (API B2B, vistas de "acceso a datos" o archivos) tiene que cumplir esta misma interfaz
 * y el resto de miDepo no se entera del cambio.
 */
export interface ConectorFierro {
  readonly modo: "simulado" | "real";
  libros(): Promise<LibroFierro[]>;
  clientes(): Promise<ClienteFierro[]>;
  pedidosPendientes(): Promise<PedidoFierro[]>;
  ingresosEsperados(): Promise<IngresoFierro[]>;
  /** Stock total por título según Fierro (clave: id de Fierro). */
  stock(): Promise<Map<string, number>>;
  /** Informa a Fierro un documento terminado en el depósito. */
  enviar(doc: DocumentoFierro): Promise<void>;
}
