# Impresoras y lectores

**Dispositivos** (en Ayuda y ajustes) muestra lo que este equipo usa para imprimir y escanear. Cada navegador es un equipo: la PC del muelle y el teléfono de un operario se configuran por separado.

## Dispositivos

- **Este equipo:** su nombre ("Muelle", "Empaque 1"). Se registra al imprimir o al guardar una impresora.
- **Impresora por etiqueta:** impresora y tamaño para cada tipo de [etiqueta](Etiquetas). Se guarda al elegir. Solo supervisores y administradores la cambian.
- **Lector:** el último escaneo de este equipo y una prueba del lector.
- **Conexiones:** qué puede usar este navegador (USB, puerto serie, Bluetooth, HID, cámara) y los dispositivos autorizados, con su estado.
- **Impresoras:** las de la empresa. **+ Nueva** agrega una con su nombre y modelo.
- **Equipos:** los equipos registrados, con su último uso (supervisores).

## Cómo imprime miDepo hoy

Todo sale por el **diálogo de impresión del sistema**, con cualquier impresora instalada en Windows o Android: térmica de etiquetas, de hojas A4, por USB, por red o por wifi. La impresión directa por USB, puerto serie o Bluetooth, sin diálogo, llega en una próxima versión.

Para que una térmica imprima bien desde el diálogo:

1. Instala el controlador del fabricante (ZDesigner para Zebra, el de TSC, Xprinter o Honeywell).
2. En las preferencias de la impresora en Windows, crea o elige un tamaño de papel igual a la etiqueta (por ejemplo 100 × 50 mm) y el tipo de papel (etiquetas con separación, marca negra o continuo).
3. Imprime la etiqueta de prueba. En el diálogo de Chrome: ese tamaño de papel, márgenes **Ninguno**, escala **100 %**, sin encabezados.

Para no ver el diálogo en una PC que solo imprime etiquetas, Chrome puede abrirse con la opción `--kiosk-printing` en su acceso directo: imprime directo en la impresora predeterminada de Windows. Todo lo que se imprima desde esa ventana de Chrome va a esa impresora.

### Impresoras por wifi o red

Una impresora en wifi o en la red del depósito se agrega en Windows (Configuración → Impresoras → Agregar), y desde ahí la usa el diálogo. Conviene darle una IP fija en el router: si cambia, Windows la pierde.

En Android, la impresora en red se usa con el servicio de impresión del teléfono (Mopria, incluido en la mayoría, o la aplicación del fabricante).

## Impresoras compatibles

miDepo genera las etiquetas en dos lenguajes de impresora, **ZPL** (Zebra) y **TSPL** (TSC y la mayoría de las térmicas chinas), y en página para el diálogo. **Ningún modelo se probó todavía con miDepo**: la columna Fuente dice en qué se apoya cada uno.

| Modelo | Lenguaje | Fuente |
|---|---|---|
| Zebra ZD230, ZD220 | ZPL | Fabricante |
| Zebra ZD421 / ZD411 | ZPL | Fabricante |
| Zebra GC420 / GK420 (discontinuadas) | ZPL | Fabricante |
| Zebra ZQ521 (móvil) | ZPL | Vendedor |
| TSC TE200 / TE210 | TSPL (y ZPL emulado) | Fabricante |
| TSC TTP-244 Pro (discontinuada) | TSPL | Fabricante |
| Honeywell PC42t / PC42d | ZPL emulado | Fabricante (emulación) |
| Godex G500 / RT200 | ZPL emulado | Fabricante (emulación) |
| Citizen CL-S621 | ZPL emulado | Fabricante (emulación) |
| Xprinter XP-420B | TSPL | Vendedor |
| Xprinter XP-365B | TSPL | Fabricante |
| Xprinter XP-470B | TSPL | Sin confirmar |
| 3nStar LTT204 | TSPL | Fabricante |
| iDPRT SP460BT | TSPL | Sin confirmar |
| Zebra ZQ220, Brother QL-800 / QL-820NWB, Dymo LabelWriter 550 | — | Solo diálogo |
| Cualquier impresora A4 | — | Solo diálogo |

Con el diálogo del sistema funcionan todas las de la tabla y cualquier otra con controlador para Windows o Android.

## Lectores compatibles

Cualquier lector que escriba como un teclado: USB, Bluetooth en modo teclado (HID) o con receptor USB. Los terminales Android (Zebra, Honeywell, Urovo, Chainway) funcionan con su salida por teclado (DataWedge o similar); la salida por "intent" no llega al navegador. La cámara del teléfono también lee.

Un lector que escribe como teclado no aparece como dispositivo: el navegador lo ve como un teclado más. miDepo lo reconoce por la velocidad y lo muestra en **Lector**.

### Configurar el lector

Se configura escaneando los códigos de su manual. Lo que conviene:

