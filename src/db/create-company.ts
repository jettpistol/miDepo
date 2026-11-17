/**
 * Creates a new company with its administrator user.
 * Usage: npm run company:create -- "Company name" code admin@company.com "initial-password"
 */
import { connect } from "./index";
import { createCompany, createUser } from "./seed";

async function main() {
  const [name, slug, email, password] = process.argv.slice(2);
  if (!name || !slug || !email || !password) {
    console.error('Missing arguments. Example: npm run company:create -- "Distribuidora Sur" sur admin@sur.com "a-long-password"');
    process.exit(1);
  }
  if (!/^[a-z0-9-]{2,20}$/.test(slug)) throw new Error("The company code must be lowercase with no spaces (letters, numbers and hyphens).");
  if (password.length < 8) throw new Error("The password needs at least 8 characters.");
  const { db, close } = await connect();
  const company = await createCompany(db, { name, slug });
  await createUser(db, company.id, { name: "Administrador", email, role: "admin", password });
  console.log(`Company "${name}" created (code: ${slug}). Administrator: ${email}`);
  await close();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
