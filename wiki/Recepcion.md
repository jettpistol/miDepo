# Recepción

Recepción es contar lo que llega **antes** de reponerlo. Así se sabe si vino lo que tenía que venir.

## Recepción avisada por Fierro

1. Ve a **Recepción**. Verás las recepciones abiertas, con el proveedor y cuántas unidades se esperan.
2. Toca la que corresponde a lo que llegó.
3. Escanea cada artículo. Si hay una pila del mismo artículo, escribe la cantidad y escanea uno.
4. Mira la tabla: cada artículo muestra **Esperado**, **Recibido** y su estado.
5. Cuando termines con todas las cajas, toca **Cerrar recepción**.

### Qué significan los estados

| Estado | Qué quiere decir |
|---|---|
| Pendiente | Todavía no escaneaste ninguno. |
| Faltan 5 | Llegaron menos de los esperados. |
| Completo | Llegó la cantidad justa. |
| +3 | Llegaron más de los esperados. |
| No avisado | Llegó un artículo que no estaba en el aviso. |

Si hay diferencias, miDepo te avisa antes de cerrar. **Se puede cerrar igual**: la oficina ve la diferencia y la reclama.

## Corregir una cantidad

Si contaste mal, toca el número en la columna **Recibido**, escribe el correcto y presiona Enter.

## Llegó dañado

En la columna **Dañadas**, escribe cuántas de las recibidas llegaron rotas o mal impresas. Al cerrar, esas unidades van a **DANADOS** en vez de a Recepción, y el archivo para Fierro las lista aparte (columna `danados`) para el reclamo al proveedor. Desde DANADOS un supervisor las da de baja en [Bajas](Bajas-y-faltantes).

## Etiquetas para lo recibido

Al cerrar, las unidades de artículos sin ISBN (grapas, variantes, packs) tienen su etiqueta pendiente en [Etiquetas](Etiquetas), una por unidad.

**Etiquetas** (arriba) imprime una etiqueta por cada unidad recibida, con ISBN o sin él. Sirve para tapas que el lector no lee o reimpresiones que comparten ISBN: pega la etiqueta en el libro antes de reponer.

## Recibir algo sin aviso

Para devoluciones de feria, una imprenta que entregó antes o cualquier cosa que no figure:

1. En **Recepción**, toca **Nueva**.
2. Abre **Proveedor** y elígelo de la lista. Puedes escribir parte del nombre para encontrarlo.
3. Toca **Crear recepción**, escanea todo y cierra.

**Si el proveedor no está en la lista:** los proveedores que envía Fierro aparecen automáticamente al sincronizar. Si falta uno, un supervisor puede crearlo: escribe el nombre completo y, si no coincide con ninguno, aparece **Crear proveedor**; tócalo y confirma. Si el nombre se parece mucho a uno que ya existe, miDepo no lo deja crear y te muestra cuál es. Los operarios no ven **Crear proveedor**: avísale a tu supervisor. Ver [Proveedores y clientes](Proveedores-y-clientes).

## Qué pasa al cerrar

- Lo recibido entra al stock en la zona **Recepción**. Todavía no está en su ubicación. Lo dañado entra en **DANADOS**.
- Aparece en [Reposición](Reposicion) para llevarlo a su ubicación.
- Queda en **Cerradas**, abajo en Recepción. Ahí están todas las recepciones cerradas; busca por número o proveedor.
- Si te equivocaste, toca **Reabrir**: sus unidades salen de Recepción hasta que la cierres de nuevo. Se puede mientras no esté cargada en Fierro y mientras todo siga en Recepción (si ya repusiste algo, devuélvelo a Recepción con [Mover](Mover) o deshazlo en **Tus últimos movimientos**). Una vez cargada en Fierro, se corrige con un [conteo](Conteos).

## Cancelar

Mientras esté abierta, **Cancelar recepción** borra una recepción sin aviso con todo lo escaneado. En una avisada por Fierro, **Borrar lo escaneado** la deja como llegó: esperando, sin nada recibido. Ninguna de las dos se puede deshacer.

> Los artículos que vuelven de un cliente **no** van por Recepción: van por [Devoluciones](Devoluciones), porque hay que revisar en qué estado están.
