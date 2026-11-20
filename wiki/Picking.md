# Picking

Picking es buscar en las ubicaciones lo que pide un pedido. miDepo genera el recorrido y te guía ubicación por ubicación.

## Tomar un pedido

1. Ve a **Picking**. Los pedidos pendientes están ordenados del más antiguo al más reciente.
2. Toca **Preparar** en el primero.

Desde ese momento el pedido es tuyo: nadie más lo puede tomar.

## Recorrer las paradas

En pantalla aparece la **próxima parada**: la ubicación en grande, el artículo y cuántas unidades tomar.

1. Ve a la ubicación.
2. Escanea **la etiqueta de la ubicación**.
3. Toma los artículos y escanea **uno**.
4. Revisa la **cantidad**: ya viene con lo que pide la parada.
5. Confirma. Aparece la parada siguiente.

Abajo ves las **Próximas paradas** y lo **Tomado**.

### Si tomas menos

Si la parada pide 8 y por ahora solo llevarás 5, cambia la cantidad a 5 y confirma. La parada queda abierta por los 3 que faltan.

## Si el artículo no está

1. Mira bien: detrás, en el nivel de arriba y en el de abajo.
2. Si no está, toca **No está en la ubicación** y confirma.

miDepo busca el artículo en otra ubicación:

- **Si lo encuentra**, suma una parada nueva al recorrido.
- **Si no hay en ninguna ubicación**, lo registra como **faltante** y el pedido sigue sin ese artículo.

Las unidades que no estaban pasan de esa ubicación a la zona **FALTANTES**: así la ubicación deja de indicar que las tiene. Si después aparecen, se devuelven con [Mover](Mover); si no, un supervisor las da de baja. Ver [Bajas y faltantes](Bajas-y-faltantes).

> No completes el pedido con un tomo parecido ni lo saques de otra ubicación sin escanear. El faltante bien avisado se resuelve; el reemplazo silencioso genera una devolución.

## Terminar

Cuando no quedan paradas, miDepo avisa **Picking terminado**. Lleva todo a la mesa de empaque y toca **Ir a empacar**, o deja que lo empaque otra persona desde [Empaque](Empaque).

## Preguntas frecuentes

**¿Puedo dejar un pedido por la mitad?** Sí. Queda guardado y en Inicio aparece **Seguir con PED-…**.

**¿Por qué el recorrido pasa por dos ubicaciones para el mismo artículo?** Porque en una sola no había suficientes unidades.

**¿Qué es "Consignación"?** El cliente recibe los artículos y paga lo que vende. Para el picking no cambia nada.

**Tomé de más.** Devuelve la diferencia a la misma ubicación. miDepo no deja confirmar más de lo que pide la parada.
