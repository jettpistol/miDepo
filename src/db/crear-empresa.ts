/**
 * Da de alta una empresa nueva con su usuario administrador.
 * Uso: npm run empresa:crear -- "Nombre de la empresa" codigo admin@empresa.com "clave-inicial"
 */
import { conexion } from "./index";
import { crearEmpresa, crearUsuario } from "./seed";

async function main() {
  const [nombre, slug, email, clave] = process.argv.slice(2);
  if (!nombre || !slug || !email || !clave) {
    console.error('Faltan datos. Ejemplo: npm run empresa:crear -- "Distribuidora Sur" sur admin@sur.com "una-clave-larga"');
    process.exit(1);
  }
  if (!/^[a-z0-9-]{2,20}$/.test(slug)) throw new Error("El código de empresa va en minúsculas, sin espacios (letras, números y guiones).");
  if (clave.length < 8) throw new Error("La clave necesita al menos 8 caracteres.");
  const { db, cerrar } = await conexion();
  const empresa = await crearEmpresa(db, { nombre, slug });
  await crearUsuario(db, empresa.id, { nombre: "Administrador", email, rol: "admin", clave });
  console.log(`Empresa "${nombre}" creada (código: ${slug}). Administrador: ${email}`);
  await cerrar();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
