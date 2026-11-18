/**
 * Creates a new company with its administrator user.
 * Usage: npm run company:create -- "Company name" code admin@company.com "initial-password"
 */
import { connect } from "./index";
import { createCompany, createUser } from "./seed";

async function main() {
  const [name, slug, email, password] = process.argv.slice(2);
  if (!name || !slug || !email || !password) {
    console.error('[CLI-01] Missing arguments. Example: npm run company:create -- "Distribuidora Sur" sur admin@sur.com "a-long-password"');
    process.exit(1);
  }
  if (!/^[a-z0-9-]{2,20}$/.test(slug)) throw new Error("[CLI-02] The company code must be lowercase with no spaces (letters, numbers and hyphens).");
  if (password.length < 8) throw new Error("[CLI-03] The password needs at least 8 characters.");
  const { db, close } = await connect();
  const company = await createCompany(db, { name, slug });
  await createUser(db, company.id, { name: "Administrador", email, role: "admin", password });
  console.log(`Company "${name}" created (code: ${slug}). Administrator: ${email}`);
  await close();
}

main().catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  // Errors raised above already carry their code; anything else (a duplicate code, no database) gets CLI-04.
  console.error(/^\[[A-Z]+-\d{2}\]/.test(message) ? message : `[CLI-04] Could not create the company: ${message}`);
  process.exit(1);
});
