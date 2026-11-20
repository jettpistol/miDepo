# Empaque

Empaque es preparar las cajas de un pedido que ya pasó por picking. Cada artículo se escanea al entrar a la caja: así la lista de empaque dice la verdad.

Con el paso de [Control](Control) activado, el pedido llega después de pasar por él.

## Paso a paso

1. Ve a **Empaque** y toca el pedido.
2. Escanea el primer artículo. Se abre automáticamente la **Caja 1**.
3. Sigue escaneando lo que va en esa caja. Si son varios iguales, escribe la cantidad.
4. Cuando la caja esté llena, pésala si hay balanza y escribe el **peso real en kg**. Si no hay balanza, déjalo vacío: miDepo usa un peso estimado.
5. Toca **Cerrar caja**.
6. El próximo artículo que escanees abre la **Caja 2**.
7. Cuando todo lo preparado esté en cajas, toca **Terminar pedido**.

La barra de arriba muestra cuántas unidades ya están en cajas.

## Imprimir

Con al menos una caja cerrada aparecen dos botones:

- **Etiquetas:** una por caja, con el cliente, la dirección y "Caja 1 de 3". En térmica de 10 × 15 cm, o cuatro por hoja A4. Al terminar el pedido quedan pendientes en [Etiquetas](Etiquetas).
- **Lista de empaque:** el detalle de qué va en cada caja. Pon una copia dentro de la Caja 1.

> La lista de empaque **no es un remito**. El remito y la factura los hace la oficina en Fierro.

## Si te equivocaste

- **Pusiste un artículo en la caja equivocada:** mientras la caja esté abierta, toca **Sacar** en esa línea (vuelve a "por empacar") o **Vaciar** para sacar todo, y vuelve a escanear lo que va.
- **Cerraste una caja antes de tiempo:** toca **Reabrir** en esa caja. Solo puede haber una caja abierta: cierra la otra primero.
- **Terminaste el pedido y falta algo:** toca **Reabrir empaque** en el aviso verde. Se puede mientras no esté cargado en Fierro; después ya salió del depósito.
- **"… no está entre lo preparado para el pedido":** ese artículo no es de este pedido. Sepáralo y avisa.
- **"Ya empacaste todas las unidades de …":** sobra un artículo. Vuelve a contar la caja.

## Comentarios

Los del picking y el control están al final de la pantalla. Ver [Comentarios](Comentarios).

## Qué pasa después

El pedido queda **empacado** y pasa a [Despacho](Despacho) para cargar sus cajas. También aparece en la pantalla **Fierro** del supervisor, para cargarlo en Fierro. Los artículos siguen contando como stock del depósito hasta que se marca como cargado en Fierro: solo entonces salen.
