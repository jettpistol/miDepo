/**
 * Scrapes the public Ovnipress store (a Tiendanube shop) for the first volume/issue of each comic or
 * manga series, and writes the demo catalogue miDepo loads for the Ovnipress demo company.
 *
 *   node scripts/scrape-ovnipress.mjs [--covers]
 *
 * Output: src/lib/fierro/ovnipress-catalog.json (+ cover images in public/covers/ovnipress with --covers).
 * Polite by design: one request per second, only the public category and product pages robots.txt allows.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanAuthor, cleanFormat, decode } from "./ovnipress-fields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOP = "https://www.ovnipress.net";
const UA = "Mozilla/5.0 (compatible; miDepo-demo-catalog/1.0)";
const WITH_COVERS = process.argv.includes("--covers");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`[CLI-06] La tienda respondió ${res.status} en ${url}`);
  return res;
};
const text = (html) => decode(html.replace(/<(script|style|text)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
const ldBlocks = (html, kind) =>
  [...html.matchAll(new RegExp(`<script type="application/ld\\+json" data-component='structured-data\\.${kind}'>([\\s\\S]*?)</script>`, "g"))].flatMap((m) => {
    try { return [JSON.parse(m[1])]; } catch { return []; }
  });

// 1. Every product on the comics and manga categories.
const listing = new Map();
for (const cat of ["comics", "manga"]) {
  for (let page = 1; page <= 100; page++) {
    const items = ldBlocks(await (await get(`${SHOP}/${cat}/?page=${page}`)).text(), "item");
    let fresh = 0;
    for (const j of items) {
      const url = j.offers?.url;
      if (url && !listing.has(url)) { fresh++; listing.set(url, { category: cat, url, name: j.name, price: Number(j.offers.price), stock: Number(j.offers.inventoryLevel?.value ?? 0) }); }
    }
    if (!fresh) break;
    process.stdout.write(`\rlisting ${cat} page ${page}: ${listing.size} products`);
    await sleep(1000);
  }
}
console.log();

// 2. Only first volumes / issues (not packs, boxes or "year one" stories).
const FIRST = /(?:\b(?:vol(?:umen)?\.?|n[º°o]\.?|#|tomo|libro|parte)\s*0*1\b(?!\d)|\b0*1\b\s*$|\(tomo 1\))/i;
const candidates = [...listing.values()].filter((p) => FIRST.test(p.name) && !/pack|box|combo/i.test(p.name));
console.log(`${candidates.length} first-volume candidates`);

// 3. Detail page: author, ISBN, format, publisher line, series, cover.
const details = [];
for (const [i, c] of candidates.entries()) {
  process.stdout.write(`\rdetail ${i + 1}/${candidates.length}`);
  try {
    const html = await (await get(c.url)).text();
    const page = ldBlocks(html, "page")[0];
    const crumbs = (page?.breadcrumb?.itemListElement ?? []).map((x) => decode(x.name));
    const desc = html.match(/<div class="product-description user-content">([\s\S]*?)<\/div>/)?.[1] ?? "";
    const body = text(desc);
    const pick = (re) => body.match(re)?.[1]?.trim() ?? null;
    const isbn = pick(/ISBN:?\s*([0-9][0-9\- ]{11,16}[0-9X])/i)?.replace(/[^0-9X]/gi, "") ?? null;
    const image = html.match(/<meta property="og:image:secure_url" content="([^"]+)"/)?.[1]?.replace(/-\d+-\d+\.webp/, "-320-0.webp") ?? null;
    const grams = Number(pick(/Peso:?\s*([\d.,]+)\s*(?:gr|g)/i)?.replace(/[.,]/g, "") ?? 0);
    details.push({
      ...c,
      title: c.name,
      line: crumbs.length >= 4 ? crumbs[2] : (crumbs[1] ?? null),
      author: cleanAuthor(pick(/Autor(?:es)?:\s*([^\n]+)/i)),
      format: cleanFormat(pick(/Formato:\s*([^\n]+)/i)),
      isbn: isbn && isbn.length === 13 ? isbn : null,
      weightGrams: grams >= 20 && grams <= 5000 ? grams : 300,
      image,
      summary: body.split("\n").find((l) => l.length > 80 && !/^(Autor|Formato|ISBN|Peso)/i.test(l))?.slice(0, 600) ?? null,
    });
  } catch (e) {
    console.warn(`\n[CLI-07] Se salteó ${c.url}: ${e.message}`);
  }
  await sleep(1000);
}
console.log();

// 4. One per series: prefer what is in stock, then the cheapest listing (usually the current edition).
const seriesKey = (title) =>
  title
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s*(?:\b(?:vol(?:umen)?\.?|n[º°o]\.?|tomo|libro|parte)\s*|#)0*1\b.*$|\s0*1\s*$/, "")
    .replace(/[^a-z0-9áéíóúñ]+/g, " ")
    .trim();
const bySeries = new Map();
for (const d of details) {
  const key = seriesKey(d.title);
  d.series = key;
  const best = bySeries.get(key);
  if (!best || (d.stock > 0) > (best.stock > 0) || ((d.stock > 0) === (best.stock > 0) && d.price < best.price)) bySeries.set(key, d);
}

// Hand-curated: local indie titles, kids' and cartoon tie-ins, near-duplicate editions and the most obscure series.
const EXCLUDE = new Set([
  "angela della morte", "proyecto tifón", "love the bomb", "spidey y sus sorprendentes amigos", "gravity falls", "spacedrum", "boys run the riot",
  "money shot", "sweet paprika", "sweet paprika hot paprika", "star wars darth vader lord oscuro", "batman no man s land cataclismo parte 1",
  "colección 80 aniversario batman", "sanctify", "twisted wonderland", "planeta manga alter ego", "planeta manga kohva", "alas de estrella",
  "la lavandería de minato", "mientras yubooh duerme", "kinryo rock", "adventureman", "la criatura de einstein", "neun", "the walking cat",
]);
const seriesOf = (d) => seriesKey(d.title);
const all = [...bySeries.values()].filter((d) => d.image && !EXCLUDE.has(seriesOf(d)));
const fileOf = (d) => d.url.split("/productos/")[1].replace(/\/.*/, "");

const catalog = all.map((d) => ({
  title: d.title,
  author: d.author,
  imprint: d.line,
  isbn: d.isbn,
  price: d.price, // ARS pesos
  weightGrams: d.weightGrams,
  cover: `/covers/ovnipress/${fileOf(d)}.webp`,
  format: d.format,
  summary: d.summary,
  stockInShop: d.stock,
  source: d.url,
}));
const out = join(ROOT, "src/lib/fierro/ovnipress-catalog.json");
writeFileSync(out, JSON.stringify(catalog, null, 1) + "\n");
console.log(`${catalog.length} titles -> ${out}`);

if (WITH_COVERS) {
  const dir = join(ROOT, "public/covers/ovnipress");
  mkdirSync(dir, { recursive: true });
  for (const [i, d] of all.entries()) {
    if (!d.image) continue;
    const file = `${fileOf(d)}.webp`;
    if (!existsSync(join(dir, file))) {
      writeFileSync(join(dir, file), Buffer.from(await (await get(d.image)).arrayBuffer()));
      await sleep(500);
    }
    process.stdout.write(`\rcovers ${i + 1}/${all.length}`);
  }
  console.log();
}
