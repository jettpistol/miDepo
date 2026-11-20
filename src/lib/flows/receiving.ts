import { and, eq, sql } from "drizzle-orm";
import { receivingLines, receivings, stock, suppliers } from "@/db/schema";
import { distance, plain } from "../text";
import { UserError } from "../errors";
import { findProduct, moveStock, zone } from "../stock";
import { nextNumber, validQuantity, type Ctx } from "./common";
import { prepareLabels, receivingLabels } from "./labels";
import { articleName } from "@/lib/article";

async function open(c: Ctx, id: number) {
  const [r] = await c.db.select().from(receivings).where(and(eq(receivings.id, id), eq(receivings.companyId, c.companyId)));
  if (!r) throw new UserError("RCV-01", "No se encontró esa recepción.");
  if (r.status === "closed") throw new UserError("RCV-02", "Esta recepción ya está cerrada.");
  return r;
}

/** A receiving that Fierro did not announce. The supplier has to be one already on the list. */
export async function createUnannouncedReceiving(c: Ctx, supplierId: number) {
  const [supplier] = Number.isInteger(supplierId) ? await c.db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, c.companyId))) : [];
  if (!supplier) throw new UserError("RCV-03", "Elige un proveedor de la lista.");
  const number = await nextNumber(c.db, receivings, receivings.number, eq(receivings.companyId, c.companyId), "REC-", 4);
  const [r] = await c.db
    .insert(receivings)
    .values({ companyId: c.companyId, number, supplierId: supplier.id, status: "in_progress" })
    .returning();
  return r.id;
}

/**
 * Adds a supplier on purpose, from the "Crear proveedor" choice. Refuses names that already
 * exist, even with different accents, capitals or spacing, so the list does not fill with near-copies.
 */
export async function createSupplier(c: Ctx, name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 2) throw new UserError("RCV-04", "Escribe el nombre del proveedor.");
  if (clean.length > 80) throw new UserError("RCV-05", "El nombre es demasiado largo.");
  if (!/\p{L}/u.test(clean)) throw new UserError("RCV-06", "El nombre tiene que tener letras.");
  const existing = await c.db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.companyId, c.companyId));
  const same = existing.find((s) => plain(s.name) === plain(clean));
  if (same) throw new UserError("RCV-07", `Ya existe: ${same.name}. Elígelo de la lista.`);
  // One or two letters off an existing name is almost always a typo of it.
  const near = existing.find((s) => Math.min(plain(s.name).length, plain(clean).length) >= 6 && distance(plain(s.name), plain(clean)) <= 2);
  if (near) throw new UserError("RCV-08", `¿Es ${near.name}? Ya existe un proveedor casi igual. Elígelo de la lista.`);
  const [created] = await c.db.insert(suppliers).values({ companyId: c.companyId, name: clean, createdBy: c.userId }).returning({ id: suppliers.id, name: suppliers.name });
  return created;
}

/** Adds received units of a title. If the title was not on the notice, it is added anyway. */
export async function scanReceiving(c: Ctx, receivingId: number, code: string, quantity: unknown) {
  const n = validQuantity(quantity);
  const r = await open(c, receivingId);
  const p = await findProduct(c.db, c.companyId, code);
  const [line] = await c.db
    .insert(receivingLines)
    .values({ receivingId, productId: p.id, expected: 0, received: n })
    .onConflictDoUpdate({ target: [receivingLines.receivingId, receivingLines.productId], set: { received: sql`${receivingLines.received} + ${n}` } })
    .returning();
  if (r.status === "pending") await c.db.update(receivings).set({ status: "in_progress" }).where(eq(receivings.id, receivingId));
  const notice = line.expected === 0 ? " (no estaba en el aviso)" : line.received > line.expected ? ` (${line.received - line.expected} de más)` : "";
  return `${articleName(p.title)}: ${line.received} de ${line.expected}${notice}`;
}

export async function setReceived(c: Ctx, receivingId: number, productId: number, received: unknown) {
  const n = Number(received);
  if (!Number.isInteger(n) || n < 0) throw new UserError("RCV-09", "Escribe un número de cero para arriba.");
  await open(c, receivingId);
  const [l] = await c.db.select().from(receivingLines).where(and(eq(receivingLines.receivingId, receivingId), eq(receivingLines.productId, productId)));
  if (l && n < l.damaged) throw new UserError("RCV-18", `Hay ${l.damaged} marcadas como dañadas. Corrige eso primero.`);
  await c.db.update(receivingLines).set({ received: n }).where(and(eq(receivingLines.receivingId, receivingId), eq(receivingLines.productId, productId)));
  return "Cantidad corregida.";
}

/** How many of a title's received units arrived damaged. They stay received; on closing they go to DANADOS. */
export async function setDamaged(c: Ctx, receivingId: number, productId: number, damaged: unknown) {
  const n = Number(damaged);
  if (!Number.isInteger(n) || n < 0) throw new UserError("RCV-09", "Escribe un número de cero para arriba.");
  await open(c, receivingId);
  const [l] = await c.db.select().from(receivingLines).where(and(eq(receivingLines.receivingId, receivingId), eq(receivingLines.productId, productId)));
  if (!l) throw new UserError("RCV-19", "Ese artículo no está en esta recepción.");
  if (n > l.received) throw new UserError("RCV-20", `Se recibieron ${l.received}: no pueden estar dañadas más.`);
  await c.db.update(receivingLines).set({ damaged: n }).where(eq(receivingLines.id, l.id));
  return n === 0 ? "Sin dañadas." : `${n} dañada${n === 1 ? "" : "s"}: van a Dañados al cerrar.`;
}

