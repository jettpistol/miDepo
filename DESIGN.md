---
name: miDepo
description: The Tejuelo system. White label stock, Klein-blue ink, shelf addresses written as spine labels.
colors:
  accent: "#002fa7"
  on-accent: "#ffffff"
  page: "#ffffff"
  surface: "#ffffff"
  sunken: "#eef1f8"
  ink: "#0a0f24"
  muted: "#4d5674"
  line: "#d3d9e8"
  line-strong: "#8e99b8"
  ok: "#0b6b3a"
  ok-soft: "#e2f3e9"
  warn: "#7d5200"
  warn-soft: "#fbefd0"
  danger: "#a8231c"
  danger-soft: "#fae5e3"
  zone-receiving: "#b26a00"
  zone-returns: "#6b3fc4"
  zone-damaged: "#b3261e"
  zone-clearance: "#0c7a70"
  zone-staging: "#1a7f43"
  dark-page: "#090c1a"
  dark-surface: "#121731"
  dark-sunken: "#161c3a"
  dark-ink: "#eceffa"
  dark-muted: "#a3abc9"
  dark-line: "#2a3259"
  dark-accent-text: "#9db1f5"
typography:
  title:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title-phone:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  section:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  body-phone:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  table-header:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  code:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
  scan-target:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1
  scan-target-desktop:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
rounded:
  label: "3px"
  control: "6px"
spacing:
  row: "10px"
  group: "20px"
  section: "36px"
  page: "40px"
components:
  btn:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
    height: "32px"
  btn-soft:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
    height: "32px"
  btn-sm:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "2px 10px"
    height: "28px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
    height: "32px"
  shelfmark:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    typography: "{typography.code}"
    rounded: "{rounded.label}"
  code-chip:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.label}"
  bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    height: "48px"
---

# miDepo design system: Tejuelo

## Overview

miDepo is a warehouse tool for small book warehouses. Its interface is an Operate surface: the supervisor at a desk reads the state of the day, and operators on phones do one scan task at a time.

The system is named after the tejuelo, the shelf-mark label on a book's spine. Every copy has an address, and the address leads: lists and tables start with the shelf label, and the one thing to scan now is shown at sign size. The page is white label stock; the ink is Klein blue. Rows are ruled with hairlines. There are no stacks of cards.

The source of truth is `src/app/globals.css` (tokens and component classes) and `src/components/ui.tsx` (components). Code is in English; interface copy is Spanish. Product facts live in `PRODUCT.md`.

## Colors

- **Klein blue `#002FA7` (`accent`)** is the brand colour and the default. It fills primary buttons and the picking-stop block and the active sidebar item, and it inks shelf labels and links. Users can still choose another accent; every accent use goes through the tokens, never a literal hex.
- `accent-text` is the accent as text. It is computed per theme so it always reads (light: the accent itself; dark: `#9DB1F5` for Klein blue).
- Neutrals are tinted toward blue. `page` and `surface` are white; `sunken` is the second layer (hovered rows, sidebar hover, code chips).
- `ok`, `warn` and `danger` each have a `-soft` tint and appear only where they carry state.
- Zone colours mark the five non-shelf zones on their labels (recepción amber, devoluciones violet, dañados red, saldos teal, preparación green).
- Light and dark themes both ship. The dark theme uses a deep blue-black ground (`#090C1A`); Klein blue stays on primary buttons, the active sidebar item and shelf marks.

## Typography

- **Libre Franklin** for all interface text. One family; weight and size carry hierarchy. Desktop: page titles 24px semibold, section headings 14px semibold, body and tables 14px, table headers and field labels 12px. Phones: titles 22px bold, body 15px. Fixed rem sizes, no fluid type.
- **Each user can switch the interface font** in Mi cuenta (14 choices in `src/lib/fonts.ts`, loaded in `src/app/fonts.ts`, applied through `--font-ui`). Libre Franklin is the default. Only the default is preloaded; other files download only for the people who pick them.
- **Courier Prime bold**, as typed on a label, only for codes: shelf labels, ISBNs, internal codes and document numbers. Never for prose or headings.
- Numerals are tabular everywhere.
- Prose (the manual) is capped at 72ch.

## Layout

