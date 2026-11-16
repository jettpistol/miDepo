import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const creado = () => timestamp("creado", { withTimezone: true }).notNull().defaultNow();

// ───────────── Empresas y usuarios ─────────────

export const empresas = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  /** Código corto que los operarios escriben una sola vez en el teléfono para entrar con PIN. */
  slug: text("slug").notNull().unique(),
  /** Esquema de nombres de ubicaciones elegido (ver src/lib/ubicaciones.ts). */
  esquemaUbicaciones: jsonb("esquema_ubicaciones"),
  /** Estado del Fierro simulado: cuántos pedidos e ingresos "existen" del otro lado. */
  simPedidos: integer("sim_pedidos").notNull().default(0),
  simIngresos: integer("sim_ingresos").notNull().default(0),
  simSemilla: integer("sim_semilla").notNull().default(1),
  simTitulos: integer("sim_titulos").notNull().default(500),
  simClientes: integer("sim_clientes").notNull().default(60),
  ultimaSync: timestamp("ultima_sync", { withTimezone: true }),
  creado: creado(),
});

export type Rol = "operario" | "supervisor" | "admin";

export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    nombre: text("nombre").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    /** HMAC del PIN: permite identificar al operario solo con el PIN dentro de su empresa. */
    pinHmac: text("pin_hmac"),
    rol: text("rol").$type<Rol>().notNull().default("operario"),
    acento: text("acento").notNull().default("#002FA7"),
    tema: text("tema").$type<"claro" | "oscuro" | "sistema">().notNull().default("sistema"),
    activo: boolean("activo").notNull().default(true),
    creado: creado(),
  },
  (t) => [uniqueIndex("usuarios_pin").on(t.empresaId, t.pinHmac)],
);

export const sesiones = pgTable("sesiones", {
  tokenHash: text("token_hash").primaryKey(),
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  expira: timestamp("expira", { withTimezone: true }).notNull(),
  creado: creado(),
});

export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(), // credential ID (base64url)
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  clavePublica: text("clave_publica").notNull(), // base64url
  contador: integer("contador").notNull().default(0),
  transportes: text("transportes"),
  nombre: text("nombre").notNull().default("Llave de acceso"),
  creado: creado(),
});

export const intentosLogin = pgTable("intentos_login", {
  clave: text("clave").primaryKey(),
  cantidad: integer("cantidad").notNull().default(0),
  bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }),
});

// ───────────── Espejo de Fierro (solo lectura para miDepo) ─────────────

export type TipoProducto = "libro" | "grapa" | "variante" | "pack";

export const productos = pgTable(
  "productos",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    fierroId: text("fierro_id").notNull(),
    codigoInterno: text("codigo_interno").notNull(),
    isbn: text("isbn"),
    /** Lo que lee el lector: EAN/ISBN impreso, o el código interno si el artículo no tiene ISBN. */
    codigoBarras: text("codigo_barras").notNull(),
    titulo: text("titulo").notNull(),
    autor: text("autor"),
    sello: text("sello"),
    tipo: text("tipo").$type<TipoProducto>().notNull().default("libro"),
    precio: integer("precio").notNull().default(0),
    pesoGramos: integer("peso_gramos").notNull().default(300),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [
    uniqueIndex("productos_fierro").on(t.empresaId, t.fierroId),
    index("productos_barras").on(t.empresaId, t.codigoBarras),
    index("productos_isbn").on(t.empresaId, t.isbn),
    index("productos_interno").on(t.empresaId, t.codigoInterno),
  ],
);

export const clientes = pgTable(
  "clientes",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    fierroId: text("fierro_id").notNull(),
    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    localidad: text("localidad"),
    provincia: text("provincia"),
  },
  (t) => [uniqueIndex("clientes_fierro").on(t.empresaId, t.fierroId)],
);

/** Stock que Fierro cree tener, por producto. Se compara contra miDepo en la conciliación. */
export const fierroStock = pgTable(
  "fierro_stock",
  {
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    cantidad: integer("cantidad").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.empresaId, t.productoId] })],
);

// ───────────── Lo que es propio de miDepo: ubicaciones y stock físico ─────────────

export type TipoUbicacion = "estanteria" | "recepcion" | "devoluciones" | "danados" | "saldos" | "preparacion";

export const ubicaciones = pgTable(
  "ubicaciones",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    codigo: text("codigo").notNull(),
    tipo: text("tipo").$type<TipoUbicacion>().notNull().default("estanteria"),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [uniqueIndex("ubicaciones_codigo").on(t.empresaId, t.codigo)],
);

export const stock = pgTable(
  "stock",
  {
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    ubicacionId: integer("ubicacion_id").notNull().references(() => ubicaciones.id),
    cantidad: integer("cantidad").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productoId, t.ubicacionId] }), index("stock_ubicacion").on(t.ubicacionId)],
);

export type MotivoMovimiento =
  | "inicial"
  | "recepcion"
  | "guardado"
  | "movimiento"
  | "picking"
  | "despacho"
  | "devolucion"
  | "ajuste_conteo";

export const movimientos = pgTable(
  "movimientos",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    desdeId: integer("desde_id").references(() => ubicaciones.id),
    haciaId: integer("hacia_id").references(() => ubicaciones.id),
    cantidad: integer("cantidad").notNull(),
    motivo: text("motivo").$type<MotivoMovimiento>().notNull(),
    referencia: text("referencia"),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    creado: creado(),
  },
  (t) => [index("movimientos_producto").on(t.productoId, t.creado)],
);

// ───────────── Salidas: pedidos, picking y cajas ─────────────

