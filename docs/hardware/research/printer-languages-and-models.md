# Thermal label printer command languages, models, and what they mean for a web WMS

Research date: 2026-11-20. Scope: desktop and mobile label printers for a small book warehouse in Argentina, driven from Chrome on Windows and Android.

Method note, read first. This session's sandbox could not open most vendor sites directly (docs.zebra.com, zebra.com, tscprinters.com, mercadolibre.com.ar, gadnic.com.ar and others did not resolve). Findings below therefore come from search-engine results pages (titles plus the text the search tool extracted from the cited page) and from the npm registry, which was reachable. Every cited URL is the page the snippet came from, but this session did not read those pages in full. Command syntax this session could not confirm from a source is listed under Inferences and marked "from general knowledge, verify against the manual". To allow the blocked hosts, add them to the session's network settings and re-check the items in the Gaps lists.

## 1. Command languages, their owners, who emulates what, and which subset covers the most printers

### Takeaway
Two languages cover almost every label printer a small Argentine warehouse is likely to buy: ZPL II (Zebra's language, emulated by TSC, Honeywell, Godex, SATO, Citizen, Xprinter and 3nStar's TSC-style models) and TSPL (TSC's language, native on TSC and on most cheap Chinese 4-inch printers: Xprinter, 3nStar, HPRT/iDPRT and others). Generating ZPL first and TSPL second, with PDF through the OS print dialog as the universal fallback, reaches most of the market. The exceptions are Brother QL (raster, ESC/P and P-touch Template, no ZPL/TSPL), Dymo LabelWriter (proprietary raster, and the 550 series only accepts Dymo's NFC-tagged labels), and Zebra's cheapest mobile ZQ220 (CPCL and ESC/POS only).

### Cited Findings

