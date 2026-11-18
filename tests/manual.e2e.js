/**
 * Manual como sitio aparte: se lee sin sesión, búsqueda sin acentos, Mi cuenta bajo el nombre,
 * el tablero no aparece dentro del manual. Datos de demostración recién cargados.
 *   BASE_URL=http://localhost:3100 node tests/manual.e2e.js [carpeta-para-capturas]
 */
const { chromium, devices } = require('playwright'); const B = process.env.BASE_URL ?? 'http://localhost:3000', OUT = process.argv[2] ?? require('node:os').tmpdir();
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('response', r => r.status() >= 500 && console.log('HTTP', r.status(), r.url()));
  const r0 = await p.goto(B + '/ayuda'); console.log('sin sesión /ayuda →', r0.status(), '| botón:', (await p.textContent('header a:last-child')).trim());
  for (const q of ['faltante', 'recepcion', 'huella rostro', 'xyzzy', 'a']) { await p.fill('input[name=q]', q); await p.press('input[name=q]', 'Enter'); await p.waitForURL(/q=/); await p.waitForLoadState('networkidle');
    console.log(`"${q}" →`, (await p.textContent('main p')).trim(), '|', (await p.$$eval('main li a span:first-child', e => e.slice(0, 4).map(x => x.textContent))).join(', ')); if (q === 'faltante') await p.screenshot({ path: OUT + '/manual-busqueda.png' }); }
  await p.goto(B + '/ayuda/Picking'); await p.screenshot({ path: OUT + '/manual-pagina.png' }); console.log('pág inexistente →', (await p.goto(B + '/ayuda/NoExiste')).status());
  await p.goto(B + '/ingresar'); await p.waitForLoadState('networkidle'); await p.fill('#email', 'supervisor@ovnipress.test'); await p.fill('#clave', 'midepo1234'); await p.click('button:has-text("Entrar"):not(:has-text("huella"))'); await p.waitForURL(B + '/');
  console.log('menú lateral:', (await p.$$eval('aside nav a', a => a.map(x => x.textContent.trim()))).join(' · '));
  await p.click('aside summary'); await p.screenshot({ path: OUT + '/menu-nombre.png' }); await p.click('aside a:has-text("Mi cuenta")'); await p.waitForURL(B + '/cuenta'); console.log('nombre → Mi cuenta →', (await p.textContent('h1')).trim(), '| menú cerrado:', !(await p.$eval('aside details', d => d.open)));
  await p.click('aside nav a:has-text("Manual")'); await p.waitForURL(B + '/ayuda'); console.log('Manual →', p.url(), '| botón:', (await p.textContent('header a:last-child')).trim(), '| tablero visible:', !!(await p.$('aside nav')));
  const t = await b.newContext({ ...devices['Pixel 7'] }); const m = await t.newPage(); await m.goto(B + '/ayuda/Picking'); await m.screenshot({ path: OUT + '/m-manual.png' });
  await m.goto(B); await m.waitForLoadState('networkidle'); await m.click('button:has-text("PIN del depósito")'); await m.fill('#empresa', 'ovnipress'); await m.fill('#pin', '100002'); await m.click('button:has-text("Entrar"):not(:has-text("huella"))'); await m.waitForURL(B + '/');
  await m.click('header a[href="/mas"]'); await m.waitForURL(B + '/mas'); await m.screenshot({ path: OUT + '/m-mas2.png' }); await m.click('main a[href="/cuenta"]'); await m.waitForURL(B + '/cuenta'); console.log('móvil foto → nombre →', (await m.textContent('h1')).trim());
  await b.close();
})().catch(e => { console.error('FALLÓ', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
