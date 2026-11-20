# Hardware: label printers and scanners

Research done 2026-11-20 to plan labels, direct printing, the device panel, demo devices and the hardware manual. The per-topic notes behind it, with every source, are in [research/](research/). Owner decisions taken before the research: Chrome on Windows and Android only; labels prepared for one click, never printed silently; all standard sizes; no carrier labels yet; printers configured by supervisors and admins, default printer per computer; demo devices also in production behind a test mode; no paid services; the Windows helper is designed, not built; scan fields quietly fix keyboard-layout errors; EAN add-ons are not used.

## In one paragraph

Chrome can drive label printers and barcode scanners directly, but **the answer depends on the operating system. On Android it works. On Windows the installed printer driver blocks it.** On an Android phone, Chrome can send raw ZPL or TSPL to a USB label printer over an OTG cable (WebUSB), to a Bluetooth Classic printer (Web Serial over RFCOMM, Chrome 138+), and to Zebra's Bluetooth Low Energy printers (Web Bluetooth). On a Windows desktop, a USB label printer installed with its driver is owned by `usbprint.sys`, so WebUSB fails with "Access denied". The only fix is to replace the driver with WinUSB, which removes the printer from Windows, so the print dialog and ZebraDesigner stop working on that computer. For miDepo this means three things. Phase 2 (direct printing) mainly benefits phones and the minority of Windows setups that expose a serial port. The browser print dialog at the exact label size stays the main route on Windows. The optional Windows helper is the only route that gives one-click raw printing to a USB printer on Windows without touching drivers, not only to wifi printers. Two printer languages cover almost every label printer a small Argentine warehouse is likely to own: **ZPL II** (Zebra; emulated by TSC, Honeywell, Godex, SATO, Citizen and most Chinese 4-inch models) and **TSPL** (TSC and nearly every cheap Chinese clone). Brother QL, Dymo and Zebra's CPCL-only ZQ220 are the exceptions, and they print only through the dialog. Scanners need no API at all: keyboard-wedge input already works everywhere. The work there is normalising what arrives: keyboard-layout substitutions, add-ons, UPC-A and ISBN-10. **No printer or scanner model in this document has been tested with miDepo.** Every compatibility claim comes from vendor specs, vendor emulation claims or reseller listings, and many sources were read only as search-engine summaries.

## What miDepo already prints (2026-11-20)

The research was written against an older copy of the app. Since then `main` has gained the following, which the phases below build on rather than replace:

- **Receiving item labels** (D53): *Etiquetas* on a receiving prints one Code 128 label per received unit on the A4 product sheet (`src/app/(print)/imprimir/productos`).
- **A 100 × 150 mm thermal box label** (D54): one per box, with recipient, carrier, tracking barcode, remito and the box code `<order>-C<n>` that Despacho scans. It goes through the print dialog with `@page { size: 100mm 150mm; margin: 0 }` (`src/app/(label)/`). It is miDepo's own label, not a carrier-issued one; carrier label integrations stay deferred.
- A4 shelf labels (3 × 8), A4 box labels and the packing list, as before.

So the label work starts by moving these existing layouts onto the shared millimetre model, then adds the missing sizes and labels from the catalogue below.

## Executive summary: what is and is not possible in Chrome

### Platform matrix

The table below is the reference for every later decision. "Remembered" means the page can reopen a device it was granted before, without a click.

| Capability | Chrome on Windows desktop | Chrome on Android phone |
|---|---|---|
| Print HTML/PDF at label size through the print dialog | **Yes.** The driver must offer a paper size equal to the label; the user picks it, with Margins None and Scale 100% | Yes, through an Android print service (Mopria built in, vendor plugins); least predictable for thermal labels |
| One click straight to the printer, no dialog | Only with the `--kiosk-printing` flag or `SilentPrintingEnabled` policy, and every job then goes to the single default printer | No route found |
| WebUSB to a USB label printer | **Blocked by the Windows printer driver** ("Access denied"). Works only after rebinding the printer to WinUSB (Zadig), and then the Windows queue is gone | **Works** over USB-OTG. The printer needs its own power. Remembered |
| Web Serial (raw bytes to a COM port) | Since Chrome 89: USB CDC / virtual COM ports, RS-232 adapters. Paired Bluetooth Classic (SPP) devices since Chrome 117. Remembered | Bluetooth Classic RFCOMM since Chrome 138. Wired USB-serial only on devices that expose it (tied to Android 17) |
| Web Bluetooth (BLE GATT) | Since Chrome 70 | Since Chrome 56 |
| Remembered BLE printer | **No.** `getDevices()` is still behind a flag, so every session needs a chooser tap | Same |
| WebHID (HID-POS scanners, scales) | Since Chrome 89 | Not shipped. Policy files hint at Chrome 155, unverified |
| Keyboard-wedge scanner (USB, 2.4 GHz dongle, Bluetooth HID) | Yes, as keystrokes. The page cannot see the device | Yes, as keystrokes, including Zebra DataWedge and Honeywell keystroke output |
| Camera scanning with the native `BarcodeDetector` | **Not on Windows.** miDepo's ZXing-WASM ponyfill does the work | Native (needs Google Play Services) |
| Raw TCP 9100 to a wifi/Ethernet printer | Impossible from a web page; needs a helper | Impossible; no helper on phones |
| Web page talking to a helper on `localhost` | Works, with a Local Network Access permission prompt since Chrome 142 | Not practical |

The sources for the matrix:

