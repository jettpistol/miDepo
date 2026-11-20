# Conteos

Un conteo sirve para corregir el stock de un tramo del depósito sin detener el trabajo. Se cuenta por partes: un pasillo por semana es suficiente para tener todo al día.

## Contar (operarios)

1. Ve a **Conteos** y toca el conteo abierto.
2. Elige una ubicación y toca **Contar**.
3. Ve a esa ubicación.
4. Escanea **todo lo que haya**. Si un artículo está muchas veces, cuéntalo, escribe la cantidad y escanea uno.
5. Toca **Terminar esta ubicación**. Si no había nada, toca **Está vacía**.
6. Sigue con la próxima.

### El conteo es a ciegas

miDepo **no te dice cuánto debería haber**. Es a propósito: si sabes el número, es fácil "encontrarlo". Cuenta lo que ves.

### Corregir

Si te equivocaste antes de terminar la ubicación, toca el número al lado del artículo y escribe el correcto.

### Recontar

Si una ubicación aparece con la marca **Recuento**, un supervisor pidió contarla de nuevo. Se cuenta igual, desde cero. **Lo tiene que hacer otra persona**: quien la contó primero ve el aviso y no puede escanear.

## Crear y cerrar un conteo (supervisores)

### Crear

1. En **Conteos**, completa **Nuevo conteo**.
2. Pon un nombre claro: "Pasillo A, noviembre".
3. En **Ubicaciones que empiezan con**, escribe el comienzo del código: `A` para todo el pasillo A, `A-03` para una sola estantería.
4. Toca **Crear conteo**.

Un conteo admite hasta 300 ubicaciones. Para más, crea varios.

### Revisar y aprobar

A medida que se cuentan ubicaciones, aparece la **Revisión del supervisor** con las diferencias: lo que decía el sistema, lo que se contó y la diferencia. Debajo, un resumen: cuántos artículos están **mal ubicados**, cuántos **sobran** y cuántos **faltan**.

#### Diferencias grandes: recuento obligatorio

Si en una ubicación un artículo difiere en **5 unidades o más**, o en **20% o más** de lo que decía el sistema (a partir de 2 unidades), esa ubicación tiene que **recontarla otra persona** antes de aprobar.

1. Toca **Pedir recuento** en esa fila. Lo contado ahí se borra y la ubicación vuelve a quedar pendiente.
2. Otra persona la cuenta (ver [Recontar](#recontar)).
3. Cuando está **Recontada**, ya se puede aprobar, aunque la diferencia siga: la confirmaron dos personas.

Mientras falte un recuento, **Aprobar y ajustar stock** está desactivado y dice por qué.

Para otras diferencias raras, también puedes tocar **Reabrir** en la ubicación y pedir que la cuenten de nuevo.

#### Aprobar

Si hay artículos que faltan, elige el **Motivo de lo que falta** (por defecto, *Diferencia de conteo*). Después toca **Aprobar y ajustar stock**.

Al aprobar, artículo por artículo:

- **Mal ubicados:** si un artículo falta en una ubicación contada y sobra en otra, se mueve de una a la otra. No es pérdida.
- **Sobran:** si ese artículo estaba en `FALTANTES`, vuelve de ahí. Si no, entra al stock como **Apareció**.
- **Faltan:** lo que sigue faltando se da de baja con el motivo elegido.
- Las ubicaciones **sin contar** no se tocan.

El conteo aparece en **Fierro** para cargarlo, en el mismo formato que usa Fierro para importar tomas de inventario. Las bajas y lo que apareció quedan en el historial de [Bajas y faltantes](Bajas-y-faltantes).

> Mientras se cuenta una ubicación, conviene no hacer picking ni reposición en ella. Si ocurre, la diferencia aparecerá en la revisión.
