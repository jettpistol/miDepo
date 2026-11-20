# Warehouse label types, standards, sizes and how WMS products organise label printing (for miDepo)

Research date: 2026-11-20. Method note: web search worked, but direct page fetches to odoo.com, gs1.se and docs.oracle.com were blocked by this session's network allowlist, so several findings rest on search-result summaries of those pages rather than full reads. Items marked "background knowledge, unverified" come from general industry knowledge and found no source in this session; treat them as hypotheses to verify.

## 1. Which labels are printed at which warehouse step, and which are industry-standard

### Takeaway
Sourced evidence covers location/rack labels (incl. vertical "totem" labels with level colours and check digits), tote labels, box/carton labels, item labels printed at receiving, lot/serial labels, package labels and package-contents sheets, and pallet/carton logistic labels (SSCC). These form the de-facto standard set in small-WMS products. Count tags, user badges, equipment labels and condition stickers for returns are common in practice but had little or no sourcing here.

### Cited Findings
**Receiving**
- ShipHero has a help article "How to Print Barcodes When Receiving Inventory": item barcodes printed at receiving are a built-in step. — [ShipHero Help](https://software-help.shiphero.com/hc/en-us/articles/4419353852941-How-to-Print-Barcodes-When-Receiving-Inventory)
- Odoo: lot/serial labels can print automatically when a transfer is validated. The setting is on the operation type's Hardware tab ("Lot/SN Labels"). The PDF format is 4 x 12 per page, with one label per unique lot/SN or one per unit, and ZPL variants exist. (Source: search summary of the Odoo docs. Full page fetch blocked.) — [Odoo 17 docs, Printable delivery PDFs](https://www.odoo.com/documentation/17.0/zh_CN/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/print_on_validation.html)
- Odoo product labels print as a PDF grid of labels per page or as ZPL for Zebra printers. The ZPL label contains the product name and barcode. — [Odoo 17 docs](https://www.odoo.com/documentation/17.0/zh_CN/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/print_on_validation.html)
- A pallet/case ("logistic unit") label carries the SSCC, the only mandatory element of the GS1 Logistic Label. The company that assembles the unit assigns the SSCC and keeps it unique. — [GS1 UK, logistics labels and SSCCs](https://gs1uk.org/support-training/help-to-use-and-implement-gs1-standards/logistics-labels-and-ssccs); [GS1 UK how-to PDF](https://www.gs1uk.org/sites/default/files/94702_HowToGuideslogistics%20labels%20and%20SSCCs_0315_FV.pdf)

**Put-away / locations**
- Vertical "totem" location labels gather the barcodes for every level onto one label at eye height on the rack upright. They are often colour-coded by level to prevent picking errors. — [Interlake Mecalux](https://www.interlakemecalux.com/blog/rack-labels-warehouse); [Creative Safety Supply](https://creativesafetysupply.com/articles/rack-labeling)
- Example level-colour scheme: red = 01, blue = 02, green = 03. Colour lets workers find the right shelf without reading every digit. — [Cleverence](https://www.cleverence.com/articles/for-business/warehouse-shelf-numbering-4827/)
- Colour must stay a secondary cue, because colour-blind staff and faded labels defeat it. Keep the human-readable code prominent. — [Cleverence](https://www.cleverence.com/articles/for-business/warehouse-shelf-numbering-4827/)
- Recommended template content: human-readable text, barcode, check digit (if used), and optional arrows to the pick face. — [Cleverence](https://www.cleverence.com/articles/for-business/warehouse-shelf-numbering-4827/)
- Label every location (including each level), use strong contrast, and put the label in the same spot on every shelf. — [Infoplus](https://www.infopluscommerce.com/blog/warehouse-rack-labeling); [Linnworks](https://linnworks.com/?p=7046)
- Numbering schemes and labelling are treated as one design problem. — [MMH, tips for effective warehouse numbering schemes](https://www.mmh.com/article/other_voices_tips_for_effective_warehouse_numbering_schemes)
- Sortly is described as offering on-demand label printing for locations, checklists and audits. (Aggregator source.) — [Capterra compare](https://www.capterra.com/compare/79357-169199/ZebraDesigner-Pro-vs-Sortly-Pro)

**Picking**
- ShipHero: tote barcodes are created and printed from Orders > Totes, with bulk printing and a per-row Print icon for replacing a label that will not scan or after a rename. — [ShipHero: Create Totes and Print Tote Barcodes](https://software-help.shiphero.com/hc/en-us/articles/4419345058445-How-to-Create-Totes-and-Print-Tote-Barcodes)
- ShipHero's Barcode Label Generator produces PDFs of command barcodes, i.e. scannable action codes, and of box barcodes. — [ShipHero Printing section](https://software-help.shiphero.com/hc/en-us/sections/4420180235021-Printing)

**Packing**
- Odoo: the operation type's Hardware tab has "Package Contents", which prints a PDF of the package's contents on validation, and "Package Label", which prints when "Put in Pack" is clicked. Odoo 18 lets you choose PDF or ZPL in "Print label as". — [Odoo 18 docs](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/print_on_validation.html)
- ShipHero box labels: upload a CSV of box information from Shipping Boxes, choose a label size, and download a PDF. Freight pallet/carton labels can be reprinted from a bulk action. — [ShipHero Printing section](https://software-help.shiphero.com/hc/en-us/sections/4420180235021-Printing)

**Returns, counts, damaged/quarantine, badges, equipment**
- No vendor documentation was found that specifies RMA labels, grade stickers, count tags, quarantine tags, user badges or equipment labels. See Gaps.

### Inferences
- For miDepo, the sourced practice maps to steps as follows:
  - Receiving: item labels for unlabelled items, i.e. grapas with only internal codes, plus an optional box/pallet ID label.
  - Put-away: location labels (shelf-edge and totem).
  - Picking: tote/cart labels, printed once and reused, not per order.
  - Packing: a box label with order, box n of N and a contents list, plus a packing slip on A4. miDepo already has an A4 packing list in `src/app/(print)/`.
  - Returns: a condition sticker (VENDIBLE / SALDO / DAÑADO) and the original item label if it is missing.
  - Counts: an optional "contado" tag. This is low value when counts are recorded on scan.
- Command barcodes (ShipHero) are a useful, cheap idea for miDepo: a printed sheet of codes such as "CERRAR CAJA", "SALTAR" or "CANTIDAD+1" scanned at the station. Their adoption in other WMSs is inference.
- Labels that are reprinted from the record (tote, location) should not print automatically. Labels tied to an event (item labels at receiving, box labels at packing) are the natural candidates for "prepared automatically, one click to print", which matches Odoo's operation-type triggers.

### Gaps
- No authoritative "standard list" of warehouse label types exists. Vendor docs list only what each product does.
- RMA/return labels, condition/grade stickers, count tags, quarantine/hold tags, badge/equipment labels: no sources found this session.
- Arrow conventions on multi-level labels (up/down arrow pointing to the level the barcode identifies): mentioned only as "optional arrows" by one blog. Background knowledge, unverified: the arrow points from the label toward the slot it identifies, and top-level labels on the beam often point up.
- Floor (aisle/bulk) labels: not sourced.

## 2. Standards: GS1-128/SSCC, logistic label, ISBN/ISSN, symbology choice, barcode dimensions

### Takeaway
SSCC and GS1-128 logistic labels require a GS1 Company Prefix. Without one, miDepo should use non-GS1 internal codes in Code 128 (or QR/DataMatrix) and never invent SSCC-looking numbers. Books carry EAN-13 with 978/979 (ISBN), periodicals 977 (ISSN) with an optional 2- or 5-digit add-on. Practical print rules: quiet zone at least 10X each side, X-dimension at least about 10 mil (0.25 mm), and at 203 dpi one dot is 0.125 mm, so X should be a whole number of dots.

### Cited Findings
**SSCC / GS1 Logistic Label**
- The current guideline is the GS1 Logistic Label Guideline, Release 1.3, ratified July 2019. Labels have always used GS1-128, and 1.3 adds supplementary GS1 2D barcodes. — [GS1 Logistic Label Guideline](https://www.gs1.org/standards/gs1-logistic-label-guideline); [ref.gs1.org](https://ref.gs1.org/guidelines/logistic-label)
- The SSCC is 18 digits: extension digit + GS1 Company Prefix + serial reference + mod-10 check digit. The first three parts always total 17 digits. With a 7-digit prefix you get 10^9 serials per extension digit. — [GS1 UK](https://www.gs1uk.org/knowledge-hub/barcodes/how-do-i-create-ssccs-and-logistics-labels); [GS1 SSCC Executive Summary](https://GS1.org/docs/idkeys/GS1_SSCC_Executive_Summary.pdf)
- The SSCC is built from your existing GS1 Company Prefix, so no separate prefix is needed, but a prefix is required. — [GS1 UK](https://www.gs1uk.org/knowledge-hub/barcodes/how-do-i-create-ssccs-and-logistics-labels)
- The SSCC is the only mandatory content. The GS1 UK layout has three sections, with the top section free-form (company name, logo, etc.). — [GS1 UK how-to PDF](https://www.gs1uk.org/sites/default/files/94702_HowToGuideslogistics%20labels%20and%20SSCCs_0315_FV.pdf)
- ANSI MH10.8.1 / ISO 15394 (US/ISO shipping labels): not researched in depth because carrier and shipping labels are out of scope. GS1 Scan4Transport covers 2D codes on transport labels. — [GSCN 18-207 Scan4Transport](https://www.gs1.org/docs/barcodes/GSCN_18-207_Scan4Transport.pdf)

**GS1 Argentina**
- Getting your own company prefix in Argentina means joining GS1 Argentina as a member. The country prefix is 779. — [yo-facturo blog](https://yo-facturo.com/blog/codigos-de-barras-para-productos-propios-gs1-o-internos/); [GS1 Argentina location page](https://gs1.org/locations/argentina)
- A municipal agreement (Corrientes) gives a reduced initial annual fee, which confirms the fee model is an initial plus an annual fee. No amounts are published there. — [Convenio Corrientes–GS1](https://ciudaddecorrientes.gov.ar/sites/default/files/convenio_gs1_firmado_.pdf)
- Comparison point, not Argentina: GS1 US charges USD 250 initial plus USD 50/year for 1–10 GTINs (as of July 2024). GS1 Brasil charges an annual fee proportional to revenue. — (search summary of [GS1 Brasil](https://www.gs1br.org/solicitar-codigo-de-barras))
- AFIP (now ARCA) runs a "Código de Producto" programme tied to GS1 codes. — [AFIP Código de Producto](https://www.afip.gob.ar/codigoProducto/)

**ISBN / ISSN on books and comics**
- The ISSN barcode is EAN-13 with prefix 977, the first 7 ISSN digits, 2 digits (usually 00 or a price/variant code), and the EAN check digit. The ISSN's own mod-11 check digit is dropped. — [US ISSN Center, LoC](https://www.loc.gov/issn/barcodes.html); [ISSN International](https://www.issn.org/?p=1287)
- An optional 2- or 5-digit add-on to the right usually carries the issue number: the month for monthlies, the week for newspapers. It is never scanned alone, and both symbols should be processed together. — [GS1 support: add-on barcodes for books](https://support.gs1.org/support/solutions/articles/43000734089-what-are-the-extra-add-on-barcodes-for-books-)
- Sources conflict on the meaning of the two digits inside the 977 code: price or variant code (UKOLN) versus sequence-based (Danish Royal Library). — [UKOLN factfile](https://www.ukoln.ac.uk/bib-man/factfile/standard-numbers/issn/index.html); [KB Denmark](https://pro.kb.dk/en/publishers/international-standard-serial-number-issn/practical-information-issn-barcodes-and-ean)
- Books (Bookland): EAN-13 978/979, with a 5-digit add-on used for price in some markets. — [GS1 support](https://support.gs1.org/support/solutions/articles/43000734089-what-are-the-extra-add-on-barcodes-for-books-); [Seagull barcode guide, publishing](https://barcodeguide.seagullscientific.com/Content/Ind_Publishing.htm)

**Location label practice**
- A check digit sharply cuts "fat finger" errors and wrong-slot scans across the aisle. The scanner can prompt for the check digit (Mod10 or a weighted sum) to confirm bay and level. — [Cleverence](https://www.cleverence.com/articles/for-business/warehouse-shelf-numbering-4827/)

**Symbology and print dimensions**
- Code 128 needs a quiet zone of at least 10X on the left and right. One vendor says at least 10X or 0.10 in, whichever is greater. — [Wikipedia Code 128](https://www.Wikipedia.org/wiki/Code128); [Acctivate](https://hub.acctivate.com/articles/printing-standard-barcodes)
- Recommended X-dimension: no less than 10 mil (0.254 mm). Aspose citing ISO/IEC 15417 gives 0.0075 in (7.5 mil) as the minimum possible. — [Acctivate](https://hub.acctivate.com/articles/printing-standard-barcodes); [Aspose Code 128](https://docs.aspose.com/barcode/info-cards/code-128/)
- Zebra print specs: the dot is 0.125 mm at 203 dpi and 0.084 x 0.099 mm at 300 dpi. The barcode module range is 4.9–49 mil at 203 dpi and 3.3–33 mil at 300 dpi (picket fence). — [Zebra ZT510 print specs](https://docs.zebra.com/us/en/printers/industrial/zt510-ug/specifications/printing-specifications.html); [Zebra ZT231 print specs](https://docs.zebra.com/us/en/printers/industrial/zt231-industrial-printer-user-guide/r-2x1-specifications/r-zt2x1-print-specifications.html)
- ZPL barcode commands: — [Zebra ZPL programming guide, barcodes](https://docs.zebra.com/us/en/printers/software/zpl-pg/fonts-and-barcodes/barcodes.html)

### Inferences
- At 203 dpi, use X = 2 dots (0.25 mm, about 9.8 mil) for most labels and 3 dots (0.375 mm) for location labels read from a distance. At 300 dpi, X = 3 dots (0.25 mm). Integer-dot modules avoid bar-width distortion. This is derived from the Zebra dot sizes above.
- Width check: a 10-character Code 128 subset B code is about (11 x 10 + 35) modules, roughly 145X. At X = 0.25 mm that is about 36 mm plus 2 x 2.5 mm quiet zones, about 41 mm, which fits a 50 x 25 label. All-numeric even-length codes can use subset C and come out about half as wide. Calculation from the Code 128 structure; verify with the rendering library.
- miDepo without a GS1 prefix:
  - Do not generate SSCCs or GS1-128 with AI (00).
  - Use internal Code 128 IDs with a clear prefix, e.g. `LOC-`, `BOX-`, `TOT-`, or for grapas an internal code that cannot collide with 978/979/977/779 EAN-13s.
  - GS1 reserves prefixes 20–29 for restricted in-store use; that is background knowledge, unverified here. Do not use them either, to keep internal codes from looking like GTINs.
- QR/DataMatrix is fine for internal labels but needs a 2D (imager) scanner. Code 128 works with cheap laser and 1D scanners. Prefer Code 128 as the primary symbol.
- When printing an EAN-13 for a book that lacks one (rare), the label must reproduce the real ISBN-derived EAN. It must not invent a code.

### Gaps
- GS1 Argentina 2026 fee amounts and prefix tiers: not published in the results. Ask gs1.org.ar directly.
- Exact GS1 Logistic Label dimensions (background knowledge, unverified: A6 105 x 148 mm, or A5 for pallets with more data) and GS1-128 minimum X (about 0.495 mm) and bar height (about 32 mm) for logistic labels: the page fetch was blocked, so these are not confirmed.
- Recommended location-label size by reading distance (e.g. charts relating barcode X to scan distance for long-range scanners): not found.
- ANSI MH10.8.1 / ISO 15394: not researched (out of scope).
- Agencia Argentina de ISBN (Cámara Argentina del Libro) barcode rules: not researched.

## 3. Standard label sizes, media and Argentine availability

### Takeaway
On sale in Argentina (MercadoLibre): 100 x 150 mm (4 x 6 in) rolls on a 25 mm core, 51 x 25 mm (2 x 1 in) rolls, 100 x 190 mm, 58 x 31 mm, and 2.25 x 1.25 in (57 x 32 mm). Direct thermal lasts about 6–12 months indoors and fades in sun. Thermal transfer lasts 2+ years and suits shelf/location labels. No source in this session confirmed A4 sticker-sheet formats (Pimaco/Avery codes).

### Cited Findings
- MercadoLibre Argentina listing: "Etiqueta Térmica 100x150mm Blanco Rollo x300 Buje 25mm". Another seller: "Rollo Etiquetas Térmicas Para Zebra 100x150mm X 350 Unidades". — [MercadoLibre AR, afimpresion](https://www.mercadolibre.com.ar/pagina/afimpresion); [MercadoLibre AR, rollospremium](https://www.mercadolibre.com.ar/pagina/rollospremium)
- 51 x 25 mm thermal rolls, about 1,000 per roll, are offered. 100 x 190 mm rolls are sold bundled with Zebra ZD220. 58 x 31 mm also appears. 80 x 50 mm is mainly ticket paper. — (search summary of MercadoLibre AR seller pages, e.g. [IDSYSTEMS](https://www.mercadolibre.com.ar/pagina/idsystems), [RD Printer Service](https://www.mercadolibre.com.ar/tienda/rd-printer-service))
- Frávega (Argentine retailer) sells direct thermal 4 x 6 in labels (fanfold and roll) and 2.25 x 1.25 in labels. — [Frávega 4x6 fanfold](https://www.fravega.com/p/etiquetas-de-envio-immuson-fanfold-4x6-cm-direct-thermal-100-23047079/); [Frávega MFLABEL 4x6](https://www.fravega.com/p/etiquetas-termicas-directas-mflabel-4x6-pulgadas-22898504/); [Frávega 2.25x1.25](https://www.fravega.com/p/etiquetas-de-envio-mflabel-direct-thermal-de-2-25-x-1-25-pul-23047404/)
- Odoo third-party label modules list PDF formats including 50 x 38 mm and 66 x 25 mm. — [garazd product label packaging](https://apps.odoo.com/apps/modules/17.0/garazd_product_label_packaging/)
- Odoo built-in PDF product/lot sheets are grids, e.g. 4 x 12 per page. (Search summary.) — [Odoo 17 docs](https://www.odoo.com/documentation/17.0/zh_CN/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/print_on_validation.html)
- A4 sheets: an Argentine ERP (Dux Software) help page offers a "3x8 without margins = 24 labels" A4 layout. — [Dux Software help](https://intercom.help/duxsoftware/es/articles/7874443-imprimir-etiquetas-y-rotulos)
- Pimaco A4251: sold as 25 A4 sheets with 65 labels per sheet; no dimensions given. A LibreOffice extension ships Pimaco label dimensions, the likely best machine-readable source. — [MercadoLivre BR listing](https://www.mercadolivre.com.br/pagina/selectimports017); [LibreOffice Etiquetas PIMACO](https://extensions.libreoffice.org/en/extensions/show/etiquetas-pimaco)
- Apli (EU) A4 examples: 105 x 74 mm (8 per sheet, Apli 1279) and 52.5 x 29.7 mm (40 per sheet, Apli 4719). — [PcComponentes Apli 1279](https://www.pccomponentes.com/etiquetas-adhesivas-apli-1279-a4-105x74-mm-800-etiquetas-100-hojas); [PcComponentes Apli 4719](https://www.pccomponentes.com/etiqueta-adhesiva-apli-4719-52-5-x-29-7mm-4000-unid-blanco-100-hojas-multi3)
- Direct thermal lasts about 6–12 months in a climate-controlled warehouse. Thermal transfer usually lasts more than 2 years, and up to 10 years outdoors with the right ribbon. — [Avery blog](https://www.avery.com/blog/thermal-printers-direct-thermal-vs-thermal-transfer-labels/); [Advanced Automation](https://www.advanced-automationinc.com/learning-center/do-barcode-labels-expire-direct-thermal-vs-thermal-transfer/); [Zebra FAQ](https://www.zebra.com/gb/en/resource-library/faq/printing/difference-between-direct-thermal-and-thermal-transfer-printing.html)
- Direct thermal in direct sunlight lasts 1–3 months. This comes from a vendor selling thermal transfer, so treat it with caution. Rule of thumb: direct thermal for under 6 months, thermal transfer for longer or harsh conditions. — [HPRT](https://www.hprt.com/Product/Label-Printers/do-direct-thermal-labels-fade-in-sunlight.html); [Brother Mobile Solutions](https://brothermobilesolutions.com/direct-thermal-vs-thermal-transfer/)
- Zebra label selection white paper. — [Zebra: Selecting the right label](https://www.zebra.com/content/dam/zebra/white-papers/en-us/selecting-right-label-white-paper-en-us.pdf)

### Inferences
- Suggested size set for miDepo (inference, based on what is on sale in Argentina and the job each label does):
  - **50 x 25 mm** (sold as 51 x 25 / 2 x 1 in): item labels for grapas and unlabelled books, condition stickers. The most common small roll.
  - **100 x 50 mm**: location labels on shelf edges, tote labels, box "n of N" labels.
  - **100 x 150 mm** (4 x 6 in): box content label (order, box n of N, item list), pallet/received-lot label, totem location label, and the future carrier label. This is the default stock for desktop Zebra printers in Argentina.
  - **A4 sheets for laser/inkjet** (3 x 8 = 24, about 70 x 37 mm): a fallback for warehouses without a thermal printer, especially for location labels.
  - **A4 full page**: packing slip and the count sheet.
- Location/shelf labels should be thermal transfer, or laser on synthetic/polyester A4, because they must last years. Item, box and tote-session labels can be direct thermal.
- Rolls sold in Argentina use a 25 mm core, which matches desktop printers (Zebra ZD220/ZD230-class) rather than industrial printers that use 76 mm cores. That 76 mm figure is background knowledge, unverified.
- Templates should be defined in mm with an origin offset and gap setting per printer, because 51 x 25 versus 50 x 25 and inch-based stock (2.25 x 1.25 in) all circulate.

### Gaps
- Pimaco A4 codes and dimensions (e.g. A4248/A4249/A4251/A4254/A4255/A4256/A4263) were not confirmed. Background knowledge, unverified: A4251 is about 21.2 x 38.2 mm (65 per sheet), A4254 about 25.4 x 63.5 mm (33 per sheet), and A4256/A4356 about 63.5 x 38.1 mm (21 per sheet, the Avery L7160 equivalent). Read the LibreOffice Pimaco extension to confirm.
- Avery L7160/L7163/L7651 and other A4 formats: not fetched.
- The MercadoLibre AR results did not show 60 x 40, 40 x 30, 38 x 25 or 32 x 25 mm. No sales-volume data by size was found.
- Gap vs black-mark vs continuous media, and core sizes beyond "buje 25mm": no source in this session.

## 4. How WMS/ERP products organise label printing (what is table stakes)

### Takeaway
Common sourced features:
- labels printed as PDF (sheet or roll) or as raw ZPL for Zebra;
- auto-print triggers bound to operation events (validate receipt, put in pack), configured per operation type;
- a local print helper or agent for direct printing;
- a template designer with presets and custom width x height;
- bulk printing and reprint from the record (tote, pallet, batch).

Per-workstation default printers and print queues are implied by the helper/agent model but were not documented in what was read.

### Cited Findings
- **Odoo**:
  - The operation type's Hardware tab configures auto-print on validation: delivery slips, lot/SN labels, product labels, package contents and package label (on Put in Pack).
  - Formats are PDF grids or ZPL.
  - Odoo 18 adds the "Print label as" PDF/ZPL choice for package labels.
  - (Search summary; fetch blocked.) — [Odoo 18 docs](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/print_on_validation.html)
- **Odoo App Store** ecosystem:
  - custom label builders with PDF/ZPL output and batch printing from transfers, adjustments and packagings (garazd, oe_product_label_builder);
  - direct printing to a saved printer (inom_label_builder);
  - QZ Tray integration for silent browser-to-printer printing (qz_tray_report);
  - a ZPL label designer;
  - zpl_lot_label (v18), which outputs raw ZPL as plain text.
  - These gaps show the core product is weak on template editing. — [garazd_product_label_pro](https://apps.odoo.com/apps/modules/17.0/garazd_product_label_pro/); [qz_tray_report](https://apps.odoo.com/apps/modules/17.0/qz_tray_report); [zpl_label_designer](https://apps.odoo.com/apps/modules/17.0/zpl_label_designer); [inom_label_builder](https://apps.odoo.com/apps/modules/17.0/inom_label_builder); [zpl_lot_label](https://apps.odoo.com/apps/modules/18.0/zpl_lot_label)
- **inFlow**:
  - a built-in Label Designer with customizable pre-made templates, or blank templates where you enter width and height;
  - printing via the "inFlow Print Helper" installed on at least one computer per account;
  - tested printers include the Zebra GK420D.
  - Supports DYMO, Zebra, Brother and others (vendor claim). — [inFlow: Label printing](https://www.inflowinventory.com/support/cloud/print-product-labels-in-inflow); [inFlow barcode features](https://www.inflowinventory.com/features/barcode-software)
- **ShipHero**:
  - tote labels with bulk print and per-row reprint;
  - a Barcode Label Generator (PDF) for command and box barcodes with a choice of label size;
  - item barcodes at receiving;
  - reprint of freight pallet/carton labels via bulk action;
  - reprint of batches from the Batches tab;
  - a troubleshooting article for label printing.
  - No location-label article was found. — [ShipHero Printing section](https://software-help.shiphero.com/hc/en-us/sections/4420180235021-Printing); [Totes](https://software-help.shiphero.com/hc/en-us/articles/4419345058445-How-to-Create-Totes-and-Print-Tote-Barcodes); [Troubleshooting label printing](https://software-help.shiphero.com/hc/en-us/articles/42284586388621-Troubleshooting-Label-Printing-Issues)
- **NetSuite** has a help article "Label Printing and Reprinting" (content not fetched; blocked). — [NetSuite help](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_163113050855.html)
- **ShipWorks**: reprint a label by scanning a barcode. — [ShipWorks](https://support.shipworks.com/hc/en-us/articles/4407048286875-Reprinting-a-Label-with-a-Barcode-Scan)
- **Sortly**: on-demand label printing for locations, checklists and audits. **Zoho Inventory**: barcode and shipping label generation from order/SKU data. (Aggregator sources only.) — [Capterra](https://www.capterra.com/compare/79357-169199/ZebraDesigner-Pro-vs-Sortly-Pro); [Capterra SG compare](https://www.capterra.com.sg/compare/78431/146241/inflow-inventory/vs/zoho-inventory)

### Inferences
- Table stakes for a small-warehouse WMS like miDepo:
  1. Print from the record: location, tote, item, box.
  2. Bulk print: a range of locations, all totes, all items in a receipt.
  3. Event-prepared labels: a receipt line confirmed with an unlabelled item queues an item label, and a box closed queues a box label. Each is one click to print, with an optional auto-print setting per station.
  4. PDF output that works with any printer, using A4 sheets or a single-label page sized to the roll.
  5. Optional raw ZPL for Zebra-class printers via a local agent (QZ Tray-like) for silent printing.
  6. Reprint with no data change. Count reprints if useful for audits.
  7. A per-device default printer and label stock, stored with miDepo's per-device sessions.
- A full WYSIWYG designer is beyond table stakes. Odoo leaves it to add-ons, while inFlow includes it. For miDepo, a fixed set of well-designed templates per size, with a few toggles (show price, show supplier), is enough at first. That is inference.

### Gaps
- Fishbowl, Cin7, Shopify (incl. Shopify Retail barcode labels) and NetSuite WMS label features: not researched or fetched this session.
- Odoo IoT Box specifics (direct printing via IoT, printer assignment per report): not confirmed.
- Print queue and per-workstation default-printer features: no vendor doc read confirms them.

## 5. Template approaches (mm-based design, PDF/HTML and ZPL/TSPL rendering, long text, characters)

### Takeaway
Little was found in this session's sources. Products ship either PDF (sheet/roll) or ZPL, and some add-ons emit raw ZPL as text. The rest below is inference.

### Cited Findings
- Odoo add-ons generate ZPL "for direct printing to Zebra thermal printers", alongside PDF from the same label definition. — [oe_product_label_builder](https://apps.odoo.com/apps/modules/17.0/oe_product_label_builder)
- inFlow templates are defined by label width x height entered by the user. — [inFlow support](https://www.inflowinventory.com/support/cloud/print-product-labels-in-inflow)
- ZPL has native barcode commands, including Code 128, EAN-13 and QR, so barcodes can be generated by the printer rather than rasterised. — [Zebra ZPL guide](https://docs.zebra.com/us/en/printers/software/zpl-pg/fonts-and-barcodes/barcodes.html)

### Inferences
- Define each template once in mm (size, margins, element boxes), then render it two ways:
  - HTML/CSS (`@page { size: 50mm 25mm }`), printed to PDF or by the browser, which works with any printer;
  - ZPL (or TSPL for the cheap Xprinter/TSC-class printers common on MercadoLibre AR) by converting mm to dots at the printer's dpi.
- Long titles: give each text field a box with a maximum line count, then shrink to a floor font size and finally truncate with an ellipsis. Never let text push the barcode out of its quiet zone.
- Spanish characters (ñ, á, ¿): ZPL needs `^CI28` (UTF-8) and a font that has the glyphs. Built-in printer fonts may lack them, so HTML/PDF is the safer default. The `^CI28` detail is background knowledge, unverified here.

### Gaps
- No sourced comparison of label-rendering libraries (e.g. JsBarcode/bwip-js, PDF generation) or TSPL specifics was gathered.
- No source on how vendors handle overflowing text on labels.
