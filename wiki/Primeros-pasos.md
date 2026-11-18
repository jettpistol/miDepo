# Primeros pasos

## Qué hace miDepo y qué no

miDepo se ocupa de **lo físico**: en qué estante está cada libro, qué hay que ir a buscar para un pedido, qué llegó y qué volvió.

Todo lo demás sigue en Fierro: el catálogo, los clientes, los pedidos, los remitos, las facturas y las consignaciones. Por eso en miDepo **no se cargan pedidos ni se crean títulos**: llegan solos desde Fierro.

## La pantalla de Inicio

Al entrar ves una tarjeta por cada tipo de trabajo, con un número grande: cuánto hay pendiente. Toca una tarjeta para ir a ese trabajo.

Si dejaste un pedido a medio preparar, arriba de todo aparece un botón **Seguir con PED-…** para retomarlo.

## El recorrido de un libro

1. **Llega** al depósito: se cuenta en [Recepción](Recepcion).
2. **Se guarda** en un estante: [Guardar](Guardar).
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
