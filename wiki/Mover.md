# Mover

Usa **Mover** cada vez que cambies artículos de una ubicación a otra: para reordenar, juntar un artículo que quedó repartido o liberar una ubicación.

## Paso a paso

1. Ve a **Mover**.
2. En **Origen**, escanea la ubicación **de donde sacas**.
3. Escanea **el artículo**.
4. En **Destino**, escanea la ubicación **donde lo dejas**.
5. Escribe la cantidad y confirma.

El mensaje verde resume el movimiento: `12 × Artículo: A-03-2 → B-01-4`.

## Para tener en cuenta

- Se mueve **un artículo por vez**. Para vaciar una ubicación, repite por cada artículo.
- No se puede mover más de lo que hay en el origen. Si miDepo dice que no hay tantas unidades, el stock de esa ubicación está mal: pide un [conteo](Conteos).
- Los pedidos ya preparados no se mueven con esta pantalla: salen automáticamente al despacharse.
- **Si aparece un faltante**, muévelo desde `FALTANTES` a su ubicación: vuelve al stock sin baja. A `FALTANTES` no se mueve nada manualmente: solo llega desde el picking.
- **Un artículo roto** se mueve a `DANADOS`. Desde ahí un supervisor lo da de baja. Ver [Bajas y faltantes](Bajas-y-faltantes).

> Mover artículos sin registrarlo es la causa número uno de "el sistema dice que hay y no está". Son diez segundos.
