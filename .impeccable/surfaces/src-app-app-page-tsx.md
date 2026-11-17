---
version: 1
slug: "src-app-app-page-tsx"
primary_target: "src/app/(app)/page.tsx"
related_targets: []
---

# miDepo app (all authenticated screens, login and manual)

Scope: every route under `src/app`. Visitor mode: Operate (the manual at `/ayuda` is Read and inherits the same world).

Audience and job: the supervisor at a desk reads the state of the day and manages documents; operators on phones do one scan task at a time. Constraints: Klein blue `#002FA7` stays the default colour; light and dark themes stay; all functions, flows and Spanish copy stay. Per-user accent keeps working through the same tokens.

Chosen direction: Tejuelo (the library shelf-mark). Memorable moment: the shelf address as a segmented spine label leading every row and shown at sign size on the picking stop.

Unresolved: none.

## Direction contract

THESIS: Every copy has an address, and the address is the interface. Lists lead with the shelf label the way spines lead on a shelf. Refused: the grid of same-size icon cards with a number in each.

OWN-WORLD: White label stock on a white page, Klein-blue ink. A white 48px top bar and a 240px left sidebar with queue counts, Jira-style density on desktop. Ruled lists and tables with hairlines, no card stacks. Rectangular labels with 3–6px corners. Libre Franklin for interface text; Courier Prime bold, as typed on a label, only for codes. Zone labels carry a colour band (recepción amber, devoluciones violet, dañados red, saldos teal, preparación green).

STORY: The supervisor sees what is waiting, who has what, and where; opens a document; sends it to Fierro. The operator sees one label and scans it.

FIRST VIEWPORT: Inicio at 1440. Blue bar: mark, company, manual, user. Tab strip: all sections. Left two thirds: "Pedidos en preparación" table (next shelf label, number, customer, who, progress) then the oldest pending orders. Right third: ruled list of the day's queues with right-aligned counts. Primary action: "Preparar" on the first pending order.

FORM: Tejuelo, position 1 on the ordered list (chosen by the owner as the pick card). seed:89cabb9159db412f. Signature interaction: the segmented label; on picking, the label at sign size on the picking stop, and scan fields that mark "Coincide" when the shelf and book match. Motion grammar: 150 ms state changes only.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
