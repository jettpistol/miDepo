import { and, asc, desc, eq, gt, like, ne, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { pedidoLineas, pedidos, productos, recepcionLineas, recepciones, stock, tareasPicking, ubicaciones } from "@/db/schema";
import { MAXIMO_CONTEO } from "./flujos/conteos";
import { nombreUbicacion } from "./stock";

/**
 * Ensayo de un formulario de escaneo: revisa lo escrito con las mismas reglas que la acción real,
 * antes de confirmar, y sugiere qué escribir. No cambia nada; la acción vuelve a validar todo.
 */
export type Estado = { tono: "ok" | "alerta" | "peligro"; texto: string };
export type Sugerencia = { valor: string; tipo: "ubicacion" | "producto"; titulo: string; detalle?: string };
/** Un valor que se puede poner con un toque: "Está en A-01-1", "Todas: 60". */
export type Atajo = { campo: string; valor: string; texto: string; tejuelo?: boolean; sufijo?: string };
export type Consulta = { estados: Record<string, Estado>; sugerencias: Sugerencia[]; atajos: Atajo[] };

const UBICACIONES = ["origen", "destino", "ubicacion"];
/** En picking y empaque el escaneo comprueba el libro que se tiene en la mano: ahí no se sugiere. */
const SIN_SUGERENCIAS = ["picking", "empaque"];
const limpio = (q: string) => q.replace(/[%_\\]/g, "");

/** "cronicas luna" encuentra "Crónicas de la Luna Roja": sin tildes, sin mayúsculas y con palabras salteadas. */
export function contiene(columna: AnyColumn, texto: string): SQL {
  const plano = limpio(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return sql`translate(lower(${columna}), 'áéíóúüñ', 'aeiouun') like ${`%${plano.split(/\s+/).join("%")}%`}`;
}
const unidades = (n: number) => (n === 1 ? "1 unidad" : `${n} unidades`);

export async function consultar(db: DB, empresaId: number, p: URLSearchParams): Promise<Consulta> {
  const v = (k: string) => (p.get(k) ?? "").trim();
  const ctx = v("ctx");
  const estados: Record<string, Estado> = {};
  const atajos: Atajo[] = [];
  const sugerencias: Sugerencia[] = [];

  if (ctx === "conteo-nuevo") {
    const pre = limpio(v("prefijo")).toUpperCase();
    if (pre) {
      const filas = await db
        .select({ id: ubicaciones.id })
        .from(ubicaciones)
        .where(and(eq(ubicaciones.empresaId, empresaId), eq(ubicaciones.tipo, "estanteria"), eq(ubicaciones.activa, true), like(ubicaciones.codigo, `${pre}%`)))
        .limit(MAXIMO_CONTEO + 1);
      estados.prefijo =
        filas.length === 0
          ? { tono: "peligro", texto: `Ninguna ubicación empieza con "${pre}".` }
          : filas.length > MAXIMO_CONTEO
            ? { tono: "peligro", texto: `Son más de ${MAXIMO_CONTEO}. Partí el conteo en tramos más chicos.` }
            : { tono: "ok", texto: filas.length === 1 ? "1 ubicación" : `${filas.length} ubicaciones` };
    }
    return { estados, sugerencias, atajos };
  }

  const buscaProducto = (q: string): SQL => {
    const c = limpio(q);
    return or(like(productos.codigoBarras, `${c}%`), like(productos.isbn, `${c}%`), like(productos.codigoInterno, `${c.toUpperCase()}%`), contiene(productos.titulo, c), contiene(productos.autor, c))!;
  };

  async function ubicacion(codigo: string) {
    if (!codigo) return null;
    const [u] = await db.select().from(ubicaciones).where(and(eq(ubicaciones.empresaId, empresaId), eq(ubicaciones.codigo, codigo.toUpperCase()))).limit(1);
    return u ?? null;
  }
  async function producto(codigo: string) {
    if (!codigo) return null;
    const [x] = await db
      .select()
      .from(productos)
      .where(and(eq(productos.empresaId, empresaId), or(eq(productos.codigoBarras, codigo), eq(productos.isbn, codigo), eq(productos.codigoInterno, codigo.toUpperCase()))))
      .limit(1);
    return x ?? null;
  }
  /** Dónde está un título, de más a menos unidades. */
  const dondeEsta = (productoId: number, soloEstantes = false) =>
    db
      .select({ id: ubicaciones.id, codigo: ubicaciones.codigo, tipo: ubicaciones.tipo, cantidad: stock.cantidad })
      .from(stock)
      .innerJoin(ubicaciones, eq(ubicaciones.id, stock.ubicacionId))
      .where(and(eq(stock.productoId, productoId), gt(stock.cantidad, 0), eq(ubicaciones.activa, true), soloEstantes ? eq(ubicaciones.tipo, "estanteria") : ne(ubicaciones.tipo, "preparacion")))
      .orderBy(desc(stock.cantidad))
      .limit(8);

  /** Estado de un campo de ubicación: si existe, si está activa y cuánto tiene. */
  async function revisarUbicacion(campo: string, u: Awaited<ReturnType<typeof ubicacion>>) {
    const texto = v(campo);
    if (!texto) return;
    if (!u) {
      // Mientras lo escrito sea el comienzo de algún código, todavía se está escribiendo.
      const [empieza] = await db.select({ id: ubicaciones.id }).from(ubicaciones).where(and(eq(ubicaciones.empresaId, empresaId), like(ubicaciones.codigo, `${limpio(texto).toUpperCase()}%`))).limit(1);
      if (!empieza) estados[campo] = { tono: "peligro", texto: `No existe la ubicación "${texto.toUpperCase()}".` };
      return;
    }
    if (!u.activa) return void (estados[campo] = { tono: "peligro", texto: `"${u.codigo}" está dada de baja.` });
    const [hay] = await db.select({ titulos: sql<number>`count(*)`.mapWith(Number), n: sql<number>`coalesce(sum(${stock.cantidad}), 0)`.mapWith(Number) }).from(stock).where(and(eq(stock.ubicacionId, u.id), gt(stock.cantidad, 0)));
    const nombre = u.tipo === "estanteria" ? "" : `${nombreUbicacion(u)} · `;
    estados[campo] = { tono: "ok", texto: hay.n === 0 ? `${nombre}Vacía` : `${nombre}${hay.titulos === 1 ? "1 título" : `${hay.titulos} títulos`} · ${unidades(hay.n)}` };
  }
  /** Si el código no es de ningún libro y tampoco se parece a ninguno, se avisa. */
  async function desconocido(texto: string) {
    if (texto.length < 3) return;
    const [parecido] = await db.select({ id: productos.id }).from(productos).where(and(eq(productos.empresaId, empresaId), buscaProducto(texto))).limit(1);
    if (!parecido) estados.producto = { tono: "peligro", texto: `No conozco "${texto}". Si es un título nuevo, sincronizá con Fierro.` };
  }

  const n = Number(v("cantidad"));
  const cantidad = Number.isInteger(n) && n > 0 ? n : null;
  const libro = await producto(v("producto"));
  if (v("producto") && !libro) await desconocido(v("producto"));

  let origen: Awaited<ReturnType<typeof ubicacion>> = null;

  if (ctx === "mover" || ctx === "guardar") {
    origen = await ubicacion(v("origen"));
    const destino = await ubicacion(v("destino"));
    await revisarUbicacion("origen", origen);
    await revisarUbicacion("destino", destino);
    for (const [campo, u] of [["origen", origen], ["destino", destino]] as const) {
      if (u?.activa && u.tipo === "preparacion") estados[campo] = { tono: "peligro", texto: "Los pedidos preparados no se mueven a mano." };
    }
    if (origen && destino && origen.id === destino.id) estados.destino = { tono: "peligro", texto: "Es el mismo lugar que el origen." };

    if (libro) {
      const lugares = await dondeEsta(libro.id);
      if (origen?.activa) {
        const hay = lugares.find((l) => l.id === origen!.id)?.cantidad ?? 0;
        if (hay === 0) {
          estados.producto = { tono: "peligro", texto: `"${libro.titulo}" no está en ${nombreUbicacion(origen)}.` };
        } else {
          estados.producto = { tono: "ok", texto: `${libro.titulo} · hay ${hay} en ${nombreUbicacion(origen)}` };
          if (hay > 1 && cantidad !== hay) atajos.push({ campo: "cantidad", valor: String(hay), texto: `Todas: ${hay}` });
          if (cantidad && cantidad > hay) estados.cantidad = { tono: "peligro", texto: `En ${nombreUbicacion(origen)} hay ${hay}.` };
        }
      } else {
        estados.producto = { tono: "ok", texto: libro.titulo };
      }
      // Lo que resuelve el problema, a un toque: de dónde sacarlo y dónde ya vive.
      if (ctx === "mover" && (!origen || estados.producto.tono === "peligro")) {
        for (const l of lugares.slice(0, 3)) atajos.push({ campo: "origen", valor: l.codigo, texto: "Está en", tejuelo: true, sufijo: `· ${l.cantidad}` });
      }
      if (!v("destino")) {
        const vive = lugares.find((l) => l.tipo === "estanteria" && l.id !== origen?.id);
        if (vive) atajos.push({ campo: "destino", valor: vive.codigo, texto: "Ya hay en", tejuelo: true });
      }
    }
  } else if (ctx === "picking") {
    const [t] = await db
      .select({ t: tareasPicking, codigo: ubicaciones.codigo })
      .from(tareasPicking)
      .innerJoin(pedidos, eq(pedidos.id, tareasPicking.pedidoId))
      .leftJoin(ubicaciones, eq(ubicaciones.id, tareasPicking.ubicacionId))
      .where(and(eq(tareasPicking.id, Number(v("tareaId"))), eq(pedidos.empresaId, empresaId)));
    if (t) {
      const u = await ubicacion(v("ubicacion"));
      await revisarUbicacion("ubicacion", u);
      if (u?.activa) estados.ubicacion = u.id === t.t.ubicacionId ? { tono: "ok", texto: "Es el estante de esta parada" } : { tono: "peligro", texto: `Estás en ${u.codigo}. Esta parada es en ${t.codigo}.` };
      if (libro) estados.producto = libro.id === t.t.productoId ? { tono: "ok", texto: libro.titulo } : { tono: "peligro", texto: `Ese es "${libro.titulo}". No es el título de esta parada.` };
      const pendiente = t.t.cantidad - t.t.pickeado;
      if (cantidad && cantidad > pendiente) estados.cantidad = { tono: "peligro", texto: `Esta parada pide ${pendiente}.` };
    }
  } else if (ctx === "recepcion" && libro) {
    const [r] = await db.select().from(recepciones).where(and(eq(recepciones.id, Number(v("id"))), eq(recepciones.empresaId, empresaId)));
    estados.producto = { tono: "ok", texto: libro.titulo };
    if (r) {
      const [l] = await db.select().from(recepcionLineas).where(and(eq(recepcionLineas.recepcionId, r.id), eq(recepcionLineas.productoId, libro.id)));
      if (l && l.esperado > 0) {
        estados.producto = { tono: "ok", texto: `${libro.titulo} · van ${l.recibido} de ${l.esperado}` };
        if (cantidad && l.recibido + cantidad > l.esperado) estados.cantidad = { tono: "alerta", texto: `Con estas son ${l.recibido + cantidad - l.esperado} de más.` };
      } else if (l) {
        estados.producto = { tono: "ok", texto: `${libro.titulo} · van ${l.recibido}` };
      } else if (r.fierroId) {
        estados.producto = { tono: "alerta", texto: `${libro.titulo} · no está avisado en este ingreso` };
      }
    }
  } else if (ctx === "empaque" && libro) {
    const [l] = await db
      .select({ l: pedidoLineas })
      .from(pedidoLineas)
      .innerJoin(pedidos, eq(pedidos.id, pedidoLineas.pedidoId))
      .where(and(eq(pedidoLineas.pedidoId, Number(v("id"))), eq(pedidoLineas.productoId, libro.id), eq(pedidos.empresaId, empresaId)));
    const resta = l ? l.l.pickeado - l.l.empacado : 0;
    if (!l || l.l.pickeado === 0) estados.producto = { tono: "peligro", texto: `"${libro.titulo}" no está entre lo preparado para este pedido.` };
    else if (resta === 0) estados.producto = { tono: "peligro", texto: `Ya empacaste todas las unidades de "${libro.titulo}".` };
    else {
      estados.producto = { tono: "ok", texto: `${libro.titulo} · quedan ${resta} por empacar` };
      if (resta > 1 && cantidad !== resta) atajos.push({ campo: "cantidad", valor: String(resta), texto: `Todas: ${resta}` });
      if (cantidad && cantidad > resta) estados.cantidad = { tono: "peligro", texto: `Quedan ${resta} por empacar.` };
    }
  } else if (libro) {
    estados.producto = { tono: "ok", texto: libro.titulo };
  }

  // Sugerencias para el campo en el que se está escribiendo.
  const campo = v("campo");
  if (campo && !SIN_SUGERENCIAS.includes(ctx)) {
    const q = v(campo);
    if (UBICACIONES.includes(campo)) {
      const vistos = new Set<string>();
      const pre = limpio(q).toUpperCase();
      // Primero, los lugares donde ya está el libro elegido.
      if (libro && (ctx === "mover" || ctx === "guardar")) {
        for (const l of await dondeEsta(libro.id, campo === "destino")) {
          if (!l.codigo.startsWith(pre) || (campo === "destino" && l.id === origen?.id)) continue;
          vistos.add(l.codigo);
          sugerencias.push({ valor: l.codigo, tipo: "ubicacion", titulo: l.codigo, detalle: campo === "origen" ? `${l.cantidad} de este título` : `ya hay ${l.cantidad}` });
        }
      }
      if (pre) {
        const filas = await db.select({ codigo: ubicaciones.codigo }).from(ubicaciones).where(and(eq(ubicaciones.empresaId, empresaId), eq(ubicaciones.activa, true), ne(ubicaciones.tipo, "preparacion"), like(ubicaciones.codigo, `${pre}%`))).orderBy(asc(ubicaciones.codigo)).limit(8);
        for (const f of filas) if (!vistos.has(f.codigo)) sugerencias.push({ valor: f.codigo, tipo: "ubicacion", titulo: f.codigo });
      }
    } else if (campo === "producto") {
      const codigos = (x: { codigoBarras: string; autor: string | null }) => [x.codigoBarras, x.autor].filter(Boolean).join(" · ");
      if ((ctx === "mover" || ctx === "guardar") && origen?.activa) {
        // Solo lo que de verdad está en el origen: cualquier otra cosa no se podría mover.
        const filas = await db
          .select({ codigoBarras: productos.codigoBarras, titulo: productos.titulo, autor: productos.autor, cantidad: stock.cantidad })
          .from(stock)
          .innerJoin(productos, eq(productos.id, stock.productoId))
          .where(and(eq(stock.ubicacionId, origen.id), gt(stock.cantidad, 0), q ? buscaProducto(q) : undefined))
          .orderBy(asc(productos.titulo))
          .limit(8);
        for (const f of filas) sugerencias.push({ valor: f.codigoBarras, tipo: "producto", titulo: f.titulo, detalle: `${f.codigoBarras} · hay ${f.cantidad}` });
      } else if (q.length >= 2) {
        const filas = await db.select({ codigoBarras: productos.codigoBarras, titulo: productos.titulo, autor: productos.autor }).from(productos).where(and(eq(productos.empresaId, empresaId), buscaProducto(q))).orderBy(asc(productos.titulo)).limit(8);
        for (const f of filas) sugerencias.push({ valor: f.codigoBarras, tipo: "producto", titulo: f.titulo, detalle: codigos(f) });
      }
    }
  }
  // Si lo único que queda por sugerir es lo que ya está escrito, no hay nada que sugerir.
  if (sugerencias.length === 1 && sugerencias[0].valor.toUpperCase() === v(campo).toUpperCase()) sugerencias.length = 0;

  return { estados, sugerencias: sugerencias.slice(0, 8), atajos };
}
