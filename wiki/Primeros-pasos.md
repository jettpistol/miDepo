# Primeros pasos

## Qué hace miDepo y qué no

miDepo se ocupa de **lo físico**: en qué estante está cada libro, qué hay que ir a buscar para un pedido, qué llegó y qué volvió.

Todo lo demás sigue en Fierro: el catálogo, los clientes, los pedidos, los remitos, las facturas y las consignaciones. Por eso en miDepo **no se cargan pedidos ni se crean títulos**: llegan solos desde Fierro.

## La pantalla de Inicio

Inicio muestra lo que tienes por hacer y cómo está el depósito.

- **Arriba**, cuatro números. Un operario ve cuánto tiene asignado, cuántas unidades movió hoy, los pedidos para preparar y las unidades por reponer. Un supervisor ve los pedidos para preparar y para empacar, las tareas sin asignar y lo que falta cargar en Fierro. Toca un número para ir a esa pantalla.
- **Asignado a ti**: los pedidos, recepciones, devoluciones, conteos y reposiciones que un supervisor te dio, más el pedido que estás preparando. Cada uno tiene su botón para seguir. Si no tienes nada asignado, aparece el pedido más viejo que no tiene dueño.
- **Pedidos abiertos**: una barra con cuántos pedidos hay en cada etapa, de "para preparar" a "empacados, sin cargar en Fierro".
- **Actividad, últimos 7 días**: unidades recibidas, preparadas y despachadas por día. Pasa el mouse sobre un día para ver los números.
- **Stock esperando en zonas**: lo que espera en Recepción y Devoluciones para reponer, en Faltantes y en Dañados.
- **Equipo** (solo supervisores): qué tiene asignado cada persona, qué pedido está preparando y cuántas unidades movió hoy. La primera fila es lo que no tiene dueño.

Si dejaste un pedido a medio preparar, arriba de todo aparece un botón **Seguir con PED-…** para retomarlo.

## Asignar trabajo (supervisores)

En un pedido, una recepción, una devolución, un conteo o en Reposición, arriba a la derecha está **Asignado a**. Elige a la persona y queda guardado; elige **Sin asignar** para sacárselo. Esa persona lo ve en su Inicio.

Asignar dice de quién es el trabajo, pero no lo bloquea: otra persona puede seguir con él si hace falta. Los operarios ven a quién está asignado, pero no pueden cambiarlo.

## El recorrido de un libro

1. **Llega** al depósito: se cuenta en [Recepción](Recepcion).
2. **Se guarda** en un estante: [Reposición](Reposicion).
3. Un cliente lo pide: se busca en [Picking](Picking).
4. **Se empaca** en una caja: [Empaque](Empaque).
5. La oficina hace el remito en Fierro y la caja **sale**.
6. Si el cliente lo devuelve, se revisa en [Devoluciones](Devoluciones) y vuelve al paso 2.

## Tres reglas que evitan casi todos los problemas

1. **Siempre escanea.** No confirmes de memoria: el estante y el libro se leen con el lector o la cámara.
2. **Si no está, dilo.** En picking, toca **No está en el estante**. No busques por tu cuenta en otro lado sin avisarle a miDepo.
3. **No muevas libros sin registrarlo.** Si cambias algo de lugar, usa [Mover](Mover). Un libro movido "a mano" es un libro perdido.

## Roles

- **Operario:** hace todo el trabajo del día.
- **Supervisor:** además arma conteos, maneja las ubicaciones y trabaja con Fierro.
- **Administrador:** además maneja los usuarios.

Más detalle en [Usuarios y roles](Usuarios-y-roles).
