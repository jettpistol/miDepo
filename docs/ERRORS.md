# Error codes

Every message miDepo shows when something fails has a code. This file lists all of them.
`tests/errors.test.ts` keeps this file in step with the code: `npm test` fails if a code in `src/` or `scripts/` is missing here, if a code here no longer exists there (or is not in the file named in its row), or if two places use the same code.

## How codes work

- **Format:** `AREA-NN`, for example `RCV-07`. The area says which part of the app raised it; the number is the next free one in that area.
- **What the user sees:** the message, a middle dot, then the code: `Esta recepción ya está cerrada. · RCV-02`. `withCode()` in `src/lib/errors.ts` builds that text. An operator can read the code to a supervisor, who finds it here.
- **In the code:** `throw new UserError("RCV-02", "Esta recepción ya está cerrada.")`. The constructor requires the code. `attempt()` (used by every server action through `action()`) adds the code to what is shown.
- **Unexpected errors** (a bug, the database being down) are never shown as is: the user sees `SYS-01` and the server log gets `[SYS-01]` with the real error.
- **Command-line scripts and configuration** write the code in brackets at the start of the line: `[CLI-02] El código de empresa va en minúsculas…`.
- **Every message is in Spanish, addressing the user as tú (never voseo), and impersonal: the app never says "I"** ("No se encontró ese pedido"), including the ones only a developer sees. The only English that can appear is an error passed through from a library or the database (the `{error}` in `CLI-04` and `CLI-05`, the server log of `SYS-01`).
- **Codes are never reused.** If a message is removed, move its row to [Retired codes](#retired-codes) and do not give its number to anything else. If a message changes wording but means the same, keep its code.

| Area | Part of the app |
|---|---|
| `SYS` | Unexpected failures (any screen) |
| `AUTH` | Logging in (`/ingresar`) and permissions |
| `PKEY` | Passkeys: fingerprint, face or hardware key |
| `ACCT` | Ajustes (`/cuenta`), and the theme switch in the top bar |
| `USER` | Usuarios (`/usuarios`), admin only |
| `SET` | Organización (`/organizacion`): the company's settings, for supervisors and admins |
| `LOC` | Ubicaciones (`/ubicaciones`) |
| `STK` | Stock, moves and scanning a book or a location (any scan screen) |
| `RCV` | Recepción and suppliers |
| `ORD` | Orders in general: Pedidos and marking an order urgent |
| `PICK` | Picking |
| `CTRL` | Control: the second count of a picked order before packing |
| `PACK` | Empaque |
| `RET` | Devoluciones |
| `CNT` | Conteos |
| `ADJ` | Bajas (`/bajas`): write-offs from Faltantes and Dañados |
| `ASG` | Assigning work to a person (the "Asignado a" control, supervisors) |
| `EXP` | Fierro documents (CSV files and marking them as sent) |
| `CAM` | Phone camera used as a scanner |
| `WIKI` | Editing the manual (`/ayuda/editar`), admin only |
| `CFG` | Server configuration (environment variables) |
| `CLI` | Developer scripts: `npm run db:setup`, `company:create`, `scripts/` |

Placeholders in messages are written `{like this}`; the app fills them in.

## SYS: unexpected failures

| Code | Message | Where | When |
|---|---|---|---|
| `SYS-01` | Error inesperado. Prueba de nuevo; si persiste, avisa a un supervisor. | `src/lib/errors.ts` · `attempt` | Any server action threw something that is not a `UserError` (a bug, a database or network failure). The real error is logged as `[SYS-01]`. |

## AUTH: logging in and permissions

| Code | Message | Where | When |
|---|---|---|---|
| `AUTH-01` | Demasiados intentos. Espera {5} minutos y prueba de nuevo. | `src/app/ingresar/actions.ts` · `withRateLimit` | Six failed logins in a row for the same email, or the same company code from the same address. Locked for 5 minutes. |
| `AUTH-02` | Los datos no coinciden. Revísalos y prueba de nuevo. | `src/app/ingresar/actions.ts` · `withRateLimit` | Wrong email or password, wrong company code or PIN, or the user is deactivated. It does not say which on purpose. |
| `AUTH-03` | Completa el email y la contraseña. | `src/app/ingresar/actions.ts` · `loginWithPassword` | Email or password left empty. |
| `AUTH-04` | Escribe el código de empresa. | `src/app/ingresar/actions.ts` · `loginWithPin` | PIN login with no company code. |
| `AUTH-05` | El PIN tiene 6 dígitos. | `src/app/ingresar/actions.ts` · `loginWithPin` | The PIN typed is not exactly 6 digits. |
| `AUTH-06` | Tu usuario no tiene permiso para hacer esto. | `src/lib/session.ts` · `requireSessionInAction` | An action needs a higher role than the user has (for example an operator generating locations). |

## PKEY: passkeys

| Code | Message | Where | When |
|---|---|---|---|
| `PKEY-01` | El intento venció. Prueba de nuevo. | `src/app/api/passkeys/[step]/route.ts` · `login-verify` | Logging in with a passkey took more than 5 minutes, or the challenge cookie is missing or was tampered with. |
| `PKEY-02` | Esta llave no está registrada en miDepo. Inicia sesión de otra forma y regístrala en Ajustes. | `src/app/api/passkeys/[step]/route.ts` · `login-verify` | The passkey offered by the device is unknown, or its user is deactivated. |
| `PKEY-03` | No se pudo verificar la llave. | `src/app/api/passkeys/[step]/route.ts` · `login-verify` | The signature check ran and did not pass. |
| `PKEY-04` | No se pudo verificar la llave. | `src/app/api/passkeys/[step]/route.ts` · `login-verify` | The signature check itself failed (malformed reply, wrong origin or domain). |
| `PKEY-05` | Primero inicia sesión. | `src/app/api/passkeys/[step]/route.ts` · `POST` | Registering a passkey with no session (HTTP 401). |
| `PKEY-06` | El intento venció. Prueba de nuevo. | `src/app/api/passkeys/[step]/route.ts` · `register-verify` | Registering a passkey took more than 5 minutes, or the challenge cookie is missing or was tampered with. |
| `PKEY-07` | No se pudo registrar la llave. | `src/app/api/passkeys/[step]/route.ts` · `register-verify` | The registration check ran and did not pass. |
| `PKEY-08` | No se pudo registrar la llave. | `src/app/api/passkeys/[step]/route.ts` · `register-verify` | The registration check failed, or saving the passkey failed. |
| `PKEY-09` | Paso desconocido. | `src/app/api/passkeys/[step]/route.ts` · `POST` | A request to a passkey step that does not exist (HTTP 404). Only reachable by calling the API by hand. |
| `PKEY-10` | Se canceló el inicio de sesión con huella o llave. | `src/app/ingresar/LoginForm.tsx` · `withPasskey` | The user cancelled the device's passkey prompt, or it timed out. Shown in the browser. |
| `PKEY-11` | No se pudo iniciar sesión con huella o llave. | `src/app/ingresar/LoginForm.tsx` · `withPasskey` | The browser failed without a message (no passkey support, no network). Shown in the browser. |
| `PKEY-12` | Se canceló el registro. | `src/app/(app)/cuenta/Passkeys.tsx` · `AddPasskey` | The user cancelled the device's prompt while adding a passkey. |
| `PKEY-13` | Este dispositivo ya tiene una llave registrada para tu usuario. | `src/app/(app)/cuenta/Passkeys.tsx` · `AddPasskey` | The device already holds a passkey for this user. |
| `PKEY-14` | Este dispositivo no permite registrar una llave. | `src/app/(app)/cuenta/Passkeys.tsx` · `AddPasskey` | The browser failed without a message (no passkey support, no network). |

## ACCT: Ajustes

| Code | Message | Where | When |
|---|---|---|---|
| `ACCT-01` | Ese color no es válido. | `src/app/(app)/cuenta/actions.ts` · `saveAppearance` | The accent colour is not a `#RRGGBB` value. Only reachable by editing the form by hand. |
| `ACCT-02` | Elige una tipografía de la lista. | `src/app/(app)/cuenta/actions.ts` · `saveAppearance` | The font is not one of the offered ones. |
| `ACCT-03` | Elige un tema. | `src/app/(app)/cuenta/actions.ts` · `validTheme` | The theme sent by Ajustes or the top-bar switch is not light, dark or system. |
| `ACCT-04` | La contraseña actual no es correcta. | `src/app/(app)/cuenta/actions.ts` · `changePassword` | Changing the password with the wrong current password. |
| `ACCT-05` | La contraseña nueva necesita al menos 8 caracteres. | `src/app/(app)/cuenta/actions.ts` · `changePassword` | New password shorter than 8 characters. |
| `ACCT-06` | El PIN debe tener exactamente 6 dígitos. | `src/app/(app)/cuenta/actions.ts` · `changePin` | New PIN is not exactly 6 digits. |
| `ACCT-07` | Ese PIN no está disponible. Elige otro. | `src/app/(app)/cuenta/actions.ts` · `changePin` | Someone else in the company already uses that PIN (or saving failed). |
| `ACCT-08` | No se pudo leer esa imagen. Prueba con otra foto. | `src/app/(app)/cuenta/actions.ts` · `savePhoto` | The uploaded photo did not arrive as a JPEG data URL. |
| `ACCT-09` | No se pudo leer esa imagen. Prueba con otra foto. | `src/app/(app)/cuenta/actions.ts` · `savePhoto` | The photo is not a JPEG, or is under 100 bytes or over 200 KB after the browser shrank it. |
| `ACCT-10` | Ese archivo no es una imagen que pueda usar. Prueba con una foto JPG o PNG. | `src/app/(app)/cuenta/Photo.tsx` · `choose` | The browser could not open or crop the chosen file. |

## USER: Usuarios (admin)

| Code | Message | Where | When |
|---|---|---|---|
| `USER-01` | La contraseña necesita al menos 8 caracteres. | `src/app/(app)/usuarios/actions.ts` · `validatePassword` | Creating a user or setting their access with a password under 8 characters. |
| `USER-02` | El PIN debe tener exactamente 6 dígitos. | `src/app/(app)/usuarios/actions.ts` · `validatePin` | Creating a user or setting their access with a PIN that is not 6 digits. |
| `USER-03` | No se encontró a esa persona. | `src/app/(app)/usuarios/actions.ts` · `ofCompany` | The user does not exist or belongs to another company. |
| `USER-04` | Completa el nombre y un email válido. | `src/app/(app)/usuarios/actions.ts` · `create` | Name empty or email not shaped like an email. |
| `USER-05` | Elige un rol. | `src/app/(app)/usuarios/actions.ts` · `create` | Creating a user with no valid role. |
| `USER-06` | Asigna una contraseña, un PIN o ambos para que pueda iniciar sesión. | `src/app/(app)/usuarios/actions.ts` · `create` | Creating a user with neither password nor PIN. |
| `USER-07` | Elige un rol. | `src/app/(app)/usuarios/actions.ts` · `changeRole` | Changing a role to one that does not exist. |
| `USER-08` | No puedes cambiar tu propio rol. Debe hacerlo otro administrador. | `src/app/(app)/usuarios/actions.ts` · `changeRole` | An admin tried to change their own role. |
| `USER-09` | No puedes desactivar tu propio usuario. | `src/app/(app)/usuarios/actions.ts` · `toggleActive` | An admin tried to deactivate themselves. |
| `USER-10` | Escribe una contraseña nueva, un PIN nuevo o ambos. | `src/app/(app)/usuarios/actions.ts` · `setAccess` | Saving access with both fields empty. |
| `USER-11` | Ese email o ese PIN ya lo usa otra persona. | `src/app/(app)/usuarios/actions.ts` · `create` | The database refused a duplicate email or PIN (Postgres 23505). |
| `USER-12` | Ese PIN ya lo usa otra persona. Elige otro. | `src/app/(app)/usuarios/actions.ts` · `setAccess` | The database refused a duplicate PIN (Postgres 23505). |

## SET: Organización

| Code | Message | Where | When |
|---|---|---|---|
| `SET-01` | Para pedidos grandes, escribe desde cuántas unidades: un número entero de 2 o más. | `src/lib/flows/settings.ts` · `saveControlSettings` | Choosing Control for large orders without a valid threshold. |
| `SET-02` | Elige cómo se controlan los pedidos. | `src/lib/flows/settings.ts` · `saveControlSettings` | The form sent no valid choice of where orders are checked. |
| `SET-03` | Elige cómo se separa el lote. | `src/lib/flows/settings.ts` · `saveBatchSorting` | The batch sorting setting got a value that is not one of the two options. Replaces `ACCT-11`. |
| `SET-04` | Escribe el nombre de la organización. | `src/lib/flows/settings.ts` · `renameOrganization` | Saving the name empty (or only spaces). |
| `SET-05` | El nombre tiene como máximo {80} caracteres. | `src/lib/flows/settings.ts` · `renameOrganization` | The name is longer than `MAX_NAME`. |
| `SET-06` | El código va en minúsculas y sin espacios: de 2 a 20 letras, números o guiones. | `src/lib/flows/settings.ts` · `changeOrganizationCode` | The new company code is not 2–20 characters of `a-z`, `0-9` and `-` (same rule as `CLI-02`). |
| `SET-07` | Ese código ya lo usa otra organización. Elige otro. | `src/lib/flows/settings.ts` · `changeOrganizationCode` | Another company already has that code. |

## LOC: Ubicaciones

`LOC-06` to `LOC-11` are also shown while the scheme is edited, without the code (that is an as-you-type warning). They get their code when the server refuses the scheme.

| Code | Message | Where | When |
|---|---|---|---|
| `LOC-01` | No se pudo leer el esquema. Recarga la página y prueba de nuevo. | `src/app/(app)/ubicaciones/actions.ts` · `generate` | The scheme sent by the generator is not valid JSON (stale page, edited form). |
| `LOC-02` | El código admite letras, números, guiones y puntos (hasta 20 caracteres, sin espacios ni Ñ). | `src/app/(app)/ubicaciones/actions.ts` · `createStandalone` | A single location code with characters that are not allowed, or over 20 characters. |
| `LOC-03` | La ubicación {código} ya existe. | `src/app/(app)/ubicaciones/actions.ts` · `createStandalone` | Creating a location whose code already exists. |
| `LOC-04` | Esa ubicación no se puede desactivar. | `src/app/(app)/ubicaciones/actions.ts` · `toggle` | The location does not exist or is a zone (RECEPCION, DEVOLUCIONES…), not a shelf. |
| `LOC-05` | Todavía hay artículos en esta ubicación. Muévelos antes de desactivarla. | `src/app/(app)/ubicaciones/actions.ts` · `toggle` | Deactivating a shelf that still holds stock. |
| `LOC-06` | El esquema necesita entre 1 y 5 tramos. | `src/lib/locations.ts` · `validateScheme` | The scheme has no segments or more than 5. |
| `LOC-07` | El separador puede ser guion, punto, barra, guion bajo o nada. | `src/lib/locations.ts` · `validateScheme` | Separator is not `-`, `.`, `/`, `_`, a space or empty. |
| `LOC-08` | Cada tramo necesita un nombre. | `src/lib/locations.ts` · `validateScheme` | A segment has an empty name. |
| `LOC-09` | "{tramo}": la cantidad va de 1 a 999. | `src/lib/locations.ts` · `validateScheme` | A segment's quantity is not a whole number from 1 to 999. |
| `LOC-10` | "{tramo}": el prefijo admite hasta 4 letras o números. | `src/lib/locations.ts` · `validateScheme` | A segment's prefix has symbols or more than 4 characters. |
| `LOC-11` | Son demasiadas ubicaciones (máximo {MAX_LOCATIONS}). | `src/lib/locations.ts` · `validateScheme` | The scheme would generate more locations than the limit. |

## STK: stock, moves and scanning

These come from shared helpers, so they can appear on any scan screen (Mover, Guardar, Recepción, Picking, Empaque, Devoluciones, Conteos).

| Code | Message | Where | When |
|---|---|---|---|
| `STK-01` | La cantidad tiene que ser un número mayor que cero. | `src/lib/stock.ts` · `moveStock` | A stock movement with a quantity that is not a positive whole number. Normally caught earlier by `STK-10`. |
| `STK-02` | El origen y el destino son la misma ubicación. | `src/lib/stock.ts` · `moveStock` | Moving stock from a location to itself. |
| `STK-03` | No hay tantas unidades de ese artículo en la ubicación de origen. | `src/lib/stock.ts` · `moveStock` | Taking more units of a title than the source location holds. |
| `STK-04` | Escanea o escribe el código del artículo. | `src/lib/stock.ts` · `findProduct` | The book field is empty. |
| `STK-05` | El código "{código}" no está en el catálogo. Si es un artículo nuevo, pide que sincronicen con Fierro. | `src/lib/stock.ts` · `findProduct` | No title of the company has that barcode, ISBN or internal code. |
| `STK-06` | Escanea o escribe la ubicación. | `src/lib/stock.ts` · `findLocation` | The location field is empty. |
| `STK-07` | No existe la ubicación "{código}". | `src/lib/stock.ts` · `findLocation` | No location of the company has that code. |
| `STK-08` | La ubicación "{código}" está desactivada. | `src/lib/stock.ts` · `findLocation` | The location exists but is deactivated. |
| `STK-09` | Los pedidos preparados no se mueven manualmente: salen cuando se despacha el pedido. | `src/lib/flows/move.ts` · `move` | Moving stock into or out of the staging zone (picked orders) by hand. |
| `STK-11` | Nada pasa a Faltantes manualmente: solo ocurre cuando un artículo no está en su ubicación durante el picking. | `src/lib/flows/move.ts` · `move` | Moving stock into FALTANTES by hand. Moving out of it is allowed: that is how a missing book comes back. |
| `STK-12` | Ese movimiento no se puede deshacer desde aquí. | `src/lib/flows/move.ts` · `undoMove` | Undoing a movement that was not a manual move (picking, a count, a receiving…). Only reachable by editing the form. |
| `STK-13` | Solo quien hizo el movimiento puede deshacerlo. | `src/lib/flows/move.ts` · `undoMove` | Undoing somebody else's move. The screen lists only your own. |
| `STK-14` | Ese movimiento ya se deshizo. | `src/lib/flows/move.ts` · `undoMove` | Undoing the same move twice. |
| `STK-15` | Esas unidades ya no están todas en el destino. Muévelas a mano. | `src/lib/flows/move.ts` · `undoMove` | Undoing a move after some of the units left the destination. |
| `STK-16` | El archivo tiene más de 20000 filas. Divídelo en varios. | `src/lib/flows/stockLoad.ts` · `applyLoad` | Loading an opening stock file with too many rows. |
| `STK-17` | El archivo no tiene filas para cargar. | `src/lib/flows/stockLoad.ts` · `applyLoad` | Loading an empty opening stock file. |
| `STK-18` | {n} filas tienen errores. Corrígelas y vuelve a subir el archivo. | `src/lib/flows/stockLoad.ts` · `applyLoad` | Loading an opening stock file in which some row names an unknown code or location, or a wrong quantity. |
| `STK-19` | No se encontró esa carga. | `src/lib/flows/stockLoad.ts` · `undoLoad` | Undoing a stock load that does not exist or belongs to another company. |
| `STK-20` | La carga {número} ya se deshizo. | `src/lib/flows/stockLoad.ts` · `undoLoad` | Undoing a stock load twice. |
| `STK-21` | Parte de la carga {número} ya se movió. Corrige las diferencias con un conteo. | `src/lib/flows/stockLoad.ts` · `undoLoad` | Undoing a stock load after some of its units were moved, picked or written off. |
| `STK-10` | La cantidad tiene que ser un número entero mayor que cero. | `src/lib/flows/common.ts` · `validQuantity` | A scanned quantity that is not a whole number from 1 to 100,000. Used by every scan flow. |

## RCV: Recepción and suppliers

| Code | Message | Where | When |
|---|---|---|---|
| `RCV-01` | No se encontró esa recepción. | `src/lib/flows/receiving.ts` · `open` | The receiving does not exist or belongs to another company. |
| `RCV-02` | Esta recepción ya está cerrada. | `src/lib/flows/receiving.ts` · `open` | Scanning into, correcting or closing a receiving that is already closed. |
| `RCV-03` | Elige un proveedor de la lista. | `src/lib/flows/receiving.ts` · `createUnannouncedReceiving` | Starting an unannounced receiving with no supplier, or one from another company. |
| `RCV-04` | Escribe el nombre del proveedor. | `src/lib/flows/receiving.ts` · `createSupplier` | New supplier name shorter than 2 characters. |
| `RCV-05` | El nombre es demasiado largo. | `src/lib/flows/receiving.ts` · `createSupplier` | New supplier name over 80 characters. |
| `RCV-06` | El nombre tiene que tener letras. | `src/lib/flows/receiving.ts` · `createSupplier` | New supplier name has no letters (only numbers or symbols). |
| `RCV-07` | Ya existe: {proveedor}. Elígelo de la lista. | `src/lib/flows/receiving.ts` · `createSupplier` | A supplier with the same name exists, ignoring case and accents. |
| `RCV-08` | ¿Es {proveedor}? Ya existe un proveedor casi igual. Elígelo de la lista. | `src/lib/flows/receiving.ts` · `createSupplier` | A supplier with a nearly identical name exists: one or two letters apart, for names of 6 letters or more. |
| `RCV-09` | Escribe un número de cero para arriba. | `src/lib/flows/receiving.ts` · `setReceived` | Correcting a received quantity to a negative or non-whole number. |
| `RCV-10` | La recepción no tiene artículos escaneados. | `src/lib/flows/receiving.ts` · `closeReceiving` | Closing a receiving with nothing received. |
| `RCV-11` | No se pudo crear el proveedor. | `src/app/(app)/recepcion/actions.ts` · `addSupplier` | Creating a supplier from the dropdown failed without a message. Should not happen: any failure there already has its own code. |
| `RCV-12` | Esta recepción todavía está abierta. | `src/lib/flows/receiving.ts` · `reopenReceiving` | Reopening a receiving that is not closed. |
| `RCV-13` | Esta recepción ya se cargó en Fierro. No se puede reabrir. | `src/lib/flows/receiving.ts` · `reopenReceiving` | Reopening a receiving already marked as loaded in Fierro. |
| `RCV-14` | Parte de lo recibido ya se guardó en una ubicación. Devuélvelo a Recepción con Mover para poder reabrir. | `src/lib/flows/receiving.ts` · `reopenReceiving` | Reopening a receiving when RECEPCION holds fewer units of a title than it received. |
| `RCV-15` | No se encontró ese proveedor. | `src/lib/flows/receiving.ts` · `deleteSupplier` | The supplier does not exist or belongs to another company. |
| `RCV-16` | Ese proveedor viene de Fierro. Se borra allí. | `src/lib/flows/receiving.ts` · `deleteSupplier` | Deleting a supplier that came from Fierro. The screen offers it only for suppliers created in miDepo. |
| `RCV-17` | Ese proveedor ya tiene recepciones y no se puede borrar. | `src/lib/flows/receiving.ts` · `deleteSupplier` | Deleting a supplier some receiving uses. The screen disables the button first. |

## ORD: orders

| Code | Message | Where | When |
|---|---|---|---|
| `ORD-01` | No se encontró ese pedido. | `src/lib/flows/orders.ts` · `setUrgent` | Marking urgent an order that does not exist or belongs to another company. |
| `ORD-02` | El pedido {número} ya está empacado: la urgencia no cambia nada. | `src/lib/flows/orders.ts` · `setUrgent` | Marking urgent an order already packed, shipped or cancelled. |

## PICK: Picking

| Code | Message | Where | When |
|---|---|---|---|
| `PICK-01` | No se encontró ese pedido. | `src/lib/flows/picking.ts` · `orderOf` | The order does not exist or belongs to another company. |
| `PICK-02` | Ese pedido ya lo tomó otra persona. | `src/lib/flows/picking.ts` · `takeOrder` | Two people tried to take the same order; the other one got it first. Taking an order you already have opens it instead. |
| `PICK-03` | No se encontró esa parada del recorrido. | `src/lib/flows/picking.ts` · `taskOf` | The pick task does not exist or belongs to another company. |
| `PICK-04` | Esa parada ya está resuelta. | `src/lib/flows/picking.ts` · `taskOf`, `confirmBatchPick`, `markBatchShort` | Confirming or marking short a stop that is already done (also a stop of a batch). |
| `PICK-05` | Estás en {ubicación}, pero esta parada es en otra ubicación. Revisa la etiqueta. | `src/lib/flows/picking.ts` · `confirmPick`, `confirmBatchPick` | The scanned location is not the stop's location. |
| `PICK-06` | Ese es "{artículo}". No es el artículo que pide esta parada. | `src/lib/flows/picking.ts` · `confirmPick`, `confirmBatchPick` | The scanned book is not the one the stop asks for. |
| `PICK-07` | Esta parada pide {n}. Si tomaste de más, devuelve {sobrante} a la ubicación. | `src/lib/flows/picking.ts` · `confirmPick`, `confirmBatchPick` | Picking more units than the stop still needs. |
| `PICK-08` | El pedido {número} ya pasó por empaque. Su picking ya no se puede cambiar. | `src/lib/flows/picking.ts` · `releaseOrder`, `unpick`, `undoShort` | Dropping an order, undoing a pick or undoing a shortage report once the order is packed or shipped. |
| `PICK-09` | Nadie está preparando el pedido {número}. | `src/lib/flows/picking.ts` · `releaseOrder` | Dropping an order that is still pending (somebody dropped it already). |
| `PICK-10` | Este pedido lo está preparando {nombre}. Solo esa persona o un supervisor puede soltarlo. | `src/lib/flows/picking.ts` · `releaseOrder` | An operator tries to drop an order somebody else took. The screen disables the button first. |
| `PICK-11` | Ya hay cajas armadas para este pedido. Vacíalas en empaque antes de soltarlo. | `src/lib/flows/picking.ts` · `releaseOrder`, `releaseBatch` | Dropping an order whose packing has started. The screen disables the button first. |
| `PICK-12` | El pedido cambió mientras tanto. Recarga la página. | `src/lib/flows/picking.ts` · `releaseOrder` | Two people act on the same order at the same moment and the other got there first. |
| `PICK-13` | En esta parada todavía no se tomó nada. | `src/lib/flows/picking.ts` · `unpick`, `unpickBatchStop` | Undoing a pick on a stop with nothing picked (for example, pressed twice). |
| `PICK-14` | Parte de esto ya está en una caja. Sácalo de la caja en empaque primero. | `src/lib/flows/picking.ts` · `unpick` | Undoing a pick whose units are already in a box. |
| `PICK-15` | Esa parada no está marcada como no encontrada. | `src/lib/flows/picking.ts` · `undoShort`, `undoBatchShort` | Undoing a shortage report on a stop that is not short, or on a title with no stock anywhere (nothing was reported). |
| `PICK-16` | Las paradas que la reemplazaron ya avanzaron. Deshaz esas primero. | `src/lib/flows/picking.ts` · `undoShort` | Undoing a shortage report after the extra stop miDepo added elsewhere was picked or reported short too. |
| `PICK-17` | Esas unidades ya no están en Faltantes: se encontraron o se dieron de baja. | `src/lib/flows/picking.ts` · `undoShort` | Undoing a shortage report after a supervisor wrote the units off or somebody moved them out of FALTANTES. |
| `PICK-18` | Primero deshaz el aviso de que no estaba en la ubicación. | `src/lib/flows/picking.ts` · `unpick` | Undoing a partial pick on a stop that was then reported short. |
| `PICK-19` | El pedido {número} ya no figura como pendiente en Fierro. | `src/lib/flows/picking.ts` · `takeOrder` | Taking an order a sync cancelled because Fierro stopped listing it. |
| `PICK-20` | El pedido {número} tiene {n} artículos que no están en el catálogo. Sincroniza con Fierro cuando estén cargados. | `src/lib/flows/picking.ts` · `takeOrder` | Taking an order whose Fierro lines name articles missing from the synced catalogue. |
| `PICK-21` | Fierro cambió el pedido {número}. Sincroniza antes de prepararlo. | `src/lib/flows/picking.ts` · `takeOrder` | Taking a released order whose change from Fierro has not been applied yet. |
| `PICK-22` | No hay pedidos pendientes para preparar. | `src/lib/flows/picking.ts` · `takeAll` | "Preparar todos" when no order can be taken (none pending, or the pending ones were changed in Fierro or have titles not in the catalogue). |
| `PICK-23` | No se encontró ese lote. | `src/lib/flows/picking.ts` · `batchOf` | The batch does not exist or belongs to another company. |
| `PICK-24` | Este lote lo está preparando {nombre}. Solo esa persona o un supervisor puede soltarlo. | `src/lib/flows/picking.ts` · `releaseBatch` | Dropping someone else's batch without being a supervisor. The screen disables the button with this reason first. |

## CTRL: Control

| Code | Message | Where | When |
|---|---|---|---|
| `CTRL-01` | No se encontró ese pedido. | `src/lib/flows/control.ts` · `orderToControl` | The order does not exist or belongs to another company. |
| `CTRL-02` | Este pedido no está esperando control. | `src/lib/flows/control.ts` · `orderToControl` | The order is still being picked, or already passed Control (or the step was turned off). |
| `CTRL-03` | Preparaste este pedido: lo tiene que controlar otra persona. | `src/lib/flows/control.ts` · `orderToControl` | The company does not let the picker do the check (Ajustes) and the person controlling is the one who picked it. |
| `CTRL-04` | "{artículo}" no está entre lo preparado para el pedido {número}. Devuélvelo a su ubicación. | `src/lib/flows/control.ts` · `checkUnit` | The book in the cart is not in the order, or none of it was picked. In stock terms it never left its shelf. |
| `CTRL-05` | Ya están controladas todas las unidades de "{artículo}". Las que sobran vuelven a su ubicación. | `src/lib/flows/control.ts` · `checkUnit` | Every picked unit of that title was already counted: the cart has extra copies. |
| `CTRL-06` | De "{artículo}" quedan {n} por controlar, no {m}. | `src/lib/flows/control.ts` · `checkUnit` | Counting more units than are left to control (also when two scans race). |
| `CTRL-07` | En ese artículo no falta nada. | `src/lib/flows/control.ts` · `reportMissing` | Marking a title as missing from the cart when every picked unit was counted. |
| `CTRL-08` | Quedan {n} unidades sin controlar. Escanéalas o márcalas como faltantes. | `src/lib/flows/control.ts` · `finishControl` | Finishing Control with picked units not counted. |

## PACK: Empaque

| Code | Message | Where | When |
|---|---|---|---|
| `PACK-01` | No se encontró ese pedido. | `src/lib/flows/packing.ts` · `orderToPack` | The order does not exist or belongs to another company. |
| `PACK-02` | Este pedido todavía no terminó el picking. | `src/lib/flows/packing.ts` · `orderToPack` | Packing an order that is pending or still being picked. |
| `PACK-03` | Este pedido ya está empacado. | `src/lib/flows/packing.ts` · `orderToPack` | Packing an order that is already packed (or later). |
| `PACK-04` | "{artículo}" no está entre lo preparado para el pedido {número}. | `src/lib/flows/packing.ts` · `scanIntoBox` | The scanned book is not in the order, or none of it was picked. |
| `PACK-05` | Ya están empacadas todas las unidades de "{artículo}". | `src/lib/flows/packing.ts` · `scanIntoBox` | Every picked unit of that title is already in a box. |
| `PACK-06` | De "{artículo}" quedan {n} por empacar, no {m}. | `src/lib/flows/packing.ts` · `scanIntoBox` | Packing more units than are left to pack. |
| `PACK-07` | Esa caja no está abierta. | `src/lib/flows/packing.ts` · `closeBox` | Closing a box that does not exist or is already closed. |
| `PACK-08` | La caja está vacía. | `src/lib/flows/packing.ts` · `closeBox` | Closing a box with nothing in it. |
| `PACK-09` | Solo se puede vaciar una caja abierta. | `src/lib/flows/packing.ts` · `emptyBox` | Emptying a box that does not exist or is closed. |
| `PACK-10` | Quedan {n} unidades preparadas sin empacar. | `src/lib/flows/packing.ts` · `finishPacking` | Finishing packing with picked units not yet in a box. |
| `PACK-11` | Cierra la caja abierta antes de terminar. | `src/lib/flows/packing.ts` · `finishPacking` | Finishing packing with a box still open. |
| `PACK-12` | Todavía no hay ninguna caja. | `src/lib/flows/packing.ts` · `finishPacking` | Finishing packing an order with picked units but no boxes. |
| `PACK-13` | No se encontró esa caja. | `src/lib/flows/packing.ts` · `removeFromBox`, `reopenBox` | The box does not exist or belongs to another company. Only reachable by editing the form. |
| `PACK-14` | Esa caja está cerrada. Reábrela para sacar algo. | `src/lib/flows/packing.ts` · `removeFromBox` | Taking a title out of a closed box. |
| `PACK-15` | Ese artículo no está en la caja. | `src/lib/flows/packing.ts` · `removeFromBox` | Taking out a title that is not in the box (for example, pressed twice). |
| `PACK-16` | Esa caja ya está abierta. | `src/lib/flows/packing.ts` · `reopenBox` | Reopening a box that is open. |
| `PACK-17` | La caja {n} está abierta. Ciérrala antes de reabrir otra. | `src/lib/flows/packing.ts` · `reopenBox` | Reopening a box while another box of the order is open. The screen disables the button first. |
| `PACK-18` | Este pedido ya se cargó en Fierro y salió del depósito. No se puede reabrir. | `src/lib/flows/packing.ts` · `reopenPacking` | Reopening packing of a shipped order. |
| `PACK-19` | Este pedido todavía no se terminó de empacar. | `src/lib/flows/packing.ts` · `reopenPacking` | Reopening packing of an order that is not packed. |
| `PACK-20` | Este pedido todavía no pasó por control. | `src/lib/flows/packing.ts` · `orderToPack` | Packing an order that is waiting in Control. |
| `PACK-21` | Preparaste este pedido: lo tiene que empacar otra persona. | `src/lib/flows/packing.ts` · `orderToPack` | The company does not let the picker do the check (Ajustes), the order skipped Control, and the person packing is the one who picked it. |

## RET: Devoluciones

| Code | Message | Where | When |
|---|---|---|---|
| `RET-01` | Elige un cliente de la lista. | `src/lib/flows/returns.ts` · `createReturn` | Starting a return with no customer, or one from another company. |
| `RET-02` | No se encontró esa devolución. | `src/lib/flows/returns.ts` · `open` | The return does not exist or belongs to another company. |
| `RET-03` | Esta devolución ya está cerrada. | `src/lib/flows/returns.ts` · `open` | Scanning into, editing or closing a return that is already closed. |
| `RET-04` | Elige en qué estado está el artículo. | `src/lib/flows/returns.ts` · `scanReturn` | Scanning a returned book without choosing its condition. |
| `RET-05` | La devolución no tiene artículos escaneados. | `src/lib/flows/returns.ts` · `closeReturn` | Closing a return with no books. |
| `RET-06` | Esta devolución todavía está abierta. | `src/lib/flows/returns.ts` · `reopenReturn` | Reopening a return that is not closed. |
| `RET-07` | Esta devolución ya se cargó en Fierro. No se puede reabrir. | `src/lib/flows/returns.ts` · `reopenReturn` | Reopening a return already marked as loaded in Fierro. |
| `RET-08` | Parte de lo devuelto ya salió de {zona}. Devuélvelo ahí con Mover para poder reabrir. | `src/lib/flows/returns.ts` · `reopenReturn` | Reopening a return after some of its units were put away or moved. |

## CNT: Conteos

| Code | Message | Where | When |
|---|---|---|---|
| `CNT-01` | Escribe un nombre para el conteo (por ejemplo: Pasillo A, noviembre). | `src/lib/flows/counts.ts` · `createCount` | Creating a count with no name. |
| `CNT-02` | Escribe con qué empiezan las ubicaciones a contar (por ejemplo: A-01). | `src/lib/flows/counts.ts` · `createCount` | Creating a count with no location prefix. |
| `CNT-03` | No hay ubicaciones que empiecen con "{prefijo}". | `src/lib/flows/counts.ts` · `createCount` | No active shelf starts with that prefix. |
| `CNT-04` | Son más de {300} ubicaciones. Divide el conteo en tramos más pequeños. | `src/lib/flows/counts.ts` · `createCount` | The prefix covers more shelves than one count allows. |
| `CNT-05` | No se encontró ese conteo. | `src/lib/flows/counts.ts` · `isOpen` | The count does not exist or belongs to another company. |
| `CNT-06` | Este conteo ya está cerrado. | `src/lib/flows/counts.ts` · `isOpen` | Scanning into, editing or closing a count that is already closed. |
| `CNT-07` | Esa ubicación no es parte de este conteo. | `src/lib/flows/counts.ts` · `countLocation` | The location is not one of the count's locations. |
| `CNT-08` | Esta ubicación ya se dio por contada. | `src/lib/flows/counts.ts` · `scanCount` | Scanning into a location already marked as counted. |
| `CNT-09` | Escribe un número de cero para arriba. | `src/lib/flows/counts.ts` · `setCounted` | Correcting a counted quantity to a negative or non-whole number. |
| `CNT-10` | Todavía no hay ninguna ubicación contada. | `src/lib/flows/counts.ts` · `closeCount` | Closing a count with no location marked as counted. |
| `CNT-11` | Hay diferencias grandes sin recontar. Pide el recuento antes de aprobar. | `src/lib/flows/counts.ts` · `closeCount` | Approving while a counted location has a difference of 5+ units or 20%+ (from 2 units) that nobody has recounted. The screen disables the button first. |
| `CNT-12` | El recuento debe hacerlo otra persona. | `src/lib/flows/counts.ts` · `scanCount`, `markLocation` | The person who counted a location first tries to scan into it or finish it during its recount. |
| `CNT-13` | Esa ubicación todavía no se contó. | `src/lib/flows/counts.ts` · `requestRecount` | Asking for a recount of a location that is not marked as counted. |
| `CNT-14` | Elige el motivo de lo que falta. | `src/lib/flows/counts.ts` · `closeCount` | Approving with a cause for the losses that is not in the list. Only reachable by editing the form. |

## ADJ: Bajas

| Code | Message | Where | When |
|---|---|---|---|
| `ADJ-01` | Solo se da de baja lo que está en Faltantes o en Dañados. | `src/lib/flows/adjustments.ts` · `writeOff` | Writing off from a location that is not FALTANTES or DANADOS, or from another company's. Only reachable by editing the form. |
| `ADJ-02` | Elige el motivo de la baja. | `src/lib/flows/adjustments.ts` · `writeOff` | Writing off with no cause, or with "Apareció", which is not a loss. |
| `ADJ-03` | Ese artículo no está en el catálogo. | `src/lib/flows/adjustments.ts` · `writeOff` | The title does not exist or belongs to another company. Only reachable by editing the form. |
| `ADJ-04` | No se encontró esa baja. | `src/lib/flows/adjustments.ts` · `undoWriteOff` | The adjustment does not exist or belongs to another company. |
| `ADJ-05` | Ese ajuste es parte de un conteo aprobado y no se puede deshacer. | `src/lib/flows/adjustments.ts` · `undoWriteOff` | Undoing an adjustment made by a count. The screen offers undo only for write-offs. |
| `ADJ-06` | Esa baja ya se cargó en Fierro. No se puede deshacer. | `src/lib/flows/adjustments.ts` · `undoWriteOff` | Undoing a write-off already marked as loaded in Fierro. |

Writing off more units than the zone holds is refused by `STK-03`.

## ASG: assigning work

| Code | Message | Where | When |
|---|---|---|---|
| `ASG-01` | Tipo de tarea desconocido. | `src/lib/flows/assignments.ts` · `assign` | The kind sent is not an order, receiving, return, count or put-away zone. Only reachable by editing the form. |
| `ASG-02` | No se encontró. | `src/lib/flows/assignments.ts` · `assign` | The document or zone does not exist, belongs to another company, or (put-away) the location is not RECEPCION or DEVOLUCIONES. |
| `ASG-03` | {Pedido PED-00012} sin trabajo pendiente. | `src/lib/flows/assignments.ts` · `assign` | Assigning an order already packed or shipped, or a closed receiving, return or count (for example, someone closed it while the page was open). |
| `ASG-04` | Elige una persona de la lista. | `src/lib/flows/assignments.ts` · `assign` | The person chosen does not exist, is deactivated, or belongs to another company. Only reachable by editing the form or a stale page. |

## EXP: Fierro documents

| Code | Message | Where | When |
|---|---|---|---|
| `EXP-01` | No se encontró ese pedido. | `src/lib/flows/exports.ts` · `fileFor` | Downloading the CSV of an order that does not exist or belongs to another company. |
| `EXP-02` | No se encontró esa recepción. | `src/lib/flows/exports.ts` · `fileFor` | Same, for a receiving. |
| `EXP-03` | No se encontró esa devolución. | `src/lib/flows/exports.ts` · `fileFor` | Same, for a return. |
| `EXP-04` | No se encontró ese conteo. | `src/lib/flows/exports.ts` · `fileFor` | Same, for a count. |
| `EXP-05` | Ese pedido no está listo para cargar en Fierro. | `src/lib/flows/exports.ts` · `markSent` | Marking an order as sent to Fierro when it is not packed (or was already sent). |
| `EXP-06` | Esa recepción no está pendiente de carga en Fierro. | `src/lib/flows/exports.ts` · `markSent` | Marking a receiving as sent when it is not closed and pending (or was already sent). |
| `EXP-07` | Esa devolución no está pendiente de carga en Fierro. | `src/lib/flows/exports.ts` · `markSent` | Same, for a return. |
| `EXP-08` | Ese conteo no está pendiente de carga en Fierro. | `src/lib/flows/exports.ts` · `markSent` | Same, for a count. |
| `EXP-09` | Documento desconocido. | `src/app/(app)/fierro/actions.ts` · `submit` | Marking as sent a document type that does not exist. Only reachable by editing the form. |
| `EXP-10` | No autorizado | `src/app/api/export/[type]/[id]/route.ts` · `GET` | Downloading a CSV without a session or below supervisor (HTTP 401). Shown as plain text in the browser. |
| `EXP-12` | No se encontró esa baja. | `src/lib/flows/exports.ts` · `fileFor` | Downloading the CSV of a write-off that does not exist or belongs to another company. |
| `EXP-13` | Esa baja no está pendiente de carga en Fierro. | `src/lib/flows/exports.ts` · `markSent` | Marking as sent a write-off already sent, or one that belongs to a count (it goes with the count). |
| `EXP-11` | No existe | `src/app/api/export/[type]/[id]/route.ts` · `GET` | Downloading a CSV for a document type that does not exist (HTTP 404). |

The CSV download route also returns `EXP-01` to `EXP-04` and `EXP-12` as plain text with HTTP 404.

## CAM: phone camera

| Code | Message | Where | When |
|---|---|---|---|
| `CAM-01` | miDepo no tiene permiso para usar la cámara. Habilítalo en los ajustes del navegador y vuelve a intentar. | `src/components/Camera.tsx` · `Camera` | The user or the browser denied camera access. |
| `CAM-02` | No se pudo abrir la cámara en este dispositivo. Puedes escribir el código a mano. | `src/components/Camera.tsx` · `Camera` | No camera, no camera API (for example plain HTTP), or the barcode reader failed to load. |

## WIKI: editing the manual

| Code | Message | Where | When |
|---|---|---|---|
| `WIKI-01` | Esa página del manual no existe. | `src/lib/wiki.ts` · `saveEdit` | Saving a page whose name is not a file in `wiki/`. Only reachable by editing the form by hand. |
| `WIKI-02` | La página necesita un título: una línea que empiece con # y un espacio. | `src/lib/wiki.ts` · `saveEdit` | The text has no `# Title` line. The editor disables Guardar first and says why. |
| `WIKI-03` | La página es demasiado larga: el máximo es {max} caracteres. | `src/lib/wiki.ts` · `saveEdit` | The text is over 100,000 characters. The editor disables Guardar first. |
| `WIKI-04` | Esa página del manual no existe. | `src/lib/wiki.ts` · `restoreOriginal` | Restoring a page whose name is not a file in `wiki/`. Only reachable by editing the form by hand. |

## CFG: server configuration

| Code | Message | Where | When |
|---|---|---|---|
| `CFG-01` | Falta la variable SECRET. Genera una con: openssl rand -hex 32 | `src/lib/credentials.ts` · `secret` | The app is running against a real database (`DATABASE_URL`) without `SECRET`. PIN logins, setting a PIN and passkeys fail; users see `SYS-01` (or `ACCT-07` when changing their PIN). |
| `CFG-02` | Falta la variable SECRET. Es obligatoria cuando está DATABASE_URL. Genera una con: openssl rand -hex 32 | `src/db/setup.ts` · `main` | `npm run db:setup` (also run by the Vercel build) with `DATABASE_URL` but no `SECRET`. |

## CLI: scripts

| Code | Message | Where | When |
|---|---|---|---|
| `CLI-01` | Faltan datos. Ejemplo: npm run company:create -- "Distribuidora Sur" sur admin@sur.com "una-contraseña-larga" | `src/db/create-company.ts` · `main` | `company:create` called with fewer than four arguments. |
| `CLI-02` | El código de empresa va en minúsculas y sin espacios (letras, números y guiones). | `src/db/create-company.ts` · `main` | The company code is not 2–20 characters of `a-z`, `0-9` and `-`. |
| `CLI-03` | La contraseña necesita al menos 8 caracteres. | `src/db/create-company.ts` · `main` | The administrator password is too short. |
| `CLI-04` | No se pudo crear la empresa: {error} | `src/db/create-company.ts` · `main` | Anything else failed: the company code is taken, the email is in use, the database is unreachable. |
| `CLI-05` | No se pudo preparar la base de datos: {error} | `src/db/setup.ts` · `main` | `db:setup` or `db:reset` failed: the database is unreachable or a migration failed. |
| `CLI-06` | La tienda respondió {status} en {url} | `scripts/scrape-ovnipress.mjs` · `get` | The Ovnipress store answered a request with an error. On a category page the script stops; on a product page it becomes `CLI-07`. |
| `CLI-07` | Se salteó {url}: {error} | `scripts/scrape-ovnipress.mjs` · product loop | A product page could not be fetched or read; the script skips it and carries on. |

## Not coded on purpose

These are not errors the user has to report, so they have no code. They are listed here so nobody adds a code to them by mistake.

- **As-you-type warnings.** The red and amber hints under scan fields (`src/lib/lookup.ts`, served by `/api/lookup`), the count prefix hint (`PrefixField.tsx`) and the scheme preview in the locations generator. They warn before the click; if the user goes ahead anyway, the server refuses with the coded message.
- **Required-field prompts.** The browser's bubble when a form is sent incomplete: "Elige una opción de la lista." (`Select.tsx`, default), "Elige un proveedor de la lista o crea uno." (`SupplierSelect.tsx`), "Elige el cliente de la lista." (`devoluciones/page.tsx`), and the "PIN, contraseña o las dos" prompts on `usuarios/page.tsx`. The form is not sent; the server checks behind them are `RCV-03`, `RET-01`, `USER-06` and `USER-10`.
- **Silent fallbacks.** The scan beep when the browser has no audio (`ScanForm.tsx` · `beep`), the as-you-type check when there is no network (`ScanForm.tsx`, `PrefixField.tsx`), reading or saving the company code on the phone (`LoginForm.tsx`, `localStorage`) and a single failed camera frame (`Camera.tsx`). Nothing is shown and nothing breaks.
- **Pages that crash while rendering.** There is no `error.tsx` yet, so Next.js shows its own error page with no code. Server actions are covered by `SYS-01`.
- **`notFound()`** on a detail page for a document that does not exist: the user sees the standard 404 page.

## Retired codes

Codes that no longer exist in the app. Never give these numbers to anything else.

| Code | Was | Retired |
|---|---|---|
| `ACCT-11` | Elige cómo se separa el lote. (`cuenta/actions.ts` · `saveBatchSorting`) | 2026-11-20: batch sorting moved to Organización, now `SET-03`. |
