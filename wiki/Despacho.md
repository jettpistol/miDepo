# Despacho

En **Despacho** se registra qué sale del depósito, con qué transporte y con qué papeles, y se escanea cada caja al subirla al vehículo.

## Datos del envío

1. En **Despacho**, toca el pedido.
2. Elige el **Transporte** de la lista. Si no está, un supervisor lo crea desde la misma lista.
3. Escribe el número de **Seguimiento** del transporte y el número de **Remito** con que viaja (el remito se hace en Fierro).
4. Toca **Guardar**.

Desde ahí se imprimen las etiquetas: **10×15** para impresora térmica (una por caja, con transporte, remito y seguimiento) o **A4** para impresora común.

## Cargar las cajas

1. En **Despacho**, escanea la etiqueta de cada caja en **Caja** y confirma.
2. miDepo avisa antes de confirmar si la caja ya se cargó, si todavía está abierta o si al pedido le falta el transporte.
3. Cuando se carga la última caja de un pedido, queda **despachado** y sale de la lista.

## Si te equivocaste

- **Cargaste una caja que no iba:** abre el pedido y toca **Descargar** en esa caja. El pedido deja de figurar como despachado.
- **Hay que cambiar el transporte o el remito de un pedido ya despachado:** descarga una caja, corrige y vuelve a cargarla.

## Comentarios

Al final de la pantalla, los mismos del picking y el empaque. Ver [Comentarios](Comentarios).

## Para tener en cuenta

El stock sale del depósito cuando el pedido se marca como cargado en [Fierro](Trabajar-con-Fierro), no al despachar. Despacho registra la salida física: quién cargó cada caja y cuándo.
