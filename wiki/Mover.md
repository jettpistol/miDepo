# Mover

Usa **Mover** cada vez que cambies artículos de una ubicación a otra: para reordenar, juntar un artículo que quedó repartido o liberar una ubicación.

## Paso a paso

1. Ve a **Mover**.
2. En **Origen**, escanea la ubicación **de donde sacas**.
3. Escanea **el artículo**.
4. En **Destino**, escanea la ubicación **donde lo dejas**.
5. Escribe la cantidad y confirma.

El mensaje verde resume el movimiento: `12 × Artículo: A-03-2 → B-01-4`.

## Mover toda una ubicación

Para vaciar una ubicación o pasar todo su contenido a otra, abre la pestaña **Toda la ubicación**, escanea el **Origen** y el **Destino** y toca **Mover todo**. Antes de confirmar, miDepo muestra cuántos artículos y unidades hay en el origen. Todo se mueve de una vez y queda como un solo movimiento: **Deshacer** lo devuelve entero.

## Deshacer un movimiento

Debajo del formulario están **Tus últimos movimientos**. **Deshacer** devuelve las unidades del destino al origen, una sola vez. Si alguien ya movió esas unidades del destino, muévelas a mano. Lo mismo aparece en [Reposición](Reposicion).

## Para tener en cuenta

- No se puede mover más de lo que hay en el origen. Si miDepo dice que no hay tantas unidades, el stock de esa ubicación está mal: pide un [conteo](Conteos).
- Los pedidos ya preparados no se mueven con esta pantalla: salen automáticamente al despacharse.
- **Si aparece un faltante**, muévelo desde `FALTANTES` a su ubicación: vuelve al stock sin baja. A `FALTANTES` no se mueve nada manualmente: solo llega desde el picking.
- **Un artículo roto** se mueve a `DANADOS`. Desde ahí un supervisor lo da de baja. Ver [Bajas y faltantes](Bajas-y-faltantes).

> Mover artículos sin registrarlo es la causa número uno de "el sistema dice que hay y no está". Son diez segundos.