- **Sufijo Enter (CR)** después de cada lectura.
- **País del teclado** igual al de Windows, normalmente Español (Latinoamérica). Para ver el de Windows: Windows + Espacio.
- **EAN-13, Code 128 e ISBN** activos. Los suplementos de 2 y 5 dígitos, en **Ignorar**.
- Sin prefijos.

### Prueba del lector

En **Dispositivos → Lector**, escanea cualquier código en **Prueba del lector**. miDepo muestra lo que llegó, si llegó a velocidad de lector, lo que lee y qué ajustar en el lector.

## Lo que miDepo corrige solo

| Llega | miDepo lee | Por qué |
|---|---|---|
| `A'01'1` | `A-01-1` | Lector como teclado de EE. UU. en Windows en español |
| `a-01-1` | `A-01-1` | Bloq Mayús activado |
| `]E09789500700016` | `9789500700016` | Prefijo AIM |
| `978950070001612` | `9789500700016` | Suplemento EAN (se ignora) |
| `036000291452` | `0036000291452` | UPC-A de un cómic estadounidense |
| `950070001X` o `978-950-…` | su ISBN-13 | ISBN-10 o ISBN con guiones |

## Problemas frecuentes

### Impresora

| Pasa | Qué hacer |
|---|---|
| Sale en blanco | Papel térmico directo con la impresora en modo ribbon, o al revés; ribbon del lado equivocado. Ajusta el tipo de impresión en las preferencias. |
| Saltea etiquetas o imprime sobre la separación | Calibra: Zebra, mantén FEED hasta que parpadee; TSC, el procedimiento de calibración del manual. Elige separación o marca negra según el rollo. |
| Sale corrida o cortada | El tamaño de papel del controlador no es el de la etiqueta, o la escala del diálogo no es 100 %. Imprime la etiqueta de prueba. |
| Muy clara o muy oscura | Ajusta la oscuridad (darkness) y la velocidad en las preferencias de la impresora. |
| Acentos o Ñ mal | Imprime desde el diálogo con el controlador del fabricante. |
| Imprime texto o códigos en vez de la etiqueta | La impresora está en otro lenguaje o en modo diagnóstico. Apágala y enciéndela; en Zebra, imprime la configuración (FEED + CANCEL 2 s en ZD421). |
| El código de barras no se lee | Muy claro, muy oscuro o sin margen blanco a los costados. Prueba otro tamaño más ancho. |
| La impresora wifi no aparece | Cambió de IP. Dale IP fija en el router y vuelve a agregarla en Windows. |

Para ver la configuración de una Zebra, mantén **FEED + CANCEL** dos segundos (ZD421/ZD621) o FEED hasta el primer parpadeo (modelos anteriores). En TSC y Xprinter, mantén FEED al encender.

### Lector

| Pasa | Qué hacer |
|---|---|
| Escribe el código pero no avanza | Falta el sufijo Enter. Escanea "Add Enter / CR suffix" del manual del lector. |
| Aparece "Sin Enter" en Dispositivos | Lo mismo: el lector no envía Enter. |
| Los guiones llegan como `'` | País del teclado distinto al de Windows. miDepo lo corrige; para corregirlo en el lector, elige Español (Latinoamérica). |
| Todo llega en minúsculas | Bloq Mayús activado. |
| No lee un ISBN o un código interno | Activa EAN-13 o Code 128 en el lector. |
| Lee dos veces | Modo de lectura continua: pásalo a gatillo. |
| El lector Bluetooth deja de escribir | Se durmió o perdió la conexión. Presiona el gatillo para despertarlo o vuelve a vincularlo en modo teclado (HID). |
| En el teléfono aparece el teclado en pantalla | Con un lector Bluetooth en modo teclado, Android oculta el teclado en pantalla; si no, desactívalo en los ajustes de idioma. |

## Modo de prueba

Para probar etiquetas y escaneos sin hardware, un administrador activa **Organización → Modo de prueba**. Aparecen:

- **Impresoras demo** (Zebra ZD421, TSC TE210, Xprinter XP-420B), marcadas como demo. Reciben ZPL o TSPL como una impresora real y guardan lo recibido: en **Dispositivos → Impresoras**, el nombre abre su bandeja, con cada etiqueta dibujada y el programa recibido. **Estado** simula fallas (sin papel, cabezal abierto, sin conexión) para ver el aviso que daría una real.
- **Lector demo**, abajo a la derecha en cada pantalla. Lee un código en el campo de escaneo en uso, o toca uno de los códigos en pantalla. Simula un lector mal configurado: teclado de EE. UU., sin Enter, con prefijo AIM o con suplemento EAN.

Al desactivar el modo de prueba, las impresoras demo y el lector demo desaparecen; los equipos que usaban una impresora demo vuelven al diálogo del sistema.
