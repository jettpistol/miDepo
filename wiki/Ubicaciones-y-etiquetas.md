# Ubicaciones y etiquetas

Para que miDepo pueda decir "ve a `A-03-2`", cada ubicación necesita un nombre y una etiqueta con su código de barras. Esta tarea es de supervisores.

## Elegir cómo nombrar las ubicaciones

En **Ubicaciones**, baja hasta el **Generador de ubicaciones**. Hay cuatro modelos:

| Modelo | Ejemplo | Para qué depósito |
|---|---|---|
| Pasillo · Estante · Nivel | `A-03-2` | El más común: pasillos rectos con estanterías. |
| Estantería numerada · Nivel | `E07-3` | Depósitos pequeños, estanterías contra las paredes. |
| Sector · Pasillo · Estante · Nivel | `S1-A-03-2` | Más de un ambiente o de un piso. |
| Estante · Nivel · Posición | `07-3-P2` | Muchos artículos distintos por estante. |

### Adaptar el modelo

1. Toca el modelo que más se parece a tu depósito.
2. En **Ajústalo a tus medidas**, cambia cuántos pasillos, estantes y niveles hay.
3. Puedes agregar o quitar tramos, cambiar letras por números, poner un prefijo y elegir el separador.
4. Mira **3. Vista previa**: muestra los primeros códigos, el último y el total.
5. Toca **Crear estas ubicaciones**.

Las ubicaciones que ya existen no se tocan. Por eso el generador sirve también para **agregar** un pasillo o un nivel más adelante.

### Consejos para elegir

- **Los niveles se cuentan desde abajo.** El nivel 1 es el del piso.
- **Numera en el sentido en que se camina.** El picking recorre los códigos en orden.
- **Que el código se pueda decir en voz alta.** "A, tres, dos" es mejor que un código largo.
- **Deja espacio para crecer.** Si hoy hay 14 estanterías, crea 20.

### Una ubicación suelta

Para una mesa, un pallet o una vitrina, usa **Agregar una ubicación suelta** y escribe el código (`MESA-1`).

## Imprimir las etiquetas

Al crear ubicaciones, sus etiquetas quedan pendientes en [Etiquetas](Etiquetas). Para reimprimir:

1. En **Ubicaciones**, filtra por el comienzo del código (por ejemplo `A-01`) o deja el filtro vacío para todas.
2. Toca **Imprimir etiquetas** y elige el **Tamaño**: rollo térmico (100 × 50 mm por defecto) u hoja A4 autoadhesiva.
3. Pega cada una en el frente de su nivel, a la altura de los ojos si se puede.

En una estantería que dura años conviene etiqueta de transferencia térmica (con ribbon) o papel A4 con cinta transparente ancha por encima: el papel térmico directo se borra en meses.

## Etiquetas para artículos sin ISBN

Las grapas, variantes y packs necesitan una etiqueta con su código interno.

1. En **Ubicaciones**, toca **Etiquetas sin ISBN**.
2. Busca la serie o el artículo.
3. Imprime y pega una etiqueta por ejemplar, o una en la bolsa si van embolsados.

Al cerrar una recepción con artículos sin ISBN, sus etiquetas ya quedan pendientes en [Etiquetas](Etiquetas).

## Desactivar una ubicación

Abre la ubicación y toca **Desactivar**. Solo se puede si está vacía: primero [mueve](Mover) lo que tenga. Una ubicación desactivada se puede reactivar con **Reactivar**.
