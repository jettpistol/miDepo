# Primeros pasos

## Qué hace miDepo y qué no

miDepo se ocupa de **lo físico**: en qué ubicación está cada artículo, qué hay que ir a buscar para un pedido, qué llegó y qué volvió.

Todo lo demás sigue en Fierro: el catálogo, los clientes, los pedidos, los remitos, las facturas y las consignaciones. Por eso en miDepo **no se cargan pedidos ni se crean artículos**: llegan automáticamente desde Fierro.

## La pantalla de Inicio

- **Números de arriba.** Operario: asignado, unidades movidas hoy, pedidos para preparar, unidades por reponer. Supervisor: pedidos para preparar y para empacar, tareas sin asignar, para cargar en Fierro. Cada número abre su pantalla.
- **Asignado a ti**: lo que un supervisor te asignó y los pedidos que estás preparando. Muestra 5; el resto, en un enlace por tipo. Sin nada asignado, muestra el pedido más viejo sin asignar.
- **Pedidos abiertos**: pedidos por etapa.
- **Últimos 7 días**: unidades recibidas, preparadas y despachadas por día.
- **Stock en zonas**: unidades en Recepción, Devoluciones, Faltantes y Dañados.
- **Equipo** (supervisores): tareas, pedido en preparación y unidades de hoy por persona. Muestra las 8 personas con más actividad.

Con un pedido a medio preparar, arriba aparece **Seguir con PED-…**: el último en el que escaneaste.

## Asignar trabajo (supervisores)

En un pedido, una recepción, una devolución, un conteo o en Reposición: **Asignado a**, arriba a la derecha. **Sin asignar** lo quita. La persona lo ve en su Inicio.

Asignar no bloquea: otra persona puede seguir con el trabajo. Los operarios ven la asignación pero no la cambian.

## Buscar

El buscador de arriba encuentra cualquier cosa de miDepo. Los resultados vienen en tres pestañas:

- **Funciones:** pantallas, acciones y ajustes. "Nueva devolución", "etiquetas", "color", "PIN".
- **Inventario:** artículos, ubicaciones y documentos. Busca por nombre, autor, ISBN, código de ubicación, número de pedido o recepción, o por el nombre del cliente o proveedor.
- **Guías:** este manual, abierto en la sección que habla de lo que buscaste.

Se abre sola la pestaña que tiene resultados; **Tab** pasa a la siguiente. Con las flechas eliges y con **Enter** abres. Si escaneas un código, lo que coincide exacto aparece primero: **Enter** y estás ahí.

En la computadora, **Ctrl + K** (en Mac, **⌘ + K**) o **/** llevan al buscador desde cualquier pantalla. En el teléfono, toca la lupa de arriba.

## El recorrido de un artículo

1. **Llega** al depósito: se cuenta en [Recepción](Recepcion).
2. **Se repone** en su ubicación: [Reposición](Reposicion).
3. Un cliente lo pide: se busca en [Picking](Picking).
4. **Se empaca** en una caja: [Empaque](Empaque).
5. La oficina hace el remito en Fierro y la caja **sale**.
6. Si el cliente lo devuelve, se revisa en [Devoluciones](Devoluciones) y vuelve al paso 2.

## Tres reglas que evitan casi todos los problemas

1. **Siempre escanea.** No confirmes de memoria: la ubicación y el artículo se leen con el lector o la cámara.
2. **Si no está, dilo.** En picking, toca **No está aquí**. No busques por tu cuenta en otra ubicación sin registrarlo en miDepo.
3. **No muevas artículos sin registrarlo.** Si cambias algo de ubicación, usa [Mover](Mover). Un artículo movido sin registrarlo es un artículo perdido.

## Roles

- **Operario:** hace todo el trabajo del día.
- **Supervisor:** además crea conteos, gestiona las ubicaciones y trabaja con Fierro.
- **Administrador:** además gestiona los usuarios.

Más detalle en [Usuarios y roles](Usuarios-y-roles).
