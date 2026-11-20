# Etiquetas

miDepo prepara las etiquetas que cada paso necesita y las deja en **Etiquetas**, listas para imprimir con un clic. Nada se imprime solo.

## Qué se prepara y cuándo

| Etiqueta | Se prepara al | Contenido | Tamaño inicial |
|---|---|---|---|
| **Artículo** | Cerrar una [recepción](Recepcion) con artículos sin ISBN (grapas, variantes, packs) | Nombre, SKU y código de barras; una por unidad | 50 × 25 mm |
| **Ubicación** | Crear ubicaciones en [Ubicaciones](Ubicaciones-y-etiquetas) | Código grande y código de barras | 100 × 50 mm |
| **Caja** | Terminar un pedido en [Empaque](Empaque) | Destinatario, transporte, remito, seguimiento, "Caja 2 de 3" y el código que escanea [Despacho](Despacho) | 100 × 150 mm |
| **Devolución** | Cerrar una [devolución](Devoluciones) | VENDIBLE, SALDO o DAÑADO, el artículo y el número de devolución; una por unidad | 50 × 25 mm |

La etiqueta de caja se lee de nuevo al imprimir: si el transporte o el seguimiento se cargan después en Despacho, salen en la etiqueta.

También se imprimen desde cada documento, sin pasar por la lista: **Etiquetas** en una recepción, en Empaque, en Despacho y en Ubicaciones.

## Imprimir

1. Abre **Etiquetas**. La columna **Destino** dice adónde va cada una en este equipo.
2. Toca **Imprimir**.
   - Con una impresora asignada a este equipo, se envía directo.
   - Con el **diálogo del sistema**, se abre la vista de impresión y el diálogo de Chrome. Elige la impresora, el tamaño de papel igual al de la etiqueta, márgenes **Ninguno** y escala **100 %**.
3. Las impresas pasan a **Impresas**, con quién y cuándo. **Reimprimir** las vuelve a enviar.

**Descartar** (en ⋯) saca de la lista lo que no hace falta imprimir; **Volver a pendientes** lo recupera.

## Tamaño e impresora

La vista de impresión (⋯ → **Ver y elegir tamaño**) muestra las etiquetas a tamaño real, con **Tamaño** e **Impresora** arriba. Los tamaños disponibles dependen del tipo de etiqueta:

- **Rollos térmicos:** 100 × 150, 100 × 100, 100 × 75, 100 × 50, 80 × 50, 60 × 40, 58 × 40, 57 × 32, 50 × 30, 50 × 25, 40 × 30, 40 × 20, 38 × 25 y 32 × 25 mm, y en pulgadas 4 × 6, 4 × 3, 4 × 2, 3 × 2, 2,25 × 1,25 y 2 × 1.
- **Hojas A4 autoadhesivas:** 4, 8, 14, 21, 24 y 65 por hoja, con las medidas habituales de las marcas de hojas para etiquetas. Las hojas A4 solo van por el diálogo del sistema.

Un supervisor puede tocar **Fijar en este equipo** para que ese tamaño e impresora queden como los de este equipo para ese tipo de etiqueta. También se eligen en [Dispositivos](Impresoras-y-lectores).

## Etiqueta de prueba

**Prueba** (arriba en Etiquetas, o en Dispositivos) imprime una etiqueta con su tamaño, la impresora, acentos, una regla y un código de barras. Antes de usar una impresora nueva:

- La regla de 10 mm tiene que medir 10 mm. Si mide menos, la impresora o el diálogo están achicando la página.
- Los bordes del recuadro tienen que verse completos. Si se corta, el tamaño de papel no coincide con la etiqueta.
- `ÁÉÍÓÚ Ñ Ü` tiene que salir igual.
- El código `MIDEPO-TEST` tiene que leerse con el lector.