/** Closes the receiving: what was received enters stock in the Receiving zone, ready to put away; what arrived damaged, in Dañados. */
export async function closeReceiving(c: Ctx, receivingId: number) {
  const r = await open(c, receivingId);
  return c.db.transaction(async (tx) => {
    const lines = await tx.select().from(receivingLines).where(eq(receivingLines.receivingId, receivingId));
    const total = lines.reduce((s, l) => s + l.received, 0);
    if (total === 0) throw new UserError("RCV-10", "La recepción no tiene artículos escaneados.");
    const destination = await zone(tx, c.companyId, "receiving");
    const damagedZone = await zone(tx, c.companyId, "damaged");
    for (const l of lines) {
      const good = l.received - l.damaged;
      if (good > 0) await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: null, toId: destination.id, quantity: good, reason: "receiving", reference: r.number, userId: c.userId });
      if (l.damaged > 0) await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: null, toId: damagedZone.id, quantity: l.damaged, reason: "receiving", reference: r.number, userId: c.userId });
    }
    await tx.update(receivings).set({ status: "closed" }).where(eq(receivings.id, receivingId));
    // Articles with miDepo's own code (no ISBN) need a label on each unit: prepared for one click.
    const job = await prepareLabels(tx, c, { kind: "item", reference: r.number, source: `receiving:${receivingId}`, labels: await receivingLabels(tx, receivingId, true) });
    const damaged = lines.reduce((s, l) => s + l.damaged, 0);
    return `${r.number} cerrada. ${total - damaged} unidades por reponer${damaged > 0 ? `, ${damaged} en Dañados` : ""}${job ? `. ${job.total} etiquetas por imprimir` : ""}.`;
  });
}

/**
 * Undoes an open receiving. One miDepo created is deleted; one Fierro announced goes back to
 * waiting, with nothing received and without the titles that were not on the notice.
 */
export async function cancelReceiving(c: Ctx, receivingId: number) {
  const r = await open(c, receivingId);
  if (r.fierroId == null) {
    await c.db.delete(receivings).where(eq(receivings.id, receivingId));
    return `${r.number} cancelada.`;
  }
  await c.db.transaction(async (tx) => {
    await tx.delete(receivingLines).where(and(eq(receivingLines.receivingId, receivingId), eq(receivingLines.expected, 0)));
    await tx.update(receivingLines).set({ received: 0, damaged: 0 }).where(eq(receivingLines.receivingId, receivingId));
    await tx.update(receivings).set({ status: "pending" }).where(eq(receivings.id, receivingId));
  });
  return `${r.number} vuelve a esperar: lo escaneado se borró.`;
}

/**
 * Reopens a closed receiving that Fierro has not been told about: its units leave Recepción
 * again. Only while all of them are still there (none put away yet).
 */
export async function reopenReceiving(c: Ctx, receivingId: number) {
  const [r] = await c.db.select().from(receivings).where(and(eq(receivings.id, receivingId), eq(receivings.companyId, c.companyId)));
  if (!r) throw new UserError("RCV-01", "No se encontró esa recepción.");
  if (r.status !== "closed") throw new UserError("RCV-12", "Esta recepción todavía está abierta.");
  if (r.sentToFierro) throw new UserError("RCV-13", "Esta recepción ya se cargó en Fierro. No se puede reabrir.");
  return c.db.transaction(async (tx) => {
    const dock = await zone(tx, c.companyId, "receiving");
    const damagedZone = await zone(tx, c.companyId, "damaged");
    const lines = await tx.select().from(receivingLines).where(eq(receivingLines.receivingId, receivingId));
    for (const l of lines) {
      for (const [where, n] of [[dock, l.received - l.damaged], [damagedZone, l.damaged]] as const) {
        if (n === 0) continue;
        const [there] = await tx.select({ q: stock.quantity }).from(stock).where(and(eq(stock.productId, l.productId), eq(stock.locationId, where.id)));
        if ((there?.q ?? 0) < n) throw new UserError("RCV-14", "Parte de lo recibido ya se guardó en una ubicación. Devuélvelo a Recepción con Mover para poder reabrir.");
        await moveStock(tx, { companyId: c.companyId, productId: l.productId, fromId: where.id, toId: null, quantity: n, reason: "undo", reference: r.number, userId: c.userId });
      }
    }
    await tx.update(receivings).set({ status: "in_progress" }).where(eq(receivings.id, receivingId));
    return `${r.number} reabierta. Sus unidades salieron de Recepción hasta que se vuelva a cerrar.`;
  });
}

/** Undoes "Crear proveedor": deletes a supplier created in miDepo while no receiving uses it. */
export async function deleteSupplier(c: Ctx, supplierId: number) {
  const [s] = await c.db.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, c.companyId)));
  if (!s) throw new UserError("RCV-15", "No se encontró ese proveedor.");
  if (s.createdBy == null) throw new UserError("RCV-16", "Ese proveedor viene de Fierro. Se borra allí.");
  const [used] = await c.db.select({ id: receivings.id }).from(receivings).where(eq(receivings.supplierId, s.id)).limit(1);
  if (used) throw new UserError("RCV-17", "Ese proveedor ya tiene recepciones y no se puede borrar.");
  await c.db.delete(suppliers).where(eq(suppliers.id, s.id));
  return `Proveedor ${s.name} borrado.`;
}
