# Trabajar con Fierro

miDepo no reemplaza a Fierro: trabaja a la par. Esta página es para supervisores.

## Quién manda en qué

| Dato | Dónde se carga | Dónde se ve |
|---|---|---|
| Títulos, precios, ISBN | Fierro | miDepo los copia |
| Clientes | Fierro | miDepo los copia |
| Pedidos | Fierro | miDepo los prepara |
| Remitos y facturas | Fierro | — |
| En qué estante está cada libro | miDepo | — |
| Recepciones, devoluciones, conteos, bajas | miDepo | Se informan a Fierro |

Si un título o un pedido está mal, **se corrige en Fierro** y se vuelve a sincronizar.

## Sincronizar

En **Fierro**, toca **Sincronizar ahora**. Trae:

- títulos nuevos y cambios en los existentes;
- clientes;
- pedidos pendientes;
- ingresos avisados (aparecen en [Recepción](Recepcion));
- el stock que tiene Fierro, para comparar.

Los pedidos que ya se empezaron a preparar no se pisan.

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

> Un pedido **sale del stock del depósito recién cuando lo marcas como cargado**. Hasta entonces sus libros figuran en la zona "Pedidos preparados".

### Formato de los archivos

- **Conteo:** `código,cantidad,ubicación`, sin encabezado. Es el formato de la importación de tomas de inventario de Fierro.
- **Pedido:** una fila por título y caja, con el peso de cada caja.
- **Recepción:** esperado y recibido por título.
- **Devolución:** título, estado y cantidad.
- **Baja de stock:** `ajuste,codigo,titulo,ubicacion,cantidad,motivo`. La cantidad es negativa (sale del stock) y el motivo va en palabras: *Robo o extravío*, *Rotura o daño*…

El código es el ISBN; si el artículo no tiene, el código interno.

## Conciliar el stock

**Conciliar stock** lista los títulos donde el depósito y Fierro no coinciden.

1. Primero carga todo lo pendiente: muchas diferencias son documentos sin cargar.
2. Para las que queden, cuenta el título en el depósito.
3. Si el depósito tiene razón, corrige el stock en Fierro. Si no, corrígelo con un [conteo](Conteos).

Lo que está en **Faltantes** sigue contando como stock del depósito hasta que se da de baja, igual que en Fierro: no genera diferencias.

## Modo de prueba

Si arriba aparece un aviso de **Modo de prueba**, el depósito está conectado a un Fierro simulado con datos inventados. Hay dos botones extra, **Simular 10 pedidos nuevos** y **Simular un ingreso avisado**, que sirven para practicar. Nada llega a un Fierro real.
