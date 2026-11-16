---
name: miDepo
description: The Tejuelo system. White label stock, Klein-blue ink, shelf addresses written as spine labels.
colors:
  acento: "#002fa7"
  sobre-acento: "#ffffff"
  fondo: "#ffffff"
  superficie: "#ffffff"
  hundido: "#eef1f8"
  texto: "#0a0f24"
  suave: "#4d5674"
  borde: "#d3d9e8"
  borde-fuerte: "#8e99b8"
  ok: "#0b6b3a"
  ok-suave: "#e2f3e9"
  alerta: "#7d5200"
  alerta-suave: "#fbefd0"
  peligro: "#a8231c"
  peligro-suave: "#fae5e3"
  zona-recepcion: "#b26a00"
  zona-devoluciones: "#6b3fc4"
  zona-danados: "#b3261e"
  zona-saldos: "#0c7a70"
  zona-preparacion: "#1a7f43"
  oscuro-fondo: "#090c1a"
  oscuro-superficie: "#121731"
  oscuro-hundido: "#161c3a"
  oscuro-texto: "#eceffa"
  oscuro-suave: "#a3abc9"
  oscuro-borde: "#2a3259"
  oscuro-acento-texto: "#9db1f5"
typography:
  titulo:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  seccion:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.4
  cuerpo:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  tabla:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  codigo:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
rounded:
  rotulo: "3px"
  control: "6px"
spacing:
  fila: "10px"
  grupo: "20px"
  seccion: "36px"
  pagina: "40px"
components:
  boton:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.sobre-acento}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  boton-suave:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  boton-chico:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
    height: "32px"
  campo:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "40px"
  tejuelo:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.acento}"
    typography: "{typography.codigo}"
    rounded: "{rounded.rotulo}"
  codigo:
    backgroundColor: "{colors.hundido}"
    textColor: "{colors.texto}"
    typography: "{typography.codigo}"
    rounded: "{rounded.rotulo}"
  barra:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.sobre-acento}"
    height: "52px"
---

# miDepo design system: Tejuelo

## Overview

miDepo is a warehouse tool for small book warehouses. Its interface is an Operate surface: the supervisor at a desk reads the state of the day, and operators on phones do one scan task at a time.

The system is named after the tejuelo, the shelf-mark label on a book's spine. Every copy has an address, and the address leads: lists and tables start with the shelf label, and the one thing to scan now is shown at sign size. The page is white label stock; the ink is Klein blue. Rows are ruled with hairlines. There are no stacks of cards.

The source of truth is `src/app/globals.css` (tokens and component classes) and `src/components/ui.tsx` (components). Product facts live in `PRODUCT.md`.

## Colors

- **Klein blue `#002FA7` (`acento`)** is the brand colour and the default. It fills the header bar, primary buttons and the picking-stop block, and it inks shelf labels and links. Users can still choose another accent; every accent use goes through the tokens, never a literal hex.
- `acento-texto` is the accent as text. It is computed per theme so it always reads (light: the accent itself; dark: `#9DB1F5` for Klein blue).
- Neutrals are tinted toward blue. `fondo` and `superficie` are white; `hundido` is the second layer (tab strip, hovered rows, code chips).
- `ok`, `alerta` and `peligro` each have a `-suave` tint and appear only where they carry state.
- Zone colours mark the five non-shelf zones on their labels (recepción amber, devoluciones violet, dañados red, saldos teal, preparación green).
- Light and dark themes both ship. The dark theme uses a deep blue-black ground (`#090C1A`) and keeps the Klein-blue bar.

## Typography

- **Libre Franklin** for all interface text. One family; weight and size carry hierarchy. Page titles 26–28px bold at -0.02em; section headings 15px bold; body 15px; tables 14px. Fixed rem sizes, no fluid type.
- **Courier Prime bold**, as typed on a label, only for codes: shelf labels, ISBNs, internal codes and document numbers. Never for prose or headings.
- Numerals are tabular everywhere.
- Prose (the manual) is capped at 72ch.

## Layout

- Desktop: a 52px Klein-blue bar (mark, company, manual, user menu) over a pale tab strip with every section. Both stick to the top. Content is centred at max 1360px.
- Phone (below `lg`): the blue bar, and a five-item bar fixed at the bottom. The rest of the menu is at `/mas`.
- Work screens use two columns from `lg`: a sticky 22–24rem scan column (`lg:top-30`) and the list beside it.
- Rhythm: 36px between sections, tight inside a group, more space above a heading than below it.
- Tables hide secondary columns on narrow screens and repeat the essential value as a muted sub-line. No screen scrolls sideways at 390px.

## Elevation & Depth

Flat. Structure comes from hairlines (`borde`) and the `hundido` layer. The only shadow is `shadow-flotante`, on floating popovers such as the user menu.

## Shapes

Rectangular. Labels and chips use 3px corners (`rounded-rotulo`); buttons, inputs, panels and notices use 6px (`rounded-control`). Avatars are the only circles.

## Components

- **Tejuelo** (`<Tejuelo codigo>`): a bordered label with one cell per segment of the shelf code (`A | 01 | 1`). Sizes `sm` (in rows), `md` (row lead or page subject) and `xl` (the single thing to scan now). `sobreAcento` renders a white label for use on the blue block. Zone codes get a colour band. Every shelf or zone code goes through this component.
- **Codigo** (`<Codigo>`): a neutral chip for ISBNs and internal codes. Document numbers in lists use the `numero` class.
- **Ruled list** (`ul.lista` with `.fila` rows) and **table** (`table.tabla` inside `div.overflow-x-auto.border-y.border-borde`). Use a table when rows share three or more comparable fields.
- **Buttons**: `boton` (one primary per view), `boton-suave`, `boton-peligro`, and `boton-chico` inside table rows.
- **Fields**: `campo` with an `etiqueta` label. Scan fields show "Coincide" and a green border when the scanned code matches the expected one.
- **Insignia**: a small rectangular state badge in five tones. **Aviso**: a bordered, tinted notice. **Vacio**: an empty state between two hairlines that says what is missing and how it appears.
- **Tabs**: underlined text tabs replace segmented toggles.
- **`tarjeta`**: a plain 6px bordered panel, used only around a form or a settings group. Never nested.
- **Avance**: a 6px progress bar with "12 de 40" beside it; it turns green when complete.
- Motion: 150ms colour transitions, and a 180ms fade for scan responses. Nothing decorative; reduced-motion is respected.

## Do's and Don'ts

- Do lead a row with its shelf label when it has one.
- Do keep the product's Spanish copy (voseo) and Fierro's vocabulary.
- Do use tokens for every colour so both themes and any user accent hold.
- Don't build a screen from a grid of same-size cards or big-number tiles.
- Don't use rounded corners above 6px, pills for containers, gradients, or coloured side stripes.
- Don't put a small uppercase label above a heading.
- Don't use the mono face for anything that is not a code.
- Don't use unicode glyphs as icons; use `Icono`.
