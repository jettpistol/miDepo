# Trabajar con Fierro

miDepo no reemplaza a Fierro: trabaja junto a Fierro. Esta página es para supervisores.

## Qué sistema lleva cada dato

| Dato | Dónde se carga | Dónde se ve |
|---|---|---|
| Artículos, precios, ISBN | Fierro | miDepo los copia |
| Clientes | Fierro | miDepo los copia |
| Pedidos | Fierro | miDepo los prepara |
| Remitos y facturas | Fierro | — |
| En qué ubicación está cada artículo | miDepo | — |
| Recepciones, devoluciones, conteos, bajas | miDepo | Se cargan en Fierro |

Si un artículo o un pedido está mal, **se corrige en Fierro** y se vuelve a sincronizar.

## Sincronizar

En **Fierro**, toca **Sincronizar ahora**. Trae:

- artículos nuevos y cambios en los existentes;
- clientes;
- pedidos pendientes;
- recepciones avisadas (aparecen en [Recepción](Recepcion));
- el stock que tiene Fierro, para comparar.

Los pedidos que nadie empezó siguen a Fierro:

- si cambió en Fierro, se actualizan sus artículos;
- si ya no figura como pendiente en Fierro, queda **Anulado** y no se puede preparar (vuelve si Fierro lo lista de nuevo).

Un pedido ya empezado no se toca: muestra un aviso. Para aplicar el cambio, [suelta el pedido](Picking) y sincroniza otra vez.

Un pedido con artículos que no están en el catálogo entra igual, pero no se puede preparar hasta que esos artículos estén en Fierro y se sincronice.

## Cargar en Fierro lo que hizo el depósito

En **Para cargar en Fierro** aparece cada documento terminado:

| Documento | Cuándo aparece |
|---|---|
| Pedido empacado | Al terminar el empaque. |
| Recepción | Al cerrarla. |
| Devolución | Al cerrarla. |
| Conteo | Al aprobarlo. Lleva incluidas sus bajas y lo que apareció. |
| Baja de stock | Al dar de baja algo de Faltantes o Dañados en [Bajas](Bajas-y-faltantes). |

Para cada uno:

1. Toca **CSV** para descargar el archivo.
2. Cárgalo en Fierro.
3. Vuelve a miDepo y toca **Marcar como cargado**.

> Un pedido **sale del stock del depósito solo cuando lo marcas como cargado**. Hasta entonces sus artículos figuran en la zona "Pedidos preparados".

Lo ya marcado como cargado está en **Cargados** (arriba a la derecha en Fierro), del último al primero, con la fecha en que se marcó. Desde ahí se puede volver a descargar el CSV de cada documento.

### Formato de los archivos

- **Conteo:** `código,cantidad,ubicación`, sin encabezado. Es el formato de la importación de tomas de inventario de Fierro.
- **Pedido:** una fila por artículo y caja, con el peso de cada caja.
- **Recepción:** esperado y recibido por artículo.
- **Devolución:** artículo, estado y cantidad.
- **Baja de stock:** `ajuste,codigo,titulo,ubicacion,cantidad,motivo`. La cantidad es negativa (sale del stock) y el motivo va en palabras: *Robo o extravío*, *Rotura o daño*…

El código es el ISBN; si el artículo no tiene, el código interno.

## Conciliar el stock

**Conciliar stock** lista los artículos donde el depósito y Fierro no coinciden.

1. Primero carga todo lo pendiente: muchas diferencias son documentos sin cargar.
2. Para las que queden, cuenta el artículo en el depósito.
3. Si el depósito tiene razón, corrige el stock en Fierro. Si no, corrígelo con un [conteo](Conteos).

Lo que está en **Faltantes** sigue contando como stock del depósito hasta que se da de baja, igual que en Fierro: no genera diferencias.

## Modo de prueba

Si arriba aparece un aviso de **Modo de prueba**, el depósito está conectado a un Fierro simulado con datos inventados. Hay dos botones extra, **Simular 10 pedidos nuevos** y **Simular una recepción avisada**, que sirven para practicar. Nada llega a un Fierro real.
