# Stock comprometido y disponible

Para cada título, miDepo lleva tres números además del total que hay en el depósito:

| Número | Qué significa |
|---|---|
| **Vendible** | Lo que está en estantes. No cuenta lo que está en Recepción, Devoluciones por guardar, Saldos, Dañados ni lo ya preparado: eso no se puede sacar del estante para un pedido. |
| **Comprometido** | Libros apartados para pedidos que todavía no se tomaron del estante. |
| **Disponible** | Vendible menos comprometido. Es lo que se puede prometer. |

## Cuándo se aparta

- **Apenas entra un pedido**, aparta lo que haya de cada título. Si dos pedidos quieren el último ejemplar, se lo queda el primero en llegar.
- **Cuando aparece stock** (al guardar libros en un estante, al mover, o cuando un conteo encuentra libros de más), los pedidos que quedaron esperando lo apartan, el más viejo primero.
- **Al tomar un libro del estante** en el picking, deja de estar apartado: sale del estante y de lo comprometido a la vez, así que lo disponible no cambia.
- **Al cancelar un pedido**, todo lo que tenía apartado vuelve a estar disponible.

## Pedidos con stock parcial

En la lista de **Picking**, cada pedido pendiente dice si tiene el stock apartado:

- **Stock apartado:** hay para todo el pedido.
- **Stock parcial: 3 de 5:** hay para una parte. Se puede preparar igual: lo que falta queda como saldo pendiente.
- **Sin stock apartado:** por ahora no hay nada de lo que pide.

## Cancelar un pedido

Un supervisor puede tocar **Cancelar** en un pedido pendiente. Solo se puede cancelar un pedido que nadie empezó a preparar. Si ya se tomaron libros, hay que devolverlos al estante primero.

## Si Disponible da negativo

Pasa cuando alguien saca de un estante libros que ya estaban apartados (por ejemplo, un libro dañado). La ficha del título se marca en rojo con un aviso. No es un error del sistema: indica que conviene **contar ese título** y, si hace falta, avisar al cliente.
