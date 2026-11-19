/**
 * Full walkthrough in a real browser: receiving, put-away, picking, packing, return, count,
 * keyboard shortcuts (several steps below press F-keys instead of clicking),
 * Fierro, per-user colour, phone login with a PIN, and separation between companies.
 * Needs Playwright and miDepo running on localhost:3000 with freshly loaded demo data:
 *   npm run db:reset && npm run dev        (in another terminal)
 *   node tests/walkthrough.e2e.js [folder-for-screenshots]
 */
const { chromium, devices } = require('playwright');
const BASE = 'http://localhost:3000', OUT = process.argv[2] ?? require('node:os').tmpdir();
const errors = [];
const step = (m) => console.log('·', m);
const fail = (m) => { throw new Error(m); };

/** Behaves like a USB scanner: types each code and sends Enter. Returns the server's reply. */
async function scan(p, values, quantity) {
  await p.waitForSelector(`#scan-${Object.keys(values)[0]}`);
  if (quantity != null) await p.fill('#scan-quantity', String(quantity));
  const reply = p.waitForResponse((r) => r.request().method() === 'POST', { timeout: 20000 });
  for (const [name, v] of Object.entries(values)) { await p.fill(`#scan-${name}`, v); await p.press(`#scan-${name}`, 'Enter'); }
  await reply;
  // If that was the last item, the form disappears together with its message.
  await p.waitForFunction(() => !document.querySelector('form button[disabled]'), null, { timeout: 15000 });
  await p.waitForTimeout(150);
  return ((await p.$('[role=status]')) ? await p.textContent('[role=status]') : '(list empty)').trim().slice(0, 140);
}