Languages and owners
- ZPL II and EPL2 are Zebra's languages. The ZD421 lists firmware "ZPL II; EPL 2; XML; ZBI; PDF Direct"; the ZD230 lists ZPL II, EPL 2 and XML — [Zebra ZD421/ZD411 and ZD230 spec sheets, via search](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd421-spec-sheet-en-us.pdf); [ZD230 spec sheet](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd230-spec-sheet-en-us.pdf)
- CPCL is Zebra's mobile-printer language. The ZQ220 lists CPCL and ESC/POS (no ZPL); the ZQ220 Plus docs say the printers "use CPCL and ESC/POS programming languages"; the ZQ521 lists "CPCL, ZPL, ZBI 2.x" — [Zebra ZQ220 spec sheet](https://zebra.com/content/dam/zebra_dam/en/spec-sheets/zq220-spec-sheet-en-us.pdf); [ZQ220 Plus user guide](https://docs.zebra.com/us/en/printers/mobile/zq220plus-zq120plus-ug/printer-overview.html); [Atlas RFID ZQ521 listing](https://atlasrfidstore.com/zebra-zq521-direct-thermal-mobile-printer). A Zebra developer forum post also says the ZQ220 Plus supports CPCL but not ZPL — [developer.zebra.com](https://developer.zebra.com/content/print-web-zq220-plus-cpcl-printer-using-bluetooth-and-javascript)
- TSPL/TSPL2 is TSC's language. TSC publishes the "TSPL/TSPL2 Programming Manual" (current edition 3.0) — [TSC](https://fs.tscprinters.com/system/files/31-0000001-00_tspl_tspl2_programming_3_0.pdf)
- Zebra itself now publishes a TSPL Programming Guide for its ZD100TA/DA, ZD230TA/DA and ZD888TA/DA (document P1139068-01EN Rev A, 2025-02-28), with sections for SIZE, GAP, BLINE, DENSITY, CODEPAGE, QRCODE, `<ESC>!?` and `~!D` — [Zebra TSPL guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/software/zd100series-zd230series-zd888series-proman-en.pdf). The same ZD888/ZD230 "TA/DA" user guides say the printers support "ZPL and EPL" with some command exclusions — [Zebra ZD888TA/ZD230TA docs](https://docs.zebra.com/us/en/printers/desktop/zd888ta-zd230ta/zpl-configuration.html)
- DPL is Datamax-O'Neil's language (now Honeywell); Honeywell's own native language is Direct Protocol (DP, the successor of Intermec Fingerprint), plus IPL (Intermec). The PC42d has "integrated ESim (EPL), ZSim (ZPL-II), DPL, and Direct Protocol (DP)"; the Japanese PC42t Plus page lists "IPL, DP, ZSim2 (ZPL-II), DSim (DPL), ESim (EPL)"; Fingerprint command reference guides are listed for both models — [Honeywell PC42d](https://automation.honeywell.com/us/en/products/productivity-solutions/printers/desktop/pc42d-desktop-direct-thermal-barcode-printer); [Honeywell PC42t Plus JP](https://automation.honeywell.com/jp/ja/products/productivity-solutions/printers/desktop-printers/pc42t-plus-desktop-thermal-transfer-barcode-printer); [PC42t Plus UK](https://automation.honeywell.com/gb/en/products/productivity-solutions/printers/desktop/pc42t-plus-desktop-thermal-transfer-barcode-printer)
- SBPL is SATO's language. CL4NX Plus/CL6NX Plus run SBPL with "auto detection of SZPL, SDPL, SIPL, STCL, SEPL"; PW4NX lists SZPL, SCPL, SIPL; PW2NX lists SPOS, SCPCL, SZPL, SDPL, SIPL, STPCL — [SATO help center](https://helpcenter.sato-global.com/hc/en-001/articles/43598470009881-Emulations-Languages-Supported-For-SATO-Printers); [SATO America S84ex/86ex](https://www.satoamerica.com/support/tech-tips/s84ex-86ex---emulation-switching)
- EZPL is Godex's language. RT200: "EZPL, GEPL, GZPL auto switch"; G500/G530 spec sheet: "EZPL, GEPL, GZPL, GDPL auto switch" (a Rice Lake listing mentions only GEPL/GZPL, so sources differ) — [Rice Lake G500](https://www.ricelake.com/products/godex-g500-direct-thermal-label-printer/?print=true); [RT200 brochure](https://www.koncept-l.pl/uk/file/49171/rt200-broszura-en.pdf); [certifiedscale G500 sheet](https://certifiedscale.com/wp-content/uploads/File-1721756673.pdf)
- ESC/POS is Epson's receipt language; Epson's ESC/POS Command Reference is the public reference — [Epson ESC/POS reference](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/index.html)
- Brother QL: the QL-820NWB supports Raster, ESC/P and P-touch Template; the QL-800 supports Raster only — [Brother command reference matrix](https://support.brother.com/g/s/es/dev/en/command/reference/index.html); [QL-800 raster reference](https://download.brother.com/welcome/docp100278/cv_ql800_eng_raster_101.pdf); [QL-820 P-touch Template reference](https://download.brother.com/welcome/docp100307/cv_ql820_eng_ptemp_102.pdf); [QL-820 ESC/P reference](https://download.brother.com/welcome/docp100306/cv_ql820_eng_escp_101.pdf). A secondary source says the QL family ships in ESC/P mode and raster jobs must switch mode first — [thermal-label brother-ql docs (community)](https://thermal-label.github.io/brother-ql/protocol/ql)
- Brother also publishes an "FBPL Command Reference" (a separate label language with command names similar to TSPL) — [Brother FBPL reference](https://download.brother.com/welcome/docp100453/fbpl_command_reference_eng_ug_13.pdf)
- Dymo LabelWriter 550/550 Turbo/5XL use a proprietary wire protocol, not wire-compatible with the 450, with a job header/trailer and a 32-byte status reply; label validation by NFC tag happens in hardware and "non-certified labels are rejected at the hardware level"; 450-series models have no lock — [thermal-label labelwriter docs (community reverse engineering)](https://thermal-label.github.io/labelwriter/protocol/lw5-raster); [hardware page](https://thermal-label.github.io/labelwriter/hardware). Dymo's reply to a Staples review says its 5-series printers "were designed to work with DYMO Authentic labels only" — [Staples review](https://staples.com/ptd/review/24499871)

Emulation by other brands
- TSC TE200/TE210: "TSPL-EZD (Compatible to EPL, ZPL, ZPL II, DPL)"; an older 2016 TSC sheet says "TSPL-EZ firmware emulates ..." Eltron/Zebra languages — [POSGuys TE200/300](https://posguys.com/barcode-printer_1/TSC_TE200-300%20Series_3876/); [barcodefactory TE200](https://www.barcodefactory.com/tsc/printers/te200/99-065a300-s1lf00); [barcodesinc TTP-244 Pro](https://barcodesinc.com/tsc/ttp-244-pro.htm)
- Xprinter XP-420B: retailer spec tables list emulation "TSPL / EPL / ZPL / DPL" (no official Xprinter datasheet found) — [egyptlaptop](https://egyptlaptop.com/xprinter-xp-420b-barcode-printer); [ezonelb](https://ezonelb.com/product/xprinter-xp-420b-direct-thermal-label-printer); Xprinter XP-D463B datasheet lists "TSPL, ZPL, EPL, DPL" — [manuals.plus XP-D463B](https://manuals.plus/m/cf35f099d7538024a058e5b3adfaabca0c9a1bb35ed4404d28067323f74e2693); XP-365B lists "ESC/POS/TSC" (a 2-in-1 receipt and label printer) — [manuals.plus XP-365B](https://manuals.plus/ae/1005002997212346)
- 3nStar LTT204 manual says "Refer to TSPL" and is distributed with a "TSPL, ZPL, DPL, EPL Instruction Manual"; sibling LTT334/LTT644 list TSPL, EPL, ZPL and DPL emulation — [manualslib 3nStar LTT204](https://www.manualslib.com/manual/2157572/3nstar-Ltt204.html); [manuals.plus LTT334](https://manuals.plus/asin/B0F56ZBTGG)
- Citizen CL-S621: "Cross-Emulation" auto-detects and switches between Datamax and Zebra emulation; an older sheet lists DPL standard and ZPL only on the CL-S621z variant — [Citizen press release](https://citizen-systems.com/en/media-hub/press-releases/citizen-upgrades-versatile-desktop-printers-ease-integration); [Citizen CL-S621 manual](https://manualmachine.com/citizen/cls631/1062826-user-manual)
- Zebra's own firmware includes Datamax emulation on ZT, ZQ5/ZQ6 and ZD printers ("Printer OS" emulations) — [Zebra printer emulations](https://www.zebra.com/ap/en/support-downloads/printer-software/apl.html)
- Brady i5100/i7100 support "limited ZPL emulation" — [Brady support](https://support.bradyid.com/articles/en_US/Knowledge/i5100-and-i7100-Support-Limited-ZPL-Emulation)

### Inferences
- Coverage ranking for a book warehouse in Argentina (inference from the emulation lists above plus what is sold locally, section 4): (1) ZPL II reaches every Zebra desktop (native), TSC TE/TTP/DA, Honeywell PC42 (ZSim), Godex (GZPL), SATO (SZPL), Citizen, and most Xprinter/3nStar 4-inch models (emulated). (2) TSPL reaches TSC natively plus nearly all cheap Chinese 4-inch and 2-inch printers (Xprinter, 3nStar, Gadnic, Nictom, HPRT, iDPRT, Munbyn are typically TSC-clones), including models that do not emulate ZPL, such as the 2-in-1 XP-365B. (3) PDF/HTML through the Windows or Android print dialog reaches everything that has a driver, including Brother QL and Dymo. EPL2, DPL, CPCL, SBPL, EZPL and IPL add little once ZPL is supported, because every printer seen here that speaks them also emulates ZPL, except Zebra's ZQ220/ZQ220 Plus (CPCL) and older Datamax units.
- Recommendation for the developer: one internal label model (boxes, text, barcodes in mm), with a ZPL encoder and a TSPL encoder, plus a raster fallback (render the label to a 1-bit bitmap and send it as ZPL `^GF` or TSPL `BITMAP`) for layouts the native fonts cannot do. That raster path also makes Brother QL raster and Dymo raster possible later.
- For a technical writer: list support by language ("printers that accept ZPL II", "printers that accept TSPL"), and list models only where a spec sheet confirms it. Cheap Chinese models need testing before they are listed, because spec claims come from resellers.
- "Speaks ZPL" on a non-Zebra printer often means a firmware setting or auto-detect (TSC's TSPL-EZD, Godex auto switch, Citizen Cross-Emulation, SATO auto detection). A setup screen should tell users how to check the printer's language setting on its configuration or self-test label.
- Brother's FBPL looks like a TSPL-style language for some Brother label models (TD-4D series judging by neighbouring document numbers); which models use it is unverified.

### Gaps
- No official Xprinter datasheet was reachable; the XP-420B's ZPL/DPL claims come only from resellers. XP-470B and XP-DT425B emulations were not found.
- Whether HPRT, iDPRT and Munbyn 4-inch models emulate ZPL was not checked this session (only the iDPRT SP460BT's availability in Argentina was found, not its language).
- The meaning of TSC's "TSPL-EZ" vs "TSPL-EZD" (the D likely adds DPL) is not confirmed by a primary source.
- Whether Honeywell's printer business has been sold or rebranded in 2025-2026 (one search summary mentioned Brady) was not confirmed; check before naming the brand in documentation.

## 2. ZPL and TSPL: minimal command set, Spanish text, graphics, dot conversions

### Takeaway
A WMS label needs about 15 commands in each language. For Spanish text, ZPL needs `^CI28` (UTF-8) with scalable font 0 or a TrueType font, and `^FH` hex escapes are the safe way to send ñ/á; TSPL needs `CODEPAGE` (1252 or UTF-8 where the firmware supports it). Anything the printer cannot draw natively can be sent as a 1-bit bitmap (`^GF` in ZPL, `BITMAP` in TSPL). Positions are in dots: 8 dots/mm at 203 dpi, about 11.8 (TSC rounds to 12) at 300 dpi, about 23.6 at 600 dpi.

### Cited Findings
- `^CI28` selects UTF-8 in ZPL; one user fixed accents by placing `^CI28` right after `^XA`; the setting can be saved with `^JUS` — [Zebra ^CI reference](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-ci.html); [Zebra developer forum](https://developer.zebra.com/thread/34687)
- `^FH` before `^FD` lets you write UTF-8 bytes as `_XX` hex (é → `_C3_A9`); one user used a TrueType Unicode font `^A@N,...,E:TT0003M_.TTF` with `^FH`; another reports a printer printed nothing when raw UTF-8 hex was sent without proper escaping — [Stack Overflow archive](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/29437279/print-characters-with-an-acute-in-zpl); [Zebra special characters note](https://support.zebra.com/cpws/docs/zpl/zpl_spcl_chr.htm); [Zebra developer forum](https://developer.zebra.com/thread/36104)
- Zebra Code Page 1252 (Latin) is a valid ZPL code page; code page mapping works with scalable fonts such as Font 0 or downloaded TrueType, and bitmapped fonts A-H do not support it — [Zebra code page 1252](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zebra-code-zebra-code-pages/c-zpl-zebra-code-zebra-code-page-1252-latin-character-set.html)
- Zebra's Unicode exercise in the ZPL guide covers Asian and Unicode encodings — [Zebra ZPL exercise 7](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/c-zpl-basic-zpl-exercises-examples/c-zpl-exercise-7-asian-unicode-encodings.html)
- `^PW` sets print width in dots; default is the head's maximum; too narrow clips, too wide wastes memory — [Zebra ^PW](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-pw.html)
- `^MN` sets media type: continuous, gap/notch, mark (black mark); continuous needs `^LL` label length — [Zebra ZT510 print settings](https://docs.zebra.com/us/en/printers/industrial/zt510-ug/print-settings.html)
- Darkness via `^MD` or `~SD`, values 0.0-30.0; Zebra advises the lowest darkness that prints well — [Zebra ~SD](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-sd.html); [ZT111 print settings](https://docs.zebra.com/us/en/printers/industrial/zt111-industrial-printer-user-guide/c-zt4x1-configuration/r-changing-printer-settings/c-zt211-zt111-other-ways-to-change-printer-settings/r-zt2x0-print-settings.html)
- `^PR` sets print speed in inches per second; range depends on model (ZT231: 2-14 ips) — [Zebra ZT231 print menu](https://docs.zebra.com/us/en/printers/industrial/zt231-industrial-printer-user-guide/c-zt4x1-configuration/r-changing-printer-settings/r-zt4x1-user-menus/r-zt4x1-print-menu.html)
- TSPL manuals list SIZE, GAP, BLINE, DENSITY, CODEPAGE, QRCODE (and DMATRIX in older TSC editions) — [Zebra TSPL guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/software/zd100series-zd230series-zd888series-proman-en.pdf); [TSC TSPL/TSPL2 3.0](https://fs.tscprinters.com/system/files/31-0000001-00_tspl_tspl2_programming_3_0.pdf); [ERS copy of TSC manual, 2021](https://www.ers-online.co.uk/files/products/files/ers_tspl_tspl2_programming_april21.pdf)
- TSPL `CODEPAGE n` takes values such as 437, 850, 1252 or UTF-8 (secondary source, not the TSC manual) — [rfid-me TSPL reference](https://rfid-me.pages.dev/reference/tspl/codepage/)
- Resolution in TSC terms: "8 dots per mm (203 dpi)" — [barcodefactory TE200](https://www.barcodefactory.com/tsc/99-065a100-00lf)
- Brady warns its ZPL emulator may show "minor label size differences because of dpi conversion" — [Brady Script Emulator ZPL FAQ](https://d37iyw84027v1q.cloudfront.net/Common/Brady_Script_Emulator_ZPL_FAQ.pdf)
- `zpl-image` (npm) converts PNG/JPEG/GIF to Z64-encoded GRF bitmaps for ZPL — [npm zpl-image](https://www.npmjs.com/package/zpl-image)

### Inferences
All command syntax in this block is from general knowledge of the Zebra ZPL II Programming Guide and the TSC TSPL/TSPL2 Programming Manual, and was not re-read this session. Verify each against the manual and test on hardware.

Dots: dots = mm × dpi / 25.4. 203 dpi → 8 dots/mm (a 50 × 25 mm label is 400 × 200 dots); 300 dpi → 11.81 dots/mm (TSC documents it as 12 dots/mm, so a 50 mm width is 590 or 600 dots depending on the rounding the vendor uses); 600 dpi → 23.6 dots/mm. A WMS should store layouts in mm and convert per printer, because the same ZPL at 203 dpi prints about 1.5× larger on a 300 dpi head. TSPL accepts mm directly in `SIZE` and `GAP` (`SIZE 50 mm, 25 mm`), but positions in `TEXT`/`BARCODE` are dots.

ZPL minimal set:
- Format: `^XA` … `^XZ`; `^CI28` (UTF-8); `^PW<dots>` width; `^LL<dots>` length; `^LH0,0` home; `^MNY` (gap; `N` continuous, `M` black mark); `^MTD` direct thermal or `^MTT` thermal transfer; `~SD15` or `^MD` darkness; `^PR4` speed; `^PQ<n>` copies.
- Field: `^FO x,y` origin, `^FT` typeset origin, `^FD…^FS` data, `^FH` hex escapes, `^FB width,lines,…` text block with wrap.
- Text: `^A0N,h,w` (scalable font 0, CG Triumvirate); `^CF0,h` default font; `^A@N,h,w,E:FONT.TTF` downloaded TrueType.
- Barcodes: `^BY module,ratio,height` then `^BCN,h,Y,N,N` (Code 128, auto subset), `^BEN,h,Y,N` (EAN-13; send 12 digits, the printer computes the check digit), `^BQN,2,mag` with `^FDQA,<data>` (QR, the `QA,` prefix sets error correction and mode), `^BXN,module,200` (DataMatrix ECC 200).
- Graphics: `^GB w,h,thickness` box or line; `^GFA,total,total,bytesPerRow,<hex>` bitmap (or Z64/compressed); stored images via `~DG`/`^XG`.
- Minimal ZPL book label example (203 dpi, 50 × 25 mm):
  ```
  ^XA^CI28^PW400^LL200^MNY^PQ1
  ^FO16,12^A0N,28,28^FH^FDEl t_C3_ADtulo del libro^FS
  ^FO16,50^BY2^BEN,80,Y,N^FD978950071234^FS
  ^XZ
  ```

TSPL minimal set:
- Setup: `SIZE 50 mm, 25 mm`; `GAP 2 mm, 0 mm` (gap), `BLINE 3 mm, 0 mm` (black mark) or `GAP 0,0` (continuous); `DIRECTION 1`; `REFERENCE 0,0`; `DENSITY 8` (0-15); `SPEED 4`; `CODEPAGE 1252` or `CODEPAGE UTF-8`; `CLS` clears the image buffer.
- Content: `TEXT x,y,"font",rotation,xmul,ymul,"content"` (built-in fonts "1"-"8", scalable "0" or a downloaded `"NAME.TTF"`); `BLOCK` for wrapped text; `BARCODE x,y,"128",height,readable,rotation,narrow,wide,"data"` and `"EAN13"`; `QRCODE x,y,ECC,cellwidth,mode,rotation,"data"`; `DMATRIX x,y,w,h,"data"`; `BOX x,y,x2,y2,thickness`; `BAR x,y,w,h` (filled line); `BITMAP x,y,widthBytes,height,mode,<binary>`.
- Print: `PRINT sets[,copies]`. Each line ends with CR LF.
- Bitmap note: TSPL `BITMAP` data is raw binary, and on most TSC firmwares 1 means white (not printed); ZPL `^GF` treats 1 as black. Encoders must invert accordingly.

Spanish text strategy (inference): use UTF-8 where the printer supports it (`^CI28` on Zebra Link-OS; `CODEPAGE UTF-8` on recent TSC), and fall back to Windows-1252 (`^CI27` on Zebra, `CODEPAGE 1252` on TSPL) for emulators and clones whose UTF-8 support is unknown. Spanish needs only á é í ó ú ü ñ ¿ ¡ and capitals, all inside 1252, so 1252 is the most portable choice. Built-in bitmap fonts (ZPL A-H, TSPL "1"-"8") often lack accented glyphs; use scalable font 0 or render text into the bitmap.

### Gaps
- The exact bit polarity of TSPL `BITMAP` and whether `CODEPAGE UTF-8` exists on Xprinter/3nStar firmware were not verified from a primary source.
- `^PQ`, `^BC`, `^BE`, `^BQ`, `^BX`, `^GF` reference pages were not read this session (docs.zebra.com unreachable); syntax above is from general knowledge.
- No source measured how emulated ZPL handles `^CI28` on TSC, Xprinter or Honeywell ZSim.

## 3. Status and identification: reading model, DPI, firmware, state and language from the printer

### Takeaway
Zebra printers answer rich queries: `~HS` (three status strings), `~HI` (model, firmware, dpi, memory) and SGD `! U1 getvar "<name>"` for any setting (`device.languages`, `head.resolution.in_dpi`, `head.latch`, `device.host_status`, JSON `allvalues`). TSPL printers answer `<ESC>!?` (one status byte) and `~!`-prefixed queries. Reading anything back requires a two-way channel; from a browser on Windows that is the hard part, because Windows' printer class driver keeps WebUSB from claiming a USB printer.

### Cited Findings
- `~HS` returns three data strings, each starting with STX and ending with ETX CR LF; string 1 includes fields such as paper out and pause, string 2 includes head up and ribbon out, and string 3 the media/sensor and communication diagnostics — [Zebra ~HS](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-hs.html); [How the Zebra printer responds to host status](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-error-detection-error-detection-protocol/c-zpl-error-detection-response-from-zebra-printer/c-zpl-error-detection-how-zebra-printer-responds-host-status.html); field list as given in [an Oki manual implementing ~HS](https://www.manualslib.com/manual/1793177/Oki-Le850.html?page=101)
- Zebra's ~HS page notes the printer may not respond to the host in certain conditions, listed in the snippet as including MEDIA OUT — [Zebra ~HS](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-hs.html)
- SGD `device.host_status` returns the same data as `~HS` without STX/ETX framing — [Zebra SGD device.host_status](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-sgd-printer-commands/r-sgd-device-host-status.html)
- `~HI` (host identification) reports firmware version, dots per inch, memory and options — [Zebra host status commands](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-adv-techn-advanced-techniques/r-zpl-adv-techn-host-status-commands.html)
- SGD has reference pages for `getvar`, `head.resolution.in_dpi`, `head.latch`, `device.languages`, `appl.link_os_version`, `usb.device.device_version`, `device.serial_numbers.printhead`, and JSON `allvalues` / branch reports — [SGD getvar](https://docs.zebra.com/us/en/printers/software/zpl-pg/r-sgd-sgd-printer-commands/c-sgd-overview/c-sgd-getvar-command.html); [head.resolution.in_dpi](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-sgd-printer-commands/r-sgd-head-resolution-in-dpi.html); [head.latch](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-sgd-printer-commands/r-sgd-head-latch.html); [appl.link_os_version](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-sgd-printer-commands/r-sgd-appl-link-os-version.html); [allvalues JSON](https://docs.zebra.com/us/en/printers/software/zpl-pg/r-sgd-sgd-printer-commands/c-sgd-json-javascript-object-notation-/c-sgd-get-allvalues-report.html)
- TSPL manuals list `<ESC>!?` and `~!D` (Zebra TSPL guide pages 49-50) — [Zebra TSPL guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/software/zd100series-zd230series-zd888series-proman-en.pdf)
- `@thermal-label/tspl-core` (npm, MIT, May 2026) describes itself as a TSPL II encoder with "status line shape, anchored on TSC's TSPL II Programming Manual" — [npm](https://www.npmjs.com/package/@thermal-label/tspl-core)
- Zebra Browser Print: a local service (Windows, macOS, Android) plus a JavaScript library; `send()` takes a ZPL string; `getStatus()` parses `~HS` and returns a message and a ready flag; known issues include page must be served over HTTP(S), first-use approval, certificate install for HTTPS, and some models (a ZD420 report) failing to connect; a forum reply lists QLn, ZT200, ZT400 as supported — [ServiceNow guide](https://www.servicenow.com/community/servicenow-ai-platform-articles/print-a-barcode-label-on-a-zebra-printer-using-browser-print/ta-p/2322299); [Zebra forum status](https://developer.zebra.com/content/getting-printer-status-browser-print-api); [Zebra forum devices](https://developer.zebra.com/content/browserprint-devices)
- WebUSB on Windows: `usbprint.sys` is the class driver for USB printers and, once loaded, Chrome cannot open the device (Zebra LP2844 "Access denied" report); WinUSB must be the driver for userspace access; Windows' UWP USB API refuses the printer class (0x07); Chromium notes a crafted INF can bind WinUSB to a specific device — [Stack Overflow archive (LP2844)](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/47143148/webusb-access-denied-trying-to-open-printer-on-windows); [Microsoft Windows.Devices.Usb](https://learn.microsoft.com/en-us/uwp/api/windows.devices.usb); [Microsoft supported USB classes](https://learn.microsoft.com/windows-hardware/drivers/usbcon/supported-usb-classes); [Chromium intent: WebUSB interface class filtering](https://groups.google.com/a/chromium.org/g/blink-dev/c/LZXocaeCwDw)
- One developer reports `claimInterface()` never resolving on Windows while the same code worked on Linux and Android — [Stack Overflow archive](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/65703110/webusb-claiminterface-never-returns-on-windows)

### Inferences
From general knowledge of the manuals, to verify:
- SGD syntax: `! U1 getvar "device.languages"` + CR LF; responses are the quoted value (e.g. `"zpl"`, `"epl_zpl"`, `"hybrid_xml_zpl"`, `"line_print"`). Useful names: `device.product_name`, `appl.name` (firmware), `head.resolution.in_dpi`, `media.status`, `head.latch` (`ok`/`open`), `media.type`, `print.tone`, `device.languages`. `! U1 setvar "device.languages" "zpl"` switches language.
- TSPL `<ESC>!?` returns one byte; commonly documented bits: 0 head open, 1 paper jam, 2 out of paper, 3 out of ribbon, 4 pause, 5 printing, 6 cover open, 7 other error (0x00 = ready). `~!T` returns model name, `~!I` code page and country, `~!F` file list, `~!@` mileage, `~!D` memory. Clones (Xprinter etc.) often implement `<ESC>!?` but not all `~!` queries.
- DPI detection order: Zebra `head.resolution.in_dpi` or `~HI`; TSPL `~!T` model name mapped through a table; otherwise ask the user and print a calibration label (a 50 mm ruler) to confirm.
- Language probe (inference, test before shipping): send SGD getvar first (Zebra Link-OS answers; most emulators ignore `!` lines), then `<ESC>!?` (TSPL answers one byte). Probing can make some printers print the probe text as a label, so probe only after the user picks "detect" and on a printer they can watch.
- Implication for miDepo: on Windows desktop, raw printing with status from Chrome is unreliable over WebUSB because of `usbprint.sys`; the planned local Windows helper (or Zebra Browser Print for Zebra only) is the dependable path for both send and status. On Android Chrome, WebUSB and Web Bluetooth (BLE printers) are realistic; Web Serial over Bluetooth Classic SPP is not available on Android Chrome as far as this research found (not verified).

### Gaps
- The `~HS` bit table and the exact list of conditions in which the printer does not answer were not read in full; the snippet's statement that it does not answer on MEDIA OUT is counterintuitive and must be tested.
- `media.status` did not appear in the search results; its existence and values are unconfirmed.
- No primary source for TSPL `<ESC>!?` bit layout or for `~!T`/`~!I` was reachable.
- Not verified: Web Serial / Web Bluetooth support for Bluetooth Classic (SPP) printers on Android Chrome in 2026; which cheap printers expose BLE rather than only SPP.

## 4. Brands and models common in Argentina: languages, interfaces, resolution, width, wifi

### Takeaway
Zebra (ZD230, ZD421, ZD411; ZD220 as the cheapest), TSC (TE200/TE210), Xprinter (XP-420B, XP-365B, XP-470B), 3nStar (LTT204), Honeywell (PC42t/PC42d), Godex (G500, RT200), Brother QL and Dymo are the families in scope. All 4-inch desktops print 203 dpi as standard (300 dpi variants exist for Zebra and TSC) with about 104-108 mm print width. Wifi is an option on Zebra ZD411/ZD421 (and some ZD230 SKUs), Xprinter XP-470B (USB+Wifi variant), Brother QL-820NWB; it was not found for Honeywell PC42 or TSC TE200/210 (Ethernet only on TE210). GC420, GK420, TTP-244 Pro and DA200 are discontinued but still common second-hand.

### Cited Findings

| Model | Status | Languages | Interfaces | Res. / width | Source |
|---|---|---|---|---|---|
| Zebra ZD230 (t/d) | Current | ZPL II, EPL2, XML; TSPL guide also published for ZD230TA/DA | USB standard; Ethernet or Bluetooth options; factory USB + 802.11ac Wi-Fi + BT 4.1 option | 203 dpi, 4 in | [ZD230 spec](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd230-spec-sheet-en-us.pdf); [ZD230 tech specs](https://prod-www.zebra.com/content/dam/zebra_dam/en/tech-specs/zd230-tech-specs-en-us.pdf); [ZD200 FAQ](https://www.zebra.com/content/dam/zebra_dam/en/faq/zd200-series-faq-a4-en-us.pdf); [TSPL guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/software/zd100series-zd230series-zd888series-proman-en.pdf) |
| Zebra ZD220 | Current | ZPL/EPL (ZD200 family) | USB; 4 ips vs 6 ips on ZD230 | 203 dpi | [ZD200 FAQ](https://www.zebra.com/content/dam/zebra_dam/en/faq/zd200-series-faq-a4-en-us.pdf) |
| Zebra ZD421 / ZD411 | Current | ZPL II, EPL2 (ZD421 adds XML, ZBI, PDF Direct) | USB + USB host standard; optional Ethernet, serial, dual radio (ZD421: 802.11ax/BT 5.3 or 802.11ac/BT 4.2; ZD411: 802.11ac/BT 4.2); BLE setup app; NFC Print Touch | 203/300 dpi | [ZD421 spec](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd421-spec-sheet-en-us.pdf); [ZD411 spec](https://zebra.com/content/dam/zebra_dam/en/spec-sheets/zd411-spec-sheet-en-us.pdf) |
| Zebra GC420d/t | Discontinued (GC420t: 31 Jan 2020 EMEA; service to 31 Mar 2023) → ZD220/ZD230 | ZPL/EPL | — | 203 dpi | [Zebra GC420t support](https://prod-www.zebra.com/gb/en/support-downloads/printers/desktop/gc420t.html); [Zebra trade-up guide](https://zebra.com/content/dam/zebra_dam/en_gb/guide/portfolio/printer-trade-up-end-of-service-guide-nodate-en-gb.pdf) |
| Zebra GK420d/t | Discontinued (EMEA Oct 2021) → ZD421 | ZPL/EPL | — | 203 dpi | [Zebra EOS guide EMEA](https://www.zebra.com/content/dam/zebra_dam/en_gb/guide/portfolio/printer-tradeup-program-eos-guide-emea-en-gb.pdf); [Rice Lake](https://www.ricelake.com/products/zebra-gk-series-printer-discontinued/) |
| Zebra ZQ220 / ZQ220 Plus (mobile) | ZQ220 discontinued; Plus current | CPCL, ESC/POS (no ZPL) | BT 4.1 (ZQ220), BT 5.0 Classic + BLE (Plus) | 2-3 in | [ZQ220 spec](https://zebra.com/content/dam/zebra_dam/en/spec-sheets/zq220-spec-sheet-en-us.pdf); [ZQ220 support](https://www.zebra.com/ap/en/support-downloads/printers/mobile/zq220.html); [ZQ220 Plus guide](https://docs.zebra.com/us/en/printers/mobile/zq220plus-zq120plus-ug/printer-overview.html) |
| Zebra ZQ521 (mobile) | Current | CPCL, ZPL, ZBI 2.x | BT (4.x), 802.11ac variants | 4 in (113 mm media) | [Atlas RFID](https://atlasrfidstore.com/zebra-zq521-direct-thermal-mobile-printer); [Connection](https://www.connection.com/product/zebra-zq521-dt-4.45-113mm-english-latin-802.11ac-bt-5.2-mobile-printer-w-battery-us-canada-certs-taa/zq52-buw0000-ga/42099434) |
| TSC TE200 | Current | TSPL-EZD (EPL, ZPL, ZPL II, DPL) | USB 2.0; Bluetooth factory option | 203 dpi, 6 ips; media 20-112 mm | [POSGuys](https://posguys.com/barcode-printer_1/TSC_TE200-300%20Series_3876/); [barcodefactory](https://www.barcodefactory.com/tsc/99-065a100-00lf) |
| TSC TE210 | Current | as TE200 | USB, Ethernet 10/100, RS232, USB host | 203 dpi (TE300/310 = 300 dpi) | [POSGuys](https://posguys.com/barcode-printer_1/TSC_TE200-300%20Series_3876/) |
| TSC TTP-244 Pro | Discontinued → TE200/TE210 | TSPL-EZ (EPL/ZPL) | USB, RS232 (LPT variant) | 203 dpi | [barcodefactory](https://www.barcodefactory.com/tsc/printers/ttp-244-pro); [ERS](https://www.ers-online.co.uk/o21349/99-057a001-00lf-tsc-ttp-244-pro-compact-thermal-transfer-label-printer) |
| TSC DA200 | Discontinued 30 Mar 2018 (support to 2023) → DA210/DA220 | TSPL | — | 203 dpi | [TSC discontinued products](https://latam.tscprinters.com/en/discontinued-products) |
| Xprinter XP-420B | Current | TSPL, EPL, ZPL, DPL (resellers) | USB / USB+LAN; BT variant seen in Peru | 203 dpi, 152 mm/s, 4 in | [egyptlaptop](https://egyptlaptop.com/xprinter-xp-420b-barcode-printer); [ezonelb](https://ezonelb.com/product/xprinter-xp-420b-direct-thermal-label-printer); [Falabella PE](https://www.falabella.com.pe/falabella-pe/shop/impresora-de-etiquetas) |
| Xprinter XP-470B | Current | not found | USB 2.0 / USB+Serial / USB+Bluetooth / USB+Wifi | 203 dpi, 127 mm/s, 108 mm | [oemdrivers](https://oemdrivers.com/printer-xprinter-xp-470b) |
| Xprinter XP-365B | Current | ESC/POS + TSC (TSPL) | USB (BT variants exist) | 203 dpi, 3 in | [manuals.plus](https://manuals.plus/ae/1005002997212346) |
| Xprinter XP-DT427B (sibling of DT425B) | Current | not found | USB; optional serial / WIFI / Bluetooth | 203 dpi, 108 mm | [manuals.plus](https://manuals.plus/m/238ef18dbf53146b09460a5f0c9c9599c562aab70a1bd823f9d2eb237e8ee3ee) |
| 3nStar LTT204 | Current | TSPL (manual "Refer to TSPL"); siblings LTT334/LTT644 TSPL/EPL/ZPL/DPL | not found | 203 dpi, 4 in | [manualslib](https://www.manualslib.com/manual/2157572/3nstar-Ltt204.html); [LTT334](https://manuals.plus/asin/B0F56ZBTGG) |
| Honeywell PC42t Plus / PC42d | Current | DP, ZSim (ZPL II), DPL, ESim (EPL); IPL on JP page | USB + USB host; optional serial, Ethernet; no wifi/BT found | 203 dpi, 104 mm | [PC42t Plus](https://automation.honeywell.com/us/en/products/productivity/printers/desktop/pc42t-plus-desktop-thermal-transfer-barcode-printer); [PC42d](https://automation.honeywell.com/us/en/products/productivity-solutions/printers/desktop/pc42d-desktop-direct-thermal-barcode-printer); [PC42t data sheet](https://www.barcodesinc.com/media/pdf/Honeywell/pc42t-2021.pdf) |
| Godex G500 / RT200 | Current | EZPL, GEPL, GZPL (+GDPL on G500 per one sheet), auto switch | not checked | 203 dpi, 4 in | [Rice Lake](https://www.ricelake.com/products/godex-g500-direct-thermal-label-printer/?print=true); [RT200 brochure](https://www.koncept-l.pl/uk/file/49171/rt200-broszura-en.pdf) |
| Citizen CL-S621 | Current (II) | DPL + ZPL Cross-Emulation | — | 203 dpi | [Citizen](https://citizen-systems.com/en/media-hub/press-releases/citizen-upgrades-versatile-desktop-printers-ease-integration) |
| Brother QL-800 | Current | Raster only | USB | 300 dpi, 62 mm media | [Brother matrix](https://support.brother.com/g/s/es/dev/en/command/reference/index.html) |
| Brother QL-820NWB | Current | Raster, ESC/P, P-touch Template | USB, Ethernet, Wi-Fi (802.11b/g/n, Wireless Direct), Bluetooth | 300 × 300 (300 × 600 high-res); 62 mm media, 58-61 mm printable (sources differ) | [Brother UK](https://www.brother.co.uk/labelling/ql-printers/ql-820nwb); [Brother EE](https://brother.ee/labelling-and-receipts/ql-820nwb); [B&H](https://www.bhphotovideo.com/c/product/1305562-REG/brother_ql820nwb_ql_820nwb_high_speed_professional.html/overview) |
| Dymo LabelWriter 550 / 550 Turbo | Current | Proprietary raster; Dymo NFC-tagged labels only | USB (Turbo adds LAN) | 300 dpi, ~56-57 mm printable | [labelvalue](https://www.labelvalue.com/printer-specs-and-print-widths-for-dymo-labelwriter-printers); [B&H 550 Turbo](https://www.bhphotovideo.com/c/product/1663968-REG/dymo_2112553_labelwriter_550_turbo_printer.html) |

Argentina availability (weak evidence; MercadoLibre could not be opened directly)
- MercadoLibre Argentina has a catalogue page for "Impresora Código Barras Zebra ZD230t LAN USB" (MLA37695382) — [mercadolibre.com.ar](https://www.mercadolibre.com.ar/impresora-codigo-barras-zebra-zd230t-lan-usb/p/MLA37695382)
- An Argentine MercadoLibre seller page lists "Impresora Térmica De Etiquetas Xp-420b Con Usb" — [mercadolibre.com.ar seller page](https://www.mercadolibre.com.ar/pagina/digitekprintermarket1539)
- Argentine Zebra/Honeywell distributor storefronts on MercadoLibre exist (IDSYSTEMS SA, RD Printer Service) — [IDSYSTEMS](https://www.mercadolibre.com.ar/pagina/idsystems); [RD Printer Service](https://www.mercadolibre.com.ar/tienda/rd-printer-service)
- Frávega (Argentine retailer) sells the iDPRT SP460BT label printer and the Nictom IT05 80 mm "comandera/etiqueta" printer; Megatone also sells the Nictom IT05 — [Frávega iDPRT](https://www.fravega.com/impresora-termica-de-etiquetas-idprt-sp460bt-22912809/p); [Frávega Nictom](https://www.fravega.com/p/impresora-termica-80-mm-comandera-etiqueta-it05-negra-nictom-22014735/); [Megatone](https://www.megatone.net/producto/impresora-termica-80mm-comandera-etiqueta-it05-blanca-nictom_MKT0344DXE/)
- A Gadnic manual (gadnic.com.ar, IMPTER04) describes a 203 dpi direct thermal printer with 16-82 mm print width and up to 152 mm/s; the command language was not in the snippet — [Gadnic IMPTER04](https://www.gadnic.com.ar/descargas/IMPTER04.pdf)
- Mercado Libre's own Argentine blog reviews the 3nStar RPT006 thermal printer (a receipt model) — [ML blog](https://www.mercadolibre.com.ar/blog/impresora-termica/1)

### Inferences
- For a small book warehouse the realistic set is: Zebra ZD230/ZD421 (distributor-backed, ZPL native, wifi as option), TSC TE200/TE210 (TSPL native, ZPL emulated), Xprinter XP-420B/XP-470B and 3nStar LTT204 (cheapest; TSPL native, ZPL claimed), plus second-hand GC420/GK420 (ZPL/EPL). Brother QL-800/820 and Dymo are sold more for offices; they only fit small product stickers (62 mm / 56 mm) and need the print-dialog path.
- Wifi-capable choices for "later over the network": Zebra ZD421/ZD411 dual-radio SKUs, ZD230 wifi SKU, Xprinter XP-470B USB+Wifi variant, TSC TE210 (Ethernet only), Brother QL-820NWB. Network printers on port 9100 (raw) would need the planned Windows helper, since a browser cannot open raw TCP sockets.
- Gadnic and Nictom appear to sell rebranded Chinese printers (the Nictom IT05 is a receipt/label 80 mm combo); such 2-in-1 models usually speak ESC/POS plus TSPL, like the XP-365B. This is inference and needs per-model testing.
- Book-label sizes (e.g. 50 × 25 mm or 40 × 30 mm product labels, 100 × 50 mm shelf/box labels) fit every 4-inch model; a 100 × 150 mm box label does not fit Brother QL or Dymo LW550 standard.

### Gaps
- No ARS prices or stock levels: MercadoLibre and its API were unreachable from this session.
- Not found: interfaces for 3nStar LTT204, Godex G500/RT200 options, Xprinter XP-DT425B specifics, Gadnic and Nictom label models' languages, TSC "TE244" (no such model found; probably TTP-244 or TE200 is meant).
- 300 dpi availability for Honeywell PC42t Plus: sources found only 203 dpi.

## 5. Real ZPL vs emulated ZPL: known differences and pitfalls

### Takeaway
Emulators implement the common label-formatting subset (fields, fonts 0/A-H, Code 128/EAN/QR/DataMatrix, boxes, `^GF`) but skip or vary on configuration, status and storage commands, SGD, fonts and scaling. Treat emulated ZPL as "formatting only", avoid Zebra-only features, keep to font 0 or bitmaps, and test each family.

### Cited Findings
- Honeywell ZSim emulates ZPL II commands for specific PC/PD/PM/PX models; other models run an earlier ZSim version, so supported commands depend on model and firmware; Honeywell advises firmware updates for the latest ZSim — [Honeywell ZSim command reference](https://demo.autoid.ro/wp-content/uploads/2023/05/sps-ppr-zsim-en-cr.pdf)
- Zebra's own ZD888/ZD230 TA/DA printers support ZPL and EPL "with some command exclusions" listed in the guide — [Zebra ZD888TA/ZD230TA docs](https://docs.zebra.com/us/en/printers/desktop/zd888ta-zd230ta/zpl-configuration.html)
- A buyer's guide notes native ZPL on Zebra avoids "a translation layer and the emulation quirks that come with it" (vendor blog, opinion) — [thermalprintersupplies.com](https://www.thermalprintersupplies.com/blog/zebra-vs-honeywell-vs-tsc-how-to-choose-between-the-three-biggest-thermal-printer-brands/)
- Brady: emulator "may show minor label size differences because of dpi conversion"; it publishes a list of supported ZPL commands; its i5100/i7100 have only "limited ZPL emulation" — [Brady FAQ](https://d37iyw84027v1q.cloudfront.net/Common/Brady_Script_Emulator_ZPL_FAQ.pdf); [Brady support](https://support.bradyid.com/articles/en_US/Knowledge/i5100-and-i7100-Support-Limited-ZPL-Emulation)
- Software ZPL renderers (Labelary, Neodynamic) skip unsupported commands rather than fail; most unsupported commands are serial-communication or hardware-configuration commands that do not affect layout — [Labelary docs](https://labelary.com/docs.html); [Neodynamic ZPL command support](https://www.neodynamic.com/Products/Help/ZPLPrinterEmulatorSDK6.0/articles/zpl-commands.html)
- Zebra's own CPCL-only ZQ220 Plus does not accept ZPL (forum report) — [developer.zebra.com](https://developer.zebra.com/content/print-web-zq220-plus-cpcl-printer-using-bluetooth-and-javascript)

### Inferences
- Likely pitfalls on clones (general knowledge, to test): font 0 is replaced by a different scalable font, so text width differs and long titles overflow; `^FB` wrapping and `^FH` escapes may be missing; `^CI28` may be ignored (use 1252); `^BQ` QR defaults (error level, mask) and `^BE` human-readable placement differ; `^MN`, `~SD`, `^PR` may be ignored in favour of front-panel or utility settings; `~HS`, `~HI` and SGD often do not answer; `~DG`/`^XG` storage and `^DF`/`^XF` templates are often absent; Z64-compressed `^GF` may be unsupported (send ASCII hex).
- Defensive rules for the encoder: absolute positions only; one field per `^FO…^FS`; explicit `^BY` before every barcode; `^PW`/`^LL` on every label; ASCII-hex `^GF`; no stored formats; no reliance on status.
- Some TSC-clone firmwares need the language set to ZPL or auto on the printer; when left on TSPL, ZPL is printed as text. A first-run "test print" that prints in both languages catches this.

### Gaps
- No published list of ZPL commands that TSC TSPL-EZD, Xprinter or Godex GZPL do not support was found.
- The Honeywell ZSim reference was found but not read in full.

## 6. Open-source JavaScript/TypeScript libraries (status as of 2026-11-20)

### Takeaway
ZPL generation is well served (MIT `@schie/fluent-zpl`, `node-zpl`; GPL-3.0 `jszpl`), plus mature helpers for bitmaps (`zpl-image`, MIT) and in-browser preview (`zpl-renderer-js`, MIT). TSPL libraries are young and small (`@thermal-label/tspl-core` MIT, `tspl-generator` ISC). Multi-language abstractions exist (`label-printer` ISC for ZPL/TSPL; `portakal` MIT, 9 languages) but are new. For ESC/POS, `@point-of-sale/receipt-printer-encoder` (MIT, maintained) with its WebUSB/WebBluetooth transports is the established choice. Given the small surface needed (about 15 commands per language), writing miDepo's own ZPL and TSPL encoders and using libraries only for bitmap conversion and preview is reasonable.

### Cited Findings
All rows from the npm registry metadata, read 2026-11-20 ("published" = date of the latest version).

| Package | Latest | Published | License | Purpose | Source |
|---|---|---|---|---|---|
| jszpl | 2.0.1 | 2026-05-05 | GPL-3.0 | ZPL II generation, TypeScript (v2 rewrite); created 2018 | [npm](https://www.npmjs.com/package/jszpl) |
| @schie/fluent-zpl | 1.0.0 | 2026-03-19 | MIT | fluent, type-safe ZPL builder | [npm](https://www.npmjs.com/package/@schie/fluent-zpl) |
| node-zpl | 1.0.5 | 2024-03-19 | MIT | typed ZPL generator; README says not every command supported | [npm](https://www.npmjs.com/package/node-zpl) |
| zpl-image | 0.3.0 | 2025-11-17 | MIT | PNG/JPEG/GIF → Z64 GRF for `^GF`; about 16k weekly downloads | [npm](https://www.npmjs.com/package/zpl-image) |
| zpl-renderer-js | 5.0.0 | 2026-10-20 | MIT | render ZPL to PNG in the browser without Labelary; about 57k weekly downloads | [npm](https://www.npmjs.com/package/zpl-renderer-js) |
| zplr | 0.3.0 | 2026-07-27 | MIT | parse and render ZPL; renderer pinned to Zebra's Oct 2025 guide | [npm](https://www.npmjs.com/package/zplr) |
| @caddy-industries/react-zpl | 0.3.1 | 2026-11-10 | MIT | build ZPL with React/flexbox (new, Oct 2026) | [npm](https://www.npmjs.com/package/@caddy-industries/react-zpl) |
| @wifilabel/zpl, @wifilabel/epl2 | 0.1.1 | 2026-10-23 | MIT | ZPL + SGD builder/parser; EPL2 setup + TSPL bitmap wrapper (new) | [npm](https://www.npmjs.com/package/@wifilabel/zpl) |
| webzlp | 2.0.4 | 2025-09-05 | GPL-2.0 | WebUSB printing to Zebra (ZPL/EPL) printers | [npm](https://www.npmjs.com/package/webzlp) |
| zebra-browser-print-wrapper | 0.1.4 | 2021-06-16 | GPL-3.0 | wrapper for Zebra Browser Print; unmaintained | [npm](https://www.npmjs.com/package/zebra-browser-print-wrapper) |
| @thermal-label/tspl-core | 0.2.0 | 2026-05-06 | MIT | TSPL II encoder + status shape, anchored on TSC manual | [npm](https://www.npmjs.com/package/@thermal-label/tspl-core) |
| tspl-generator | 1.0.1 | 2025-03-04 | ISC | TypeScript TSPL/TSPL2 generator; no repository listed | [npm](https://www.npmjs.com/package/tspl-generator) |
| js-tspl | 1.1.0 | 2023-09-20 | ISC | TSPL generator (one release) | [npm](https://www.npmjs.com/package/js-tspl) |
| @psdk/tspl, @psdk/cpcl | 0.7.22 | 2026-11-18 | none declared | TSPL/CPCL SDK, active (129 versions) | [npm](https://www.npmjs.com/package/@psdk/tspl) |
| printer-command-generator | 1.0.12 | 2025-10-14 | MIT | ZPL and TSPL generator, Chinese README, no repo listed | [npm](https://www.npmjs.com/package/printer-command-generator) |
| label-printer | 0.14.0 | 2026-11-05 | ISC | abstraction over thermal printer languages; 46 versions since 2023 | [npm](https://www.npmjs.com/package/label-printer) |
| portakal | 0.5.0 | 2026-04-02 | MIT | 9 languages (TSC, ZPL, EPL, ESC/POS, CPCL, DPL, SBPL, Star PRNT, IPL), parsers, cross-compilers | [npm](https://www.npmjs.com/package/portakal) |
| retail-print-kit | 0.4.0 | 2026-10-23 | MIT | Node/Electron ESC/POS + ZPL/TSPL/EZPL (new, Oct 2026) | [npm](https://www.npmjs.com/package/retail-print-kit) |
| libniimai | 0.9.2 | 2026-11-12 | MIT | browser printing to NIIMBOT, TSPL, ESC/POS over Web Bluetooth/Serial/USB (new, Nov 2026) | [npm](https://www.npmjs.com/package/libniimai) |
| @goodboy008/labelize-wasm | 1.12.0 | 2026-11-12 | MIT AND BSD-3-Clause | render ZPL/EPL/TSPL/CPCL/DPL to PNG/PDF via WebAssembly | [npm](https://www.npmjs.com/package/@goodboy008/labelize-wasm) |
| @point-of-sale/receipt-printer-encoder | 4.0.1 | 2026-09-18 | MIT | ESC/POS, StarLine, StarPRNT encoder (successor of esc-pos-encoder) | [npm](https://www.npmjs.com/package/@point-of-sale/receipt-printer-encoder) |
| @point-of-sale/webusb-receipt-printer, …/webbluetooth-receipt-printer | 2.1.0 | 2026-09-18 | MIT | WebUSB / Web Bluetooth transports | [npm](https://www.npmjs.com/package/@point-of-sale/webusb-receipt-printer) |
| esc-pos-encoder | 3.0.0 | 2024-09-21 | MIT | superseded by the @point-of-sale package | [npm](https://www.npmjs.com/package/esc-pos-encoder) |
| escpos (node) | 3.0.0-alpha.6 | 2020-08-18 | MIT | Node ESC/POS driver; stale | [npm](https://www.npmjs.com/package/escpos) |
| @node-escpos/core | 0.6.0 | 2024-03-13 | MIT | Node ESC/POS driver | [npm](https://www.npmjs.com/package/@node-escpos/core) |
| @mmote/niimbluelib | 0.49.1 | 2026-11-05 | MIT | NIIMBOT BLE protocol | [npm](https://www.npmjs.com/package/@mmote/niimbluelib) |

### Inferences
- License: `jszpl` (GPL-3.0), `webzlp` (GPL-2.0) and `zebra-browser-print-wrapper` (GPL-3.0) are copyleft; bundling them into a closed browser app ships GPL code to users, so avoid them unless miDepo's licence allows it. The MIT/ISC options cover the same ground.
- Maturity: most TSPL and multi-language packages were created in 2025-2026 with few downloads; treat them as references rather than dependencies. `zpl-image` and `zpl-renderer-js` are the most used and useful for bitmap conversion and on-screen preview of what will print.
- Preview: rendering the label in the browser (from miDepo's own label model, or from the generated ZPL via `zpl-renderer-js`) lets the user see the label before printing, consistent with the owner's "say problems before the click".

### Gaps
- GitHub activity (open issues, last commit, maintainers) was not checked: the GitHub API returned 403 from this session.
- No library's emulator compatibility (does its output print correctly on TSC/Xprinter ZPL emulation) is documented.
