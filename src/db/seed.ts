import { eq, sql } from "drizzle-orm";
import type { DB } from "./index";
import { empresas, fierroStock, productos, stock, ubicaciones, usuarios, type Rol } from "./schema";
import { hashPassword, pinHmac } from "@/lib/claves";
import { sincronizar } from "@/lib/fierro";
import { stockInicial } from "@/lib/fierro/simulado";
import { ZONAS } from "@/lib/stock";
import { generarCodigos, MODELOS, type Esquema } from "@/lib/ubicaciones";

export const CLAVE_DEMO = "midepo1234";

type Demo = {
  nombre: string;
  slug: string;
  semilla: number;
  titulos: number;
  clientes: number;
  pedidos: number;
  ingresos: number;
  esquema: Esquema;
  /** Cuántos títulos comparten una ubicación. */
  porUbicacion: number;
  usuarios: { nombre: string; email: string; rol: Rol; pin?: string; acento?: string }[];
};

const DEMOS: Demo[] = [
  {
    nombre: "Ovnipress",
    slug: "ovnipress",
    semilla: 7,
    titulos: 6000,
    clientes: 300,
    pedidos: 80,
    ingresos: 6,
    esquema: MODELOS[0].esquema,
    porUbicacion: 8,
    usuarios: [
      { nombre: "Admin Ovnipress", email: "admin@ovnipress.test", rol: "admin" },
      { nombre: "Sofía Quiroga", email: "supervisor@ovnipress.test", rol: "supervisor", pin: "100000" },
      ...["Martín Sosa", "Lucía Ferreyra", "Joaquín Paz", "Camila Ortiz", "Nicolás Rivas", "Julieta Ibarra", "Facundo Varela", "Mara Ledesma"].map(
        (nombre, i) => ({ nombre, email: `operario${i + 1}@ovnipress.test`, rol: "operario" as Rol, pin: String(100001 + i) }),
      ),
    ],
  },
  {
    nombre: "Librería Demo",
    slug: "demo",
    semilla: 21,
    titulos: 450,
    clientes: 40,
    pedidos: 12,
    ingresos: 2,
    esquema: MODELOS[1].esquema,
    porUbicacion: 4,
    usuarios: [
      { nombre: "Admin Demo", email: "admin@demo.test", rol: "admin", acento: "#0F766E" },
      { nombre: "Operario Demo", email: "operario@demo.test", rol: "operario", pin: "200001", acento: "#0F766E" },
    ],
  },
];

export async function crearEmpresa(db: DB, datos: { nombre: string; slug: string; esquema?: Esquema }) {
  const [empresa] = await db.insert(empresas).values({ nombre: datos.nombre, slug: datos.slug, esquemaUbicaciones: datos.esquema ?? null }).returning();
  await db.insert(ubicaciones).values(ZONAS.map((z) => ({ empresaId: empresa.id, codigo: z.codigo, tipo: z.tipo })));
  return empresa;
}

export async function crearUsuario(db: DB, empresaId: number, u: { nombre: string; email: string; rol: Rol; clave?: string; pin?: string; acento?: string }) {
  const [nuevo] = await db
    .insert(usuarios)
    .values({
      empresaId,
      nombre: u.nombre,
      email: u.email.toLowerCase().trim(),
      rol: u.rol,
      passwordHash: u.clave ? hashPassword(u.clave) : null,
      pinHmac: u.pin ? pinHmac(empresaId, u.pin) : null,
      ...(u.acento ? { acento: u.acento } : {}),
    })
    .returning();
  return nuevo;
}

const tandas = <T,>(l: T[], n: number) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));

export async function sembrar(db: DB, log: (m: string) => void = () => {}) {
  for (const d of DEMOS) {
    log(`Creando ${d.nombre}: ${d.titulos} títulos, ${d.pedidos} pedidos…`);
    const base = await crearEmpresa(db, d);
    const [empresa] = await db
      .update(empresas)
      .set({ simSemilla: d.semilla, simTitulos: d.titulos, simClientes: d.clientes, simPedidos: d.pedidos, simIngresos: d.ingresos })
      .where(eq(empresas.id, base.id))
      .returning();
    for (const u of d.usuarios) await crearUsuario(db, empresa.id, { ...u, clave: CLAVE_DEMO });

    const codigos = generarCodigos(d.esquema);
    for (const t of tandas(codigos, 1000)) await db.insert(ubicaciones).values(t.map((codigo) => ({ empresaId: empresa.id, codigo })));
    const estantes = (await db.select({ id: ubicaciones.id, codigo: ubicaciones.codigo }).from(ubicaciones).where(eq(ubicaciones.empresaId, empresa.id)))
      .filter((u) => codigos.includes(u.codigo))
      .sort((a, b) => codigos.indexOf(a.codigo) - codigos.indexOf(b.codigo));

    await sincronizar(db, empresa);
    const prods = (await db.select({ id: productos.id, fierroId: productos.fierroId }).from(productos).where(eq(productos.empresaId, empresa.id)))
      .map((p) => ({ id: p.id, i: Number(p.fierroId.split("-L")[1]) - 1 }))
      .sort((a, b) => a.i - b.i);

    // Stock físico inicial: las series quedan juntas; lo que no entra va a un segundo lugar.
    const filasStock: (typeof stock.$inferInsert)[] = [];
    const filasFierro: (typeof fierroStock.$inferInsert)[] = [];
    for (const p of prods) {
      const q = stockInicial(d.semilla, p.i);
      // Fierro arranca casi igual que el depósito: 1 de cada 70 títulos difiere, para que la conciliación tenga qué mostrar.
      const desvio = p.i % 70 === 13 ? (p.i % 3) - 1 || 2 : 0;
      filasFierro.push({ empresaId: empresa.id, productoId: p.id, cantidad: Math.max(0, q + desvio) });
      if (q === 0) continue;
      const principal = estantes[Math.floor(p.i / d.porUbicacion) % estantes.length];
      const enPrincipal = Math.min(q, 60);
      filasStock.push({ empresaId: empresa.id, productoId: p.id, ubicacionId: principal.id, cantidad: enPrincipal });
      if (q > enPrincipal) {
        const reserva = estantes[(Math.floor(p.i / d.porUbicacion) + Math.floor(estantes.length / 2) + 3) % estantes.length];
        filasStock.push({ empresaId: empresa.id, productoId: p.id, ubicacionId: reserva.id, cantidad: q - enPrincipal });
      }
    }
    for (const t of tandas(filasStock, 1000)) await db.insert(stock).values(t);
    for (const t of tandas(filasFierro, 1000)) {
      await db.insert(fierroStock).values(t).onConflictDoUpdate({ target: [fierroStock.empresaId, fierroStock.productoId], set: { cantidad: sql`excluded.cantidad` } });
    }
  }
}
