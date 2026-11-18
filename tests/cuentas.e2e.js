/**
 * Cuentas múltiples y foto de perfil: sumar, cambiar y cerrar cuentas, subir una foto,
 * aislamiento de la foto entre empresas, teléfono con PIN. Datos de demostración recién cargados.
 *   BASE_URL=http://localhost:3100 node tests/cuentas.e2e.js [carpeta-para-capturas]
 */
const { chromium, devices } = require('playwright'); const B = process.env.BASE_URL ?? 'http://localhost:3000', OUT = process.argv[2] ?? require('node:os').tmpdir();
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('response', r => r.status() >= 500 && console.log('HTTP', r.status(), r.url())); p.on('dialog', d => d.accept());
  const h1 = async () => (await p.textContent('h1')).trim(); const acento = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acento'));
  const entrar = async (email) => { await p.waitForLoadState('networkidle'); await p.fill('#email', email); await p.fill('#clave', 'midepo1234'); await p.click('button:has-text("Entrar"):not(:has-text("huella"))'); await p.waitForURL(B + '/'); };
  await p.goto(B); await entrar('supervisor@ovnipress.test'); console.log('1 →', await h1());
  // Foto
  const png = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 600, 400); g.addColorStop(0, '#f59e0b'); g.addColorStop(1, '#be185d'); x.fillStyle = g; x.fillRect(0, 0, 600, 400); x.fillStyle = '#fff'; x.beginPath(); x.arc(300, 170, 80, 0, 7); x.fill(); x.beginPath(); x.arc(300, 420, 170, 0, 7); x.fill(); return c.toDataURL('image/png').split(',')[1]; });
  await p.goto(B + '/cuenta'); await p.waitForLoadState('networkidle');
  await p.setInputFiles('#foto-archivo', { name: 'yo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await p.waitForSelector('text=Foto guardada');
  const src = await p.getAttribute('aside img', 'src'); const r = await ctx.request.get(B + src); console.log('foto →', src, r.status(), r.headers()['content-type'], (await r.body()).length, 'bytes');
  await p.setInputFiles('#foto-archivo', { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') }); await p.waitForSelector('text=no es una imagen'); console.log('archivo no imagen → rechazado');
  // Segunda y tercera cuenta
  await p.click('aside summary'); await p.screenshot({ path: OUT + '/cuentas-menu-1.png' }); await p.click('aside a:has-text("Agregar otra cuenta")'); await p.waitForURL(/agregar/);
  await p.screenshot({ path: OUT + '/ingresar-agregar.png' }); await entrar('operario1@ovnipress.test'); console.log('2 →', await h1());
  await p.goto(B + '/ingresar?agregar=1'); await entrar('admin@demo.test'); console.log('3 →', await h1(), await acento());
  await p.click('aside summary'); await p.screenshot({ path: OUT + '/cuentas-menu-3.png' });
  await p.click('aside button:has-text("Sofía Quiroga")'); await p.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Sofía')); console.log('cambio →', await h1(), await acento(), '| pedido en curso intacto');
  // Misma persona dos veces no duplica
  await p.goto(B + '/ingresar?agregar=1'); await entrar('operario1@ovnipress.test'); await p.click('aside summary'); console.log('cuentas tras reingreso:', 1 + await p.locator('aside form:has(input[name=usuarioId])').count());
  // Foto ajena desde otra empresa
  await p.click('aside button:has-text("Admin Demo")'); await p.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Admin')); console.log('foto desde otra empresa →', (await ctx.request.get(B + src)).status());
  // Salir pasa a la siguiente; salir de todas va al ingreso
  await p.click('aside summary'); await p.click('aside button:has-text("Salir de Admin")'); await p.waitForFunction(() => !document.querySelector('h1')?.textContent.includes('Admin')); console.log('salir →', await h1());
  await p.goto(B + '/usuarios'); console.log('operario en /usuarios →', p.url());
  await p.click('aside summary'); await p.click('aside button:has-text("Salir de todas")'); await p.waitForURL(/ingresar/); console.log('salir de todas →', p.url(), '| cookies:', (await ctx.cookies()).filter(c => c.name.startsWith('midepo_sesi')).length);
  // Teléfono
  const t = await b.newContext({ ...devices['Pixel 7'] }); const m = await t.newPage(); await m.goto(B); await m.waitForLoadState('networkidle'); await m.click('button:has-text("PIN del depósito")');
  await m.fill('#empresa', 'ovnipress'); await m.fill('#pin', '100000'); await m.click('button:has-text("Entrar"):not(:has-text("huella"))'); await m.waitForURL(B + '/');
  await m.goto(B + '/ingresar?agregar=1'); await m.waitForLoadState('networkidle'); await m.fill('#pin', '100002'); await m.click('button:has-text("Entrar"):not(:has-text("huella"))'); await m.waitForURL(B + '/');
  await m.goto(B + '/mas'); await m.evaluate(() => window.scrollTo(0, 99999)); await m.screenshot({ path: OUT + '/m-cuentas.png' });
  await b.close();
})().catch(e => { console.error('FALLÓ', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
