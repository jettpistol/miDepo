import { eq, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { fierroStock, products } from "@/db/schema";
import type { ProductType } from "@/db/schema";
import type { FierroCustomer, FierroConnector, FierroDocument, FierroReceipt, FierroBook, FierroOrder } from "./types";

/**
 * A pretend Fierro. It always generates the same data from a seed, so tests are
 * repeatable. Every title, author and customer is invented.
 */

function random(...seeds: number[]) {
  let a = seeds.reduce((h, s) => Math.imul(h ^ s, 0x9e3779b1) >>> 0, 0x811c9dc5);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const choose = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];
const between = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

const OPENINGS = ["Crónicas", "Leyendas", "Sombras", "Guardianes", "Hijos", "Cazadores", "Ecos", "Herederos", "Náufragos", "Centinelas", "Pilotos", "Brujas", "Detectives", "Samuráis", "Fantasmas", "Reinas", "Vagabundos", "Arquitectos", "Ladrones", "Jinetes"];
const ENDINGS = ["de la Luna Roja", "del Neón", "de la Última Ciudad", "del Abismo", "de Ceniza", "del Río de la Plata", "de Otro Planeta", "del Invierno Eterno", "de la Pampa Eléctrica", "del Subte B", "de Medianoche", "del Fin del Mundo", "de Papel", "del Puerto", "de la Tormenta", "del Sótano", "de Vidrio", "del Kilómetro Cero", "de la Niebla", "del Barrio Sur", "de Marte", "del Faro", "de la Cordillera", "del Tiempo Perdido", "de Hierro"];
const FIRST_NAMES = ["Lucía", "Martín", "Sofía", "Tomás", "Valentina", "Joaquín", "Camila", "Nicolás", "Julieta", "Facundo", "Aiko", "Kenji", "Haruka", "Daniel", "Elena", "Bruno", "Mara", "Iván"];
const SURNAMES = ["Ferreyra", "Quiroga", "Bianchi", "Sosa", "Aguirre", "Tanaka", "Morimoto", "Ledesma", "Ortiz", "Varela", "Castaño", "Ibarra", "Kowalski", "Méndez", "Paz", "Rivas"];
const IMPRINTS = ["Órbita Cómics", "Nébula Manga", "Cometa Novela Gráfica", "Satélite Infantil", "Clásicos del Espacio"];
const CITIES: [string, string][] = [["CABA", "Buenos Aires"], ["La Plata", "Buenos Aires"], ["Mar del Plata", "Buenos Aires"], ["Rosario", "Santa Fe"], ["Santa Fe", "Santa Fe"], ["Córdoba", "Córdoba"], ["Río Cuarto", "Córdoba"], ["Mendoza", "Mendoza"], ["San Miguel de Tucumán", "Tucumán"], ["Salta", "Salta"], ["Neuquén", "Neuquén"], ["Bariloche", "Río Negro"], ["Posadas", "Misiones"], ["Resistencia", "Chaco"], ["Paraná", "Entre Ríos"], ["Bahía Blanca", "Buenos Aires"]];
const STREETS = ["Av. Corrientes", "Av. Rivadavia", "San Martín", "Belgrano", "Mitre", "Sarmiento", "Av. Colón", "9 de Julio", "Moreno", "Lavalle", "Av. Santa Fe", "Urquiza"];
const SHOPS = ["Comiquería", "Librería", "Club del Cómic", "Mangas", "Historietas", "Libros"];
const NICKNAMES = ["El Aleph", "Kamikaze", "La Viñeta", "Punto de Fuga", "El Baldío", "Tinta China", "Galaxia", "La Bestia Pop", "Trinchera", "El Oráculo", "Zona Fantasma", "Rayuela", "Onomatopeya", "El Globo", "Página Doble", "La Cueva"];
const SUPPLIERS = ["Imprenta Gráfica del Sur", "Talleres Latingráfica", "Importación marítima – contenedor", "Imprenta Kollor", "Devolución de feria", "Encuadernación Morón"];

function isbn13(n: number) {
  const base = "978987" + String(n % 1000000).padStart(6, "0");
  let sumOf = 0;
  for (let i = 0; i < 12; i++) sumOf += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  return base + ((10 - (sumOf % 10)) % 10);
}

export function generateBook(seedNum: number, i: number, prefix: string): FierroBook {
  // Each series has about 15 issues: neighbouring titles belong to the same series.
  const seriesN = Math.floor(i / 15);
  const rs = random(seedNum, 1, seriesN);
  const series = `${OPENINGS[seriesN % OPENINGS.length]} ${ENDINGS[Math.floor(seriesN / OPENINGS.length + seriesN * 7) % ENDINGS.length]}`;
  const imprint = choose(rs, IMPRINTS);
  const author = `${choose(rs, FIRST_NAMES)} ${choose(rs, SURNAMES)}`;
  const inFloppy = rs() < 0.22; // series published as magazines, without an ISBN
  const r = random(seedNum, 2, i);
  const number = (i % 15) + 1;
  const given = r();
  let type: ProductType = inFloppy ? "floppy" : "book";
  let title = inFloppy ? `${series} #${number}` : `${series} Vol. ${number}`;
  if (!inFloppy && given < 0.05) {
    type = "pack";
    title = `${series} – Pack tomos ${number} a ${number + 2}`;
  } else if (given > 0.94) {
    type = "variant";
    title += " (portada variante)";
  }
  const internalCode = `${prefix}-${String(i + 1).padStart(6, "0")}`;
  const isbn = type === "book" ? isbn13(seedNum * 100000 + i) : null;
  return {
    id: `F${seedNum}-L${i + 1}`,
    internalCode,
    isbn,
    barcode: isbn ?? internalCode,
    title,
    author,
    imprint,
    type,
    price: (type === "floppy" ? between(r, 45, 90) : type === "pack" ? between(r, 500, 900) : between(r, 150, 420)) * 100,
    weightGrams: type === "floppy" ? between(r, 60, 110) : type === "pack" ? between(r, 700, 1300) : between(r, 180, 520),
  };
}

export function initialStock(seedNum: number, i: number) {
  const r = random(seedNum, 3, i);
  if (r() < 0.05) return 0;
  return r() < 0.7 ? between(r, 4, 60) : between(r, 60, 220);
}

export function generateCustomer(seedNum: number, i: number): FierroCustomer {
  const r = random(seedNum, 4, i);
  const [city, province] = choose(r, CITIES);
  return {
    id: `F${seedNum}-C${i + 1}`,
    name: `${choose(r, SHOPS)} ${choose(r, NICKNAMES)}${i >= SHOPS.length * NICKNAMES.length ? ` ${i}` : ""} (${city})`,
    address: `${choose(r, STREETS)} ${between(r, 100, 4900)}`,
    city,
    province,
  };
}

function lines(r: () => number, seedNum: number, bookCount: number, howMany: number, min: number, max: number, onlyInStock: boolean) {
  const used = new Map<number, number>();
  let attempts = 0;
  while (used.size < howMany && attempts++ < howMany * 20) {
    const idx = Math.floor(r() * bookCount);
    // Almost every order asks for titles in stock; a few do not, to exercise shortages.
    if (onlyInStock && initialStock(seedNum, idx) === 0 && r() > 0.03) continue;
    if (!used.has(idx)) used.set(idx, between(r, min, max));
  }
  return [...used].map(([idx, quantity]) => ({ bookId: `F${seedNum}-L${idx + 1}`, quantity }));
}

export function generateOrder(seedNum: number, i: number, bookCount: number, customerCount: number): FierroOrder {
  const r = random(seedNum, 5, i);
  // Orders arrive one every 11 minutes: the lowest number is always the oldest.
  const date = new Date(Date.UTC(2026, 10, 2, 12, 0) + i * 11 * 60_000);
  return {
    id: `F${seedNum}-P${i + 1}`,
    number: `PED-${String(i + 1).padStart(5, "0")}`,
    customerId: `F${seedNum}-C${between(r, 1, customerCount)}`,
    saleMode: r() < 0.35 ? "consignment" : "firm",
    date,
    lines: lines(r, seedNum, bookCount, between(r, 2, 14), 1, 8, true),
  };
}

export function generateReceipt(seedNum: number, i: number, bookCount: number): FierroReceipt {
  const r = random(seedNum, 6, i);
  return {
    id: `F${seedNum}-I${i + 1}`,
    number: `ING-${String(i + 1).padStart(4, "0")}`,
    supplier: choose(r, SUPPLIERS),
    date: new Date(Date.UTC(2026, 10, 3 + i, 8, 30)),
    lines: lines(r, seedNum, bookCount, between(r, 4, 18), 20, 240, false),
  };
}

export type SimCompany = { id: number; slug: string; simSeed: number; simTitles: number; simCustomers: number; simOrders: number; simReceipts: number };

export class SimulatedFierro implements FierroConnector {
  readonly mode = "simulated" as const;
  constructor(private db: Executor, private e: SimCompany) {}

  private get prefix() {
    return this.e.slug.slice(0, 3).toUpperCase();
  }
  async books() {
    return Array.from({ length: this.e.simTitles }, (_, i) => generateBook(this.e.simSeed, i, this.prefix));
  }
  async customers() {
    return Array.from({ length: this.e.simCustomers }, (_, i) => generateCustomer(this.e.simSeed, i));
  }
  async pendingOrders() {
    return Array.from({ length: this.e.simOrders }, (_, i) => generateOrder(this.e.simSeed, i, this.e.simTitles, this.e.simCustomers));
  }
  async expectedReceipts() {
    return Array.from({ length: this.e.simReceipts }, (_, i) => generateReceipt(this.e.simSeed, i, this.e.simTitles));
  }
  /** The simulated "Fierro stock" lives in the fierro_stock table: it is its only memory. */
  async stock() {
    const rows = await this.db
      .select({ fierroId: products.fierroId, quantity: fierroStock.quantity })
      .from(fierroStock)
      .innerJoin(products, eq(products.id, fierroStock.productId))
      .where(eq(fierroStock.companyId, this.e.id));
    return new Map(rows.map((f) => [f.fierroId, f.quantity]));
  }
  async submit(doc: FierroDocument) {
    for (const l of doc.lines) {
      if (l.delta === 0) continue;
      await this.db
        .insert(fierroStock)
        .values({ companyId: this.e.id, productId: l.productId, quantity: l.delta })
        .onConflictDoUpdate({
          target: [fierroStock.companyId, fierroStock.productId],
          set: { quantity: sql`${fierroStock.quantity} + ${l.delta}` },
        });
    }
  }
}