/** Types into a scan field without submitting and returns the warning shown before the click. */
async function warning(p, field, value) {
  await p.fill(`#scan-${field}`, value);
  await p.waitForFunction((f) => document.querySelector(`#note-${f}`)?.textContent.trim(), field, { timeout: 10000 });
  return (await p.textContent(`#note-${field}`)).trim();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push('console @' + p.url() + ': ' + m.text().slice(0, 120) + ' || ' + m.text().split('\n').filter((l) => /^\s*[+-]\s/.test(l)).slice(0, 6).join(' | ')));
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('response', (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  p.on('dialog', (d) => d.accept());
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: false, caret: 'initial' });

  // Password login (supervisor)
  await p.goto(BASE + '/'); await p.fill('#email', 'supervisor@ovnipress.test'); await p.fill('#password', 'wrong'); await p.click('button:has-text("Entrar")');
  await p.waitForSelector('[role=status]'); step('wrong password → ' + (await p.textContent('[role=status]')).trim());
  await p.fill('#email', 'supervisor@ovnipress.test'); await p.fill('#password', 'midepo1234'); await p.click('button:has-text("Entrar")'); await p.waitForURL(BASE + '/');

  // Receiving
  await p.goto(BASE + '/recepcion'); await p.click('a[href^="/recepcion/"]'); await p.waitForSelector('#scan-product');
  const rows = await p.$$eval('tbody tr', (trs) => trs.map((tr) => ({ code: tr.querySelector('.code-chip').textContent, expected: Number(tr.children[1].textContent) })));
  step(`receiving with ${rows.length} titles`);
  step('  unknown code, before the click → ' + await warning(p, 'product', '0000000000000'));
  await p.fill('#scan-product', '');
  for (const r of rows.slice(0, 4)) step('  ' + await scan(p, { product: r.code }, r.expected));
  await shot('receiving');
  await p.click('button:has-text("Cerrar recepción")'); await p.waitForSelector('text=Recepción cerrada');

  // An unannounced receiving only takes a listed supplier; junk text is never accepted.
  await p.goto(BASE + '/recepcion'); await p.click('button:has-text("Nueva")'); await p.click('button:has-text("Crear recepción")');
  step('  no supplier chosen → ' + await p.locator('[role=dialog] input[required]').evaluate((e) => e.validationMessage));
  await p.click('#supplier'); await p.keyboard.type('asdasdasds'); await p.keyboard.press('Enter');
  step('  junk + Enter only asks: ' + ((await p.inputValue('input[name=supplierId]')) === '' && (await p.locator('text=¿Crear').count()) === 1 ? 'ok' : fail('junk was accepted')));
  await p.keyboard.press('Escape');

  // Keyboard: Alt + digit opens a screen, F1 lists the keys, Esc clears a scan, F2 confirms.
  await p.keyboard.press('Alt+7'); await p.waitForURL(BASE + '/mover'); await p.waitForSelector('#scan-source');
  await p.fill('#scan-source', 'A-01-1'); await p.press('#scan-source', 'Escape');
  step('Esc clears the scan: ' + ((await p.inputValue('#scan-source')) === '' ? 'ok' : fail('not cleared')));
  await p.keyboard.press('F1'); await p.waitForSelector('[role=dialog]:has-text("Atajos de teclado")'); await p.waitForTimeout(400); await shot('hotkeys');
  const listed = await p.textContent('[role=dialog]');
  step('F1 lists F2 Mover and Alt+2: ' + (listed.includes('Mover') && listed.includes('Reposición') ? 'ok' : fail(listed.slice(0, 200))));
  await p.keyboard.press('Escape'); await p.waitForSelector('[role=dialog]', { state: 'detached' });
  await p.goto(BASE + '/guardar'); step('/guardar redirects: ' + (p.url().endsWith('/reposicion') ? 'ok' : fail(p.url())));

  // Put-away (Reposición)
  await p.keyboard.press('Alt+2'); await p.waitForURL(BASE + '/reposicion'); await p.waitForSelector('#scan-product'); await shot('putaway');
  await p.fill('#scan-product', rows[0].code);
  step('  missing location, before the click → ' + await warning(p, 'destination', 'ZZ-99'));
  await p.fill('#scan-product', ''); await p.fill('#scan-destination', '');
  for (const r of rows.slice(0, 4)) step('  put away → ' + await scan(p, { product: r.code, destination: 'A-01-1' }, r.expected));
  await p.goto(BASE + '/reposicion'); step('put-away empty: ' + ((await p.textContent('main')).includes('No queda nada') ? 'ok' : fail('something left to put away')));

  // Picking
  await p.goto(BASE + '/picking'); await shot('picking-list');
  await p.click('button:has-text("Preparar")'); await p.waitForURL(/\/picking\/\d+/); await p.waitForSelector('text=Próxima parada');
  const orderId = p.url().split('/').pop(); await shot('picking-stop');
  const codes = {}; let stops = 0, first = true;
  const stopKey = () => p.evaluate(() => (document.querySelector('.bg-accent p.text-lg')?.textContent ?? '') + (document.querySelector('.shelfmark-xl')?.getAttribute('title') ?? ''));
  while (await p.$('text=Próxima parada')) {
    const shelf = await p.getAttribute('.shelfmark-xl', 'title');
    const title = (await p.textContent('.bg-accent p.text-lg')).trim();
    const code = (await p.textContent('.bg-accent p.font-mono.text-sm')).trim();
    codes[title] = code;
    if (first) {
      first = false;
      step('  wrong shelf, before the click → ' + await warning(p, 'location', shelf === 'A-01-1' ? 'A-01-2' : 'A-01-1'));
      await p.fill('#scan-location', '');
    }
    if (stops === 2) { await p.focus('#scan-location'); await p.keyboard.press('F8'); await p.waitForSelector('[role=status]'); step('  shortage → ' + (await p.textContent('[role=status]')).trim()); await p.reload(); stops++; continue; }
    const before = await stopKey(); const msg = await scan(p, { location: shelf, product: code }); stops++;
    await p.waitForFunction((b) => ((document.querySelector('.bg-accent p.text-lg')?.textContent ?? '') + (document.querySelector('.shelfmark-xl')?.getAttribute('title') ?? '')) !== b, before, { timeout: 15000 });
    if (stops === 1) step('  pick ok → ' + msg);
  }
  step(`picking finished in ${stops} stops`); await shot('picking-done');

  // Packing (F2 on a finished route goes to packing)
  await p.keyboard.press('F2'); await p.waitForURL(`${BASE}/empaque/${orderId}`); await p.waitForSelector('#scan-product');
  const lines = await p.$$eval('table tbody tr', (trs) => trs.map((tr) => ({ title: tr.querySelector('td span.font-medium').textContent.trim(), picked: Number(tr.children[2].textContent) })));
  let n = 0;
  for (const l of lines.filter((l) => l.picked > 0)) {
    const msg = await scan(p, { product: codes[l.title] }, l.picked); if (n === 0) step('  box → ' + msg);
    if (++n === 2) { await p.fill('#kg', '3,4'); await p.click('button:has-text("Cerrar caja")'); await p.waitForSelector('text=Cerrada · 3,4 kg'); }
  }
  await shot('packing');
  if (await p.$('button:has-text("Cerrar caja")')) { await p.keyboard.press('F8'); await p.waitForSelector('button:has-text("Terminar pedido")'); }
  await p.keyboard.press('F9'); await p.waitForSelector('text=Pedido empacado en'); await shot('packing-done');
  for (const r of ['cajas', 'lista']) { await p.goto(`${BASE}/imprimir/${r}/${orderId}`); await p.waitForSelector('main, body'); await shot('print-' + r); }

  // Return
  await p.goto(BASE + '/devoluciones'); await p.click('button:has-text("Nueva")'); await p.click('#customer');
  await p.keyboard.type('aleph'); await p.keyboard.press('Enter');
  await p.click('button:has-text("Empezar a revisar")'); await p.waitForURL(/\/devoluciones\/\d+/);
  step('  return → ' + await scan(p, { product: rows[0].code }, 3));
  await p.focus('#scan-product'); await p.keyboard.press('F6');
  step('F6 changes the condition: ' + ((await p.isChecked('input[value=damaged]')) ? 'ok' : fail('still sellable')));
  step('  return → ' + await scan(p, { product: rows[1].code }, 2)); await shot('return');
  await p.keyboard.press('F9'); await p.waitForSelector('text=Devolución cerrada');

  // Count
  await p.goto(BASE + '/conteos'); await p.fill('#name', 'Prueba A-01'); await p.fill('#prefix', 'a-01');
  await p.waitForSelector('#note-prefix:has-text("ubicaciones")'); step('  count range → ' + (await p.textContent('#note-prefix')).trim());
  await p.click('button:has-text("Crear conteo")'); await p.waitForURL(/\/conteos\/\d+$/);
  const countUrl = p.url(); await p.keyboard.press('F2'); await p.waitForSelector('#scan-product');
  step('  count → ' + await scan(p, { product: rows[0].code }, rows[0].expected - 1));
  await p.keyboard.press('F8'); await p.waitForURL(countUrl); await p.waitForSelector('text=Revisión del supervisor'); await shot('count');
  // Only one title was counted on a shelf that holds several: large differences wait for a recount by someone else.
  step('  approval waits for a recount: ' + ((await p.isDisabled('button:has-text("Aprobar y ajustar stock")')) ? 'ok' : fail('approve enabled')));
  await p.click('button:has-text("Pedir recuento")'); await p.waitForSelector('text=Recuento');
  await p.goto(countUrl); await p.click('a:has-text("Contar")'); await p.waitForSelector('text=Este recuento lo tiene que hacer otra persona'); step('  first counter cannot recount: ok');
  const second = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const q = await second.newPage();
  q.on('dialog', (d) => d.accept()); q.on('pageerror', (e) => errors.push('recount pageerror: ' + e.message)); q.on('response', (r) => r.status() >= 500 && errors.push(`recount HTTP ${r.status()} ${r.url()}`));
  await q.goto(BASE + '/'); await q.click('button:has-text("PIN del depósito")'); await q.fill('#company', 'ovnipress'); await q.fill('#pin', '100001'); await q.click('button:has-text("Entrar")'); await q.waitForURL(BASE + '/');
  await q.goto(countUrl); await q.click('a:has-text("Contar")'); await q.waitForSelector('#scan-product');
  step('  recount → ' + await scan(q, { product: rows[0].code }, rows[0].expected - 1));
  await q.click('button:has-text("Terminar esta ubicación")'); await q.waitForURL(countUrl); await second.close();
  await p.goto(countUrl); await p.waitForSelector('text=Recontada');
  await p.keyboard.press('F9'); await p.waitForSelector('text=Conteo cerrado'); step('  count approved after the recount: ok');

  // Write-offs: the picking shortage above left units in FALTANTES
  await p.goto(BASE + '/bajas'); await p.waitForSelector('text=Faltantes y dañados'); await shot('write-offs');
  const historyBefore = Number(await p.textContent('#history small'));
  await p.locator('button:has-text("Dar de baja"):visible').first().click(); await p.waitForFunction((n) => Number(document.querySelector('#history small')?.textContent) > n, historyBefore, { timeout: 15000 });
  step('  write-off → ' + (await p.textContent('#history ~ div tbody tr')).replace(/\s+/g, ' ').trim());

  // Fierro
  await p.goto(BASE + '/fierro'); await shot('fierro');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('a:has-text("CSV")')]); step('CSV downloaded: ' + dl.suggestedFilename());
  let pending = await p.$$('button:has-text("Marcar como cargado")'); step(`pending exports: ${pending.length}`);
  while ((pending = await p.$$('button:has-text("Marcar como cargado")')).length) {
    const k = pending.length; await pending[0].click();
    await p.waitForFunction((k) => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Marcar como cargado')).length < k, k, { timeout: 15000 });
  }
  await p.click('button:has-text("Simular 10 pedidos nuevos")'); await p.waitForSelector('text=Entraron 10 pedidos');
  await p.goto(BASE + '/fierro/conciliacion'); await shot('reconciliation'); step('reconciliation: ' + (await p.textContent('main')).replace(/\s+/g, ' ').slice(0, 90));

  // Stock, locations, labels, manual
  await p.goto(BASE + '/stock?q=' + rows[0].code); await p.click('table a[href^="/stock/"]'); await p.waitForSelector('text=Últimos movimientos'); await shot('stock');
  await p.goto(BASE + '/ubicaciones'); await p.waitForSelector('text=Generador de ubicaciones'); await p.screenshot({ path: `${OUT}/locations.png`, fullPage: true, caret: 'initial' });
  await p.goto(BASE + '/imprimir/ubicaciones?prefijo=A-01'); await shot('labels');
  await p.goto(BASE + '/ayuda'); await shot('manual'); await p.click('article a:has-text("Picking")'); await p.waitForSelector('h1:has-text("Picking")');
  step('supervisor sees no Editar in the manual: ' + ((await p.$('a[href^="/ayuda/editar/"]')) ? fail('Editar visible') : 'ok'));
  step('supervisor cannot open the editor: ' + ((await p.goto(BASE + '/ayuda/editar/Picking'), p.url()) === BASE + '/' ? 'ok' : fail('reached ' + p.url())));
  step('supervisor cannot open users: ' + ((await p.goto(BASE + '/usuarios'), p.url()) === BASE + '/' ? 'ok' : fail('reached ' + p.url())));

  // Light/dark from the top bar, saved at once
  await p.goto(BASE + '/'); await p.click('summary[aria-label^="Tema:"] >> visible=true'); const saved = p.waitForResponse((r) => r.request().method() === 'POST');
  await p.click('details[open] button:has-text("Oscuro")'); await saved; await p.reload(); await shot('home-dark-switch');
  step('theme after reload: ' + ((await p.getAttribute('html', 'data-theme')) === 'dark' ? 'dark' : fail('not saved')));
  await p.click('summary[aria-label^="Tema:"] >> visible=true'); const back = p.waitForResponse((r) => r.request().method() === 'POST'); await p.click('details[open] button:has-text("Claro")'); await back;
  step('sidebar has Ajustes: ' + ((await p.$('aside a[href="/cuenta"]')) ? 'ok' : fail('missing')));

  // Per-user colour
  await p.goto(BASE + '/cuenta'); await p.click('button[aria-label="Magenta"]'); await p.click('form button:has-text("Oscuro")'); await shot('account-magenta-dark');
  await p.click('button:has-text("Guardar apariencia")'); await p.waitForSelector('text=Guardado'); await p.goto(BASE + '/'); await shot('home-magenta');
  step('saved accent: ' + await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent')));
  await ctx.close();

  // Phone, with a PIN (another user: keeps Klein blue)
  const phone = await browser.newContext({ ...devices['Pixel 7'] }); const m = await phone.newPage();
  m.on('pageerror', (e) => errors.push('phone pageerror: ' + e.message)); m.on('response', (r) => r.status() >= 500 && errors.push(`phone HTTP ${r.status()} ${r.url()}`));
  await m.goto(BASE + '/'); await m.screenshot({ path: `${OUT}/m-login.png`, caret: 'initial' });
  await m.click('button:has-text("PIN del depósito")'); await m.fill('#company', 'ovnipress'); await m.fill('#pin', '100003'); await m.click('button:has-text("Entrar")'); await m.waitForURL(BASE + '/');
  await m.screenshot({ path: `${OUT}/m-home.png`, caret: 'initial' });
  step('phone accent: ' + await m.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent')));
  await m.goto(BASE + '/picking'); await m.click('button:has-text("Preparar")'); await m.waitForSelector('text=Próxima parada'); await m.screenshot({ path: `${OUT}/m-picking.png`, fullPage: true, caret: 'initial' });
  await m.goto(BASE + '/mas'); await m.screenshot({ path: `${OUT}/m-more.png`, caret: 'initial' });
  step('operator does not see Fierro: ' + (!(await m.textContent('main')).includes('Fierro') ? 'ok' : fail('Fierro visible')));
  await m.goto(BASE + '/fierro'); step('operator /fierro → ' + m.url());

  // Another company does not see Ovnipress orders
  const other = await browser.newContext(); const o = await other.newPage();
  await o.goto(BASE + '/'); await o.fill('#email', 'admin@demo.test'); await o.fill('#password', 'midepo1234'); await o.click('button:has-text("Entrar")'); await o.waitForURL(BASE + '/');
  const r = await o.goto(`${BASE}/picking/${orderId}`); step(`other company opens a foreign order → HTTP ${r.status()}`);
  await o.goto(BASE + '/ubicaciones'); await o.waitForSelector('text=Generador'); step('demo company scheme: ' + ((await o.textContent('main')).includes('Mostrando el esquema') ? 'shown' : 'none'));

  // An admin edits a manual page for their company only
  o.on('pageerror', (e) => errors.push('admin pageerror: ' + e.message)); o.on('response', (r) => r.status() >= 500 && errors.push(`admin HTTP ${r.status()} ${r.url()}`));
  await o.setViewportSize({ width: 1440, height: 900 });
  await o.goto(BASE + '/ayuda/Glosario'); await o.click('a[href="/ayuda/editar/Glosario"]'); await o.waitForSelector('textarea');
  await o.click('textarea'); await o.keyboard.press('Control+End'); await o.keyboard.type('\n\n## Palabras de Demo\n\nUn ');
  await o.keyboard.press('Control+b'); await o.keyboard.type('zorzal'); await o.keyboard.press('End'); await o.keyboard.type(' es un lector fiel. Ver [Picking](Pickin).');
  await o.waitForSelector('[role=region] strong:has-text("zorzal")'); await o.waitForSelector('text=no lleva a ninguna página');
  await o.screenshot({ path: `${OUT}/manual-editor.png`, caret: 'initial' });
  await o.fill('textarea', (await o.inputValue('textarea')).replace('(Pickin)', '(Picking)')); await o.waitForSelector('text=no lleva a ninguna página', { state: 'detached' });
  await o.click('button:has-text("Guardar")'); await o.waitForURL(BASE + '/ayuda/Glosario'); await o.waitForSelector('text=Versión de');
  step('edited page shows: ' + ((await o.textContent('article')).includes('zorzal es un lector fiel') ? 'ok' : fail('edit missing')));
  await m.goto(BASE + '/ayuda/Glosario'); step('other company still reads the original: ' + (!(await m.textContent('article')).includes('zorzal') ? 'ok' : fail('edit leaked')));
  await m.goto(BASE + '/ayuda?q=zorzal'); step('other company search: ' + ((await m.textContent('main')).includes('No hay resultados') ? 'ok' : fail('found')));
  await o.goto(BASE + '/ayuda?q=zorzal'); step('admin search finds it: ' + ((await o.$('a[href="/ayuda/Glosario"]:has-text("Glosario")')) ? 'ok' : fail('not found')));
  await o.goto(BASE + '/ayuda/editar/Glosario'); o.once('dialog', (d) => d.accept()); await o.click('button:has-text("Volver al original")'); await o.waitForURL(BASE + '/ayuda/Glosario');
  step('back to original: ' + (!(await o.textContent('article')).includes('zorzal') ? 'ok' : fail('still edited')));
  await m.goto(BASE + '/ayuda'); await m.screenshot({ path: `${OUT}/m-manual.png`, caret: 'initial' });
  const ma = await phone.newPage(); await ma.goto(BASE + '/ingresar?agregar=1'); await ma.click('button:has-text("Email y contraseña")'); await ma.fill('#email', 'admin@ovnipress.test'); await ma.fill('#password', 'midepo1234'); await ma.click('button:has-text("Entrar")'); await ma.waitForURL(BASE + '/');
  await ma.goto(BASE + '/ayuda/editar/Picking'); await ma.waitForSelector('textarea'); await ma.screenshot({ path: `${OUT}/m-editor.png`, caret: 'initial' });
  await ma.click('button:has-text("Vista previa")'); await ma.screenshot({ path: `${OUT}/m-editor-preview.png`, caret: 'initial' });
  step('phone editor scrolls sideways: ' + ((await ma.evaluate(() => document.documentElement.scrollWidth > innerWidth)) ? fail('yes') : 'no'));
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'NO CONSOLE ERRORS OR 5xx');
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); console.log([...new Set(errors)].join('\n')); process.exit(1); });
