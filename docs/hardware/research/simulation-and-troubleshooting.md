# Testing label printing and scanning without hardware, and label-printer troubleshooting

Research date: 2026-11-20. Scope: (a) simulated "demo" printers and scanners for miDepo (Next.js, Chrome on Windows/Android; PDF/HTML via the OS print dialog, raw ZPL/TSPL over WebUSB / Web Serial / Web Bluetooth, later TCP 9100 via a local helper); (b) material for a Spanish troubleshooting guide.

Method note: labelary.com, cdn.jsdelivr.net and translate.google.com could not be fetched from this session (blocked by the session's network allowlist), so Labelary facts below come from search-result excerpts of labelary.com pages, not a full read. Several vendor-procedure facts come from search-engine summaries of docs.zebra.com / TSC manuals; the URLs are the primary pages, but the exact wording was not read in full. Anything marked "Inference" or listed under Gaps is not verified.

## 1. Rendering ZPL/TSPL to an image for previews without sending data to third parties

### Takeaway
Labelary is the de-facto renderer but is a hosted third-party service (50 labels/request cap, paid on-premise licence exists); for an in-browser, no-network preview the two credible 2026 options are ZPLr (MIT, TypeScript, canvas/PNG, broad ZPL II coverage) and zpl-renderer-js (WASM build of the Go library Zebrash, ~8 MB). There is no mature open-source TSPL renderer; Portakal (JS) has an SVG preview for TSC/TSPL2 and is the only lead found.

### Cited Findings
**Labelary (hosted, sends data off-site)**
- Labelary is offered as an online service accessed through a REST API, with ZPL sent in the URL or the request body — [Labelary ZPL Label API](https://labelary.com/service.html)
- Maximum 50 labels per request, "may be changed without notice"; the service page's limits table lists the 50-label cap for Free, Plus and Business plans, answering HTTP 413 when exceeded — [Labelary FAQ](https://labelary.com/faq.html); [Labelary service](https://labelary.com/service.html)
- The on-premise tier is listed with no requests-per-second or per-day limit; the FAQ suggests licensing Labelary "for private on-premise use" if shared-service limits are too restrictive — [Labelary service](https://labelary.com/service.html); [Labelary FAQ](https://labelary.com/faq.html)
- Workaround for the too-many-labels error: fewer ^XA…^XZ definitions per request, or lower ^PQ counts — [Labelary FAQ (cached)](https://labelary.com/faq.html)
- The FAQ has a question on whether the free API/viewer come with privacy guarantees and whether a paid offering adds them; the answer text was not retrievable this session — [Labelary FAQ](https://labelary.com/faq.html)
- Support contact shown on the service page: support@labelary.com — [Labelary service](https://labelary.com/service.html)

**Open-source renderers (local, no network)**
- ZPLr (github.com/le2ni/zplr): MIT; TypeScript ZPL/ZPL II parser and renderer for ESM on Node.js 22/24 and evergreen browsers; API 0.3.0 frozen in `api/0.3.0.json`; `zpl-ii-2025` profile based on the Zebra Programming Guide of 2025-10-10 recognises 200+ command identities: 95 supported rendering/job commands, 11 partial, 1 unsupported, plus 116 device/network/RFID commands recognised but not rendered; barcodes include Code 128, Code 39, UPC, EAN, QR, Data Matrix, PDF417, Aztec, MaxiCode, Codablock, Code 49 and postal/stacked types; outputs 1-bit rasters, Canvas and PNG (browser: `HTMLCanvasElement` and `Blob[]`); E2E tests on Chromium, Firefox, WebKit; does not execute printing, networking, RFID or filesystem lookups ("not a full Zebra printer emulator"); only redistributable open fonts; 72 commits, no releases listed, no dates visible — [ZPLr on GitHub](https://github.com/le2ni/zplr)
- zpl-renderer-js (Fabrizz/zpl-renderer-js, npm 3.4.0) is a wrapper of Zebrash by IngridHQ (Go) compiled to WASM; the per-build output is ~8 MB because the WASM is inlined; raw WASM in GitHub Releases; PNG output, browser or Node, no third-party service — [zpl-renderer-js README](https://cdn.jsdelivr.net/npm/zpl-renderer-js@3.4.0/README.md); [Zebrash](https://github.com/ingridhq/zebrash) (README read via search excerpt only)
- Labelize (GOODBOY008/labelize): Rust, self-hosted Labelary alternative rendering ZPL and EPL to PNG or PDF — [Labelize](https://github.com/GOODBOY008/labelize); [docs.rs labelize](https://docs.rs/crate/labelize/1.0.0/source/README.md)
- zpl-forge (Rust) renders ZPL to PNG — [docs.rs zpl-forge](https://docs.rs/crate/zpl-forge/0.2.0/source/src/forge/png.rs)
- @zpl-toolchain/core: TypeScript over WASM for parsing, validating, formatting and explaining ZPL (linting, not rendering) — [pkgstats @zpl-toolchain/core](https://www.pkgstats.com/pkg:@zpl-toolchain/core)
- BinaryKits.Zpl (.NET) exists on GitHub; its `BinaryKits.Zpl.Labelary` package is a client for the Labelary API (i.e. that part sends data off-site) — [BinaryKits.Zpl fork](https://github.com/bamf-health/BinaryKits.Zpl); [BinaryKits.Zpl.Labelary](https://libraries.io/nuget/BinaryKits.Zpl.Labelary)
- Neodynamic ZPL Printer Emulator SDK (.NET, commercial) converts ZPL to PNG/JPG/PCX/GRF/PDF — [neodynamic/ZPL-Printer-Emulator-SDK](https://www.Github.com/neodynamic/ZPL-Printer-Emulator-SDK)

**TSPL**
- No mature open-source TSPL/TSPL2-to-PNG renderer found. Portakal (JS) has a TSC/TSPL2 module with parser, validator and an SVG preview "using language-specific font metrics"; Labelscope renders label code to PNG but its examples are EPL2; `tspl2` (Rust) and `haxii/tspl` (Go) generate/send commands, not previews; raster-to-tspl-js converts images to TSPL — [Portakal](https://www.pkgstats.com/pkg:portakal); [Labelscope](https://github.com/Xpertik/labelscope); [tspl2 crate](https://lib.rs/crates/tspl2); [haxii/tspl](https://pkg.go.dev/github.com/haxii/tspl); [raster-to-tspl-js](https://awesome.ecosyste.ms/projects/github.com%2Fkubesail%2Fraster-to-tspl-js)

### Inferences
- For miDepo, the safest design is to build labels from one internal label model and emit three outputs (HTML/PDF, ZPL, TSPL); preview the HTML/PDF rendering for everyone and, in test mode, also render the generated ZPL locally with ZPLr (lighter, MIT, canvas) so the demo printer shows "what the printer would print" without sending warehouse data to Labelary. zpl-renderer-js is the fallback if ZPLr's coverage falls short, at the cost of ~8 MB (lazy-load it only in test mode).
- Labelary should be treated as off-site processing of label content (product names, customer names on packing labels). If ever used, it should be opt-in, documented, and never default; a paid on-premise licence removes that concern but costs money.
- For TSPL, a home-grown preview is realistic only for the small subset miDepo emits (TEXT, BARCODE, QRCODE, BOX, BAR, SIZE, GAP); validating TSPL output may be better done by round-trip tests (golden strings) plus checking with Portakal's SVG preview.
- Rendering fidelity varies per renderer (fonts, ^A0 scalable font metrics); previews prove layout and data, not exact printer output.

### Gaps
- Labelary's exact free-tier rate limits (requests/second, per day), maximum label size, privacy/retention answer and on-premise price could not be read (site blocked); check https://labelary.com/faq.html and service.html directly.
- Maintenance status (last commit dates) of ZPLr, zpl-renderer-js/Zebrash and Labelize as of November 2026 was not visible; check repos before adopting.
- Licence of zpl-renderer-js / Zebrash not confirmed. BinaryKits.Zpl's own (non-Labelary) viewer licence and completeness not verified (main repo page not fetched).
- No Zebra-official offline renderer was found (Zebra's tools such as ZebraDesigner were not researched).

## 2. Virtual printers and capturing raw jobs

### Takeaway
Many "virtual ZPL printers" exist (Windows .NET app, Chrome extensions, Electron/Python listeners on TCP 9100) but most render through Labelary, i.e. send ZPL off-site; a raw TCP 9100 listener that just saves the bytes is trivial and fully local. Windows "Generic / Text Only" driver is the classic way to pass raw ZPL through the spooler; Chrome print-to-PDF at the label paper size checks layouts for the HTML/PDF path.

### Cited Findings
- Virtual ZPL Printer (porrey): "Ethernet-based virtual Zebra label printer", configurable TCP listener, MSI installer, requires .NET 10, LGPL-3.0, latest release 3.5.1; renders via the Labelary API (HTTP/HTTPS, GET/POST, optional Labelary linting); regex find/replace filters on incoming ZPL, image cache, custom TrueType fonts, built-in editor and test templates, Spanish translation — [porrey/Virtual-ZPL-Printer](https://www.Github.com/porrey/Virtual-ZPL-Printer); a setup guide uses TCP port 9100 with it — [Asgard setup guide](https://intercom.help/asgard-alliance-inc/en/articles/6461275-setting-up-a-virtual-printer); SourceForge listing also says it forwards data to Labelary — [SourceForge](https://sourceforge.net/app/virtual-zpl-printer/)
- Other TCP 9100 emulators: bizzabo/zplserver (cross-platform, port 9100), kliucode/ZPLPrinter (port 9100, renders with Labelary), sbinkert/ZplPrinter (Labelary-based, configurable density/size/TCP port), 1linux/zpl-viewer (desktop viewer/emulator; set up a Windows printer to 127.0.0.1:9100), brianzinn/zebra-emulator — [bizzabo/zplserver](https://github.com/bizzabo/zplserver); [kliucode/ZPLPrinter](https://github.com/kliucode/ZPLPrinter); [sbinkert/ZplPrinter](https://github.com/sbinkert/ZplPrinter); [1linux/zpl-viewer](https://github.com/1linux/zpl-viewer); [brianzinn/zebra-emulator](https://github.com/brianzinn/zebra-emulator)
- "Zpl Printer" Chrome extension: printer emulator "based on the http://labelary.com/service.html web service", configurable density, label size and TCP listener; one project states it is ChromeOS-only; a separate "ZPL emulator" extension claims to run in any Chrome — [Zpl Printer (Chrome Web Store)](https://chromewebstore.google.com/detail/zpl-printer/phoidlklenidapnijkabnfdgmadlcmjo); [brianzinn/zebra-emulator](https://github.com/brianzinn/zebra-emulator); [ZPL emulator](https://chromewebstore.google.com/detail/zpl-emulator/onimpgjcfjhbcolcnnehbjncobifnnlb)
- Zebra Browser Print cannot run when another program uses ports 9100 or 9101; these ports are for RAW printing (sending ZPL directly) — [Zebra Browser Print user guide v1.3](https://www.zebra.com/content/dam/zebra_dam/en/guide/portfolio/zebra-browser-print-user-guide-v1-3-en-us.pdf)
- Zebra's own application note: a text file with ZPL sent through the ZebraDesigner driver prints the ZPL as text; fix is to install the printer with the "Generic / Text Only" driver — [Zebra app note "Why is my printer printing code?"](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/printing-code-app-note.pdf)
- ondras12345/zebra-bridge redirects ZPL from a virtual COM port to a networked Zebra over TCP (useful pattern for serial testing) — [zebra-bridge](https://github.com/ondras12345/zebra-bridge)
- ZDesigner driver: the label size is set in Printing Preferences > Options (v5) or Page Setup (v10) — [Zebra KB: Printing a PDF file using the ZDesigner driver](https://supportcommunity.zebra.com/articles/en_US/Knowledge/Printing-a-PDF-File-Using-the-ZDesigner-Driver)

### Inferences
- A "demo printer" inside miDepo does not need any of these tools: the device layer can expose a `PrinterTransport` interface (`write(bytes)`, `read()` for status) with real implementations (WebUSB, Web Serial, Web Bluetooth, local helper TCP) and a demo implementation that stores the exact bytes and renders them locally. To exercise the same code paths, the demo should sit as low as possible: the label → ZPL/TSPL encoder, chunking, and the status-query/response parsing (~HS for ZPL) all run, only the final byte sink differs.
- The demo should also simulate failure states (head open, paper out, paused, offline, slow ACK) by returning the status bytes a real printer would, so the troubleshooting UI can be exercised; the exact ~HS response format must be taken from the Zebra ZPL guide (not verified here).
- For the future local helper, a 20-line Node/Python TCP 9100 listener that writes each job to a file is a fully local virtual printer; avoid the Labelary-backed emulators for real customer data.
- On Windows the HTML/PDF path can be checked with Chrome "Save as PDF" using a custom page size via CSS `@page { size: 100mm 50mm; margin: 0 }`; real drivers then need the matching paper size (see section 5).

### Gaps
- No confirmed default port or current maintenance status for the "Zpl Printer" extension; whether it still works outside ChromeOS in 2026 is unconfirmed.
- No fully local (non-Labelary) Windows virtual Zebra printer with ~HS status emulation was confirmed.
- No TSPL/TSC virtual printer was found.

## 3. Simulating barcode scanners (keyboard wedge, HID POS, serial) and testing with Playwright

### Takeaway
A keyboard-wedge scanner is indistinguishable from typing except by timing (typically <10–30 ms between characters, ending in Enter or Tab); scanners have configurable inter-key delays (e.g. 20/40 ms). In tests, Playwright's `keyboard.type(text, { delay })` produces real, trusted input through the browser's input pipeline; in production "demo mode", synthetic `dispatchEvent` keyboard events are `isTrusted: false` and do not insert text, so a demo scanner should feed the same handler the wedge listener calls rather than fake keystrokes.

### Cited Findings
- Detection libraries use timing heuristics: js-scanner-detection defaults to an average 30 ms between characters, minimum length 6, end characters Tab (9) and Enter (13) — [js-scanner-detection](https://npmjs.com/package/js-scanner-detection); onScan.js is another; its README warns its key-down handling can prevent default on every key that could be part of a scan — [onScan.js README](https://unpkg.com/onscan.js@1.5.2/README.md)
- "Normally a barcode scanner will type a character within 10ms" — [BarcodeScanner.js](https://github.com/itexpertsbv/BarcodeScanner.js) (search excerpt)
- An informal test found two keystrokes under 20 ms easy to produce by hand, three hard but doable — [Scanner or person? Part 1](https://blog-2qe.pages.dev/blog/scanner-or-person-part-1)
- Zebra scanners have an "Intra-Keystroke Delay" keyboard-wedge parameter; a manual lists options No Delay, Medium (20 ms), Long (40 ms) — [Zebra DS4678 PRG: Intra-keystroke delay](https://docs.zebra.com/us/en/scanners/general/ds4-series/ds4678-prg/keyboard-wedge-interface/keyboard-wedge-host-parameters/intra-keystroke-delay-.html); [Zebra SM72](https://docs.zebra.com/us/en/scanners/general/sm72-ig/keyboard-wedge-interface/keyboard-wedge-host-parameters/intra-keystroke-delay-.html)
- With a keyboard wedge there is no way to tell scanner from keyboard from the input alone — [CodeProject forum](https://forum.codeproject.com/post/2137933)
- Playwright `keyboard.type` has a `delay` option (ms between key presses, default 0); modifier keys do not affect `keyboard.type`; for characters not on a US keyboard only an `input` event is sent — [Playwright Keyboard API](https://playwright.dev/docs/api/class-keyboard)
- Playwright documents overriding browser APIs on `navigator` with an init script before page load (example: `getBattery`) — [Playwright: Mock browser APIs](https://playwright.dev/docs/mock-browser-apis)

### Inferences
- Verified elsewhere (general web-platform knowledge, not re-sourced this session): events created with `new KeyboardEvent()` + `dispatchEvent` have `isTrusted === false` and do not trigger default actions such as inserting characters into an input; Playwright/CDP input goes through the browser's real input pipeline and produces trusted events. Treat as needing a quick confirmation test.
- Design for miDepo: keep one `onScan(code, source)` entry point. The keyboard-wedge listener (timing + terminator), a camera scanner (if any), a serial/HID scanner, and a "demo scanner" button/menu that picks a valid or invalid code from the database all call it. The demo scanner can optionally "type" the code into the focused `ScanForm` field character by character (setting `value` and dispatching `input`) at ~10 ms per char plus Enter, to exercise the as-you-type `/api/lookup` path; it should not depend on synthetic keydown being trusted.
- Playwright walkthrough tests: `page.keyboard.type(code, { delay: 10 }); page.keyboard.press('Enter')` mimics a fast wedge scanner; `delay: 80–150` mimics a human, to test that the detector does not misclassify. Include non-ASCII and GS1 group-separator cases since non-US chars only fire `input`.
- Scanners configured for different keyboard layouts (e.g. Spanish vs US) can produce wrong characters for symbols like `-` or `/`; a demo cannot reproduce that, but the troubleshooting guide should mention it (unsourced; see Gaps).

### Gaps
- No source found on HID POS (usage page 0x8C) scanners via WebHID or on serial-mode scanners in Chrome; not researched in depth.
- No primary source retrieved on `isTrusted` behaviour for Playwright-generated events.
- Keyboard-layout mismatch symptoms for scanners not sourced.

## 4. Mocking WebUSB, Web Serial and Web Bluetooth for automated tests

### Takeaway
Chrome has a real virtual-device facility only for Bluetooth (CDP `BluetoothEmulation` domain and WebDriver BiDi `bluetooth` module, Chrome 140+, also wrapped by Puppeteer). WebUSB has a Chromium test-only API (`navigator.usb.test.addFakeDevice`) used by web-platform-tests, not exposed to normal pages; Web Serial has only a Chromium-internal MojoJS fake. In practice, Playwright tests should inject a fake `navigator.usb` / `navigator.serial` via `addInitScript`, and miDepo's demo mode should swap the transport, not the browser API.

### Cited Findings
- BluetoothEmulation CDP domain: "allows configuring virtual Bluetooth devices to test the web-bluetooth API" (experimental); `enable` takes the simulated central state (absent / powered-off / powered-on) and `leSupported`; `addService`, `addCharacteristic`, `addDescriptor` (and remove*), `simulateAdvertisement`, preconnected peripherals with address, name, manufacturer data, known service UUIDs — [CDP BluetoothEmulation](https://chromedevtools.github.io/devtools-protocol/tot/BluetoothEmulation); [Chromium handler](https://chromium.googlesource.com/chromium/src/+/main/content/browser/devtools/protocol/bluetooth_emulation_handler.h)
- Puppeteer exposes an experimental `BluetoothEmulation` API wrapping that domain — [puppeteer-core BluetoothEmulation.ts](https://chromium.googlesource.com/devtools/devtools-frontend/+/main/node_modules/puppeteer-core/src/api/BluetoothEmulation.ts); [puppeteer-core 25.4.0 d.ts](https://app.unpkg.com/puppeteer-core@25.4.0/files/lib/puppeteer/api/BluetoothEmulation.d.ts)
- WebDriver BiDi `bluetooth` module (`simulateAdvertisement`, `disableSimulation`, …), Chrome support listed from version 140 — [MDN browser-compat-data: webdriver/bidi/bluetooth](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/HEAD/webdriver/bidi/bluetooth.json)
- Selenium exposes the domain too (`OpenQA.Selenium.DevTools.V148.BluetoothEmulation`) — [Selenium .NET docs](https://www.selenium.dev/selenium/docs/api/dotnet/webdriver/OpenQA.Selenium.DevTools.V148.BluetoothEmulation.html)
- WebUSB web-platform-tests use `navigator.usb.test.addFakeDevice(...)`, loading a Chromium-specific `webusb-test.js` when `navigator.usb.test` is missing — [WPT usb-helpers.js](https://kdab.searchfox.org/firefox-main/source/testing/web-platform/tests/webusb/resources/usb-helpers.js); [Chromium WPT webusb](https://chromium.googlesource.com/external/w3c/web-platform-tests/+/refs/tags/merge_pr_31104/webusb)
- Web Serial WPT: "currently only provides permission policy and manual tests"; Chromium's fake serial is `fake-serial.js` via MojoJS — [WPT serial README](https://dxr.mozilla.org/mozilla-central/source/testing/web-platform/tests/serial/README.md); [Chromium WPT serial](https://chromium.googlesource.com/external/w3c/web-platform-tests/+/refs/tags/merge_pr_45021/serial/)
- web-serial-polyfill (Google) implements Web Serial on top of WebUSB, useful on Android (WebUSB but no Web Serial), limited to devices not claimed by an OS driver; npm 1.0.15 — [web-serial-polyfill (npm)](https://www.npmjs.com/package/web-serial-polyfill)
- Hand-rolled pattern: Vitest setup stubbing `navigator.usb` (`requestDevice`, `getDevices`) and `navigator.serial` via `Object.defineProperty` — [LeRobot.js tests/setup.ts](https://huggingface.co/spaces/NERDDISCO/LeRobot.js/blame/main/packages/web/tests/setup.ts)
- WebUSB overview (requestDevice, open, claimInterface, transferOut) — [Chrome: Access USB devices on the web](https://developer.chrome.com/articles/usb/)
- Playwright documents mocking browser APIs on `navigator` with init scripts — [Playwright: Mock browser APIs](https://playwright.dev/docs/mock-browser-apis)

### Inferences
- Architecture: `PrinterTransport` with `WebUsbTransport`, `WebSerialTransport`, `WebBluetoothTransport`, `HelperTcpTransport`, `DemoTransport`. Unit tests (Vitest) pass fake `USBDevice`/`SerialPort` objects into the transports directly (dependency injection beats patching globals). Playwright E2E injects a fake `navigator.usb` via `addInitScript` whose `requestDevice()` resolves to a fake device recording `transferOut` bytes, then asserts the ZPL. For Bluetooth, Playwright can open a CDP session (`page.context().newCDPSession(page)`) and use `BluetoothEmulation` to create a virtual peripheral with the printer's GATT write characteristic — this exercises the real Web Bluetooth code path. (Feasibility from Playwright not tested.)
- The `requestDevice()` chooser cannot be clicked by automation in a normal page; this is why init-script fakes (or the BiDi/CDP emulation) are needed.
- In production test mode, do not replace `navigator.*` globally; select `DemoTransport` explicitly so a real device can never be confused with the demo.

### Gaps
- Whether Playwright (Chromium) can drive BluetoothEmulation reliably in headless mode as of Nov 2026 not verified.
- No maintained npm "fake WebUSB device" library confirmed.
- No WebHID mocking source gathered.

## 5. Common label-printer problems and fixes, by symptom

### Takeaway
The usual causes are a handful: media type/sensor not matching the stock (blank or skipping labels → calibrate, set gap vs black-mark, direct thermal vs transfer), driver/language issues (ZPL printed as text → raw path, language setting, ~JD diagnostic mode), page size/scaling in the Windows driver and Chrome dialog (cut-off or shrunken labels), encoding (accents → ^CI28 + font with the glyph), and barcode geometry (X-dimension, quiet zone, darkness). Network "offline" is most often a changed DHCP address.

### Cited Findings
**Prints blank / skips labels / feeds extra**
- Most blank feeds come from media type mismatch, uncalibrated gap sensor, or darkness too low — [mylabelmaker: Zebra blank labels](https://mylabelmaker.com/blog/zebra-printer-blank-labels)
- Set Print Method to Thermal Transfer when using ribbon, Direct Thermal for heat-sensitive labels; on transfer models check the ribbon is seated and not empty — [plusleading: Zebra skipping/blank](https://plusleading.com/how-to-fix-zebra-printer-skipping-labels-or-printing-blank-labels/)
- Wrong sensor type is the most common cause of blank feeding/skipping; gap/notch stock needs the gap setting, black-mark stock the mark setting; the movable sensor must sit over the gap/mark; calibrate so the printer learns label length and gap — [labelinn: ZT230](https://www.labelinn.com/en/blog/zebra-zt230-not-printing-skipping-labels-fix); [whizz-tech: gap sensor](https://whizz-tech.com/support/printers/zebra-rollo-skipping-labels-gap-sensor/); [labelinn: ZD220](https://www.labelinn.com/en/blog/zebra-zd220-skipping-labels-fix)
- TSC: select gap or black mark sensor by sending `GAP` or `BLINE` before calibrating — [TSC TE200 user manual](https://shop.f-trade.ru/files/%D0%9F%D1%80%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D1%8B%20%D1%8D%D1%82%D0%B8%D0%BA%D0%B5%D1%82%D0%BE%D0%BA/TSC/TE200/TE200_user_manual_ENG.pdf)
- Toshiba B-443 example: if no gap is detected within 7", media is treated as continuous — [Toshiba B-443 manual](https://www.manualslib.com/manual/180448/Toshiba-B-443.html?page=26)

**Prints the code instead of the label**
- Three causes: (1) diagnostic/dump mode set by `~JD` persists across power cycles until `~JE`; (2) printer language set to EPL or line print — set it to ZPL or `epl_zpl` (auto-detect) via front panel or SGD `device.languages`; (3) ZPL sent through a printer driver that renders it as text — [Stripy Horse guide](https://stripyhorse.io/guides/zebra-prints-zpl-as-text); [Zebra app note](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/printing-code-app-note.pdf)
- Zebra's fix for the driver case: reinstall the printer with "Generic / Text Only" — [Zebra app note](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/printing-code-app-note.pdf). Sources differ (raw socket vs Generic/Text Only), both avoid the rendering driver.

**Wrong characters / accents (ñ, á)**
- `^CI28` selects UTF-8 — [Zebra ZPL guide: ^CI](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-ci.html)
- `^FH` lets you enter hex values in the following `^FD`; must precede each `^FD` that uses hex; bytes written as `_C3_B1` (ñ) — [Zebra ZPL guide: ^FH](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-fh.html); example `^XA^CI28^FO60,75^ASN,36,20^FH^FDAlvaro Jes_c3_bas P_c3_a9rez Pe_c3_b1aranda^FS^XZ` — [Stack Overflow (kiwix mirror)](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/63045930/how-to-print-on-zpl-zebra-printer-language-unicode-utf-8)
- Missing characters can be a font without the glyph; `^JUS` saves settings to EEPROM; save ZPL files as UTF-8 — [Zebra developer forum](https://developer.zebra.com/thread/34687); [Zebra: Printing special characters in ZPL2](https://support.zebra.com/cpws/docs/zpl/zpl_spcl_chr.htm)

**Cut off, shrunken, shifted (PDF/HTML via driver)**
- Set the label size in the ZDesigner driver (Printing Preferences > Options in v5; Page Setup in v10) — [Zebra KB](https://supportcommunity.zebra.com/articles/en_US/Knowledge/Printing-a-PDF-File-Using-the-ZDesigner-Driver)
- In Chrome: paper size = label size, Scale 100%, Margins None, Fit to page off; Chrome may not list driver label sizes — use "Print using system dialog" (Ctrl+Shift+P) on Windows; in PDF viewers choose Actual size (Adobe: "Choose paper source by PDF page size"); print one and scan it before a batch — [Cleverence: print to Zebra from Chrome](https://www.cleverence.com/label/blog/print-to-zebra-printer-from-chrome); [Pirate Ship: Windows 4x6](https://support.pirateship.com/en/articles/2610080-windows-how-to-print-with-a-4x6-label-printer); [Pitney Bowes: ZD621 partial labels](https://www.pitneybowes.com/us/support/article/000088704/jz22-zd621-printer-prints-partial-cut-off-shipping-labels-in-pit.html)
- Case collection on "preview correct but physical print shifted" — [AutoShipFlow label-tools #6](https://github.com/AutoShipFlow/label-tools/issues/6)

**Barcodes that do not scan**
- Quiet zone at least 10× X-dimension (linear); FedEx 0.10" all sides; Zebra manual: leave ≥3.2 mm (1/8") between barcode and label edge/other print — [FedEx printer maintenance guidelines](https://fedex.com/content/dam/fedex/us-united-states/shipping/images/printer_maintenance_guidelines.pdf); [Zebra ZT231 print quality issues](https://docs.zebra.com/us/en/printers/industrial/zt231-industrial-printer-user-guide/c-zt4x1-troubleshoot/c-zt4x1-troubleshooting/r-zt4x1-printing-or-print-quality-issues.html)
- Common minimum X-dimension 10 mil (0.010"); bars too thin/anti-aliased at 203 dpi → increase X-dimension, print at 100% scale, disable smoothing; raise darkness until bars are solid but not bleeding — [whizz-tech: barcodes won't scan](https://whizz-tech.com/support/printers/barcodes-wont-scan-fix/); [IDPRT troubleshooting](https://www.idprt.com/Blog/Barcode-Not-Scanning-Troubleshooting-Guide.html); [TEC-IT FAQ](https://www.tec-it.com/en/support/faq/barcode/printing-decoding/Default.aspx)
- Wrong print direction for the line is a common cause; ISO/IEC 15416 verification grades contrast, modulation, edges, quiet zone — [Durafast](https://www.durafastlabel.com/solutions/barcode-labels-not-scanning-the-mistakes-youre-making-and-how-to-fix-them); [Keyence FAQ](https://www.keyence.com/ss/products/auto_id/codereader/code_verification/faq-read-error.jsp)
- Zebra print-quality troubleshooting pages (darkness, speed, head cleaning) — [Zebra ZT400 print quality KB](https://supportcommunity.zebra.com/articles/en_US/Knowledge/ZT400-Series-Printer-Resolving-Print-Quality-Issues); [Zebra ZT200 printing issues](https://docs.zebra.com/content/tcm/us/en/printers/industrial/zt200-series-industrial-printer-user-guide/troubleshooting/r-zt2x0-printing-issues.html)

**Offline over Wi-Fi / network**
- A changed IP (DHCP) leaves the Windows port pointing at the old address; use a DHCP reservation (by MAC) or static IP; update the Windows printer port if the IP changed; static/DHCP set via Zebra Setup Utilities or the Printer Setup Utility app (Android/iOS) — [BCTP: ZD421 wireless](https://www.bctp.com/blogs/post/zebra-zd421-wireless-setup); [BCTP: ZT411 network](https://www.bctp.com/blogs/post/zebra-zt411-network-connection-problems-ethernet-usb-setup); [Zebra KB 000026349](https://support.zebra.com/article/000026349); [Zebra KB 000015720](https://support.zebra.com/article/000015720)

### Inferences (from training knowledge of the ZPL guide; not re-verified this session)
- Label geometry commands for miDepo's generator and the guide: `^PW` print width in dots, `^LL` label length, `^LH` label home/origin, `^MN` media tracking (N continuous, W/Y gap/web, M black mark), `^MT` media type (D direct thermal, T thermal transfer), `^MD`/`~SD` darkness, `^PR` speed, `~JC` calibrate, `^JUS` save. DPI mismatch: dots = mm × 8 at 203 dpi (8 dots/mm) and × 11.8 at 300 dpi (12 dots/mm), so a label designed for 203 dpi prints ~2/3 size on a 300 dpi head. miDepo should ask/store DPI per printer and generate coordinates from mm. Verify each command in the Zebra ZPL Programming Guide before writing the guide.
- ZPL sent to an EPL-only or TSPL printer typically prints garbage or nothing; TSC/Xprinter models that "emulate ZPL" do so partially, so miDepo should prefer each printer's native language.
- Direct-thermal stock with ribbon fitted, or transfer stock without ribbon / ribbon ink side facing away from the labels, yields blank labels; quick test: scratch the label with a fingernail (direct thermal blackens). (Common practice; not sourced here.)
- Windows: when using ZDesigner/Seagull (BarTender) drivers for HTML/PDF, define the exact stock size as a paper form; when sending raw ZPL from a helper, bypass the driver (raw port 9100 or Generic/Text Only).
- Android Bluetooth: many low-cost label printers are Bluetooth Classic (SPP) only, which Web Bluetooth (BLE GATT only) cannot reach; this should be the first check in the Android guide. (Not sourced this session — see Gaps.)

### Gaps
- Android Bluetooth pairing problems (BLE vs Classic SPP, Chrome Web Bluetooth limits, location permission) were not researched with sources.
- Printer sleep/Wi-Fi power-save as a cause of "offline": no source found.
- Red/flashing light meanings (head open, media out, ribbon out, paused) per model not gathered; see each model's "Status indicator" table in docs.zebra.com.
- Seagull/BarTender driver-specific issues not researched.

## 6. Self-test, configuration label, calibration and factory reset per brand

### Takeaway
Zebra desktop (ZD421/ZD621): FEED+CANCEL 2 s prints configuration + network reports; hold FEED for SmartCal; PAUSE+FEED at power-on resets printer settings (network kept); PAUSE+CANCEL resets network only. TSC (TE200): hold FEED while powering on and release at a given LED colour/blink to choose calibration, self-test, factory default, etc. Xprinter: hold FEED while powering on for a self-test/settings print; model-specific details were not confirmed.

### Cited Findings
- Zebra ZD421/ZD621 configuration report: in ready state (status solid green), hold FEED + CANCEL 2 s, release; prints printer and network configuration reports — [Zebra ZD421/ZD621 UG: configuration reports](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd421-zd621-ug-tools/r-mlk-ug-printer-diagnostics/t-zd620zd420-ug-printing-the-printer-and-network-configuration-reports.html); [Test printing with a configuration report](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/setup/test-printing-with-a-configuration-report.html)
- Zebra ZD421/ZD621 print quality report (FEED self-test): prints labels at various speeds and darkness above/below the configured value — [Zebra: Printing a print quality report](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd421-zd621-ug-tools/r-mlk-ug-printer-diagnostics/c-zd410d-ug-perform-a-print-quality-report-feed-self-test/t-zd421-zd621-ug-printing-a-print-quality-report.html)
- Zebra ZD421 calibration: hold FEED until the status light blinks twice, release (SmartCal) — [Shopify Help: ZD421](https://help.shopify.com/en/manual/fulfillment/fulfilling-orders/shipping-labels/label-printers/wireless-zebra-label-printer-ZD421) (third-party; Zebra calls it SmartCal)
- Zebra ZD421/ZD621 factory reset: PAUSE + FEED held at power-on resets printer configuration, no labels printed, network unchanged; RESET button held 1–5 s does a factory reset then prints a configuration report; PAUSE + CANCEL resets only network settings, no report printed — [Zebra: RESET button functions](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd421-zd621-ug-tools/r-mlk-ug-printer-diagnostics/c-resetting-defaults/c-zd421-zd621-ug-reset-button-functions.html); [Zebra: resetting network to factory defaults](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/tools/printer-diagnostics/resetting-the-printer-s-network-settings-to-their-factory-defaults.html); [scanprinter.eu ZD421 factory reset](https://scanprinter.eu/blogs/guides/zebra-zd421-factory-reset)
- Zebra one-button models (ZD220/ZD230/ZD888) have "FEED button modes – power ON" tables (hold FEED at power-on, release after N flashes) — [Zebra ZD888/ZD230 FEED button modes](https://docs.zebra.com/us/en/printers/desktop/zd888da-zd230da/controls-and-indicators/user-interface/feed-(advance)-button/feed-button-modes-power-on.html); [Zebra ZD200 FEED modes](https://docs.zebra.com/us/en/printers/desktop/zd100ta-ug/c-zd200t-ug-controls-and-indicators/r-zd200t-ug-user-interface/r-zd200d-ug-feed-advance-button/r-zd200t-ug-feed-button-modes-power-on.html)
- Zebra industrial (ZT200/ZT400): FEED + PAUSE self test at power-on — [Zebra ZT200 FEED and PAUSE self test](https://docs.zebra.com/us/en/printers/industrial/zt200-series-industrial-printer-user-guide/troubleshooting/c-zt2x0-printer-diagnostics/t-zt2x0-feed-and-pause-self-test.html); [ZT400](https://docs.zebra.com/us/en/printers/industrial/zt400-series-industrial-printer-user-guide/c-zt4x0-ug-diagnostics-and-troubleshooting/c-zt4x0-ug-printer-diagnostics/t-zt4x0-ug-feed-and-pause-self-test.html)
- TSC TE200: power off, hold the button, power on, release when the LED turns red and blinks → calibrates ribbon sensor and gap/black-mark sensitivity; self-test printout shows dot damage on the head, configuration and memory; a further option initialises to factory default — [TSC TE200 user manual](https://shop.f-trade.ru/files/%D0%9F%D1%80%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D1%8B%20%D1%8D%D1%82%D0%B8%D0%BA%D0%B5%D1%82%D0%BE%D0%BA/TSC/TE200/TE200_user_manual_ENG.pdf); [TSC TE200 manual (alt copy)](https://btpos.md/wp-content/uploads/2024/03/TSC-TE200-TE300-TE210-TE310-User-Manual-EN.pdf)
- Third-party sequence for TSC power-on utilities after the first amber: red ×5 = sensor calibration; amber ×5 = self-test; green ×5 = factory default; green/amber ×5 = black-mark calibration; red/amber ×5 = gap calibration; solid green = skip AUTO.BAS (unverified against the official manual) — [scanprinter.eu TSC TE200 calibration](https://scanprinter.eu/blogs/guides/tsc-te200-te210-calibration); another guide says the printer feeds 1–3 labels to calibrate — [labelinn calibration guide](https://www.labelinn.com/en/blog/thermal-printer-calibration-guide)
- Xprinter (Q260III receipt model): power off, hold FEED while powering on ~3 s, release → self-test/settings printout — [Poster KB: Xprinter Q260III self-test](https://knowledge-base.joinposter.com/en/how-to-print-a-self-test-for-the-xprinter-q260iii)
- SATO: hold FEED while powering on → media calibration then a configuration/self-test label — [SATO SA4 factory test print mode](https://helpcenter.sato-global.com/hc/en-001/articles/38168076438553-SA4-Factory-Test-Print-Mode)

### Inferences
- A Spanish guide can generalise: "Apaga la impresora, mantén pulsado FEED y enciéndela; suelta según el color o número de parpadeos" for TSC/Xprinter/SATO class printers, and "FEED + CANCEL 2 s" for Zebra ZD4xx/6xx, always pointing users to their model's manual table, since timings vary by model.
- The configuration label is the single most useful artifact for support: it shows language, DPI, print width, media type, sensor type, IP — miDepo's guide should ask the user to print it first.

### Gaps
- Xprinter label models (XP-365B, XP-420B, XP-470B) self-test/calibration sequence not confirmed from Xprinter documentation.
- Honeywell (PC42/PC43) and Godex (G500/RT200) self-test/calibration/reset sequences not researched.
- TSC official LED colour sequence not read verbatim.

## 7. First steps recommended by vendor troubleshooting guides

### Takeaway
Across Zebra, TSC and third-party guides, the first steps converge on: print the self-test/configuration label, check media type and sensor (gap/black mark/continuous) and run calibration, check print method (direct thermal vs transfer) and ribbon, check language and connection, then adjust darkness/speed and clean the head.

### Cited Findings
- Zebra recommends test printing with a configuration report as part of setup — [Zebra ZD421/ZD621 UG](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/setup/test-printing-with-a-configuration-report.html)
- Zebra's "printing code" note: check diagnostic mode (~JD/~JE), language setting, and driver path first — [Zebra app note](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/printing-code-app-note.pdf)
- Zebra printer diagnostics section lists power-on self test, configuration report, print quality report, sensor profile, communication diagnostics — [Zebra ZD421/ZD621 printer diagnostics](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/c-zd421-zd621-ug-tools/r-mlk-ug-printer-diagnostics.html); [Zebra ZD620/ZD420 power-on self test](https://docs.zebra.com/us/en/printers/desktop/bm-zd620-and-zd420-desktop-printers-user-guide-ditamap/c-zd620-420-tools/c-zd200t-ug-printer-diagnostics/c-zd620-zd420-ug-power-on-self-test.html)
- TSC: self-test to check head dots, configuration, memory; calibrate sensors after choosing GAP/BLINE — [TSC TE200 user manual](https://shop.f-trade.ru/files/%D0%9F%D1%80%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D1%8B%20%D1%8D%D1%82%D0%B8%D0%BA%D0%B5%D1%82%D0%BE%D0%BA/TSC/TE200/TE200_user_manual_ENG.pdf)
- FedEx printer maintenance guidance (head cleaning, darkness, quiet zones) for shipping labels — [FedEx printer maintenance guidelines](https://fedex.com/content/dam/fedex/us-united-states/shipping/images/printer_maintenance_guidelines.pdf)

### Inferences
- Suggested order for miDepo's Spanish guide (each step a symptom → check → fix row): 1) ¿Enciende y qué luz muestra? 2) Imprime la etiqueta de configuración. 3) Tipo de papel y sensor; calibra. 4) Térmica directa o con cinta. 5) Idioma (ZPL/TSPL) y conexión (USB/red/Bluetooth). 6) Tamaño de etiqueta, DPI y escala en Chrome. 7) Oscuridad/velocidad y limpieza del cabezal. 8) Código de barras: tamaño, zona en blanco, orientación. In miDepo, the demo printer can reproduce steps 3, 5 and 6 as simulated faults.

### Gaps
- Honeywell and Godex official first-step guidance not retrieved.
- No Spanish-language vendor guides consulted (the guide will need translation of terminology: "sensor de separación (gap)", "marca negra", "térmica directa", "transferencia térmica", "cinta (ribbon)", "cabezal").
