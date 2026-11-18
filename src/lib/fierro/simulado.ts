import { and, eq, sql } from "drizzle-orm";
import type { Ejecutor } from "@/db";
import { fierroStock, productos } from "@/db/schema";
import type { TipoProducto } from "@/db/schema";
import type { ClienteFierro, ConectorFierro, DocumentoFierro, IngresoFierro, LibroFierro, PedidoFierro } from "./tipos";

/**
 * Fierro de mentira. Genera siempre los mismos datos a partir de una semilla, así las pruebas
 * son repetibles. Todos los títulos, autores y clientes son inventados.
 */

function azar(...semillas: number[]) {
  let a = semillas.reduce((h, s) => Math.imul(h ^ s, 0x9e3779b1) >>> 0, 0x811c9dc5);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const elegir = <T,>(r: () => number, lista: T[]) => lista[Math.floor(r() * lista.length)];
const entre = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

const INICIOS = ["Crónicas", "Leyendas", "Sombras", "Guardianes", "Hijos", "Cazadores", "Ecos", "Herederos", "Náufragos", "Centinelas", "Pilotos", "Brujas", "Detectives", "Samuráis", "Fantasmas", "Reinas", "Vagabundos", "Arquitectos", "Ladrones", "Jinetes"];
const FINALES = ["de la Luna Roja", "del Neón", "de la Última Ciudad", "del Abismo", "de Ceniza", "del Río de la Plata", "de Otro Planeta", "del Invierno Eterno", "de la Pampa Eléctrica", "del Subte B", "de Medianoche", "del Fin del Mundo", "de Papel", "del Puerto", "de la Tormenta", "del Sótano", "de Vidrio", "del Kilómetro Cero", "de la Niebla", "del Barrio Sur", "de Marte", "del Faro", "de la Cordillera", "del Tiempo Perdido", "de Hierro"];
const NOMBRES = ["Lucía", "Martín", "Sofía", "Tomás", "Valentina", "Joaquín", "Camila", "Nicolás", "Julieta", "Facundo", "Aiko", "Kenji", "Haruka", "Daniel", "Elena", "Bruno", "Mara", "Iván"];
const APELLIDOS = ["Ferreyra", "Quiroga", "Bianchi", "Sosa", "Aguirre", "Tanaka", "Morimoto", "Ledesma", "Ortiz", "Varela", "Castaño", "Ibarra", "Kowalski", "Méndez", "Paz", "Rivas"];
const SELLOS = ["Órbita Cómics", "Nébula Manga", "Cometa Novela Gráfica", "Satélite Infantil", "Clásicos del Espacio"];
const LOCALIDADES: [string, string][] = [["CABA", "Buenos Aires"], ["La Plata", "Buenos Aires"], ["Mar del Plata", "Buenos Aires"], ["Rosario", "Santa Fe"], ["Santa Fe", "Santa Fe"], ["Córdoba", "Córdoba"], ["Río Cuarto", "Córdoba"], ["Mendoza", "Mendoza"], ["San Miguel de Tucumán", "Tucumán"], ["Salta", "Salta"], ["Neuquén", "Neuquén"], ["Bariloche", "Río Negro"], ["Posadas", "Misiones"], ["Resistencia", "Chaco"], ["Paraná", "Entre Ríos"], ["Bahía Blanca", "Buenos Aires"]];
const CALLES = ["Av. Corrientes", "Av. Rivadavia", "San Martín", "Belgrano", "Mitre", "Sarmiento", "Av. Colón", "9 de Julio", "Moreno", "Lavalle", "Av. Santa Fe", "Urquiza"];
const LOCALES = ["Comiquería", "Librería", "Club del Cómic", "Mangas", "Historietas", "Libros"];
const APODOS = ["El Aleph", "Kamikaze", "La Viñeta", "Punto de Fuga", "El Baldío", "Tinta China", "Galaxia", "La Bestia Pop", "Trinchera", "El Oráculo", "Zona Fantasma", "Rayuela", "Onomatopeya", "El Globo", "Página Doble", "La Cueva"];
const PROVEEDORES = ["Imprenta Gráfica del Sur", "Talleres Latingráfica", "Importación marítima – contenedor", "Imprenta Kollor", "Devolución de feria", "Encuadernación Morón"];

function isbn13(n: number) {
  const base = "978987" + String(n % 1000000).padStart(6, "0");
  let suma = 0;
  for (let i = 0; i < 12; i++) suma += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  return base + ((10 - (suma % 10)) % 10);
}

export function generarLibro(semilla: number, i: number, prefijo: string): LibroFierro {
  // Cada serie tiene unos 15 números: los títulos vecinos pertenecen a la misma serie.
  const serieN = Math.floor(i / 15);
  const rs = azar(semilla, 1, serieN);
  const serie = `${INICIOS[serieN % INICIOS.length]} ${FINALES[Math.floor(serieN / INICIOS.length + serieN * 7) % FINALES.length]}`;
  const sello = elegir(rs, SELLOS);
  const autor = `${elegir(rs, NOMBRES)} ${elegir(rs, APELLIDOS)}`;
  const enGrapa = rs() < 0.22; // series que salen en revistas, sin ISBN
  const r = azar(semilla, 2, i);
  const numero = (i % 15) + 1;
  const dado = r();
  let tipo: TipoProducto = enGrapa ? "grapa" : "libro";
  let titulo = enGrapa ? `${serie} #${numero}` : `${serie} Vol. ${numero}`;
  if (!enGrapa && dado < 0.05) {
    tipo = "pack";
    titulo = `${serie} – Pack tomos ${numero} a ${numero + 2}`;
  } else if (dado > 0.94) {
    tipo = "variante";
    titulo += " (portada variante)";
  }
  const codigoInterno = `${prefijo}-${String(i + 1).padStart(6, "0")}`;
  const isbn = tipo === "libro" ? isbn13(semilla * 100000 + i) : null;
  return {
    id: `F${semilla}-L${i + 1}`,
    codigoInterno,
    isbn,
    codigoBarras: isbn ?? codigoInterno,
    titulo,
    autor,
    sello,
    tipo,
    precio: (tipo === "grapa" ? entre(r, 45, 90) : tipo === "pack" ? entre(r, 500, 900) : entre(r, 150, 420)) * 100,
    pesoGramos: tipo === "grapa" ? entre(r, 60, 110) : tipo === "pack" ? entre(r, 700, 1300) : entre(r, 180, 520),
  };
}

export function stockInicial(semilla: number, i: number) {
  const r = azar(semilla, 3, i);
  if (r() < 0.05) return 0;
  return r() < 0.7 ? entre(r, 4, 60) : entre(r, 60, 220);
}

export function generarCliente(semilla: number, i: number): ClienteFierro {
  const r = azar(semilla, 4, i);
  const [localidad, provincia] = elegir(r, LOCALIDADES);
  return {
    id: `F${semilla}-C${i + 1}`,
    nombre: `${elegir(r, LOCALES)} ${elegir(r, APODOS)}${i >= LOCALES.length * APODOS.length ? ` ${i}` : ""} (${localidad})`,
    direccion: `${elegir(r, CALLES)} ${entre(r, 100, 4900)}`,
    localidad,
    provincia,
  };
}

function lineas(r: () => number, semilla: number, nLibros: number, cuantas: number, min: number, max: number, soloConStock: boolean) {
  const usados = new Map<number, number>();
  let intentos = 0;
  while (usados.size < cuantas && intentos++ < cuantas * 20) {
    const idx = Math.floor(r() * nLibros);
    // Casi todos los pedidos piden títulos con stock; unos pocos no, para ejercitar los faltantes.
    if (soloConStock && stockInicial(semilla, idx) === 0 && r() > 0.03) continue;
    if (!usados.has(idx)) usados.set(idx, entre(r, min, max));
  }
  return [...usados].map(([idx, cantidad]) => ({ libroId: `F${semilla}-L${idx + 1}`, cantidad }));
}

export function generarPedido(semilla: number, i: number, nLibros: number, nClientes: number): PedidoFierro {
  const r = azar(semilla, 5, i);
  // Los pedidos entran uno cada 11 minutos: el número más bajo es siempre el más viejo.
  const fecha = new Date(Date.UTC(2026, 10, 2, 12, 0) + i * 11 * 60_000);
  return {
    id: `F${semilla}-P${i + 1}`,
    numero: `PED-${String(i + 1).padStart(5, "0")}`,
    clienteId: `F${semilla}-C${entre(r, 1, nClientes)}`,
    modalidad: r() < 0.35 ? "consignacion" : "firme",
    fecha,
    lineas: lineas(r, semilla, nLibros, entre(r, 2, 14), 1, 8, true),
  };
}

export function generarIngreso(semilla: number, i: number, nLibros: number): IngresoFierro {
  const r = azar(semilla, 6, i);
  return {
    id: `F${semilla}-I${i + 1}`,
    numero: `ING-${String(i + 1).padStart(4, "0")}`,
    proveedor: elegir(r, PROVEEDORES),
    fecha: new Date(Date.UTC(2026, 10, 3 + i, 8, 30)),
    lineas: lineas(r, semilla, nLibros, entre(r, 4, 18), 20, 240, false),
  };
}

export type EmpresaSim = { id: number; slug: string; simSemilla: number; simTitulos: number; simClientes: number; simPedidos: number; simIngresos: number };

export class FierroSimulado implements ConectorFierro {
  readonly modo = "simulado" as const;
  constructor(private db: Ejecutor, private e: EmpresaSim) {}

  private get prefijo() {
    return this.e.slug.slice(0, 3).toUpperCase();
  }
  async libros() {
    return Array.from({ length: this.e.simTitulos }, (_, i) => generarLibro(this.e.simSemilla, i, this.prefijo));
  }
  async clientes() {
    return Array.from({ length: this.e.simClientes }, (_, i) => generarCliente(this.e.simSemilla, i));
  }
  async pedidosPendientes() {
    return Array.from({ length: this.e.simPedidos }, (_, i) => generarPedido(this.e.simSemilla, i, this.e.simTitulos, this.e.simClientes));
  }
  async ingresosEsperados() {
    return Array.from({ length: this.e.simIngresos }, (_, i) => generarIngreso(this.e.simSemilla, i, this.e.simTitulos));
  }
  /** El "stock de Fierro" simulado vive en la tabla fierro_stock: es su única memoria. */
  async stock() {
    const filas = await this.db
      .select({ idExterno: productos.idExterno, cantidad: fierroStock.cantidad })
      .from(fierroStock)
      .innerJoin(productos, eq(productos.id, fierroStock.productoId))
      .where(and(eq(fierroStock.empresaId, this.e.id), eq(productos.origen, "fierro")));
    return new Map(filas.flatMap((f) => (f.idExterno ? [[f.idExterno, f.cantidad] as [string, number]] : [])));
  }
  async enviar(doc: DocumentoFierro) {
    for (const l of doc.lineas) {
      if (l.delta === 0) continue;
      await this.db
        .insert(fierroStock)
        .values({ empresaId: this.e.id, productoId: l.productoId, cantidad: l.delta })
        .onConflictDoUpdate({
          target: [fierroStock.empresaId, fierroStock.productoId],
          set: { cantidad: sql`${fierroStock.cantidad} + ${l.delta}` },
        });
    }
  }
}