- WebUSB, Web Serial, Web Bluetooth and WebHID versions come from MDN's compatibility data as stored on GitHub ([USB.json](https://github.com/mdn/browser-compat-data/blob/main/api/USB.json), [Serial.json](https://github.com/mdn/browser-compat-data/blob/main/api/Serial.json), [Bluetooth.json](https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json), [HID.json](https://github.com/mdn/browser-compat-data/blob/main/api/HID.json)) and from Chromium source ([runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)).
- Bluetooth serial on desktop comes from the Chrome blog, read as a search extract ([Serial over Bluetooth on the web](https://developer.chrome.com/blog/serial-over-bluetooth)).
- Web Serial on Android, fully supported from Chrome 148 (stable 5 May 2026), comes from the release notes, read as a search summary ([Chrome 148 release notes](https://developer.chrome.com/release-notes/148)).
- Silent printing comes from Chromium source ([print_preview_utils.h](https://github.com/chromium/chromium/blob/main/chrome/browser/ui/webui/print_preview/print_preview_utils.h)).
- `BarcodeDetector` comes from Chrome's Shape Detection page, read as a search extract ([Shape Detection API](https://developer.chrome.com/docs/capabilities/shape-detection)).
- Local Network Access comes from the release notes ([Chrome 142 release notes](https://developer.chrome.com/release-notes/142)).

### The Windows driver conflict and what it does to phase 2

The central constraint is easy to miss in the WebUSB documentation. The USB printer class (0x07) is not on WebUSB's protected-class list, so in principle a page may claim a label printer ([WebUSB spec source](https://github.com/WICG/webusb/blob/main/index.bs)). On Windows, though, the inbox `usbprint.sys` driver already owns any printer that has a print queue. Zebra, LP2844 and receipt-printer users all report `DOMException: Access denied` on `open()` or `claimInterface()` in both Chrome and Edge ([Zebra developer forum](https://developer.zebra.com/content/domexception-failed-execute-open-usbdevice-access-denied); [Stack Overflow archive](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/47143148/webusb-access-denied-trying-to-open-printer-on-windows), search summaries). The author of the MIT point-of-sale libraries says it plainly: "on most platforms you can directly talk to USB connected receipt printers using WebUSB. The main exception to this is on Windows where the printer driver exclusively claims the printer" ([WebUSBReceiptPrinter README](https://github.com/at-point-of-sale/WebUSBReceiptPrinter/blob/main/README.md)). Microsoft's own UWP USB API also refuses printer-class devices, which shows that Windows reserves them for its print stack ([Windows.Devices.Usb](https://learn.microsoft.com/en-us/uwp/api/windows.devices.usb), search summary).

There are three ways around the conflict, and none is clean. **Zadig** can replace `usbprint` with WinUSB on that one computer. The WebZLP project documents the steps, including the red "driver isn't trusted" warning that comes from Zadig's self-signed driver ([WebZLP windows_driver.md](https://github.com/Cellivar/WebZLP/blob/main/docs/windows_driver.md)). Users report mixed results and rollbacks after a reboot or replug ([chromium webusb group](https://groups.google.com/a/chromium.org/g/webusb/c/qmbqfPNj97A), search summary), and one Zebra-forum developer called Zadig "not viable for our customer base". **Firmware** that declares WinUSB through Microsoft OS 2.0 descriptors avoids the conflict ([Microsoft: Automatic installation of WinUSB](https://learn.microsoft.com/windows-hardware/drivers/usbcon/automatic-installation-of-winusb)), but no label printer found in this research does so. **Web Serial** works if the printer exposes a USB CDC-ACM interface or its driver creates a virtual COM port. The point-of-sale author recommends this route, and warns it fails for Star printers ([WebUSBReceiptPrinter README](https://github.com/at-point-of-sale/WebUSBReceiptPrinter/blob/main/README.md)). Which label printers expose a COM port is not verified per model.

Phase 2 should therefore be planned as follows:

- On **Android**, direct printing becomes the best route: WebUSB over OTG, Web Serial over Bluetooth Classic, Web Bluetooth for Zebra BLE.
- On **Windows**, direct printing is an opt-in. It covers printers reached through a COM port (Bluetooth SPP pairs as one, and RS-232 models such as the TSC TE210 have one). WebUSB is a supervisor-performed Zadig setup, offered only on computers where the printer is used from miDepo alone.
- Everything else on Windows stays on the print dialog. Phase 1 must make that route reliable: exact page sizes, a per-printer setup check, a test label.
- The future helper is the clean Windows answer for USB printers too. It writes raw bytes through the Windows spooler (`OpenPrinter` → `StartDocPrinter` with datatype RAW → `WritePrinter`), which coexists with the installed driver ([Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/printdocs/sending-data-directly-to-a-printer)).

### How to read the sources in this document

Network access during research was narrow. Pages were reached in two ways. **Read in full:** GitHub-hosted sources (WICG spec sources, the Chromium mirror, MDN's compat data, project READMEs and issues) and the npm registry. **Search summary:** text extracted by a search engine from a cited page that was not opened, which covers most vendor manuals, Chrome release notes and forum threads. This document says "search summary" where it matters. Command syntax for ZPL and TSPL that no reachable source confirmed is flagged as "to verify against the manual". The blocked hosts are listed in the final section.

## Two printer languages reach almost every label printer on sale

### ZPL first, TSPL second, the dialog for everything else

**ZPL II** is Zebra's language. The ZD421 lists "ZPL II; EPL 2; XML; ZBI; PDF Direct" and the ZD230 lists ZPL II, EPL 2 and XML ([ZD421 spec sheet](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd421-spec-sheet-en-us.pdf); [ZD230 spec sheet](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd230-spec-sheet-en-us.pdf), search summaries). Other brands emulate it, usually through a firmware mode or automatic detection:

- **TSC:** "TSPL-EZD (Compatible to EPL, ZPL, ZPL II, DPL)" on the TE200/TE210 ([POSGuys](https://posguys.com/barcode-printer_1/TSC_TE200-300%20Series_3876/)).
- **Honeywell:** ZSim on the PC42 ([Honeywell PC42d](https://automation.honeywell.com/us/en/products/productivity-solutions/printers/desktop/pc42d-desktop-direct-thermal-barcode-printer)).
- **Godex:** "EZPL, GEPL, GZPL auto switch" ([RT200 brochure](https://www.koncept-l.pl/uk/file/49171/rt200-broszura-en.pdf)).
- **SATO:** auto-detection of SZPL and others ([SATO help center](https://helpcenter.sato-global.com/hc/en-001/articles/43598470009881-Emulations-Languages-Supported-For-SATO-Printers)).
- **Citizen:** "Cross-Emulation" ([Citizen](https://citizen-systems.com/en/media-hub/press-releases/citizen-upgrades-versatile-desktop-printers-ease-integration)).

**TSPL** is TSC's language ([TSPL/TSPL2 Programming Manual 3.0](https://fs.tscprinters.com/system/files/31-0000001-00_tspl_tspl2_programming_3_0.pdf)). It is native on nearly every cheap Chinese 4-inch printer. Zebra itself now publishes a TSPL guide for its ZD230TA/DA and ZD888TA/DA variants ([Zebra TSPL guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/software/zd100series-zd230series-zd888series-proman-en.pdf)). A third-party label-software vendor reports that Xprinter and TSC clones identify as TSPL ([LabelInn](https://www.labelinn.com/en/thermal-printer-software)). TSPL matters because some cheap models do not emulate ZPL at all, such as the 2-in-1 Xprinter XP-365B (ESC/POS + TSPL) ([manuals.plus XP-365B](https://manuals.plus/ae/1005002997212346)).

**The exceptions use other languages and should be dialog-only:**

- **Brother QL** speaks raster, ESC/P and P-touch Template. The QL-800 speaks raster only ([Brother command reference matrix](https://support.brother.com/g/s/es/dev/en/command/reference/index.html)).
- **Dymo LabelWriter 550** uses a proprietary raster protocol, and "non-certified labels are rejected at the hardware level" ([thermal-label community docs](https://thermal-label.github.io/labelwriter/hardware)).
- **Zebra ZQ220 / ZQ220 Plus** mobile printers speak CPCL and ESC/POS, with no ZPL ([ZQ220 spec sheet](https://zebra.com/content/dam/zebra_dam/en/spec-sheets/zq220-spec-sheet-en-us.pdf); [ZQ220 Plus guide](https://docs.zebra.com/us/en/printers/mobile/zq220plus-zq120plus-ug/printer-overview.html)).

EPL2, DPL, SBPL, EZPL and IPL add almost nothing once ZPL and TSPL exist, because every printer seen in this research that speaks them also emulates ZPL.

**Emulated ZPL should be treated as "formatting only".** Honeywell says its ZSim command support depends on model and firmware ([Honeywell ZSim reference](https://demo.autoid.ro/wp-content/uploads/2023/05/sps-ppr-zsim-en-cr.pdf)). Even Zebra's own TSPL-based ZD230TA supports ZPL "with some command exclusions" ([Zebra ZD888TA/ZD230TA docs](https://docs.zebra.com/us/en/printers/desktop/zd888ta-zd230ta/zpl-configuration.html)). Brady warns of "minor label size differences because of dpi conversion" ([Brady FAQ](https://d37iyw84027v1q.cloudfront.net/Common/Brady_Script_Emulator_ZPL_FAQ.pdf)). Software renderers such as Labelary skip what they do not support rather than fail ([Labelary docs](https://labelary.com/docs.html)), and clones probably behave the same way. That is why miDepo should prefer each printer's native language: ZPL for Zebra, TSPL for TSC and clones.

### Supported-models table

Status legend:

- **Vendor spec:** the manufacturer's spec sheet or manual lists it (mostly read as a search summary).
- **Emulation claimed by vendor:** the manufacturer claims ZPL emulation, with unknown command coverage.
- **Reseller claim:** only shop listings say so.
- **Unverified:** not confirmed by any source.
- **Dialog only:** no raw language miDepo will generate.

**Not one row has been tested with miDepo.** The phase 5 manual must show this status, in Spanish, beside every model.

The route columns combine the platform matrix with each model's interfaces. A row that says "WebUSB (OTG)" for Android assumes the printer enumerates as USB printer class or vendor class. That is standard behaviour, but no model was checked.

| Model (status in market) | Native language | ZPL | TSPL | Interfaces | Windows route | Android route | Status | Source |
|---|---|---|---|---|---|---|---|---|
| Zebra ZD230 t/d (current; sold on MercadoLibre AR) | ZPL II, EPL2 | Native | Only on TA/DA variants | USB; Ethernet or BT options; Wi-Fi SKU | Dialog (ZDesigner); WebUSB only after WinUSB; network via helper | WebUSB (OTG) | Vendor spec | [ZD230 spec](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd230-spec-sheet-en-us.pdf) |
| Zebra ZD220 (current, cheapest) | ZPL/EPL | Native | — | USB | Dialog; WebUSB after WinUSB | WebUSB (OTG) | Vendor spec | [ZD200 FAQ](https://www.zebra.com/content/dam/zebra_dam/en/faq/zd200-series-faq-a4-en-us.pdf) |
| Zebra ZD421 / ZD411 (current) | ZPL II, EPL2 | Native | — | USB; Ethernet, serial, Wi-Fi + BT/BLE options | Dialog; Web Serial (serial option or paired BT); helper for network | WebUSB (OTG); Web Bluetooth (Parser Service); Web Serial (BT Classic) | Vendor spec; BLE per Zebra app note | [ZD421 spec](https://www.zebra.com/content/dam/zebra_dam/en/spec-sheets/zd421-spec-sheet-en-us.pdf); [Zebra BLE sample](https://github.com/ZebraISV/Zebra-Printer-Samples-master/blob/master/WeChat-MiniProgram-Samples/WeChatPrintDemo/README.md) |
| Zebra GC420 / GK420 (discontinued; common second-hand) | ZPL/EPL | Native | — | USB | Dialog; WebUSB after WinUSB (LP2844/GK reports mixed) | WebUSB (OTG) | Vendor spec (EOS guides) | [Zebra EOS guide](https://www.zebra.com/content/dam/zebra_dam/en_gb/guide/portfolio/printer-tradeup-program-eos-guide-emea-en-gb.pdf) |
| Zebra ZQ521 mobile | CPCL, ZPL | Native | — | BT; 802.11ac variants | Web Serial (paired BT) | Web Serial (BT Classic); Web Bluetooth (ZQ500 BLE) | Reseller listing | [Atlas RFID](https://atlasrfidstore.com/zebra-zq521-direct-thermal-mobile-printer) |
| Zebra ZQ220 / ZQ220 Plus mobile | CPCL, ESC/POS | **No** | No | BT (Plus: BT 5.0 + BLE) | Not supported for raw | Not supported for raw | Dialog only (if a driver exists) | [ZQ220 spec](https://zebra.com/content/dam/zebra_dam/en/spec-sheets/zq220-spec-sheet-en-us.pdf) |
| TSC TE200 / TE210 (current) | TSPL-EZD | Emulation claimed by vendor | Native | USB; TE210 adds Ethernet, RS-232, USB host; TE200 BT option | Dialog; Web Serial over RS-232 (TE210) or BT; helper for Ethernet | WebUSB (OTG) | Emulation claimed by vendor (reseller copies of spec) | [POSGuys](https://posguys.com/barcode-printer_1/TSC_TE200-300%20Series_3876/) |
| TSC TTP-244 Pro (discontinued) | TSPL-EZ | Emulation claimed by vendor | Native | USB, RS-232 | Dialog; Web Serial over RS-232 | WebUSB (OTG) | Emulation claimed by vendor | [barcodesinc](https://barcodesinc.com/tsc/ttp-244-pro.htm) |
| Honeywell PC42t Plus / PC42d | DP; ZSim; DPL; ESim | Emulation claimed by vendor (ZSim, model/firmware-dependent) | No | USB; serial, Ethernet options; no wifi found | Dialog; Web Serial (serial option) | WebUSB (OTG) | Emulation claimed by vendor | [PC42d](https://automation.honeywell.com/us/en/products/productivity-solutions/printers/desktop/pc42d-desktop-direct-thermal-barcode-printer) |
| Godex G500 / RT200 | EZPL | Emulation claimed by vendor (GZPL) | No | Not checked | Dialog | WebUSB (OTG), unverified | Emulation claimed by vendor; interfaces unverified | [Rice Lake G500](https://www.ricelake.com/products/godex-g500-direct-thermal-label-printer/?print=true) |
| Citizen CL-S621 | DPL | Emulation claimed by vendor | No | Not checked | Dialog | Unverified | Emulation claimed by vendor | [Citizen](https://citizen-systems.com/en/media-hub/press-releases/citizen-upgrades-versatile-desktop-printers-ease-integration) |
| Xprinter XP-420B (sold on MercadoLibre AR) | TSPL | Reseller claim | Reseller claim | USB; USB+LAN; BT variant | Dialog; Web Serial if a virtual COM port exists (unverified) | WebUSB (OTG); Web Serial for BT variant | Reseller claim | [egyptlaptop](https://egyptlaptop.com/xprinter-xp-420b-barcode-printer) |
| Xprinter XP-470B | Not found | Unverified | Unverified | USB / USB+Serial / USB+BT / USB+Wifi variants | Dialog | Unverified | Unverified | [oemdrivers](https://oemdrivers.com/printer-xprinter-xp-470b) |
| Xprinter XP-365B (2-in-1) | ESC/POS + TSPL | No | Yes (manual) | USB; BT variants | Dialog | WebUSB (OTG); Web Serial (BT) | Manual on manuals.plus | [manuals.plus](https://manuals.plus/ae/1005002997212346) |
| 3nStar LTT204 | TSPL | Sibling models claim it | Yes | Not found | Dialog | Unverified | Manual; interfaces unverified | [manualslib](https://www.manualslib.com/manual/2157572/3nstar-Ltt204.html) |
| iDPRT SP460BT, Gadnic IMPTER04, Nictom IT05 (sold at Frávega / gadnic.com.ar) | Unknown | Unverified | Unverified (TSPL likely) | BT (SP460BT); others not found | Dialog | Unverified | Unverified | [Frávega iDPRT](https://www.fravega.com/impresora-termica-de-etiquetas-idprt-sp460bt-22912809/p); [Gadnic](https://www.gadnic.com.ar/descargas/IMPTER04.pdf) |
| Brother QL-800 / QL-820NWB | Raster; ESC/P; P-touch Template | No | No | USB; 820NWB adds Ethernet, Wi-Fi, BT | Dialog only | Dialog via print service (unverified) | Dialog only | [Brother matrix](https://support.brother.com/g/s/es/dev/en/command/reference/index.html) |
| Dymo LabelWriter 550 / Turbo | Proprietary raster; Dymo NFC labels only | No | No | USB (Turbo adds LAN) | Dialog only | — | Dialog only | [labelvalue](https://www.labelvalue.com/printer-specs-and-print-widths-for-dymo-labelwriter-printers) |

All 4-inch desktops print at 203 dpi as standard, with a print width of about 104–108 mm. Zebra and TSC also sell 300 dpi variants. Brother QL prints at 300 dpi on 62 mm media, and Dymo 550 at 300 dpi with about 56 mm printable.

**USB vendor IDs for WebUSB filters.** The following were checked in the usb.ids database ([systemd hwdb usb.ids](https://github.com/systemd/systemd/blob/main/hwdb.d/usb.ids)):

| Brand | Vendor ID |
|---|---|
| Zebra | `0x0A5F` |
| TSC | `0x1203` |
| Datamax-O'Neil | `0x0B0B` |
| Honeywell | `0x10AC` |
| Intermec | `0x067E` |
| Sato | `0x0828` |
| Brother | `0x04F9` |
| Dymo | `0x0922` |
| Bixolon | `0x1504` |
| Toshiba TEC | `0x08A6` |
| Citizen | `0x1343` and `0x08BD` |
| Epson | `0x04B8` |
| SNBC | `0x154F` |
| USB-serial bridges: WCH, Prolific, FTDI, Silicon Labs | `0x1A86`, `0x067B`, `0x0403`, `0x10C4` |

Three entries are **not** in usb.ids and remain unverified. Godex (`0x195F`) and Argox (`0x1664`) are commonly cited IDs. Xprinter-class printers usually enumerate with the chip maker's ID (STMicro, Winbond, NXP) rather than a brand ID. Because of this, the chooser filter must also include `classCode: 0x07`, which matches any USB printer.

## The browser offers four byte pipes, each with a catch

### WebUSB, Web Serial and Web Bluetooth in practice

**WebUSB** has shipped since Chrome 61, on Android too ([MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/api/USB.json)). It needs HTTPS and a user gesture for `requestDevice()` ([WebUSB spec](https://github.com/WICG/webusb/blob/main/index.bs)). An `"usb-unrestricted"` mode exists, but it is limited to Isolated Web Apps, so it cannot help a site hosted on Vercel. The connection sequence is standard USB printer-class behaviour, not taken from a fetched source:

1. `open()`.
2. `selectConfiguration(1)` if no configuration is set.
3. Claim the interface with class 0x07 (or 0xFF, vendor-specific).
4. `transferOut()` to the bulk OUT endpoint.
5. Optionally `transferIn()` from the bulk IN endpoint. Only bidirectional interfaces (protocol 0x02) have one, so status read-back works only on those.

On Android, a USB printer needs an OTG adapter and its own power supply. The notes found no Android kernel driver that claims printers. Whether Android adds its own permission dialog on top of Chrome's chooser was not verified.

**Web Serial** opens anything that presents itself as a COM port. On desktop Chrome it has been available since 89. Bluetooth SPP devices paired in Windows settings appear in the chooser since Chrome 117. Every Bluetooth service class except SPP is blocked unless the page lists it in `allowedBluetoothServiceClassIds` ([Chrome blog](https://developer.chrome.com/blog/serial-over-bluetooth), search extract). On Android, MDN records Bluetooth RFCOMM-only support from Chrome 138, and an April 2025 Intent to Ship targeted 137 ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/BqUGCcurReE)). Full support followed in Chrome 148, but the Intent to Ship says "only devices configured to expose wired serial ports will return non-empty lists" ([blink-dev: Intent to Ship Web Serial on Android](https://groups.google.com/a/chromium.org/g/blink-dev/c/HBJ-uYFvkpM), search summary). In practice this means Bluetooth Classic label printers work on Android phones, and USB-serial printers on phones should be considered unavailable. Google's `web-serial-polyfill`, which runs Web Serial over WebUSB, can reach USB CDC printers on Android that no OS driver claims ([npm](https://www.npmjs.com/package/web-serial-polyfill)). The filter for Bluetooth Classic printers is the standard SPP UUID `00001101-0000-1000-8000-00805f9b34fb`, which comes from general Bluetooth knowledge. One caveat on Android: connect/disconnect events and `port.connected` are not fully reliable over Bluetooth ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/BqUGCcurReE)).

**Web Bluetooth** reaches BLE GATT only, never Bluetooth Classic. Zebra's ZQ300/ZQ500 mobile, ZD400/ZD600 desktop and ZT600 industrial printers expose the "Zebra Parser Service" `38eb4a80-c570-11e3-9507-0002a5d5c51b`. Data is written to its characteristic `38eb4a82-…` and read from `38eb4a81-…`. BLE may first need enabling with `! U1 setvar "bluetooth.le.controller_mode" "both"`. The services "cannot be discovered unless the central device has connected to the printer", so the chooser must filter by name prefix and list the service in `optionalServices`. Writes must be chunked: the default is 20 bytes, and Zebra's sample uses 300 bytes with a 250 ms pause on Android ([ZebraISV sample README](https://github.com/ZebraISV/Zebra-Printer-Samples-master/blob/master/WeChat-MiniProgram-Samples/WeChatPrintDemo/README.md); the same UUIDs appear independently in [Zemulator](https://github.com/cabal95/Zemulator)). The MIT Web Bluetooth receipt library uses 200-byte chunks with a short pause for cheap "cat" printers ([WebBluetoothReceiptPrinter](https://github.com/at-point-of-sale/WebBluetoothReceiptPrinter/blob/main/README.md)). The service UUIDs of cheap Chinese BLE label printers (`0xFF00`, `0xFFF0`, `0x18F0`, `e7810a71-…`) are unverified leads. The biggest weakness of Web Bluetooth is that `bluetooth.getDevices()` is still experimental ([runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)). A BLE printer therefore needs a chooser tap every session.

**WebHID** is only for scanners in HID-POS mode and for scales. It is covered in the scanner section.

### What a device panel can and cannot know

`navigator.usb.getDevices()` and `navigator.serial.getPorts()` return devices granted earlier, without a user gesture, and both APIs fire `connect`/`disconnect` events. That is enough for a live "what this computer sees" panel ([MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/api/USB.json)). The panel has five limits:

- **First access needs a click.** The first grant always requires a click and a browser chooser.
- **Bluetooth printers do not stay connected.** They show as "tap to reconnect".
- **Grants belong to one browser profile.** They are stored per origin and per browser profile, so the panel describes that Chrome profile, not the machine. No source says whether an installed PWA shares grants with the tab; since grants are per origin it should, but this is unverified.
- **Keyboard-wedge scanners never appear.** They become visible only by typing.
- **Network printers appear only through a helper.**

There is also an enterprise option. The `WebUsbAllowDevicesForUrls` policy can pre-grant USB devices by vendor and product ID to miDepo's origin on Windows and Android (Chrome 75+ on Android) ([policy definition](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/WebUsbAllowDevicesForUrls.yaml)). `SerialAllowUsbDevicesForUrls` does the same for serial devices on desktop only ([policy definition](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/SerialAllowUsbDevicesForUrls.yaml)). Both belong in the manual as an option for managed computers, not as a requirement. No `Permissions-Policy` header is needed, because the defaults are `self`. Setting `usb=(self), serial=(self), bluetooth=(self), hid=(self)` documents intent and blocks third-party frames.

All four APIs live only in `window` and dedicated workers. In Next.js they must be called from client components, after user events, and never from server components or service workers.

### The print dialog route is universal but needs setup per printer

CSS `@page { size: 100mm 150mm; margin: 0 }` sets the document's page size, but it "won't actually put that size of paper into your printer's feed tray" ([voussoir.net](https://voussoir.net/writing/css_for_printing), search summary). On Windows, the driver must offer a paper size equal to the label, or Chrome scales or clips the output. Shipping-label vendors say most failures are a paper-size mismatch, and they tell users to pick "4x6" or "100x150mm" under More settings ([Pirate Ship](https://support.pirateship.com/en/articles/2610080-windows-how-to-print-with-a-4x6-label-printer), search summary). In the ZDesigner driver the label size is set under Printing Preferences > Options (v5) or Page Setup (v10) ([Zebra KB](https://supportcommunity.zebra.com/articles/en_US/Knowledge/Printing-a-PDF-File-Using-the-ZDesigner-Driver)). If Chrome's preview does not list the driver's label sizes, "Print using system dialog" (Ctrl+Shift+P) does ([Cleverence](https://www.cleverence.com/label/blog/print-to-zebra-printer-from-chrome), search summary). No Chromium source was found that says whether print preview picks a paper size matching the CSS `@page` size. The setup procedure must therefore include a visible test print.

Silent printing exists. Chromium's `--kiosk-printing` flag, or the `SilentPrintingEnabled` policy, "immediately closes the print preview dialog and prints to the default printer with default options" ([print_preview_utils.h](https://github.com/chromium/chromium/blob/main/chrome/browser/ui/webui/print_preview/print_preview_utils.h)). Its limits are real. Every job goes to one printer, so A4 packing lists would also go to the label printer. Users also report Chrome reverting the default paper size to A4 after updates ([Jamf community](https://community.jamf.com/t5/jamf-pro/set-default-page-size-for-google-chrome/m-p/154223), search summary). The web app cannot turn it on. For a Windows station that prints only labels, this flag gives true one-click printing on the dialog route. The manual can describe it as an optional station setup.

## Recommended architecture: one label model, three renderers, six transports

### A label model in millimetres

Every label should be defined once, in millimetres, and rendered for each output. Positions, sizes, fonts and barcode modules are stored in mm. Dots are computed per printer: `dots = mm × dpi / 25.4`, which is 8 dots/mm at 203 dpi, about 11.8 at 300 dpi (TSC rounds to 12) and about 23.6 at 600 dpi. The same ZPL prints about 1.5 times larger, or 2/3 the size, when the head's dpi differs from the one it was written for. That is why miDepo must store dpi per printer and never ship fixed dot coordinates.

```ts
// src/lib/labels/model.ts (proposed)
type Mm = number;
type LabelSize = { id: string; widthMm: Mm; heightMm: Mm; gapMm: Mm; media: "gap" | "mark" | "continuous" };
type TextEl = { kind: "text"; x: Mm; y: Mm; w: Mm; h: Mm; value: string; sizeMm: Mm; minSizeMm: Mm;
                maxLines: number; bold?: boolean; align?: "left" | "center" | "right" };
type BarcodeEl = { kind: "barcode"; x: Mm; y: Mm; symbology: "code128" | "ean13" | "upca" | "qr" | "datamatrix";
                   value: string; moduleMm: Mm; heightMm: Mm; humanReadable: boolean };
type BoxEl = { kind: "box"; x: Mm; y: Mm; w: Mm; h: Mm; lineMm: Mm; filled?: boolean };
type Label = { size: LabelSize; elements: (TextEl | BarcodeEl | BoxEl)[] };

type PrinterProfile = { language: "zpl" | "tspl" | "html"; dpi: 203 | 300 | 600; encoding: "utf8" | "cp1252";
                        offsetXmm: Mm; offsetYmm: Mm; darkness?: number; speed?: number };
```

There are four renderers, and all are pure functions so they can be tested in `tests/`:

- **`renderHtml(label)`** produces an HTML page with `@page { size: Wmm Hmm; margin: 0 }`. Each label is a box of exactly that size with `break-after: page` (none on the last label) and `overflow: hidden`. Barcodes are SVG drawn with bwip-js, which miDepo already uses in `src/lib/barcodes.ts`; vector barcodes avoid thermal dithering. The A4 sheet layouts in `src/app/(print)/` are a second form of this renderer.
- **`renderZpl(label, profile)`** produces ZPL.
- **`renderTspl(label, profile)`** produces TSPL.
- **`rasterize(label, dpi)`** produces a 1-bit bitmap, sent as ZPL `^GF` or TSPL `BITMAP` when native fonts cannot draw the layout. This raster path also opens a later route to Brother QL and Dymo raster.

Long titles follow one rule. Each text element has a box and a maximum line count. The text shrinks down to `minSizeMm`, and only then is truncated with an ellipsis. Text never pushes a barcode into its quiet zone.

**ZPL subset.** About 15 commands cover a WMS label:

- Format and setup: `^XA … ^XZ`, `^CI28`, `^PW`, `^LL`, `^LH0,0`, `^MN`, `^MT`, `^PQ`.
- Fields: `^FO`, `^FD … ^FS`, `^FH`, `^FB`.
- Text: `^A0N`.
- Barcodes: `^BY` before every barcode, then `^BC`, `^BE`, `^BQ`, `^BX`.
- Graphics: `^GB`, and ASCII-hex `^GFA`.

`^CI28` (UTF-8), `^PW`, `^MN`, `~SD` and `^FH` are confirmed by Zebra's guide ([^CI](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-ci.html); [^PW](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-pw.html); [^FH](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-fh.html), search summaries). The exact syntax of the barcode commands must be verified against the guide.

**TSPL subset:**

- Setup: `SIZE 50 mm, 25 mm`, then `GAP`, `BLINE` or `GAP 0,0`, then `DIRECTION`, `REFERENCE`, `DENSITY`, `SPEED`, `CODEPAGE`, `CLS`.
- Content: `TEXT`, `BLOCK`, `BARCODE`, `QRCODE`, `DMATRIX`, `BOX`, `BAR`, `BITMAP`.
- Print: `PRINT`.
- Every line ends with CR LF.

The command list matches TSC's manual ([TSPL 3.0](https://fs.tscprinters.com/system/files/31-0000001-00_tspl_tspl2_programming_3_0.pdf)). The parameter order comes from general knowledge and must be verified. One trap: on most TSC firmwares a 1 bit in `BITMAP` means white, while in ZPL `^GF` a 1 bit means black. This is unverified, so the encoder needs a polarity test on real hardware.

**Spanish text.** Spanish needs only á é í ó ú ü ñ ¿ ¡ and capitals, all inside Windows-1252. Use UTF-8 (`^CI28`, `CODEPAGE UTF-8`) where the printer supports it. Fall back to 1252 for emulators whose UTF-8 support is unknown. Use scalable font 0 (or a bitmap), because built-in bitmap fonts often lack accented glyphs ([Zebra code page 1252](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zebra-code-zebra-code-pages/c-zpl-zebra-code-zebra-code-page-1252-latin-character-set.html)).

**Injection.** A product title containing `^` or `~` would execute printer commands. Komisio's print agent strips `^`, `~`, backslash and control characters from data ([Komisio #525](https://github.com/Komisio/komisio/issues/525)). A safer alternative keeps those characters: emit every ZPL field with `^FH` and hex-escape `^`, `~`, `_` and non-ASCII bytes. This is an inference to verify.

**Defensive rules for emulators:**

- Absolute positions only.
- One field per `^FO … ^FS`.
- An explicit `^BY` before every barcode.
- `^PW` and `^LL` on every label.
- No stored formats (`^DF`/`^XF`).
- No Z64 compression.
- No dependence on status replies.

These rules are inferred from the emulator caveats above.

### A PrinterTransport interface with six implementations

The layer that varies is the transport. Everything above it is shared, including encoding, chunking and status parsing, so the demo printer runs the same code as a real printer.

```ts
// src/lib/printing/transport.ts (proposed; client-only)
type PrintJob = { labels: Label[]; copies: number; jobId: string };          // jobId makes retries idempotent
type PrinterStatus = { ready: boolean; paperOut?: boolean; headOpen?: boolean; paused?: boolean; raw?: string };

interface ByteChannel {                       // what WebUSB, Web Serial, Web Bluetooth and Demo provide
  write(bytes: Uint8Array): Promise<void>;    // chunking and pacing live here (BLE: ~180 B, 250 ms)
  read?(timeoutMs: number): Promise<Uint8Array | null>;
  close(): Promise<void>;
}

interface PrinterTransport {
  kind: "dialog" | "webusb" | "webserial" | "webbluetooth" | "helper" | "demo";
  available(): boolean;                       // feature detection: "usb" in navigator, etc.
  connect(gesture: true): Promise<DeviceRef>; // opens a chooser; must run inside a click handler
  reconnect(ref: DeviceRef): Promise<boolean>;// getDevices()/getPorts(); false for BLE (no persistence)
  print(job: PrintJob, profile: PrinterProfile): Promise<void>;
  status?(): Promise<PrinterStatus>;          // optional; never block printing on it
}
```

**`DialogTransport`** opens the label route at the exact page size and calls `window.print()`. Today this is two clicks: miDepo's button, then the dialog's Imprimir. With kiosk printing on a dedicated station it becomes one.

**`WebUsbTransport`, `WebSerialTransport` and `WebBluetoothTransport`** wrap a `ByteChannel`. They render with the printer's language, write the bytes, and optionally query status:

- **Zebra:** `~HS` returns three framed status strings, covering paper out, pause and head up ([Zebra ~HS](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-hs.html), search summary). SGD `! U1 getvar "device.languages"` and `head.resolution.in_dpi` identify the language and the dpi ([SGD getvar](https://docs.zebra.com/us/en/printers/software/zpl-pg/r-sgd-sgd-printer-commands/c-sgd-overview/c-sgd-getvar-command.html)).
- **TSPL:** printers answer `<ESC>!?` with a single status byte, but the bit layout is unverified ([Zebra TSPL guide](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/software/zd100series-zd230series-zd888series-proman-en.pdf)).
- **Clones** often ignore status queries. Status is therefore an optional extra. Zebra's page even says the printer may not answer in conditions that include MEDIA OUT, which must be tested.

**`HelperTransport`** is future work. It calls a server action that inserts a `print_job` row; the helper claims it (see the helper design).

**`DemoTransport`** is a `ByteChannel` that records bytes and returns scripted status replies (see the demo section).

The MIT `@point-of-sale` libraries are the best reference for chooser, reconnect and chunking logic ([WebUSBReceiptPrinter](https://github.com/at-point-of-sale/WebUSBReceiptPrinter/blob/main/README.md)). Their `connect()` "must be called as the result of an user action … You cannot call this function on page load".

**Language and dpi detection.** Detection should be an explicit, watched action ("Detectar"), because probe text can print as a label on some printers:

1. Send SGD `getvar`. Zebra Link-OS printers answer; emulators usually ignore `!` lines.
2. Send `<ESC>!?`. TSPL printers answer with a byte.
3. Otherwise ask the user.
4. Always finish with a test label. It prints a 50 mm ruler, which confirms dpi and offset, and one line in each language. If ZPL prints as text, the printer is set to TSPL. This is an inference from the emulator notes.

### Device panel, printer list and per-computer default

The owner's phase 3 splits naturally into two parts. Both fit "the database is the source of truth".

1. **The company printer list** is a database table. Each printer has a name, a language, a dpi, the loaded label size, a media type, offsets and a transport kind. Only supervisors and admins can create or edit printers (`action("supervisor", …)`). A new printer is a separate, confirmed action that refuses near-duplicates, like `createSupplier`.
2. **The per-computer device panel** reads `getDevices()` / `getPorts()` live. Each device it sees can be matched to a printer in the list, either by USB vendor ID, product ID and serial number, or by `SerialPort.getInfo()`. The computer's default printer per label size is stored against a **workstation** record.

miDepo has no device table today. Sessions are cookies per account. So this needs a long-lived, httpOnly "puesto" (workstation) cookie whose id keys a `workstation` row. Operators then pick only from printers that exist and that this computer can reach. Everything that cannot work is disabled, with the reason beside it, for example "Esta impresora es Bluetooth: tócala para reconectar" or "En Windows, esta impresora USB solo imprime con el diálogo".

New user-visible errors need a code area, for example `PRN` for printing and devices. It must be added to `docs/ERRORS.md` and to `AREAS` in `tests/errors.test.ts`. Print buttons need a shared `print` meaning in `src/lib/hotkeys.ts`, so the same F-key prints on every screen.

### Demo printers and scanners that exercise the real paths

In production test mode, **swap the transport, never the browser API.** Patching `navigator.usb` globally risks confusing a real device with the demo. The guidance found argues for selecting the demo transport explicitly ([Playwright: Mock browser APIs](https://playwright.dev/docs/mock-browser-apis) for the test-only alternative).

**Demo printers** are rows in the company printer list, marked as demo and visible only in admin test mode. They have a language, a dpi and a label size, like real printers. Their `DemoTransport` sits at the `ByteChannel` level, so the label model, the ZPL/TSPL encoder, chunking and status parsing all run. The recorded bytes are shown three ways: as the HTML preview, as raw text, and (for ZPL) rendered locally with **ZPLr**. ZPLr is MIT-licensed, runs in the browser, outputs canvas or PNG, and recognises 200+ ZPL command identities based on Zebra's October 2025 guide ([ZPLr](https://github.com/le2ni/zplr)). It should be lazy-loaded only in test mode. **zpl-renderer-js** (MIT on npm) is the fallback, at about 8 MB of WASM ([zpl-renderer-js](https://www.npmjs.com/package/zpl-renderer-js)). No mature TSPL renderer exists. Portakal's SVG preview is the only lead ([Portakal](https://www.pkgstats.com/pkg:portakal)), so TSPL output should be checked with golden-string tests. **Labelary must not be used** for previews of real data. It is a hosted service that receives the label content, including customer names on box labels, and caps requests at 50 labels ([Labelary FAQ](https://labelary.com/faq.html), search summary). The demo printer should also script faults: paper out, head open, paused, offline, a slow acknowledgement, and "language set to TSPL" (prints the code as text). These let the troubleshooting UI and manual be exercised without hardware.

**Demo scanners** should call the same `onScan(code, source)` entry point the keyboard-wedge listener calls. Synthetic `KeyboardEvent`s from `dispatchEvent` are untrusted and do not insert text. That is general web-platform knowledge, flagged for a quick confirmation test. To exercise the as-you-type `/api/lookup` path, the demo can type into the focused `ScanForm` field by setting `value` and dispatching `input` about every 10 ms, followed by Enter. The demo picker should offer deliberately awkward inputs so the normalisation runs:

- `A'01'1` (the keyboard-layout error)
- a 12-digit UPC-A
- an EAN-13 with a 5-digit add-on
- an ISBN-10 ending in X
- a code without Enter
- a double scan

**Automated tests.** Playwright's `keyboard.type(code, { delay: 10 })` followed by Enter mimics a fast scanner, and `delay: 100` mimics a person ([Playwright Keyboard](https://playwright.dev/docs/api/class-keyboard)). Playwright cannot click a browser chooser, so end-to-end tests inject a fake `navigator.usb` or `navigator.serial` with `addInitScript` and assert the bytes written. Unit tests pass fake devices straight into the transports. For Bluetooth, Chrome has a real virtual-device facility: the experimental CDP `BluetoothEmulation` domain, plus the WebDriver BiDi `bluetooth` module, listed from Chrome 140 ([CDP BluetoothEmulation](https://chromedevtools.github.io/devtools-protocol/tot/BluetoothEmulation); [MDN BCD bidi/bluetooth](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/HEAD/webdriver/bidi/bluetooth.json)). Whether it works from Playwright in headless mode is untested.

## Label catalogue: print where the industry prints

### Which label at which step

No authoritative "standard list" of warehouse labels exists; each vendor documents only its own product. A consistent pattern does emerge, though:

- **Odoo** binds labels to operation events on the operation type's Hardware tab: lot/serial and product labels on validation, a package-contents sheet on validation, and a package label on "Put in Pack". Each can be PDF or ZPL ([Odoo 18 docs](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/print_on_validation.html), search summary).
- **ShipHero** prints item barcodes at receiving, tote labels with bulk print and per-row reprint, and command barcodes ([ShipHero receiving](https://software-help.shiphero.com/hc/en-us/articles/4419353852941-How-to-Print-Barcodes-When-Receiving-Inventory); [ShipHero totes](https://software-help.shiphero.com/hc/en-us/articles/4419345058445-How-to-Create-Totes-and-Print-Tote-Barcodes)).
- **Location labels**, including vertical "totem" labels with level colours, are standard rack practice ([Interlake Mecalux](https://www.interlakemecalux.com/blog/rack-labels-warehouse)). Colour must stay a secondary cue behind a prominent human-readable code ([Cleverence](https://www.cleverence.com/articles/for-business/warehouse-shelf-numbering-4827/)).

The practical rule for phase 1: **labels tied to an event are prepared automatically**, waiting for one click. That covers an item label when an unlabelled item is received and a box label when a box is closed. **Labels tied to a record** (locations, totes) print from the record, never automatically.

| Label | Step in miDepo | Prepared when | Default size | Content | Symbology | Evidence |
|---|---|---|---|---|---|---|
| Item label | Recepción | A received line's product has no scannable EAN (grapas with an internal code), or the user marks it unlabelled; quantity = units received | 50 × 25 mm | Title (2 lines, shrink then ellipsis), internal code in text, barcode | Code 128 of the internal code; for a product with a real ISBN/EAN, the real EAN-13, never an invented one | Odoo, ShipHero |
| Received box / lot label | Recepción | Optional, per carton or lot received | 100 × 50 mm, or 100 × 150 mm | Supplier, remito number, receipt id, box n of N, date | Code 128 internal ID (`RCP-…`); **not** SSCC | GS1 logistic-label practice, without a prefix |
| Location label (shelf edge) | Ubicaciones | From the record, singly or by range | 100 × 50 mm; A4 3 × 8 sheet as fallback | Code very large, optional level colour band | Code 128 of the location code | Interlake Mecalux, Cleverence |
| Totem location label | Ubicaciones | From the record, per upright | 100 × 150 mm or taller | One barcode per level, arrows, level colours | Code 128 per level | Interlake Mecalux |
| Tote / cart label | Picking (only if totes are introduced) | From the record, printed once and reused | 100 × 50 mm | Tote code | Code 128 (`TOT-…`) | ShipHero |
| Box label | Empaque | Box closed | 100 × 150 mm | Order number, customer and city, box n of N, item count, date | Code 128 box ID | Odoo "Package Label" |
| Packing list | Empaque | Box or order closed | A4 (exists) or 100 × 150 mm | Lines and quantities | Code 128 order ID | Odoo "Package Contents" |
| Condition sticker | Devoluciones | Returned item graded | 50 × 25 mm | VENDIBLE / SALDO / DAÑADO, return id, item code | Code 128 | **No source found**; common practice |
| Command barcode sheet | Any scanning station | From settings | A4 | "CERRAR CAJA", "SALTAR", quantity steps… | Code 128 | ShipHero (adoption elsewhere is inference) |
| Printer test label | Device panel | On demand | Loaded stock | 50 mm ruler, dpi, language test lines, printer name | Code 128 + EAN-13 sample | Inference |
| Carrier shipping label | Despacho | **Deferred** (miDepo's own 100 × 150 mm box label with carrier and tracking exists since D54) | 100 × 150 mm | — | — | Out of scope |

Count tags and quarantine tags had no sources. Counts are recorded by scanning, so a "contado" tag adds little value, and neither label is recommended for phase 1.

### No GS1 prefix means no SSCC and no invented GTINs

An SSCC is 18 digits: an extension digit, the GS1 Company Prefix, a serial reference and a mod-10 check digit. It cannot exist without a prefix ([GS1 UK](https://www.gs1uk.org/knowledge-hub/barcodes/how-do-i-create-ssccs-and-logistics-labels)). In Argentina a prefix means joining GS1 Argentina (country prefix 779), which charges an initial and an annual fee ([GS1 Argentina](https://gs1.org/locations/argentina); [Convenio Corrientes–GS1](https://ciudaddecorrientes.gov.ar/sites/default/files/convenio_gs1_firmado_.pdf)). miDepo must therefore never generate SSCCs or GS1-128 with AI (00). It should use internal Code 128 IDs with clear prefixes (`RCP-`, `BOX-`, `TOT-`). Internal product codes must never look like 978/979 (ISBN), 977 (ISSN) or 779 EAN-13s. Background knowledge, unverified here, says GS1 reserves the 20–29 prefixes for in-store use, so avoid those too. **Code 128 should be the primary symbol everywhere**, because cheap laser and 1D CCD scanners, the likely hardware in small warehouses, cannot read QR or DataMatrix ([Dynamsoft](https://www.dynamsoft.com/blog/insights/laser-barcode-scanners-vs-2d-imagers/)).

**Print geometry:**

- **Quiet zone:** Code 128 needs at least 10X on each side ([Wikipedia Code 128](https://www.Wikipedia.org/wiki/Code128)), and Zebra advises at least 3.2 mm between a barcode and the label edge ([Zebra ZT231](https://docs.zebra.com/us/en/printers/industrial/zt231-industrial-printer-user-guide/c-zt4x1-troubleshoot/c-zt4x1-troubleshooting/r-zt4x1-printing-or-print-quality-issues.html)).
- **X-dimension:** at least about 10 mil (0.25 mm) ([Acctivate](https://hub.acctivate.com/articles/printing-standard-barcodes)).
- **Dot size:** one dot is 0.125 mm at 203 dpi ([Zebra ZT510 specs](https://docs.zebra.com/us/en/printers/industrial/zt510-ug/specifications/printing-specifications.html)).
- **Module choice** (derived from the above): use whole-dot modules. That means 2 dots (0.25 mm) at 203 dpi for item labels, 3 dots (0.375 mm) for location labels read from a distance, and 3 dots at 300 dpi.
- **Fit check:** a 10-character Code 128 is roughly 145 modules, about 36 mm plus quiet zones, which fits a 50 × 25 mm label. All-numeric codes in subset C come out about half as wide.

### Label sizes: data, not code

The owner asked for "all standard label sizes". The right shape for that is a size catalogue stored as data, plus custom width × height in mm. Inch-based stock is converted to mm on entry. Sizes seen on sale in Argentina, or used by the target printers:

- **100 × 150 mm (4 × 6 in)** on a 25 mm core, the default Zebra desktop stock ([MercadoLibre AR seller](https://www.mercadolibre.com.ar/pagina/afimpresion)).
- **51 × 25 mm (2 × 1 in)**, **58 × 31 mm**, and **100 × 190 mm** (bundled with the ZD220) (search summary of MercadoLibre AR seller pages).
- **57 × 32 mm (2.25 × 1.25 in)** and 4 × 6 in fanfold at Frávega ([Frávega](https://www.fravega.com/p/etiquetas-de-envio-mflabel-direct-thermal-de-2-25-x-1-25-pul-23047404/)).
- **62 mm continuous** for Brother QL.
- **About 56 mm printable** for Dymo 550.
- A4 sheets: **3 × 8 = 24** (an Argentine ERP offers this layout, and miDepo's `Labels.tsx` already uses it) ([Dux Software](https://intercom.help/duxsoftware/es/articles/7874443-imprimir-etiquetas-y-rotulos)), plus 105 × 74 mm (8 per sheet) and 52.5 × 29.7 mm (40 per sheet) Apli formats ([PcComponentes Apli 1279](https://www.pccomponentes.com/etiquetas-adhesivas-apli-1279-a4-105x74-mm-800-etiquetas-100-hojas)). Pimaco A4 dimensions were not confirmed.

Each printer profile also needs an origin offset and a gap setting, because 50 × 25 and 51 × 25 stock both circulate. **Media choice matters for location labels.** Direct thermal lasts about 6–12 months indoors, while thermal transfer lasts more than 2 years ([Avery](https://www.avery.com/blog/thermal-printers-direct-thermal-vs-thermal-transfer-labels/)). Shelf labels should be thermal transfer, or laser on synthetic A4. Item, box and condition labels can be direct thermal.

## Scanners: keystrokes stay the contract

### What a Chrome page can see, by scanner mode

Almost every scanner a small Argentine warehouse buys reaches Chrome as keystrokes:

- **Wired and wireless wedges:** a USB keyboard wedge, a 2.4 GHz dongle, or Bluetooth HID.
- **Android handhelds:** Zebra DataWedge keystroke output sends "the processed data … as keystrokes, as if a user were typing" ([DataWedge Keystroke Output](https://techdocs.zebra.com/datawedge/15-0/guide/output/keystroke), search extract). Honeywell handhelds have a keyboard wedge method with a configurable `\r` suffix ([CartonCloud](https://help.cartoncloud.com/knowledge/honeywell-ck65-ct60-ct40-setup-instructions)).

Chrome blocks every report from a HID collection with a keyboard usage, to prevent keylogging ([WICG/webhid #12](https://github.com/WICG/webhid/issues/12); [hid_report_utils.cc](https://github.com/chromium/chromium/blob/main/services/device/public/cpp/hid/hid_report_utils.cc)). A keyboard wedge is therefore invisible as a device. Two other modes are reachable but optional:

- **HID-POS** (usage page 0x8C) through WebHID, on desktop only. The MIT `@point-of-sale/webhid-barcode-scanner` supports Honeywell, Zebra and Datalogic in this mode ([npm](https://npmjs.com/@point-of-sale/webhid-barcode-scanner), search extract).
- **Serial and SPP** through Web Serial.

Intent or broadcast output (DataWedge Intent, Honeywell Data Intent, Urovo, Chainway, Sunmi) is invisible to a Chrome page. The manual must tell users to choose keystroke/keyboard output.

**Recommendation: keystroke input stays the only required path.** WebHID and Web Serial scanners are deferred. They give a real "connected" signal, but each needs a configuration barcode and a chooser, and a scanner in HID-POS or COM mode stops typing into other programs.

### Detection heuristic: a hint, never a gate

A page can only infer that input came from a scanner from how it arrived. The common library defaults are a 30 ms average per character, a minimum length of 6, and Enter (13) or Tab (9) as terminators ([onScan.js](https://github.com/axenox/onscan.js); [js-scanner-detection](https://npmjs.com/package/js-scanner-detection)). Scanners typically type a character within about 10 ms ([BarcodeScanner.js](https://github.com/itexpertsbv/BarcodeScanner.js), search excerpt). Zebra scanners have an intra-keystroke delay of 20 or 40 ms ([Zebra DS4678](https://docs.zebra.com/us/en/scanners/general/ds4-series/ds4678-prg/keyboard-wedge-interface/keyboard-wedge-host-parameters/intra-keystroke-delay-.html)), and DataWedge in Chrome may need 6 ms or more to avoid losing characters ([Zebra forum](https://developer.zebra.com/content/scan-barcode-without-input-stroke)).

Recommended rule (inference; no published per-type timings were found):

- **What counts as a scan:** a burst of at least 4 characters, a **median** gap under about 35 ms (tolerant to 50 ms for Bluetooth and DataWedge), and Enter or Tab within about 50 ms of the last character.
- **How to measure:** use `event.timeStamp`. Ignore `event.repeat`, and ignore keyCode 229 / `key: "Unidentified"` events (soft-keyboard IME) on Android.
- **What it is used for:** the hint "escaneado" on the field, a per-device "a scanner has been used here" memory, and the diagnostic "Llegó sin Enter: configura el sufijo del lector".
- **What it is never used for:** never claim "lector conectado", and never refuse a value because of how it was typed. Accept paste followed by Enter too, for clipboard-mode scanners.

Do not adopt onScan.js. Its default keyCode mapper drops characters such as hyphens ([onScan.js](https://github.com/axenox/onscan.js)), the very problem the layout fix addresses. It is a reference, not a dependency.

### Normalisation pipeline (the owner's quiet layout fix, specified)

Most scanners send US key codes. Windows reads them through the PC's own layout, so on Spanish layouts **"-" arrives as "'"** ([Morovia KB](https://www.morovia.com/kb/PRB-Scanned-Data-Incorrectly-Displayed-Computer-10604.html); [Ex Libris](https://knowledge.exlibrisgroup.com/Aleph/Knowledge_Articles/Barcode%3A_the_hyphen_(-)_is_read_like_apostrophe_('))). The table below was derived from the standard Windows Latin American and Spain layouts. No source listed it, so it needs a two-minute check on a real PC with each layout. Letters, digits, space, `.` and `,` are unaffected.

| Barcode has | Spanish (Latin America) gives | Spanish (Spain) gives |
|---|---|---|
| `-` | `'` | `'` |
| `_` | `?` | `?` |
| `/` | `-` | `-` |
| `?` | `_` | `_` |
| `=` | `¿` | `¡` |
| `+` | `¡` | `¿` |
| `;` / `:` | `ñ` / `Ñ` | `ñ` / `Ñ` |
| `'` | `{` | dead key (merges with the next character) |
| `&` `*` `(` `)` | `/` `(` `)` `=` | `/` `(` `)` `=` |

The owner has already decided that scan fields fix these quietly. The pipeline, in order, must be shared by `src/lib/lookup.ts` and the flows, so that `tests/lookup.test.ts` keeps them in agreement:

1. Trim, and drop a trailing Tab that follows Enter.
2. Strip a leading AIM symbology identifier (`]E0`, `]C1`, `]d2`, `]Q1`…) when present ([Zebra AIM IDs](https://docs.zebra.com/us/en/scanners/multi-plane/mp72pg/c-param-desc-programming-reference/r-param-desc-aim-code-identifiers.html)).
3. Upper-case location and internal codes. CapsLock inverts the case of wedge input.
4. For location and internal codes, if the raw value matches nothing, apply the inverse of the layout table (`'` → `-`, `?` → `_`, and `-` → `/` only when the location scheme's separator is `/`). Accept the result if it matches. Location schemes in `src/lib/locations.ts` have a configurable separator, so the mapping must be derived from the scheme's separator, not hard-coded. Dead keys can merge two characters (`'A` → `Á` on the Spain layout), so the scheme editor should warn against `'` and `"` as separators.
5. For digit codes:
   - A valid 12-digit UPC-A becomes `0` + UPC-A (its EAN-13 form).
   - 15 or 18 digits (EAN-13 + 2 or + 5), and 14 or 17 digits (UPC-A + add-on), are split into base and add-on.
   - A 10-character ISBN-10, possibly ending in X, becomes 978 + 9 digits + a new EAN check digit.
   - 11 digits produce a warning, "falta un dígito".
   - Always validate the check digit, and keep codes as strings end to end.
6. Ignore an identical value in the same field within about 500 ms (a double read).

Steps 5 and 6 are inferences based on the Zebra defaults below.

The manual must tell users how to fix the scanner as well: scan the "Keyboard country: Spanish (Latin America)" barcode from the scanner's manual so it matches Windows (Win+Espacio shows the active layout). Cheap scanners sold in Argentina (Gadnic CODBAR11, Netum NT-W6) have keyboard-language pages ([Gadnic CODBAR11 manual](https://manualslib.mx/manual/901348/Gadnic-Codbar11.html?page=56)). Zebra offers Alt+numpad "Keypad Emulation" for countries not in its list ([Zebra MP72](https://docs.zebra.com/us/en/scanners/multi-plane/mp72pg/usb-interface/keypad-emulation.html), search extract). To tell which Spanish layout a PC uses, look two keys right of Ñ: Spain has Ç there and Latin America has "}" ([ProVideo Coalition](https://www.provideocoalition.com/spanish-keyboard-which-of-the-three-layouts)).

### Symbologies, add-ons, UPC and ISBN-10

**EAN-13 and Code 128 are on by default everywhere.** On Zebra scanners, EAN/UPC 2- and 5-digit supplementals are **ignored by default**, and Bookland/ISBN-10 output is **disabled by default** ([Zebra SP20 Bookland EAN](https://docs.zebra.com/us/en/scanners/general/sx20-series/sp20-prg/c-param-desc-symbologies/r-param-desc-bookland-ean.html); [Zebra SM72 defaults](https://docs.zebra.com/us/en/scanners/general/sm72-ig/r-sp72-default-parameters.html), search extracts). Honeywell, Datalogic and cheap-scanner defaults were not confirmed.

**This matters more for a comics warehouse than the notes first suggest.** Periodicals use 977 (ISSN) EAN-13 with a 2-digit add-on that usually carries the issue number ([Library of Congress](https://www.loc.gov/issn/barcodes.html); [GS1 add-on barcodes](https://support.gs1.org/support/solutions/articles/43000734089-what-are-the-extra-add-on-barcodes-for-books-)). US comics carry UPC-A plus a 5-digit add-on: 3 digits of issue, 1 of cover variant and 1 of print variant ([barcode.graphics](https://www.barcode.graphics/?p=24060), a single vendor source that says its specs are dated). With add-ons ignored, every issue of a series scans as the same base code. The base code identifies the series, not the issue.

**Owner decision (2026-11-20): add-ons are not used.** A scan that arrives with an add-on (15 or 18 digits, or UPC-A + add-on) is split and the add-on dropped; the base code is matched as today. This is safe because single issues (grapas) already get their own internal code (DECISIONS item 10), and the item label printed at receiving carries that code. Revisit only if two products ever share a base EAN and have no internal code.

**Camera scanning.** `BarcodeDetector` is absent on Windows, so miDepo's `barcode-detector` / ZXing-WASM ponyfill is what Windows laptops use. Torch and continuous focus work only on Android Chrome, applied after the stream starts and guarded by `getCapabilities()` ([Dynamsoft focus](https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html)). The standard format list does not include add-ons, so the camera returns only the base code. Two more recommendations: narrow the formats per field (EAN-13, UPC-A and Code 128 for products; Code 128 for shelves), and validate check digits before accepting a read.

## Optional Windows helper: an outbound-only design (not to be built now)

### Why outbound, and why free

A browser cannot open raw TCP sockets, and Chrome treats 9100 as a restricted port (background knowledge, unverified). A Vercel function cannot reach the warehouse LAN. Since Chrome 142 (stable 28 October 2025), a public site calling `localhost` or a LAN IP triggers a Local Network Access permission prompt. Chrome 145 split that permission into `local-network` and `loopback-network` ([Chrome 142 release notes](https://developer.chrome.com/release-notes/142); [blink-dev](https://groups.google.com/a/chromium.org/g/Blink-dev/c/Zl3P6NHhMBw)). Vendors such as Box and Duo now ship guidance telling users to allow it ([Box](https://support.box.com/hc/en-us/articles/45821516452627-In-app-guidance-to-allow-Box-local-network-access-in-Chromium-142-for-Open-in-Desktop)). Whether WebSocket and the `targetAddressSpace` escape hatch are covered is still unsettled: the Chrome 154 notes describe it, and a Chromium issue shows it reverted ([Chromium issue 517413738](https://issues.chromium.org/issues/517413738)).

**A helper that connects outbound to miDepo avoids all of this.** It also serves phones on the same site, which cannot run a helper themselves. This is the pattern PrintNode, Odoo's Windows virtual IoT and the open-source Komisio agent use ([Komisio #525](https://github.com/Komisio/komisio/issues/525); [Odoo Windows virtual IoT](https://www.odoo.com/documentation/18.0/applications/general/iot/windows_iot.html)).

The free and off-the-shelf alternatives each fail a constraint:

| Option | Mechanism | Cost / licence | Why not the default for miDepo |
|---|---|---|---|
| Zebra Browser Print | Localhost service + JS library | Free; wrapper is GPL-3.0 and unmaintained since 2021 | Zebra only; localhost now behind the LNA prompt; holds ports 9100/9101 ([Zebra app notes](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/zebra-web-printing-solutions-app-notes.pdf)) |
| QZ Tray | Localhost WebSocket agent | LGPL-2.1, free | Trust dialog on every print unless requests are signed with a purchased certificate or a self-built root ([QZ Tray FAQ](https://github.com/qzind/tray/wiki/faq)) |
| Zebra WebLink | Printer opens an outbound TLS WebSocket to a server | Free | Needs an always-on non-Vercel endpoint and per-printer certificates; excludes Link-OS Basic (ZD220/ZD230) and every non-Zebra brand ([Zebra developer](https://developer.zebra.com/content/weblink-websocket)) |
| PrintNode | Cloud relay + desktop client | Paid (small free tier) | Paid service, excluded by the owner ([PrintNode pricing](https://www.printnode.com/pricing)) |
| Odoo IoT | Agent | Paid subscription | Odoo-specific |

### Design sketch

**Data model.** Three new tables:

- `print_agent`: company, name, token hash, last_seen, version.
- `printer`: the company printer list, gaining `agent_id`, `address` (IP:port or Windows queue name) and the last reported status.
- `print_job`: company, printer, payload (ZPL/TSPL rendered server-side from the label model), status `queued → claimed → printed | failed | cancelled`, attempts, claimed_at, error, jobId.

**Pairing.** A supervisor creates a pairing code in miDepo. It is hashed and expires in 15 minutes, as in Komisio. The helper exchanges it for a device token scoped to one company, and only the token's hash is stored.

**Job flow.** The helper long-polls `POST /api/print/claim`, holding the request for about 25 s. The claim picks queued jobs atomically with `UPDATE … WHERE status='queued' … FOR UPDATE SKIP LOCKED RETURNING`. Claims older than 10 minutes are re-offered, and `jobId` makes retries idempotent. A heartbeat uploads the printers the helper discovered, so supervisors pick them from miDepo's `<Select>` rather than typing IP addresses. Plain polling every 3–5 s costs about 17–29k function invocations a day per helper, and long-polling cuts that by roughly 5–8×. Vercel's current limits were not checked.

**Printing.**

- **Network printers:** raw TCP to `ip:9100`. Every networked label brand accepts this, and it carries ZPL/TSPL unchanged ([Zebra Browser Print guide](https://www.zebra.com/content/dam/zebra_dam/en/guide/portfolio/zebra-browser-print-user-guide-v1-3-en-us.pdf); [LabelInn](https://www.labelinn.com/en/thermal-printer-software)). IPP is not dependable for label languages: Zebra added IPP only in Link-OS 7.4, with "IPP Everywhere … not fully supported" ([Komisio #525](https://github.com/Komisio/komisio/issues/525)).
- **USB printers:** raw bytes through the Windows spooler (`OpenPrinter` → `StartDocPrinter` RAW → `WritePrinter`) ([Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/printdocs/sending-data-directly-to-a-printer)). This coexists with the installed driver, so the WebUSB conflict disappears. Microsoft documents that V4 drivers produce 0-byte spool files for RAW PCL/PostScript ([Microsoft Learn](https://learn.microsoft.com/en-us/previous-versions/troubleshoot/windows/win32/v4-print-driver-raw-mode-pcl-postscript)). Whether that affects ZPL on V4 label drivers must be tested. Zebra's fallback is a "Generic / Text Only" queue ([Zebra app note](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/printing-code-app-note.pdf)).
- **Status:** read in-band after each job (`~HS`, `<ESC>!?`) and reported, so miDepo can show "Impresora sin papel" beside the print button.

**Discovery, in order:**

1. mDNS browse of `_pdl-datastream._tcp`, `_ipp._tcp` and `_printer._tcp`. TXT keys `ty`, `product` and `pdl` give make, model and languages ([Apple Bonjour Printing Specification](https://developer.apple.com/bonjour/printing-specification)).
2. Zebra's UDP 4201 broadcast. It is undocumented and was reverse-engineered ([jfr.im](https://jfr.im/blog/2024/09/zebra-network-discovery-protocol/)).
3. A TCP 9100 connect scan of the local /24.
4. SNMP `sysDescr` on hits. The OIDs are background knowledge.

mDNS does not cross VLANs or guest Wi-Fi. A changed DHCP address is the most common "offline" cause, so the helper should rediscover printers by MAC or serial number.

**Packaging and security.** Komisio ships a Node single-executable app wrapped as a Windows service with WinSW, plus a small .NET Winspool helper ([Komisio #525](https://github.com/Komisio/komisio/issues/525)). A service survives logoff, and miDepo's own web screen can show the helper's status. Unsigned installers trigger SmartScreen. Without paid signing, the manual must show the "Más información → Ejecutar de todas formas" step; winget or Microsoft Store distribution are unverified free options. Six risks to design for:

- A leaked token: scope tokens to one company, make them revocable, and store only hashes.
- ZPL injection from product names: use `^FH` escaping.
- Duplicate prints on retry: idempotent jobs.
- The helper as a LAN foothold: it must never accept inbound connections and should talk only to configured printers.
- Changing printer IPs: rediscovery.
- An offline helper: show "Ayudante sin conexión desde …" from `last_seen`.

## Troubleshooting digest (for translation into the Spanish manual)

The order vendor guides converge on is the right order for the manual:

1. Check the power light.
2. Print the configuration label. It shows language, dpi, width, media type, sensor and IP.
3. Check media and sensor, then calibrate.
4. Check direct thermal versus ribbon.
5. Check language and connection.
6. Check label size, dpi and Chrome scaling.
7. Adjust darkness and speed, and clean the head.
8. Check barcode geometry.

Sources: [Zebra ZD421/ZD621 diagnostics](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd421-zd621-ug-tools/r-mlk-ug-printer-diagnostics.html); [TSC TE200 manual](https://shop.f-trade.ru/files/%D0%9F%D1%80%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D1%8B%20%D1%8D%D1%82%D0%B8%D0%BA%D0%B5%D1%82%D0%BE%D0%BA/TSC/TE200/TE200_user_manual_ENG.pdf). Spanish terms to standardise: sensor de separación (gap), marca negra, térmica directa, transferencia térmica, cinta (ribbon), cabezal.

### Printers

| Symptom | Likely cause | Fix | Source |
|---|---|---|---|
| Blank labels, skips labels, feeds several | Sensor type wrong (gap vs black mark), not calibrated; direct thermal vs ribbon mismatch; darkness too low | Set the media type, move the sensor over the gap or mark, calibrate; check the ribbon; scratch test (direct thermal blackens) | [labelinn](https://www.labelinn.com/en/blog/zebra-zd220-skipping-labels-fix); [plusleading](https://plusleading.com/how-to-fix-zebra-printer-skipping-labels-or-printing-blank-labels/) |
| Prints the code (ZPL text) instead of the label | ZPL sent through a rendering driver; language set to EPL, line print or TSPL; diagnostic mode `~JD` | Use the raw path or a "Generic / Text Only" queue; set the language to ZPL or auto; send `~JE` | [Zebra app note](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/printing-code-app-note.pdf); [Stripy Horse](https://stripyhorse.io/guides/zebra-prints-zpl-as-text) |
| Wrong accents, ñ missing | Code page; font without the glyph | `^CI28` + font 0 or TTF, `^FH` escapes; TSPL `CODEPAGE 1252` | [Zebra ^CI](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-ci.html) |
| Cut off, shrunken or shifted (dialog route) | Driver paper size ≠ label; Chrome scaling | Set the label size in the driver; in Chrome: paper = label, Margins None, Scale 100%, no fit to page; Ctrl+Shift+P for the system dialog; print one and scan it | [Zebra KB](https://supportcommunity.zebra.com/articles/en_US/Knowledge/Printing-a-PDF-File-Using-the-ZDesigner-Driver); [Cleverence](https://www.cleverence.com/label/blog/print-to-zebra-printer-from-chrome) |
| Label prints 2/3 size or 1.5× | dpi mismatch (203 vs 300) | Correct the dpi in miDepo's printer settings; print the test ruler | Derived from dot sizes |
| Barcode does not scan | X too small, quiet zone, darkness, scaling | X ≥ 0.25 mm in whole dots; 10X quiet zone; ≥ 3.2 mm from the edge; darkness up until bars are solid | [whizz-tech](https://whizz-tech.com/support/printers/barcodes-wont-scan-fix/); [Zebra ZT231](https://docs.zebra.com/us/en/printers/industrial/zt231-industrial-printer-user-guide/c-zt4x1-troubleshoot/c-zt4x1-troubleshooting/r-zt4x1-printing-or-print-quality-issues.html) |
| Network printer "offline" | DHCP gave it a new IP | DHCP reservation by MAC or static IP; read the IP on the configuration label | [BCTP](https://www.bctp.com/blogs/post/zebra-zd421-wireless-setup) |
| Chrome says "Access denied" (Windows, USB) | The Windows printer driver owns the printer | Use the print dialog or a COM-port route; Zadig only if this computer prints labels from miDepo alone | [WebZLP](https://github.com/Cellivar/WebZLP/blob/main/docs/windows_driver.md) |
| Bluetooth printer not in the chooser | Bluetooth Classic printer looked for with Web Bluetooth; not paired; filter too narrow | Pair in Windows or Android settings and use the serial (Bluetooth Classic) option | [Chrome blog](https://developer.chrome.com/blog/serial-over-bluetooth) |
| Bluetooth print truncated or garbled | Chunks too large or too fast | Smaller chunks with a pause (handled by miDepo) | [ZebraISV sample](https://github.com/ZebraISV/Zebra-Printer-Samples-master/blob/master/WeChat-MiniProgram-Samples/WeChatPrintDemo/README.md) |
| Phone does not see the USB printer | No OTG support or adapter; printer unpowered | OTG adapter; printer on its own power | Inference |

**Self-test, calibration and reset by brand** (point users to their model's table, because timings vary):

| Brand / models | Configuration label | Calibration | Reset |
|---|---|---|---|
| Zebra ZD421 / ZD621 | FEED + CANCEL for 2 s ([Zebra](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd421-zd621-ug-tools/r-mlk-ug-printer-diagnostics/t-zd620zd420-ug-printing-the-printer-and-network-configuration-reports.html)) | Hold FEED until two blinks (SmartCal) | PAUSE + FEED at power-on resets printer settings; PAUSE + CANCEL resets network settings ([Zebra RESET functions](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd421-zd621-ug-tools/r-mlk-ug-printer-diagnostics/c-resetting-defaults/c-zd421-zd621-ug-reset-button-functions.html)) |
| Zebra ZD220 / ZD230 / ZD888 (one button) | Hold FEED at power-on and release after N flashes, per the model's table ([Zebra FEED modes](https://docs.zebra.com/us/en/printers/desktop/zd888da-zd230da/controls-and-indicators/user-interface/feed-(advance)-button/feed-button-modes-power-on.html)) | Same table | Same table |
| Zebra ZT200 / ZT400 (industrial) | FEED + PAUSE at power-on ([Zebra ZT200](https://docs.zebra.com/us/en/printers/industrial/zt200-series-industrial-printer-user-guide/troubleshooting/c-zt2x0-printer-diagnostics/t-zt2x0-feed-and-pause-self-test.html)) | — | — |
| TSC TE200 / TE210 | Hold the button while powering on and release at the LED pattern for self-test | Red blink pattern = sensor calibration | Factory-default pattern ([TSC manual](https://btpos.md/wp-content/uploads/2024/03/TSC-TE200-TE300-TE210-TE310-User-Manual-EN.pdf); exact sequence only from [a third party](https://scanprinter.eu/blogs/guides/tsc-te200-te210-calibration)) |
| Xprinter | Hold FEED while powering on, about 3 s (documented for the Q260III receipt model only) ([Poster KB](https://knowledge-base.joinposter.com/en/how-to-print-a-self-test-for-the-xprinter-q260iii)) | Unverified for label models | Unverified |
| SATO | Hold FEED while powering on: calibration, then a configuration label ([SATO](https://helpcenter.sato-global.com/hc/en-001/articles/38168076438553-SA4-Factory-Test-Print-Mode)) | Included | — |

### Scanners

| Symptom | Likely cause | App-side handling | User fix |
|---|---|---|---|
| Code appears, nothing happens | No Enter suffix | Hint "Llegó sin Enter" | Scan "Add Enter/CR" in the manual ([Zebra Enter key](https://docs.zebra.com/us/en/scanners/general/sx20-series/sp20-prg/r-param-desc-enter-key.html)) |
| `A'01'1`, `?` for `_`, `ñ` | US keyboard emulation on a Spanish PC | Quiet normalisation (owner decision) | Set the keyboard country to Spanish (Latin America) or Alt mode ([Morovia](https://www.morovia.com/kb/PRB-Scanned-Data-Incorrectly-Displayed-Computer-10604.html)) |
| Lowercase letters | CapsLock on | Upper-case codes | CapsLock off |
| 12 or 11 digits | UPC-A, or check digit / number system not sent | UPC-A → EAN-13; "falta un dígito" | Enable check-digit transmission |
| 15 or 18 digits | Add-on decoded | Split the add-on | Set supplementals to Ignore (owner decision: add-ons are not used) |
| Same value twice | Double read; Enter + Tab | Ignore repeats within about 500 ms; ignore Tab after Enter | One suffix; raise the same-code delay |
| Codes appear late or all at once | Batch / storage mode | None | Scan "instant upload" mode |
| First scan after a pause lost | Bluetooth or 2.4 GHz sleep | None | Raise the sleep timeout ([Socket Mobile FAQ](https://socketmobile.com/support/faq)) |
| Phone keyboard covers the screen | Bluetooth HID / soft keyboard | Per-device `inputmode="none"` toggle (works on some devices only) | Toggle the keyboard on the scanner ([Oracle WMS 25D](https://docs.oracle.com/en/cloud/saas/readiness/logistics/25d/wms25d/25D-wms-wn-f41823.htm)) |
| Paired but nothing types | Scanner in SPP or BLE mode | — | Scan the "HID / teclado" pairing code and re-pair |
| Characters missing on a Zebra handheld | Keystrokes too fast for Chrome | No heavy work per keystroke | DataWedge inter-character delay of 6 ms or more ([Zebra forum](https://developer.zebra.com/content/scan-barcode-without-input-stroke)) |
| Typing stops after a message on a Zebra handheld | Focus lost after `alert()` | Never use `alert()` on scan screens | Tap the field ([Zebra blog](https://developer.zebra.com/blog/listening-keypress-events-datawedge)) |
| QR or a phone screen never reads | Laser or 1D scanner | Labels use Code 128 | Use a 2D imager |

## Libraries and licences

The surface needed is small, about 15 commands per language, and the new TSPL and multi-language packages are young. **miDepo should write its own ZPL and TSPL encoders and transports.** Libraries belong in barcodes, camera decoding and demo previews. All rows are from npm metadata or `package-lock.json`, read 20 November 2026 ([npm registry](https://registry.npmjs.org/)).

| Package | Version / date | Licence | Use in miDepo |
|---|---|---|---|
| bwip-js | 4.11.4 | MIT | **In use.** SVG barcodes for HTML labels |
| barcode-detector + zxing-wasm | 3.2.4 / 3.1.7 | MIT | **In use.** Camera ponyfill (Windows needs it) |
| zplr | 0.3.0, 2026-07-27 | MIT | **Adopt** for the ZPL preview in test mode (lazy-loaded) |
| zpl-renderer-js | 5.0.0, 2026-10-20 | MIT (npm); licence of the underlying Zebrash unconfirmed | Fallback preview; about 8 MB WASM |
| zpl-image | 0.3.0, 2025-11-17 | MIT | Reference for `^GF` bitmap encoding |
| @thermal-label/tspl-core | 0.2.0, 2026-05-06 | MIT | Reference for TSPL commands and status shape |
| portakal | 0.5.0, 2026-04-02 | MIT | Reference; only TSPL SVG preview found |
| @point-of-sale/webusb-, webbluetooth-receipt-printer | 2.1.0, 2026-09-18 | MIT | Reference for chooser, reconnect and chunking |
| @point-of-sale/webserial-receipt-printer | 2.0.0, 2024-09-21 | MIT | Reference |
| @point-of-sale/receipt-printer-encoder | 4.0.1, 2026-09-18 | MIT | Only if ESC/POS (2-in-1 printers) is ever needed |
| @point-of-sale/webhid-barcode-scanner | not read | not read | Only if HID-POS scanners are ever supported |
| web-serial-polyfill | 1.0.15 | not read | Possible Android USB-CDC route |
| jsPDF | 4.2.1, 2026-03-17 | MIT | Only if a downloadable PDF is ever needed; HTML print suffices |
| pdf-lib | 1.17.1, 2021-11-06 | MIT | Unmaintained; avoid |
| **webzlp** | 2.0.4, 2025-09-05 | **GPL-2.0** | **Avoid** (copyleft in a closed web app); read its Windows doc |
| **jszpl** | 2.0.1, 2026-05-05 | **GPL-3.0** | **Avoid** |
| **zebra-browser-print-wrapper** | 0.1.4, 2021-06-16 | **GPL-3.0** | **Avoid**; also unmaintained |
| qz-tray | 2.3.0, 2026-09-11 | LGPL-2.1 | Not chosen (trust dialog; agent install) |
| Virtual-ZPL-Printer (porrey) | 3.5.1 | LGPL-3.0 | Not chosen; sends ZPL to Labelary ([GitHub](https://www.Github.com/porrey/Virtual-ZPL-Printer)) |
| @psdk/tspl | 0.7.22 | **None declared** | Avoid (no licence) |
| onScan.js | — | not read | Reference only; its keyCode mapper drops hyphens |
| Labelary (service) | — | Hosted, sends data off-site | Never the default |

GitHub activity (issues, last commits) could not be checked because the GitHub API was blocked, so maintenance is judged from npm publish dates only.

## Changes of plan the findings imply

1. **Phase 1 carries more of the weight than planned.** On Windows, the print dialog is the route most users will keep. Phase 1 should therefore include the label model and HTML renderer, exact `@page` sizes, a size catalogue, a per-printer setup check with a test label and ruler, and a Spanish guide for setting the paper size in each driver. Phase 1 also needs the "prepared labels" queue: event-tied labels waiting for one click, with a reprint count.
2. **Phase 2 should be scoped as "Android first, Windows opt-in".** On Android: WebUSB over OTG, Web Serial over Bluetooth Classic, and Web Bluetooth for Zebra BLE. On Windows: Web Serial for COM-port and Bluetooth printers, and WebUSB only after a documented, supervisor-performed Zadig step that removes the printer from Windows. **"Compatible with as many models as possible" is achieved through ZPL + TSPL coverage and the dialog fallback, not through WebUSB on Windows.**
3. **The helper is not only for wifi.** Its spooler RAW path is the only way to get one-click raw printing on Windows to USB printers that keep their driver. The owner may want to bring its design forward, or at least make sure phase 3's printer model already has an `agent` transport kind. It stays design-only per the owner.
4. **Kiosk printing is a cheap intermediate step.** A Windows station dedicated to labels can get one-click printing today with the `--kiosk-printing` flag. The cost is that every job from that Chrome profile goes to the label printer. It is a station-setup option for the manual, not app code.
5. **Bluetooth Low Energy printers cannot appear as "connected" in the device panel** until Chrome ships `getDevices()`. The panel should show them as "tap to reconnect", and the manual should prefer USB or Bluetooth Classic.
6. **Comics and add-ons: settled.** The base UPC of a US comic, and the base 977 code of a periodical, identify the series, not the issue. The owner decided not to use add-ons; grapas are told apart by their internal code and its printed item label, so phase 1 must make that label easy to print at receiving.
7. **A workstation identity is a prerequisite for phase 3.** miDepo has per-account sessions but no per-computer record. A long-lived workstation cookie and table must come first.
8. **The demo layer belongs at the byte level.** The demo should sit in the `ByteChannel` and in the scanner's `onScan` entry, not in `navigator`. That way phase 4 tests the encoders, chunking, status parsing and normalisation that real hardware will use.

## Gaps, unverified claims and blocked hosts

### Unverified or weakly sourced

- **Android Web Serial:** which Android 17 devices expose wired serial ports, and whether `SerialAllowUsbDevicesForUrls` works on Android. Sources also disagree on whether Bluetooth serial shipped in Chrome 137 or 138.
- **WebHID on Android:** only policy entries suggest Chrome 155. MDN still says "not supported".
- **Print dialog sizing:** whether Chrome's print preview selects a driver paper size matching CSS `@page size`. No Chromium source was found. Also the Chrome version and platforms of `SilentPrintingEnabled`.
- **Windows WebUSB:** any 2025–2026 change to the behaviour (none found). How reliable Zadig is per model. Which label printers expose USB CDC or a virtual COM port.
- **Command syntax:** most ZPL barcode command syntax and the `~HS` bit table; TSPL parameter order, `BITMAP` polarity, the `<ESC>!?` bit layout and `~!T`; whether `CODEPAGE UTF-8` exists on Xprinter and 3nStar firmware; how emulators treat `^CI28`.
- **Printer models:** Xprinter's ZPL claims (resellers only). The languages of XP-470B, iDPRT, Gadnic and Nictom models. Interfaces of the 3nStar LTT204 and Godex models. The Godex, Argox and Xprinter USB vendor IDs. Honeywell's printer-brand status in 2025–2026: one search summary mentioned Brady, so check before naming the brand in the manual.
- **BLE details:** BLE UUIDs of non-Zebra printers. Whether Windows requires OS pairing before Web Bluetooth works.
- **Scanners:** the Spanish keyboard-layout substitution table (derived, not sourced). Honeywell, Datalogic and cheap-scanner defaults for add-ons and ISBN-10. Whether GS1 FNC1 survives a Spanish layout. Real inter-key timings per scanner type. The comic add-on structure, from one dated vendor source.
- **Labels:** Pimaco and Avery A4 dimensions. GS1 logistic-label dimensions. GS1 Argentina fees. Count, quarantine and return-condition label practice.
- **Helper:** Vercel invocation limits. LNA status for WebSocket and `targetAddressSpace`. Whether V4 label drivers pass RAW ZPL. SmartScreen and free signing routes. SNMP OIDs. Which brands advertise mDNS. Wi-Fi band and WPA-Enterprise support per model. QZ Tray and PrintNode prices.
- **Previews and testing:** licence of Zebrash and maintenance of ZPLr, zpl-renderer-js and Labelize. Labelary's privacy terms. Whether Playwright can drive Bluetooth emulation headless.
- **Self-tests:** official self-test and calibration sequences for Xprinter label models, Honeywell PC42 and Godex.
- **Hardware testing:** no miDepo hardware test of any kind has been done. `docs/ROADMAP.md` already lists printing on a real printer as untested.

### Hosts blocked during research

The following hosts could not be fetched directly. Their content, where used, came from search-engine summaries:

- **Chrome and web standards:** developer.chrome.com, web.dev, chromestatus.com, wicg.github.io, groups.google.com (blink-dev), developer.mozilla.org.
- **Vendors:** docs.zebra.com, techdocs.zebra.com, zebra.com / www.zebra.com, tscprinters.com, gadnic.com.ar.
- **Argentine retail:** mercadolibre.com.ar and its API.
- **Products and services:** odoo.com, docs.oracle.com, gs1.se, qz.io, labelary.com.
- **Package CDNs:** unpkg.com, cdn.jsdelivr.net.
- **Other:** manualsdir.com, translate.google.com, and the GitHub REST API (403; raw GitHub files worked).

Reachable in full: github.com raw files (WICG specs, Chromium mirror, MDN compat data, project READMEs and issues), the npm registry, and Microsoft Learn pages where cited. Allowing the blocked hosts and re-reading the items above, especially docs.zebra.com, the TSC manual and developer.chrome.com, would turn most "search summary" citations into verified ones.

## Conclusion

The practical boundary is not "web versus native" but "who owns the device". Windows's print stack owns USB printers, Chrome's HID blocklist owns keyboards, and Android owns nothing. That is why the same Chrome reaches a printer from a phone but not from a desk. miDepo should therefore invest first in parts that do not depend on device ownership: a millimetre label model, the HTML route done well, ZPL and TSPL encoders that respect emulator limits, and scan normalisation that absorbs keyboard layouts, add-ons and UPC. The direct transports then become thin, and the demo layer can test nearly everything without hardware.

The findings also correct two assumptions in the phase list. Direct printing is mainly a phone feature. The Windows helper, though not to be built now, is the only clean answer to the driver conflict, not just a wifi add-on. Before more code is written, the cheapest high-value step is the one the roadmap already names: put one real Zebra, one TSC-class clone and one cheap scanner on a Windows PC and an Android phone, and turn "vendor spec" and "reseller claim" in the models table into "comprobado en miDepo".