export type EstadoPedido = "pendiente" | "en_preparacion" | "preparado" | "empacado" | "despachado";

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    fierroId: text("fierro_id").notNull(),
    numero: text("numero").notNull(),
    clienteId: integer("cliente_id").notNull().references(() => clientes.id),
    modalidad: text("modalidad").$type<"firme" | "consignacion">().notNull().default("firme"),
    estado: text("estado").$type<EstadoPedido>().notNull().default("pendiente"),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    tomadoPor: integer("tomado_por").references(() => usuarios.id),
    enviadoAFierro: timestamp("enviado_a_fierro", { withTimezone: true }),
  },
  (t) => [uniqueIndex("pedidos_fierro").on(t.empresaId, t.fierroId), index("pedidos_estado").on(t.empresaId, t.estado)],
);

export const pedidoLineas = pgTable(
  "pedido_lineas",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    cantidad: integer("cantidad").notNull(),
    pickeado: integer("pickeado").notNull().default(0),
    empacado: integer("empacado").notNull().default(0),
  },
  (t) => [index("pedido_lineas_pedido").on(t.pedidoId)],
);

/** Una parada del recorrido: "andá a tal ubicación y tomá N de este título". */
export const tareasPicking = pgTable(
  "tareas_picking",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
    lineaId: integer("linea_id").notNull().references(() => pedidoLineas.id, { onDelete: "cascade" }),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    /** null = no había stock en ninguna estantería al armar el recorrido. */
    ubicacionId: integer("ubicacion_id").references(() => ubicaciones.id),
    cantidad: integer("cantidad").notNull(),
    pickeado: integer("pickeado").notNull().default(0),
    estado: text("estado").$type<"pendiente" | "hecha" | "faltante">().notNull().default("pendiente"),
  },
  (t) => [index("tareas_pedido").on(t.pedidoId)],
);

export const cajas = pgTable(
  "cajas",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    pedidoId: integer("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    pesoGramos: integer("peso_gramos"),
    estado: text("estado").$type<"abierta" | "cerrada">().notNull().default("abierta"),
  },
  (t) => [index("cajas_pedido").on(t.pedidoId)],
);

export const cajaItems = pgTable(
  "caja_items",
  {
    cajaId: integer("caja_id").notNull().references(() => cajas.id, { onDelete: "cascade" }),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    cantidad: integer("cantidad").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cajaId, t.productoId] })],
);

// ───────────── Entradas: recepciones y devoluciones ─────────────

export const recepciones = pgTable(
  "recepciones",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull().references(() => empresas.id),
    /** null = recepción sin aviso, creada en el depósito. */
    fierroId: text("fierro_id"),
    numero: text("numero").notNull(),
    proveedor: text("proveedor").notNull(),
    estado: text("estado").$type<"pendiente" | "en_curso" | "cerrada">().notNull().default("pendiente"),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    enviadoAFierro: timestamp("enviado_a_fierro", { withTimezone: true }),
  },
  (t) => [index("recepciones_estado").on(t.empresaId, t.estado)],
);

export const recepcionLineas = pgTable(
  "recepcion_lineas",
  {
    id: serial("id").primaryKey(),
    recepcionId: integer("recepcion_id").notNull().references(() => recepciones.id, { onDelete: "cascade" }),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    esperado: integer("esperado").notNull().default(0),
    recibido: integer("recibido").notNull().default(0),
  },
  (t) => [uniqueIndex("recepcion_lineas_prod").on(t.recepcionId, t.productoId)],
);

export type EstadoLibro = "vendible" | "danado" | "saldo";

export const devoluciones = pgTable("devoluciones", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  numero: text("numero").notNull(),
  clienteId: integer("cliente_id").notNull().references(() => clientes.id),
  estado: text("estado").$type<"en_curso" | "cerrada">().notNull().default("en_curso"),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  enviadoAFierro: timestamp("enviado_a_fierro", { withTimezone: true }),
});

export const devolucionLineas = pgTable(
  "devolucion_lineas",
  {
    devolucionId: integer("devolucion_id").notNull().references(() => devoluciones.id, { onDelete: "cascade" }),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    estadoLibro: text("estado_libro").$type<EstadoLibro>().notNull(),
    cantidad: integer("cantidad").notNull(),
  },
  (t) => [primaryKey({ columns: [t.devolucionId, t.productoId, t.estadoLibro] })],
);

// ───────────── Conteos cíclicos ─────────────

export const conteos = pgTable("conteos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  nombre: text("nombre").notNull(),
  estado: text("estado").$type<"abierto" | "cerrado">().notNull().default("abierto"),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  enviadoAFierro: timestamp("enviado_a_fierro", { withTimezone: true }),
});

export const conteoUbicaciones = pgTable(
  "conteo_ubicaciones",
  {
    conteoId: integer("conteo_id").notNull().references(() => conteos.id, { onDelete: "cascade" }),
    ubicacionId: integer("ubicacion_id").notNull().references(() => ubicaciones.id),
    estado: text("estado").$type<"pendiente" | "contada">().notNull().default("pendiente"),
    contadoPor: integer("contado_por").references(() => usuarios.id),
  },
  (t) => [primaryKey({ columns: [t.conteoId, t.ubicacionId] })],
);

export const conteoLineas = pgTable(
  "conteo_lineas",
  {
    conteoId: integer("conteo_id").notNull().references(() => conteos.id, { onDelete: "cascade" }),
    ubicacionId: integer("ubicacion_id").notNull().references(() => ubicaciones.id),
    productoId: integer("producto_id").notNull().references(() => productos.id),
    contado: integer("contado").notNull().default(0),
    /** Lo que decía el sistema al cerrar el conteo (queda como registro). */
    sistema: integer("sistema"),
  },
  (t) => [primaryKey({ columns: [t.conteoId, t.ubicacionId, t.productoId] })],
);

export const ahora = sql`now()`;
