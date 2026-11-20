# Picking

Picking es buscar en las ubicaciones lo que pide un pedido. miDepo genera el recorrido y te guía ubicación por ubicación.

## Tomar un pedido

1. Ve a **Picking**. Los pedidos pendientes están ordenados del más antiguo al más reciente, con los **Urgentes** primero.
2. Toca **Preparar** en el primero.

Desde ese momento el pedido es tuyo: nadie más lo puede tomar.

Si abres un pedido pendiente sin tomarlo, ves su **Recorrido previsto**: los artículos, de qué ubicación saldría cada uno y lo que no tiene stock en estanterías (saldría como faltante). Es una vista previa: el stock se reserva recién cuando tocas **Preparar este pedido**, y el recorrido se arma con lo que haya libre en ese momento.

## Preparar todos en un lote

Lo normal es preparar todos los pedidos juntos, en un solo recorrido. Toca **Preparar todos** (o **F8**) arriba de la lista de pendientes y confirma.

- Todos los pedidos pendientes que se pueden preparar, del más antiguo al más reciente, forman un **lote** (`LOTE-0001`) a tu nombre.
- Cada parada pide **el total** de ese artículo en esa ubicación, sumando todos los pedidos que lo llevan ("Toma 12 para 2 pedidos").
- Las paradas van en orden de ubicación: pasas una sola vez por cada estante. Si el carro se llena, déjalo en PREPARACIÓN y sigue con el mismo lote.
- Si falta stock, los pedidos más antiguos lo reciben primero.

Cómo se separa el lote en pedidos lo elige un supervisor en **Ajustes → Picking por lotes**:

| Opción | Qué haces |
|---|---|
| **En empaque** | Todo va junto al carro. En [Empaque](Empaque) se separa por pedido, escaneando cada libro en la caja de su pedido. |
| **Por bandeja, al tomar** | Cada pedido tiene una bandeja numerada (la lista **Bandejas** dice cuál es cuál). En cada parada la pantalla dice cuántos van en cada bandeja, y al confirmar lo repite: "Bandeja 2: 4 (PED-00002) · Bandeja 3: 8 (PED-00003)". |

El cambio vale para los lotes nuevos; un lote abierto sigue como empezó.

**No está aquí**, **Saltar**, **Ir**, **Devolver** y **Sí estaba** funcionan igual que con un pedido solo, para todos los pedidos de esa parada. **Soltar lote** devuelve todos sus pedidos a Pendientes (lo tomado vuelve a su ubicación). Si sueltas un solo pedido del lote, sale del lote.

## Recorrer las paradas

A la izquierda está la **parada actual**: la ubicación en grande, el artículo, su SKU e ISBN y cuántas unidades tomar. A la derecha está el **Recorrido** completo, en el orden en que conviene caminarlo; la parada actual aparece resaltada como **Ahora**.

1. Ve a la ubicación.
2. Escanea **la etiqueta de la ubicación** (campo 1).
3. Toma los artículos y escanea **uno** (campo 2).
4. Revisa la **cantidad**: ya viene con lo que pide la parada.
5. Confirma. La parada queda como **Tomado** y aparece la siguiente.

### Pedidos urgentes

Un supervisor marca un pedido con **Marcar urgente** (arriba, en el pedido): pasa al principio de Picking y de Empaque. **Quitar urgencia** lo devuelve a su lugar. Un pedido ya empacado no cambia.

### Cambiar el orden

Si una ubicación está ocupada o prefieres ir a otra, toca **Saltar** (pasa a la parada siguiente) o **Ir** en cualquier fila pendiente del recorrido. La parada que dejaste sigue pendiente.

### Si tomas menos

Si la parada pide 8 y por ahora solo llevarás 5, cambia la cantidad a 5 y confirma. La parada queda abierta por los 3 que faltan.

## Si el artículo no está

1. Mira bien: detrás, en el nivel de arriba y en el de abajo.
2. Si no está, toca **No está aquí** y confirma.

miDepo busca el artículo en otra ubicación:

- **Si lo encuentra**, suma una parada nueva al recorrido.
- **Si no hay en ninguna ubicación**, la fila queda como **No estaba** y el pedido sigue sin ese artículo.

Las unidades que no estaban pasan de esa ubicación a la zona **FALTANTES**: así la ubicación deja de indicar que las tiene. Si después aparecen, se devuelven con [Mover](Mover); si no, un supervisor las da de baja. Ver [Bajas y faltantes](Bajas-y-faltantes).

Los artículos que no tenían stock en ninguna ubicación cuando tomaste el pedido aparecen al final como **Sin stock**.

> No completes el pedido con un tomo parecido ni lo saques de otra ubicación sin escanear. El faltante bien avisado se resuelve; el reemplazo silencioso genera una devolución.

## Deshacer

Mientras el pedido no pase a empaque, todo se puede deshacer desde el recorrido:

- **Devolver** (en una fila Tomado): las unidades vuelven a su ubicación y la parada queda pendiente otra vez. Devuelve físicamente los artículos al estante.
- **Sí estaba** (en una fila No estaba): las unidades vuelven de FALTANTES a la ubicación y se quita la parada extra que miDepo había sumado. No funciona si un supervisor ya las dio de baja o si la parada extra ya se tomó (deshaz esa primero).
- **Soltar pedido** (arriba a la derecha): todo lo tomado vuelve a su ubicación, se borra el recorrido y el pedido vuelve a **Pendientes** para que lo tome cualquiera. Lo que marcaste como no encontrado sigue en FALTANTES; si sí estaba, usa **Sí estaba** antes de soltar. Solo puede soltarlo quien lo tomó o un supervisor, y no si ya hay cajas armadas en empaque (vacíalas primero).

## Terminar

Cuando no quedan paradas, miDepo avisa **Recorrido terminado**. Lleva todo a la mesa de empaque y toca **Ir a empacar**, o deja que lo empaque otra persona desde [Empaque](Empaque).

## Preguntas frecuentes

**¿Puedo dejar un pedido por la mitad?** Sí. Queda guardado y en Inicio aparece **Seguir con PED-…** (o **Seguir con LOTE-…** si es un lote). Si no lo vas a terminar tú, toca **Soltar pedido** para que vuelva a Pendientes.

**¿Por qué el recorrido pasa por dos ubicaciones para el mismo artículo?** Porque en una sola no había suficientes unidades.

**¿Qué es "Consignación"?** El cliente recibe los artículos y paga lo que vende. Para el picking no cambia nada.

**Tomé de más.** Devuelve la diferencia a la misma ubicación. miDepo no deja confirmar más de lo que pide la parada.

**Confirmé una parada por error.** Toca **Devolver** en esa fila.