- **Density follows Jira on desktop** (from `lg`, 1024px): 14px body text with 20px line height, 32px buttons and inputs (`btn`, `field`), 28px row buttons (`btn-sm`), 12px table headers and field labels, 24px semibold page titles. Free space is left free: a screen that is not full has room for the next feature.
- **Phones keep touch sizes** (below `lg`): 44px controls and 15–16px text, because operators scan on the floor with one hand.
- Desktop shell: a 48px white top bar (brand, stock search, manual, account menu) over a 240px left sidebar with grouped sections and, beside each queue, how many items wait in it. The active item has an `accent-soft` fill and a 2px accent bar. Content fills the remaining width with 32px side padding.
- Phone shell: a 52px white top bar and a five-item bar fixed at the bottom. The rest of the menu is at `/mas`.
- Page header: a breadcrumb (parent / ) above the title, actions on the right.
- Work screens use two columns from `lg`: a sticky 22–24rem scan column (`lg:top-30`) and the list beside it.
- Tables sit in a framed box on desktop (`table-wrap`), hairlines only on phones. Ruled lists can take the same frame (`ruled-list framed`).
- Rhythm: 24px between sections on desktop, 32px on phones; tight inside a group, more space above a heading than below it.
- Tables hide secondary columns on narrow screens and repeat the essential value as a muted sub-line. No screen scrolls sideways at 390px.

## Elevation & Depth

Flat. Structure comes from hairlines (`line`) and the `sunken` layer. The only shadow is `shadow-floating`, on floating popovers such as the user menu.

## Shapes

Rectangular. Labels and chips use 3px corners (`rounded-label`); buttons, inputs, panels and notices use 6px (`rounded-control`). Avatars are the only circles.

## Components

- **ShelfMark** (`<ShelfMark code>`, the tejuelo): a bordered label with one cell per segment of the shelf code (`A | 01 | 1`). Sizes `sm` (in rows), `md` (row lead or page subject) and `xl` (the single thing to scan now). `onAccent` renders a white label for use on the blue block. Zone codes get a colour band. Every shelf or zone code goes through this component.
- **Code** (`<Code>`): a neutral chip for ISBNs and internal codes. Document numbers in lists use the `doc-number` class.
- **Ruled list** (`ul.ruled-list` with `.row` rows) and **table** (`table.data-table` inside `div.overflow-x-auto.border-y.border-line`). Use a table when rows share three or more comparable fields.
- **Buttons**: `btn` (one primary per view), `btn-soft`, `btn-danger`, and `btn-sm` inside table rows.
- **Fields**: `field` with a `field-label` label.
- **Scan form** (`<ScanForm context>`): every keystroke is rehearsed against the server (`/api/lookup`, logic in `src/lib/lookup.ts`) with the same rules as the real action. Under each field a one-line note says what was recognised (the book's title, how much a shelf holds) or why it will not work, in `ok`, `warn` or `danger`. A field in `danger` blocks the submit. Suggestions open under the field as you type (a listbox; shelves as shelf marks). One-tap fixes sit under the field as `btn-sm` chips ("Está en", "Ya hay en", "Todas: 60"). Picking and packing validate but never suggest, because the scan there proves which book is in hand.
- **Disabled with a reason**: an action that cannot work yet is disabled and says why in one muted line (`<ActionButton reason>`).
- **Badge**: a small rectangular state badge in five tones. **Notice**: a bordered, tinted notice. **EmptyState**: an empty state between two hairlines that says what is missing and how it appears.
- **Dropdown** (`<Select>`): drawn by miDepo, never the system `<select>`. Opens the full list with a search box that keeps focus, so typing narrows the list while it is open; arrows and Enter pick. Only listed values can be submitted. With `create`, a search that matches nothing offers "Crear …", which asks for confirmation; Enter alone never creates.
- **New button** (`<NewButton>`): "+ Nueva" in the page header, opening a small panel with the form, like Jira's Create.
- **Always-on tables**: list screens keep their table even when empty, with one `<EmptyRow>` that says what is missing and how it appears.
- **Tabs**: underlined text tabs replace segmented toggles.
- **`panel`**: a plain 6px bordered panel, used only around a form or a settings group. Never nested.
- **Progress**: a 6px progress bar with "12 de 40" beside it; it turns green when complete.
- Motion: 150ms colour transitions, and a 180ms fade for scan responses. Nothing decorative; reduced-motion is respected.

## Do's and Don'ts

- Do lead a row with its shelf label when it has one.
- Do keep the product's Spanish copy (tú, never voseo) and Fierro's vocabulary.
- Do use tokens for every colour so both themes and any user accent hold.
- Don't build a screen from a grid of same-size cards or big-number tiles.
- Don't use rounded corners above 6px, pills for containers, gradients, or coloured side stripes.
- Don't put a small uppercase label above a heading.
- Don't use the mono face for anything that is not a code.
- Don't use unicode glyphs as icons; use `Icon`.
- Do treat the database as the source of truth: suppliers, customers, products, stock and locations are chosen from what exists. Never accept free text for something that should already exist; creating one is a separate, confirmed action that refuses near-duplicates.
- Do say a problem before the click: validate while typing, suggest valid values, and disable what cannot work with the reason beside it.
- Don't explain what a screen is for under its title, or how an ordinary control works. Keep text that states a fact (a count, a state) or a consequence the user could not guess.
