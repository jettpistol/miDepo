/**
 * Recorrido completo en un navegador real: recepción, guardado, picking, empaque, devolución,
 * conteo, Fierro, colores, teléfono con PIN y separación entre empresas.
 * Requiere Playwright y miDepo corriendo en localhost:3000 con los datos de demostración recién cargados:
 *   npm run db:reset && npm run dev        (en otra terminal)
 *   node tests/recorrido.e2e.js [carpeta-para-capturas]
 */
const { chromium, devices } = require('playwright');
const B = 'http://localhost:3000', OUT = process.argv[2] ?? require('node:os').tmpdir();
const errores = [];
const paso = (m) => console.log('·', m);
async function escanear(p, valores, cantidad) {
  // Simula un lector USB: escribe el código y manda Enter en cada campo.
  await p.waitForLoadState('networkidle');
  if (cantidad != null) await p.fill('#esc-cantidad', String(cantidad));
  const campos = Object.entries(valores);
  const respuesta = p.waitForResponse(r => r.request().method() === 'POST', { timeout: 20000 });
  for (const [nombre, v] of campos) { await p.fill(`#esc-${nombre}`, v); await p.press(`#esc-${nombre}`, 'Enter'); }
  await respuesta;
  // Si era lo último de la lista, el formulario desaparece junto con su mensaje.
  const h = await p.waitForSelector('[role=status], main .tarjeta.text-center', { timeout: 15000 });
  await p.waitForFunction(() => !document.querySelector('form button[disabled]'), null, { timeout: 15000 });
  await p.waitForTimeout(150);
  return ((await p.$('[role=status]')) ? await p.textContent('[role=status]') : '(lista vacía)').trim().slice(0, 140);
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('console', m => m.type() === 'error' && errores.push('console @' + p.url() + ': ' + m.text().slice(0, 90) + ' || ' + m.text().split('\n').filter(l => /^\s*[+-]\s/.test(l)).slice(0, 6).join(' | ')));
  p.on('pageerror', e => errores.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('response', r => r.status() >= 500 && errores.push(`HTTP ${r.status()} ${r.url()}`));
  p.on('dialog', d => d.accept());
  const cap = (n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });

  // Ingreso con contraseña (supervisor)
  await p.goto(B + '/'); await p.fill('#email', 'supervisor@ovnipress.test'); await p.fill('#clave', 'mala'); await p.click('button:has-text("Entrar")');
  await p.waitForSelector('[role=status]'); paso('clave mala → ' + (await p.textContent('[role=status]')).trim());
  await p.fill('#email', 'supervisor@ovnipress.test'); await p.fill('#clave', 'midepo1234'); await p.click('button:has-text("Entrar")'); await p.waitForURL(B + '/');

  // Recepción
  await p.goto(B + '/recepcion'); await p.click('a[href^="/recepcion/"]'); await p.waitForSelector('#esc-producto');
  const filas = await p.$$eval('tbody tr', trs => trs.map(tr => ({ codigo: tr.querySelector('td span.font-mono').textContent, esperado: Number(tr.children[1].textContent) })));
  paso(`recepción con ${filas.length} títulos`);
  for (const f of filas.slice(0, 4)) paso('  ' + await escanear(p, { producto: f.codigo }, f.esperado));
  paso('  desconocido → ' + await escanear(p, { producto: '0000000000000' }, 1));
  await cap('recepcion');
  await p.click('button:has-text("Cerrar recepción")'); await p.waitForSelector('text=Recepción cerrada');

  // Guardar
  await p.goto(B + '/guardar'); await p.waitForSelector('#esc-producto'); await cap('guardar');
  paso('  ubicación inexistente → ' + await escanear(p, { producto: filas[0].codigo, destino: 'ZZ-99' }, 1));
  await p.fill('#esc-producto', ''); await p.fill('#esc-destino', '');
  for (const f of filas.slice(0, 4)) paso('  guardar → ' + await escanear(p, { producto: f.codigo, destino: 'A-01-1' }, f.esperado));
  await p.goto(B + '/guardar'); paso('guardar vacío: ' + ((await p.textContent('main')).includes('No queda nada') ? 'ok' : 'QUEDA ALGO'));

  // Picking
  await p.goto(B + '/picking'); await cap('picking-lista');
  await p.click('button:has-text("Preparar")'); await p.waitForURL(/\/picking\/\d+/); await p.waitForSelector('text=Próxima parada');
  const pedidoId = p.url().split('/').pop(); await cap('picking-parada');
  const codigos = {}; let paradas = 0, primera = true;
  while (await p.$('text=Próxima parada')) {
    const ubic = (await p.textContent('.bg-acento p.text-5xl')).trim();
    const titulo = (await p.textContent('.bg-acento p.text-lg')).trim();
    const cod = (await p.textContent('.bg-acento p.font-mono.text-sm')).trim();
    codigos[titulo] = cod;
    if (primera) { primera = false;
      paso('  estante equivocado → ' + await escanear(p, { ubicacion: ubic === 'A-01-1' ? 'A-01-2' : 'A-01-1', producto: cod }));
      await p.fill('#esc-ubicacion', ''); await p.fill('#esc-producto', '');
    }
    if (paradas === 2) { await p.click('button:has-text("No está en el estante")'); await p.waitForSelector('[role=status]'); paso('  faltante → ' + (await p.textContent('[role=status]')).trim()); await p.reload(); paradas++; continue; }
    const antes = titulo + ubic; const msg = await escanear(p, { ubicacion: ubic, producto: cod }); paradas++;
    await p.waitForFunction((a) => { const e = document.querySelector('.bg-acento p.text-5xl'); const t = document.querySelector('.bg-acento p.text-lg'); return !e || (t.textContent.trim() + e.textContent.trim()) !== a; }, antes, { timeout: 15000 });
    if (paradas === 1) paso('  pick ok → ' + msg);
  }
  paso(`picking terminado en ${paradas} paradas`); await cap('picking-fin');

  // Empaque
  await p.goto(`${B}/empaque/${pedidoId}`); await p.waitForSelector('#esc-producto');
  const lineas = await p.$$eval('table tbody tr', trs => trs.map(tr => ({ titulo: tr.children[0].textContent.trim(), prep: Number(tr.children[2].textContent) })));
  let n = 0;
  for (const l of lineas.filter(l => l.prep > 0)) {
    const msg = await escanear(p, { producto: codigos[l.titulo] }, l.prep); if (n === 0) paso('  caja → ' + msg);
    if (++n === 2) { await p.fill('#kg', '3,4'); await p.click('button:has-text("Cerrar caja")'); await p.waitForSelector('text=Cerrada · 3,4 kg'); }
  }
  await cap('empaque');
  if (await p.$('button:has-text("Cerrar caja")')) { await p.click('button:has-text("Cerrar caja")'); await p.waitForSelector('button:has-text("Terminar pedido")'); }
  await p.click('button:has-text("Terminar pedido")'); await p.waitForSelector('text=Pedido empacado en'); await cap('empaque-fin');
  for (const r of ['cajas', 'lista']) { await p.goto(`${B}/imprimir/${r}/${pedidoId}`); await p.waitForLoadState('networkidle'); await cap('imprimir-' + r); }

  // Devolución
  await p.goto(B + '/devoluciones'); await p.selectOption('select[name=clienteId]', { index: 3 }); await p.click('button:has-text("Empezar a revisar")'); await p.waitForURL(/\/devoluciones\/\d+/);
  paso('  devolución → ' + await escanear(p, { producto: filas[0].codigo }, 3));
  await p.check('input[value=danado]'); paso('  devolución → ' + await escanear(p, { producto: filas[1].codigo }, 2)); await cap('devolucion');
  await p.click('button:has-text("Cerrar devolución")'); await p.waitForSelector('text=Devolución cerrada');

  // Conteo
  await p.goto(B + '/conteos'); await p.fill('#nombre', 'Prueba A-01'); await p.fill('#prefijo', 'a-01'); await p.click('button:has-text("Crear conteo")'); await p.waitForURL(/\/conteos\/\d+/);
  const conteoUrl = p.url(); await p.click('a:has-text("Contar")'); await p.waitForSelector('#esc-producto');
  paso('  conteo → ' + await escanear(p, { producto: filas[0].codigo }, filas[0].esperado - 1));
  await p.click('button:has-text("Terminé esta ubicación")'); await p.waitForURL(conteoUrl); await p.waitForSelector('text=Revisión del supervisor'); await cap('conteo');
  await p.click('button:has-text("Aprobar y ajustar stock")'); await p.waitForSelector('text=Conteo cerrado');

  // Fierro
  await p.goto(B + '/fierro'); await cap('fierro');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('a:has-text("CSV")')]); paso('CSV descargado: ' + dl.suggestedFilename());
  let pend = await p.$$('button:has-text("Marcar como cargado")'); paso(`pendientes de envío: ${pend.length}`);
  while ((pend = await p.$$('button:has-text("Marcar como cargado")')).length) { const k = pend.length; await pend[0].click(); await p.waitForFunction((k) => document.querySelectorAll('li.tarjeta').length < k, k, { timeout: 15000 }); }
  await p.click('button:has-text("Simular 10 pedidos nuevos")'); await p.waitForSelector('text=Entraron 10 pedidos');
  await p.goto(B + '/fierro/conciliacion'); await cap('conciliacion'); paso('conciliación: ' + (await p.textContent('main p.text-sm, main .tarjeta p')).trim().slice(0, 90));

  // Stock, ubicaciones, etiquetas, ayuda
  await p.goto(B + '/stock?q=' + filas[0].codigo); await p.click('ul.tarjeta a'); await p.waitForSelector('text=Últimos movimientos'); await cap('stock');
  await p.goto(B + '/ubicaciones'); await p.waitForSelector('text=Generador de ubicaciones'); await p.screenshot({ path: `${OUT}/ubicaciones.png`, fullPage: true });
  await p.goto(B + '/imprimir/ubicaciones?prefijo=A-01'); await cap('etiquetas');
  await p.goto(B + '/ayuda'); await cap('ayuda'); await p.click('article a:has-text("Picking")'); await p.waitForSelector('h1:has-text("Picking")');
  paso('supervisor no entra a usuarios: ' + ((await p.goto(B + '/usuarios'), p.url()) === B + '/' ? 'ok' : 'FALLA ' + p.url()));

  // Color por usuario
  await p.goto(B + '/cuenta'); await p.click('button[aria-label="Magenta"]'); await p.click('button:has-text("Oscuro")'); await cap('cuenta-magenta-oscuro');
  await p.click('button:has-text("Guardar apariencia")'); await p.waitForSelector('text=Guardado'); await p.goto(B + '/'); await cap('inicio-magenta');
  paso('acento guardado: ' + await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acento')));
  await ctx.close();

  // Teléfono, con PIN (otro usuario: conserva el azul Klein)
  const tel = await b.newContext({ ...devices['Pixel 7'] }); const m = await tel.newPage();
  m.on('pageerror', e => errores.push('movil pageerror: ' + e.message)); m.on('response', r => r.status() >= 500 && errores.push(`movil HTTP ${r.status()} ${r.url()}`));
  await m.goto(B + '/'); await m.screenshot({ path: `${OUT}/m-login.png` });
  await m.click('button:has-text("PIN del depósito")'); await m.fill('#empresa', 'ovnipress'); await m.fill('#pin', '100003'); await m.click('button:has-text("Entrar")'); await m.waitForURL(B + '/');
  await m.screenshot({ path: `${OUT}/m-inicio.png` });
  paso('móvil acento: ' + await m.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acento')));
  await m.goto(B + '/picking'); await m.click('button:has-text("Preparar")'); await m.waitForSelector('text=Próxima parada'); await m.screenshot({ path: `${OUT}/m-picking.png`, fullPage: true });
  await m.goto(B + '/mas'); await m.screenshot({ path: `${OUT}/m-mas.png` });
  paso('operario no ve Fierro: ' + (!(await m.textContent('main')).includes('Fierro') ? 'ok' : 'FALLA'));
  await m.goto(B + '/fierro'); paso('operario /fierro → ' + m.url());
  // Otra empresa no ve pedidos de Ovnipress
  const otra = await b.newContext(); const o = await otra.newPage(); await o.goto(B + '/'); await o.fill('#email', 'admin@demo.test'); await o.fill('#clave', 'midepo1234'); await o.click('button:has-text("Entrar")'); await o.waitForURL(B + '/');
  const r = await o.goto(`${B}/picking/${pedidoId}`); paso(`otra empresa abre pedido ajeno → HTTP ${r.status()}`);
  await o.goto(B + '/ubicaciones'); await o.waitForSelector('text=Generador'); paso('demo usa esquema: ' + (await o.textContent('ul.grid li a span')));
  await b.close();
  console.log(errores.length ? 'ERRORES:\n' + [...new Set(errores)].join('\n') : 'SIN ERRORES DE CONSOLA NI 5xx');
})().catch(e => { console.error('FALLÓ:', e.message.split('\n').slice(0, 6).join('\n')); console.log([...new Set(errores)].join('\n')); process.exit(1); });
