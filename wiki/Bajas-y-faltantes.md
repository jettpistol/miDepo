# Bajas y faltantes

Con el tiempo se pierden artículos, se rompen o aparecen donde no estaban. miDepo registra cada una de esas diferencias como lo que es: una **baja** o un **ajuste** con su motivo y quién lo aprobó. Nunca hace falta un cliente inventado ni un pedido con cantidades negativas.

Esta página es para supervisores. **Bajas** está en el menú, en **Gestión**.

## De dónde salen las diferencias

| Qué pasa | Qué hace miDepo |
|---|---|
| En picking, un artículo **no está en la ubicación** | Esas unidades pasan de la ubicación a **FALTANTES**. Siguen siendo del depósito: todavía no son una baja. |
| Un faltante **aparece** | Se mueve desde `FALTANTES` a su ubicación con [Mover](Mover). Vuelve al stock sin baja. |
| Un artículo está **roto o mojado** | Se mueve a `DANADOS` con [Mover](Mover), o llega ahí desde una [devolución](Devoluciones). |
| Un [conteo](Conteos) encuentra **menos** de lo que dice el sistema | Al aprobarlo, lo que falta se da de baja con el motivo que elijas. |
| Un conteo encuentra **más** | Si ese artículo estaba en `FALTANTES`, vuelve de ahí. Si no, entra como **Apareció**. |
| Un conteo encuentra un artículo **de menos en una ubicación y de más en otra** | Es un artículo **mal ubicado**: se mueve, no es pérdida. |

## Dar de baja

En **Bajas**, la tabla **Faltantes y dañados** muestra lo que espera una decisión.

1. Revisa la cantidad (puedes dar de baja una parte).
2. Elige el **motivo**.
3. Toca **Dar de baja** y confirma.

Las unidades salen del stock y la baja (`AJ-00001`, `AJ-00002`…) aparece en [Fierro](Trabajar-con-Fierro) para cargarla.

Antes de dar de baja un faltante conviene **contar esa ubicación y las contiguas**: muchos faltantes son artículos repuestos en otra ubicación.

## Motivos

| Motivo | Cuándo usarlo |
|---|---|
| Diferencia de conteo | Un conteo encontró menos y no se sabe por qué. Es el motivo por defecto al aprobar un conteo. |
| Robo o extravío | El artículo no aparece. Es el motivo por defecto para lo que está en Faltantes. |
| Rotura o daño | Roto, mojado o muy marcado, y no se puede vender ni como saldo. |
| Error de carga | El stock estaba mal desde antes: una recepción o un movimiento mal registrado. |
| Uso interno o muestra | Artículos que se usan en el local, se regalan o se envían como muestra. |
| Apareció | Lo pone miDepo cuando un conteo encuentra más de lo que había. |

## El historial

Debajo de la tabla está lo de los **últimos 90 días**:

- **Por motivo:** **Salidas** y **Entradas** de unidades por cada motivo, y cuántas estaban **mal ubicadas** (esas no son pérdida).
- **Historial:** cada línea con su documento, artículo, ubicación, cantidad, motivo y quién la aprobó (**Aprobado por**).

**Deshacer** una baja: en el historial, mientras no esté cargada en Fierro, las unidades vuelven a FALTANTES o DAÑADOS y la baja se borra. Los ajustes de un conteo no se deshacen aquí: se corrigen con otro conteo.

Si un motivo crece mes a mes, o las bajas se repiten en la misma ubicación, hay algo que revisar.
