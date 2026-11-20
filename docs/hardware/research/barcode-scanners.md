# Barcode scanners (and nearby floor hardware) for a browser-based WMS: Chrome on Windows and Chrome on Android

Research date: 2026-11-20. Method note: in this session, direct page fetches failed for developer.chrome.com, developer.mozilla.org, techdocs.zebra.com, docs.zebra.com, wicg.github.io, unpkg.com and manualsdir.com (the hosts were outside the session's allowed network). Facts from those sites come from search-result extracts of the cited URL, not from a full read of the page. Only github.com could be fetched in full. Anything marked "Inference" is my reasoning, not a sourced fact.

## 1. Interface modes: what a Chrome page can see as a device, and what arrives only as keystrokes

### Takeaway
In practice, almost every scanner a small Argentine warehouse buys reaches Chrome as keystrokes: USB keyboard wedge, a 2.4 GHz dongle, Bluetooth HID, or the keystroke output on an Android rugged handheld. WebHID can open a scanner only when the scanner is switched to **USB HID POS** mode (usage page 0x8C), because Chrome blocks the reports of any keyboard-class collection. Web Serial can open USB CDC/virtual COM scanners, and on desktop and Android also Bluetooth SPP (RFCOMM) scanners. Both are opt-in device modes that need configuration and a user gesture to pick the device. Keystroke input stays the baseline that has to work.

### Cited Findings
**WebHID and keyboard-class devices**
- WebHID filters match on vendorId, productId, usagePage and usage, and Chrome has supported WebHID since version 89. Firefox and Safari do not support it. — [Chrome Developers: Connect to uncommon HID devices](https://developer.chrome.com/docs/capabilities/hid) (search extract)
- Chrome blocks the input, output and feature reports of any top-level HID collection with a "protected" usage, meaning one that would let the device act as a mouse or keyboard. The aim is to prevent keylogging. — [WICG/webhid issue #12](https://github.com/WICG/webhid/issues/12)
- The WebHID spec draft says a user agent can deny access to keyboard-like devices by refusing devices that include a top-level collection with the Keyboard usage. — [WebHID spec draft](https://wicg.github.io/webhid) (search extract)
- The keyboard blocklist rule blocks every report in any collection with the Generic Desktop > Keyboard usage. One issue reports a card reader whose vendor feature report became unreachable because it sat beside a keyboard collection. — [WICG/webhid issue #95](https://github.com/WICG/webhid/issues/95)
- On a keypad, input reports inside a Keyboard/Keypad collection are not accessible through WebHID. Controls in a separate, non-protected collection still are. Protected devices can still appear in the chooser and then fail, for example `sendReport()` throws NotAllowedError. — [WICG discourse: HID API](https://discourse.wicg.io/t/human-interface-device-hid-api/3070); [WICG/webhid issue #12](https://github.com/WICG/webhid/issues/12)
- Chrome's older chrome.hid API (2014) already kept keyboards, mice, other pointer devices and system-control inputs out of enumeration. — [Chromium code review 258733002](https://codereview.chromium.org/258733002/)
- A secondary source says Chrome's blocklist also covers FIDO authenticators. I could not verify this against Chromium source. Chromium's hid.mojom defines `kPageFido = 0xF1D0` and `kPageBarCodeScanner = 0x8C`. — [TestMu AI: WebHID](https://www.testmuai.com/web-technologies/webhid-ie/); [Chromium hid.mojom](https://chromium.googlesource.com/chromium/src/+/256e7a4929a60f8ad33d2b8c154034af3371a40a/services/device/public/mojom/hid.mojom)

**HID POS (usage page 0x8C)**
- Usage pages: 0x8C Bar Code Scanner, 0x8D Scale, 0x8E Magnetic Stripe Reading devices. The usages for barcode scanners and scales are defined in the separate "HID Point of Sale Usage Tables 1.02" document. — [FreeBSD usb_hid_usages](https://cgit.freebsd.org/src/tree/share/misc/usb_hid_usages); [USB-IF HUT 1.12](https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf)
- The open-source library `@point-of-sale/webhid-barcode-scanner` works with Honeywell, Zebra and Datalogic scanners in HID POS mode through WebHID. Its README says it can switch Honeywell scanners into HID POS mode automatically. Other brands may need a configuration barcode from the manual. A scanner that is not in HID POS mode raises an "unsupported" event. — [npm: @point-of-sale/webhid-barcode-scanner](https://npmjs.com/@point-of-sale/webhid-barcode-scanner) (search extract of its README)
- A Newland manual shows a vendor HID POS input report made of a report ID and a decoded-data field. — [Newland FM420 manual, USB interface](https://www.manualslib.com/manual/696474/Newland-Fm420.html?page=52)

**Web Serial (USB CDC/COM, RS-232 adapters, Bluetooth SPP)**
- Chrome desktop added Web Serial over Bluetooth Classic SPP in Chrome 117. Chrome lists paired devices that expose SPP. Every Service Class ID built on the Bluetooth SIG Base UUID is blocked except SPP's. Custom RFCOMM services need `allowedBluetoothServiceClassIds` in `requestPort()`. Only devices already paired with the OS can be selected, and there is no scanning UI. — [Chrome blog: Serial over Bluetooth on the web](https://developer.chrome.com/blog/serial-over-bluetooth)
- Chrome on Android: an April 2025 Intent to Ship enabled Web Serial over Bluetooth RFCOMM, targeting Chrome 137. On Android over Bluetooth, the connect/disconnect events and `SerialPort.connected` are not fully supported. Wired USB serial on Android was left for a future launch, and the feature is not in Android WebView. — [blink-dev: Intent to Ship: Web serial over Bluetooth on Android](https://groups.google.com/a/chromium.org/g/blink-dev/c/BqUGCcurReE)

**Bluetooth HID vs SPP**
- One manufacturer's manual (Denso) describes SPP as the profile for connecting to Android or a PC, and HID as the profile for iPhone, iPad, Android or a PC. Its SPP mode offers non-acknowledge (the default) or ACK/NAK. — [Denso SE1-BB manual, ch. 9](https://www.manualslib.com/manual/1598192/Denso-Se1-Bb.html?page=42)

**Android rugged handhelds**
- Zebra DataWedge Keystroke Output sends the processed data to the associated app as keystrokes, as if a user were typing. "Send Enter as string" is off by default, so ENTER goes out as a key event. Related options include "Send Tab as string", "Send Control Characters as Events" and a key-event (inter-character) delay. — [Zebra DataWedge Keystroke Output](https://techdocs.zebra.com/datawedge/15-0/guide/output/keystroke) (search extract)
- Zebra docs say web applications read these key events through the DOM and do not generate Android key-press events. For example, a Ctrl+F inside a barcode does not open Find. — [DataWedge Keystroke Output (6.x–15.x)](https://techdocs.zebra.com/datawedge/latest/guide/output/keystroke/) (search extract)
- In Chrome on an MC3300x, a scan arrives as key presses and ENTER arrives as keyCode 13. One quirk: after an alert() is dismissed, typed characters do not appear in Chrome until the screen is tapped. — [Zebra developer blog: Listening for KeyPress events with DataWedge](https://developer.zebra.com/blog/listening-keypress-events-datawedge)
- A Zebra expert answered for a TC21 that, by default, DataWedge scans into any app including Chrome. If characters go missing in a web app, raise Profile 0's Keystroke "inter character delay" to 6 ms or more. For errors in general, Zebra docs say to raise the delay in steps of 100 (up to 1000) and warn that this slows the app. — [Zebra developer forum: Scan barcode without input stroke](https://developer.zebra.com/content/scan-barcode-without-input-stroke); [DataWedge keystroke docs](https://techdocs.zebra.com/datawedge/14-3/guide/output/keystroke) (search extracts)
- On Android 10 and later, the default keyboard disappears briefly during a scan and comes back after the data is delivered. Zebra recommends the DataWedge keyboard option when ENTER or TAB must move to the next field in a web page. — [DataWedge keystroke docs](https://techdocs.zebra.com/datawedge/latest/guide/output/keystroke/) (search extract)
- Honeywell handhelds have keyboard-wedge output and intent output. A setup guide says to set Wedge Method = Keyboard, set the suffix to `\r` or `\n`, and leave "Wedge as keys" empty. Honeywell's CT50 manual says `\r` becomes 13 and `\n` becomes 10 in suffix strings. DataWedge does not exist on Honeywell devices. — [CartonCloud: Honeywell CK65/CT60/CT40 setup](https://help.cartoncloud.com/knowledge/honeywell-ck65-ct60-ct40-setup-instructions); [Honeywell CT50 manual](https://manualslib.com/manual/1277581/Honeywell-Ct50.html?page=47); [Cleverence: CT45 DataWedge not available](https://www.cleverence.com/articles/technical-manuals/honeywell-ct45-datawedge-is-not-available-on-this-handheld-4827/)

### Inferences
- What a Chrome page can see, by mode:
  - USB HID keyboard wedge: keystrokes only. Chrome blocks the keyboard collection.
  - USB HID POS: WebHID device, and you get the raw data plus the symbology.
  - USB CDC/virtual COM: a Web Serial device on Windows. Not on Android Chrome, because wired serial is not shipped there.
  - RS-232 through a USB adapter: Web Serial on Windows.
  - 2.4 GHz dongle: usually keyboard wedge, so keystrokes. Some dongles may offer COM mode.
  - Bluetooth HID: keystrokes.
  - Bluetooth SPP: Web Serial on Windows and on Android (Chrome 137+, per the Intent to Ship), with unreliable disconnect events on Android.
  - Android handheld keystroke output: keystrokes.
  - Android handheld intent output (DataWedge Intent, Honeywell Data Intent, Urovo/Chainway/Sunmi/Newland broadcast): invisible to a Chrome page. A broadcast intent reaches only a native app or a WebView wrapper.
- The intent output of Urovo, Chainway, Sunmi and Newland is the same as above: a broadcast that Chrome cannot receive. Each of these brands also has a "keyboard/keystroke/wedge" output mode, which is the one miDepo needs. I found no specific vendor docs for these four brands in this session.
- miDepo should keep keystroke input as its only required path. WebHID (HID POS) and Web Serial are optional extras worth adding only if the owner wants a real "device connected" signal on desktop. Both need a one-time configuration barcode on the scanner and a permission chooser, and a scanner in HID POS or COM mode stops typing into other programs.

### Gaps
- I could not fetch the current Chromium HID blocklist source or the HID POS Usage Tables 1.02 PDF, so I could not confirm the usage IDs inside page 0x8C (for example Decoded Data).
- I could not confirm whether Chrome on Android exposes WebHID at all. The Chrome docs extract named desktop platforms only.
- I found no vendor docs on keystroke vs intent output for Urovo, Chainway, Sunmi or Newland handhelds.

## 2. Detecting a keyboard-wedge scanner in the browser

### Takeaway
A web page cannot identify a keyboard-wedge scanner as a device. It can only infer "this input came from a scanner" from how the input arrived: a fast burst of characters, a minimum length, and a terminating Enter or Tab. Optional configured prefixes, suffixes and AIM IDs make that inference much stronger. The common library defaults are 30 ms per character, a minimum length of 6, and Enter/Tab suffixes. Known pitfalls are slow Bluetooth or Android keystroke delivery, IME (keyCode 229) events, paste-mode scanners, and keyCode decoding that drops characters such as "-".

### Cited Findings
- onScan.js tells scans from typing by input speed and by prefix/suffix characters. Its defaults: `suffixKeyCodes [9,13]` (never part of the code), `prefixKeyCodes []`, `minLength 6`, `avgTimeByChar 30` ms (a scan slower than length × 30 ms is a scanError), `timeBeforeScanTest 100` ms, `reactToKeydown true`, `reactToPaste false` (for clipboard-mode scanners), and `scanButtonKeyCode` for a hardware scan key that sends a keyCode. — [github.com/axenox/onscan.js](https://github.com/axenox/onscan.js)
- Pitfall in onScan.js: its default keyCode mapper converts only keyCodes 48–90, 96–105 and 106–111. Users who see "strange extra characters ... or miss some characters (like hyphens)" are told to write a custom `keyCodeMapper`. With `preventDefault`, "you won't be able to use the keyboard for typing". — [github.com/axenox/onscan.js](https://github.com/axenox/onscan.js)
- jQuery Scanner Detection also uses a 30 ms average inter-character time. The onscan-next fork suggests raising `avgTimeByChar` and `timeBeforeScanTest` for slow scanners. — [jQuery Scanner Detection](https://www.github.com/iuyes/jQuery-Scanner-Detection); [onscan-next](https://www.pkgstats.com/pkg:onscan-next)
- AIM symbology identifiers are a three-character `]cm` prefix: code character plus modifier. Examples:
  - `]E0`: EAN-13, UPC-A, UPC-E, and 2- or 5-digit add-ons.
  - `]C1`: GS1-128, meaning FNC1 in the first position.
  - `]d1` and `]d2`: Data Matrix ECC 200, with `]d2` meaning GS1 DataMatrix (FNC1 first or fifth).
  - `]Q`: QR. Sources disagree on the modifier: Newland lists Q0 as Model 1, Q1 as Model 2 without ECI and Q2 as Model 2 with ECI.
  - Vendor "Code IDs" are a separate scheme. Honeywell uses `d` (0x64) for EAN-13 and `w` for Data Matrix.
  - — [Zebra AIM Code Identifiers (MP72)](https://docs.zebra.com/us/en/scanners/multi-plane/mp72pg/c-param-desc-programming-reference/r-param-desc-aim-code-identifiers.html); [Workday: Barcode Symbology IDs](https://doc.workday.com/admin-guide/en-us/spend-management/inventory/inventory-label-printing/bjy1503599099675.html); [Newland FR20 manual](https://www.manualslib.com/manual/3141163/Newland-Fr20.html?page=89); [GS1 EU 2018/574 data capture spec](https://www.gs1.org/sites/default/files/eu2018-574requireddatacapturespecifications.pdf)
- A Honeywell guide warns that an Enter, Tab or CR suffix can submit the field before the app has processed the last character. — [Stewart support: Configuring Honeywell scanner settings](https://stewartsupport.freshdesk.com/support/solutions/articles/43000781492-configuring-honeywell-scanner-settings-for-optimal-performance-step-by-step)
- `KeyboardEvent.code` names the physical key whatever the layout, locale or modifiers. `key` is the character the current layout produces. MDN warns that `code` cannot reliably tell you the character produced. — [Chrome blog: KeyboardEvent keys and codes](https://developer.chrome.com/blog/keyboardevent-keys-codes/); [MDN: KeyboardEvent.code](https://developer.mozilla.org/docs/Web/API/KeyboardEvent/code)

### Inferences
- The honest "scanner detected" signal miDepo can build:
  - Per field, label the last entry "escaneado" when it arrived as a burst. Suggested rule: at least 4–6 characters, median inter-key gap under about 25–35 ms, ended by Enter or Tab within about 50 ms of the last character.
  - Per device, remember in localStorage that "a scanner has been used on this device" after N such bursts.
  - Never claim "scanner connected". A keyboard wedge stays invisible until it types.
- Threshold tuning: measure gaps with `event.timeStamp`, not `Date.now()`. Ignore events where `event.repeat` is true (auto-repeat). Use the median gap, not the mean, so that one slow gap in the middle does not fail the burst.
- Fast human typists and password managers can produce bursts, but rarely 8–13 characters under 30 ms each followed by Enter.
- Android DataWedge with an inter-character delay of 6 ms or more, and Bluetooth HID, can be slower. A tolerant threshold (about 50 ms) with the Enter suffix as the main signal is safer than a strict 30 ms.
- On Android, input from the soft keyboard and IME arrives as keyCode 229, `key` "Unidentified", which a burst detector must ignore. Hardware or DataWedge keystrokes carry real keys (keyCode 13 for Enter, per Zebra's blog).
- The most robust design avoids depending on detection at all. Treat whatever lands in the field and is confirmed with Enter as the submitted value, as miDepo does today. Use detection only for the UI hint and for diagnostics, for example "Llegó sin Enter: configura el sufijo del lector".
- A configurable prefix, such as an AIM ID transmitted by the scanner, gives certainty ("this came from the scanner, symbology EAN-13"). But every scanner then has to be configured, and the app has to strip the prefix. It is worth supporting optionally, by stripping a leading `]XX` when present. It is not worth requiring.
- A field should also accept paste events, for clipboard-mode and "virtual keyboard" scanner apps, and treat a paste followed by Enter the same as a burst.

### Gaps
- I found no published measurements of real inter-key timings per scanner type (USB vs 2.4 GHz vs Bluetooth vs DataWedge), so the thresholds above are inference.

## 3. Keyboard layout problems (US scanner emulation on a Spanish-layout PC)

### Takeaway
Most scanners send US-keyboard key codes by default, and Windows then reads them through the PC's own layout. On Spanish (Latin America) and Spanish (Spain), digits and unshifted letters come out right, but punctuation does not. The critical one for miDepo: **"-" arrives as "'"**, so "A-01-1" becomes "A'01'1". The fix for users is to set the scanner's "keyboard country" to match Windows, or use Alt+numpad/"universal" emulation. The fix for the app is to normalize known substitutions in fields whose format it controls.

### Cited Findings
- A scanner set to US keyboard emulation, the default on most scanners, sends the US key code, and a non-US Windows driver translates it into a different character. Morovia's example is Italian, where "-" becomes "'". — [Morovia KB: scanned data incorrectly displayed](https://www.morovia.com/kb/PRB-Scanned-Data-Incorrectly-Displayed-Computer-10604.html)
- Same symptom in a library system: "the hyphen (-) is read like apostrophe (')". — [Ex Libris: Barcode: the hyphen is read like apostrophe](https://knowledge.exlibrisgroup.com/Aleph/Knowledge_Articles/Barcode%3A_the_hyphen_(-)_is_read_like_apostrophe_('))
- A Zebra forum thread reports "-" appearing where "/" should be. — [Zebra developer forum: CS4070 HID keyboard type](https://developer.zebra.com/thread/34311)
- To get punctuation right through a keyboard wedge, the scanner and the computer must use the same keyboard layout. Odoo's troubleshooting docs say the same. — [Morovia KB](https://www.morovia.com/kb/PRB-Scanned-Data-Incorrectly-Displayed-Computer-10604.html); [Odoo: barcode device troubleshooting](https://www.odoo.com/documentation/saas-18.3/applications/inventory_and_mrp/barcode/setup/device_troubleshooting.html)
- The Zebra LS2208 ships with US English layout and needs a configuration barcode when the system is Spanish. — [Cleverence: Zebra LS2208 setup (es)](https://www.cleverence.com/articles/usb-barcode-scanners-es/using-zebra-ls2208-on-pc-and-mac-guide-2453817/)
- Cheap scanners also list a layout option. The Netum NT-W6 and Gadnic CODBAR11 manuals both have "Keyboard Language" pages. — [Netum NT-W6 manual](https://Manualslib.com/manual/1434682/Netum-Nt-W6.html?page=2); [Gadnic CODBAR11 manual](https://manualslib.mx/manual/901348/Gadnic-Codbar11.html?page=56)
- Zebra "Keypad Emulation" sends every character as an Alt+numpad ASCII sequence. For example "A" is sent as ALT make, 0 6 5, ALT break. If the keyboard country is not in Zebra's country list, Zebra says to disable Quick Keypad Emulation and enable Keypad Emulation. "Alternate Numeric Keypad Emulation" lets a scanner emulate most other country keyboards in a Microsoft OS. Zebra also has "Keypad Emulation with Leading Zero" and "Caps Lock Override" parameters. I could not read their descriptions. — [Zebra MP72 Keypad Emulation](https://docs.zebra.com/us/en/scanners/multi-plane/mp72pg/usb-interface/keypad-emulation.html); [Zebra DS4678 Quick Keypad Emulation](https://docs.zebra.com/us/en/scanners/general/ds4-series/ds4678-prg/keyboard-wedge-interface/keyboard-wedge-host-parameters/quick-keypad-emulation-(keyboard-wedge).html); [Zebra SM72 Alternate Numeric Keypad Emulation](https://docs.zebra.com/us/en/scanners/general/sm72-ig/c-sp72-keyboard-wedge-interface/c-param-desc-keyboard-wedge-host-parameters/r-param-desc-alternate-numeric-keypad-emulation.html); [Zebra MP72 Keypad Emulation with Leading Zero](https://docs.zebra.com/us/en/scanners/multi-plane/mp72-prg/c-mp72-usb-interface/r-param-desc-keypad-emulation-leading-zero.html) (search extracts)
- Honeywell (Voyager 1250g) has separate "Keyboard Country Layout" and "ALT Mode" settings. ALT Mode is for barcodes that contain extended-ASCII characters, and you scan it after the country code. Its options are 3- or 4-character Alt sequences, and the exact options differ by model. — [Honeywell Voyager 1250g user guide](https://cdn11.bigcommerce.com/s-novopaarpb/content/brochure/h/o/sps-ppr-vg1250-ug.pdf); [manualsdir 1250g p.36–38](https://www.manualsdir.com/manuals/90212/honeywell-voyager-1250g.html?page=38) (search extracts)
- How to tell the layouts apart: two keys right of Ñ, Spain has Ç and Latin America has "}". — [ProVideo Coalition: Spanish keyboard, which of the three layouts](https://www.provideocoalition.com/spanish-keyboard-which-of-the-three-layouts); Windows registers Latin American as keyboard ID 171 — [IBM KBD171](https://public.dhe.ibm.com/software/globalization/keyboards/KBD171.pdf)

### Inferences
**What a US-emulating scanner produces on Spanish layouts**

I worked this out from the standard Windows KBDLA (Latin America) and KBDSP (Spain) layouts. No single source listed it, so verify it on a real PC.

| Barcode has | US key sent | Spanish (Latin America) gives | Spanish (Spain) gives |
|---|---|---|---|
| `-` | Minus | `'` | `'` |
| `_` | Shift+Minus | `?` | `?` |
| `/` | Slash | `-` | `-` |
| `?` | Shift+Slash | `_` | `_` |
| `=` | Equal | `¿` | `¡` |
| `+` | Shift+Equal | `¡` | `¿` |
| `;` / `:` | Semicolon, Shift+Semicolon | `ñ` / `Ñ` | `ñ` / `Ñ` |
| `'` | Quote | `{` | dead key `´` (combines with the next character) |
| `"` | Shift+Quote | `[` | dead key `¨` |
| `[` | BracketLeft | dead key `´` | dead key `` ` `` |
| `]` | BracketRight | `+` | `+` |
| `\` | Backslash | `}` | `ç` |
| `` ` `` | Backquote | `\|` | `º` |
| `@` | Shift+2 | `"` | `"` |
| `#` | Shift+3 | `#` | `·` |
| `&` | Shift+7 | `/` | `/` |
| `*` | Shift+8 | `(` | `(` |
| `(` | Shift+9 | `)` | `)` |
| `)` | Shift+0 | `=` | `=` |
| `.` | Period | `.` | `.` |
| `,` | Comma | `,` | `,` |

Letters A–Z, digits 0–9 and space come out the same on all three layouts.

**Dead keys.** Dead keys swallow or merge with the next character. For example, `'A` on Spain gives `Á`. This can corrupt whole codes, not just one character.

**CapsLock.** A scanner sends "A" as Shift+a. With CapsLock on, Windows inverts the case, so "A-01-1" arrives as "a'01'1". Zebra's "Caps Lock Override" and Honeywell's keyboard-style options exist for this.

**NumLock.** NumLock matters only in Alt+numpad (keypad emulation) mode. With NumLock off, the Alt codes fail.

**Fixes inside miDepo:**
- Use a code charset that is safe on every layout. Shelf codes printed by miDepo are under miDepo's control; letters plus digits are always safe. If "-" stays in the human-readable form, the parser can accept `'` (and `?`/`_` variants) as `-` for shelf-code fields, and upper-case before matching.
  - Example: normalize `A'01'1` → `A-01-1`, and `a-01-1` → `A-01-1`.
  - Better: make the barcode content separator-free or use `.`. Keep "A-01-1" as the printed label text and encode, say, `A.01.1` or `A011` in Code 128. `.` and `,` map the same on US, LatAm and Spain.
- EAN-13/ISBN are digits only and are unaffected by layout.
- Internal Code 128 product codes should use only `[A-Z0-9]`, or `[A-Z0-9.]`.
- For the as-you-type check in `lookup.ts`: if a value matches no record but its layout-normalized form does, accept the normalized form and show a one-line hint once, such as "El lector parece configurado con teclado en inglés".
- `KeyboardEvent.code` remapping (reading `code: "Minus"` as "-" during a detected burst) would also work on Windows. But it is fragile: wrong if the scanner is correctly set to Spanish, and absent or "Unidentified" on some Android paths. Value-level normalization of known substitutions is simpler and testable.

**Fix for users (manual):** scan the "Keyboard country: Spanish (Latin America)" or "Español (Latinoamérica)" configuration barcode from the scanner's manual, matching Windows (`Win+Espacio` shows the active layout). If the model has no such option, use Alt+numpad / "universal" emulation, or add "Inglés (EE. UU.)" as the Windows layout while working. Test by scanning a code with "-" in it.

### Gaps
- I did not find a published per-character table for Spanish layouts with a US-emulating scanner. The table above is derived and needs a 2-minute check on a real Windows PC with each layout.
- I could not read the exact behaviour of Zebra's "Caps Lock Override" or "Keypad Emulation with Leading Zero".
- Whether GS1-128 FNC1/GS (ASCII 29, usually sent as Ctrl+]) survives a Spanish layout is unverified.

## 4. Symbologies a book warehouse needs, scanner defaults, and laser vs CCD vs 2D

### Takeaway
EAN-13 (which carries ISBN-13 with prefix 978/979) and Code 128 are enabled by default on practically every scanner. EAN/UPC add-ons (2- and 5-digit) are **ignored by default** on Zebra, and Zebra's ISBN-10 ("Bookland EAN") conversion is **off by default**. miDepo should therefore match books by EAN-13 alone and treat add-ons as optional. QR and DataMatrix need a 2D area imager. Lasers cannot read phone screens.

### Cited Findings
- Zebra factory defaults:
  - Bookland EAN (ISBN-10 output): Disable.
  - UPC/EAN/JAN supplementals (2- and 5-digit): Ignore.
  - Bookland ISBN format: ISBN-10. Choosing ISBN-13 reports 978/979 as EAN-13.
  - Enabling Bookland also requires setting supplementals to "decode only with supplementals" or "autodiscriminate".
  - — [Zebra SP20 PRG: Bookland EAN](https://docs.zebra.com/us/en/scanners/general/sx20-series/sp20-prg/c-param-desc-symbologies/r-param-desc-bookland-ean.html); [Zebra SM72 defaults](https://docs.zebra.com/us/en/scanners/general/sm72-ig/r-sp72-default-parameters.html); [Zebra DS4678 Bookland EAN](https://docs.zebra.com/us/en/scanners/general/ds4-series/ds4678-prg/symbologies/upc-ean-jan/bookland-ean.html) (search extracts; not the DS2208 PRG itself)
- Books can carry extra add-on barcodes. — [GS1 support: What are the extra add-on barcodes for books?](https://support.gs1.org/support/solutions/articles/43000734089-what-are-the-extra-add-on-barcodes-for-books-)
- Serials use the 977 prefix, ISSN-based, with a 2-digit add-on that usually carries the issue number (for monthlies, often the month). Each issue needs a new barcode. — [Library of Congress: ISSN barcodes](https://www.loc.gov/issn/barcodes.html); [GS1: How is an ISSN used in a GS1 barcode?](https://support.gs1.org/support/solutions/articles/43000734320-how-is-an-issn-used-in-a-gs1-barcode-)
- US comics: UPC-A plus a 5-digit add-on made of issue (3 digits), cover variant (1) and print variant (1). Older comics used a 2-digit add-on. This comes from a single vendor source that says its specs are dated. — [barcode.graphics: UPC barcodes for comic books](https://www.barcode.graphics/?p=24060)
- Laser engines read only linear barcodes and fail on screens because of reflection and glare. Imagers handle damaged labels better. Sources disagree on whether linear CCD imagers read phone screens. 2D area imagers read 1D and 2D codes and are the recommended choice for screens. — [Dynamsoft: laser vs 2D imagers](https://www.dynamsoft.com/blog/insights/laser-barcode-scanners-vs-2d-imagers/); [SEUIC: Laser vs CCD vs 2D imager](https://www.seuic.com/en/news-product/laser-vs-ccd-vs-2d-imager-which-handheld-bar-scanner-is-right-for-you.html); [Datacor: lasers vs imagers](https://www.datacor.com/resources/lasers-vs-imagers)

### Inferences
- **Add-ons.** With add-ons ignored (the default), a comic or periodical reads as its bare 13- or 12-digit code. If someone enables "autodiscriminate", the same item may arrive as 15 or 18 digits, depending on whether the scanner caught the add-on. miDepo's lookup should therefore accept 13 + 2 and 13 + 5 (and 12 + 2, 12 + 5 for UPC-A), split off the add-on, and match on the base code. Per-issue identity for 977 and comics could use the add-on later.
- **UPC-A.** UPC-A arrives as 12 digits from many scanners. Some convert it to EAN-13 with a leading 0. miDepo should normalize: a 12-digit valid UPC-A becomes "0" + UPC-A, the EAN-13 form. Scanners can also be set to drop the check digit or the number-system digit (Honeywell, Zebra), which produces 11-digit values. A lookup check can flag "falta un dígito".
- **ISBN-10.** A scanner with Bookland/ISBN-10 output enabled will send "84-xxx" style 10-character ISBNs, with "X" as a possible check digit. miDepo can convert ISBN-10 to 978-EAN-13 on input.
- **Leading zeros.** These are mostly lost outside the scanner: in spreadsheets, CSV imports and `input type=number`. miDepo should keep codes as strings end to end.
- **QR and DataMatrix.** Only needed if miDepo prints them, for example on shelf labels. A Code 128 shelf label keeps cheap 1D/CCD scanners usable, and that is the likely default hardware in small warehouses.

### Gaps
- I did not confirm Honeywell's or Datalogic's defaults for add-ons and ISBN conversion, or the DS2208-specific PRG defaults.
- I did not confirm whether cheap Chinese scanners (Netum, Eyoyo and similar) enable add-ons by default.

## 5. Brands and models available in Argentina, and how each is configured

### Takeaway
MercadoLibre Argentina and Frávega are dominated by low-cost generic and local-label scanners: Nictom, Tecnoteam, Sker, Nisuta, Dehuka and similar, many of them 2.4 GHz plus Bluetooth with a charging base. Branded Zebra and Honeywell units come through distributors. Every one of them is configured by scanning barcodes in its manual. The big brands also offer PC tools; Zebra's is 123Scan.

### Cited Findings
- Listings found on Argentine retailers:
  - Nictom 8200 USB, at Frávega.
  - Tecnoteam TNT-6800DW and TNT-6100DW, 1D/2D, 2.4G, with a charging base, on MercadoLibre AR.
  - Sker LCB2D-004, a 2D USB and wireless imager, on MercadoLibre AR.
  - Nisuta NSLC922B, 1D/2D over BT, "wifi" and cable, at Frávega for $151.926 without national taxes.
  - Dehuka 1D with a USB receiver, at Frávega for $38.453,07.
  - Generic "8200DW" 2D and "8200LW" laser units with memory.
  - — [Frávega: Nictom 8200](https://www.fravega.com/p/lector-codigo-de-barra-nictom-8200-usb-20024193); [MercadoLibre AR: Tecnoteam TNT-6800DW](https://www.mercadolibre.com.ar/shorts/clips/RQrUUB/lector-codigo-barras-tecnoteam-tnt-6800dw-inalambrico-1d-2d); [MercadoLibre AR: Sker LCB2D-004](https://www.mercadolibre.com.ar/shorts/clips/xRWAdU/lector-codigo-barras-2d-modelo-usb-inalambrico-sker-negro); [Frávega: Nisuta NSLC922B](https://www.fravega.com/p/lector-de-codigo-de-barras-1d-y-2d-via-bt-wifi-y-cable-con-base-nisuta-nslc922b-20459179/); [Frávega: Dehuka](https://www.fravega.com/p/lector-de-codigos-de-barras-inalambrico-con-receptor-usb-color-negro-dehuka-22481180/); [Frávega: 8200LW](https://www.fravega.com/p/lector-escaner-de-codigo-de-barras-inalambrico-usb-scanner-memoria-int-color-negro-tecnologia-laser-modelo-8200lw-22649606/)
- MercadoLibre Argentina has a buyer's guide for wireless and Bluetooth readers. — [MercadoLibre AR blog: lector código barras inalámbrico bluetooth](https://www.mercadolibre.com.ar/blog/lector-codigo-barras-inalambrico-bluetooth/1)
- Gadnic (CODBAR11) and Netum (NT-W6) manuals exist with keyboard-language programming pages. — [Gadnic CODBAR11 manual](https://manualslib.mx/manual/901348/Gadnic-Codbar11.html?page=56); [Netum NT-W6 manual](https://Manualslib.com/manual/1434682/Netum-Nt-W6.html?page=2)
- SATO Argentina hosts a Spanish scanner configuration document. — [SATO Argentina help attachment](https://satoargentina.zendesk.com/hc/es/article_attachments/360042180534)
- Zebra 123Scan is a PC utility that detects scanners and walks through configuration. It stages up to 10 scanners at once, best over a powered USB hub, can generate configuration barcodes to scan from paper, a PC screen or a phone screen, and also upgrades firmware. The latest release notes list version 6.01.0001 (03/2026). — [Zebra DS4678 PRG: 123Scan](https://docs.zebra.com/us/en/scanners/general/ds4-series/ds4678-prg/123scan-and-software-tools/123scan.html); [123Scan release notes](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/release-notes/release-notes-123Scan.pdf)
- The Zebra LS2208 Product Reference Guide (Rev A, Oct 2022) is the reference for its USB keyboard and Enter settings. — [Zebra LS2208 PRG](https://www.zebra.com/content/dam/zebra_new_ia/en-us/manuals/barcode-scanners/ls2208-product-reference-guide-en-us.pdf)
- Zebra publishes a Spanish (Latin America) quick start guide for the DS8108. — [Zebra DS8108 QSG ES-LA](https://www.zebra.com/content/dam/zebra_new_ia/en-us/manuals/barcode-scanners/general/ds8108/ds8108-qsg-esla.pdf)

### Inferences
- Many generic Argentine models with names like "8200", "6800DW" or "6100DW" appear to be rebadged Chinese OEM units of the Netum/Eyoyo type. Their manuals share programming-barcode pages: keyboard language, suffix CR, upload mode (instant vs storage), sleep time, and the pairing modes HID / SPP / BLE. The user guide should tell users to keep the paper manual or find its PDF, because there is no PC tool for these.
- For a recommended purchase, a 2D imager (it reads screens, QR/DataMatrix and damaged labels) with a 2.4 GHz dongle and a base is the cheapest robust choice for a Windows desk. For phones, a Bluetooth HID scanner, or the camera.

### Gaps
- I found no Argentine listings (or no distributor info) for Honeywell Voyager/Xenon, Datalogic QuickScan, Newland, Eyoyo, 3nStar, Hasar or Inateck in this session's searches, and no prices for Zebra or Honeywell.
- I found nothing on Honeywell EZConfig (and its successor tools) or Datalogic Aladdin.

## 6. Common problems and fixes

### Takeaway
Most field problems come down to scanner settings: no Enter suffix, wrong keyboard country, symbology disabled, add-on mode, batch/storage mode, sleep timeout, or the wrong Bluetooth profile. On Android the usual problems are focus and the soft keyboard. A user guide can list each symptom with "escanea este código del manual" style fixes. The app can catch several of these as they happen.

### Cited Findings
- **Enter suffix.** Zebra scanners have an "Add Enter Key (Carriage Return/Line Feed)" parameter in the same Miscellaneous menu as Scan Data Transmission Format, Prefix/Suffix and Tab Key. I could not confirm whether the LS2208 sends Enter by default. — [Zebra SX20: Enter Key](https://docs.zebra.com/us/en/scanners/general/sx20-series/sp20-prg/r-param-desc-enter-key.html); [Zebra DS8 PRG: Scan Data Transmission Format](https://docs.zebra.com/us/en/scanners/general/ds8-series/ds82-prg/c-param-desc-user-preferences-miscellaneous-options/c-param-desc-miscellaneous-scanner-parameters/r-param-desc-scan-data-transmission-format.html) (search extracts)
- **Missing characters in web apps on Android.** Raise the DataWedge inter-character delay. — [Zebra developer forum](https://developer.zebra.com/content/scan-barcode-without-input-stroke)
- **Soft keyboard on Android.** `inputmode="none"` suppresses the keyboard on some devices and browsers but not on others, Zebra devices included, according to forum reports. Oracle WMS ships a setting that disables the virtual keyboard on barcode fields only. Zebra's DataWedge keyboard option is another route. — [freeCodeCamp forum](https://forum.freecodecamp.org/t/react-application-suppress-the-virtual-keyboard-when-barcode-scanner-text-box-active-focused-tablet/637304); [Frappe forum](https://discuss.frappe.io/t/hide-keyboard-popup-on-mobile/143662); [SAP community](https://answers.sap.com/questions/757261/fiori-mobile-disable-keyboard-input.html); [Oracle WMS 25D: Disable Virtual Keyboard for Barcode Scanning](https://docs.oracle.com/en/cloud/saas/readiness/logistics/25d/wms25d/25D-wms-wn-f41823.htm)
- **Focus loss on Zebra Chrome.** After alert(), typed characters do not render until the screen is tapped. — [Zebra developer blog](https://developer.zebra.com/blog/listening-keypress-events-datawedge)
- **Bluetooth.**
  - Scanners sleep, and their manuals have barcodes that change the sleep time.
  - Some Bluetooth devices disconnect when the host sleeps.
  - A Bluetooth HID scanner can hide the on-screen keyboard, on iOS especially. Some scanners toggle it with a double press of the power button.
  - Stale pairings are fixed with the factory-reset barcode and re-pairing.
  - — [Sky Systemz: Bluetooth barcode scanners](https://intercom.help/sky-systemz/en/articles/5790947-bluetooth-barcode-scanners); [Lightspeed: scanner troubleshooting](https://shopkeep-support.lightspeedhq.com/support/troubleshooting/scanner-troubleshooting); [Socket Mobile FAQ](https://socketmobile.com/support/faq); [Square: troubleshoot your barcode scanner](https://squareup.com/help/us/en/article/5516-troubleshoot-your-bar-code-scanner)
- **Wrong characters.** Caused by a layout mismatch; see section 3. — [Morovia](https://www.morovia.com/kb/PRB-Scanned-Data-Incorrectly-Displayed-Computer-10604.html)
- **Barcodes not reading.** Check whether the symbology is disabled, and scan a test barcode. — [Odoo: barcode device troubleshooting](https://www.odoo.com/documentation/saas-18.3/applications/inventory_and_mrp/barcode/setup/device_troubleshooting.html)
- **Premature submit.** An Enter or Tab suffix can submit before the app finishes processing. — [Stewart support](https://stewartsupport.freshdesk.com/support/solutions/articles/43000781492-configuring-honeywell-scanner-settings-for-optimal-performance-step-by-step)

### Inferences

| Symptom (Spanish UI or guide) | Likely cause | App-side mitigation | User fix |
|---|---|---|---|
| The code appears but nothing happens | No Enter suffix | Optionally auto-submit when a burst ends and the value is valid, after about 150 ms of quiet. Otherwise show "Llegó sin Enter" | Scan the "Add Enter/CR suffix" code in the manual |
| `A'01'1`, `?` instead of `_`, `ñ` | US keyboard emulation on a Spanish PC | Normalize shelf codes; use separator-free barcode content | Set the keyboard country to Spanish (LatAm), or Alt mode |
| Lowercase letters | CapsLock on | Upper-case shelf and internal codes before matching | Turn CapsLock off, or use Caps Lock Override |
| 12 or 11 digits, a missing 0 | UPC-A, or check digit or number system not transmitted | Accept UPC-A → EAN-13; warn "falta un dígito" | Enable check digit transmission |
| 15 or 18 digits | Add-on decoded | Strip a 2- or 5-digit add-on | Set supplementals back to Ignore |
| Value scanned twice | Double read, or a repeat on the trigger, or Enter plus Tab suffix | Ignore an identical value within about 500 ms in the same field; ignore Tab right after Enter | Raise "same-code delay" / "reread timeout"; use a single suffix |
| Codes appear all at once later, or not at all | Batch/inventory (storage) mode, or out of range | None possible; warn in the manual | Scan "instant/real-time upload" mode; upload stored data |
| First scan after a pause lost | Bluetooth or 2.4G sleep; first trigger only wakes | None | Raise the sleep timeout; keep within range; charge the battery |
| Phone keyboard covers the screen | Bluetooth HID or the soft keyboard | `inputmode="none"` on scan fields when a hardware scanner is in use (a per-device toggle) | Toggle the keyboard on the scanner (some models: double-press) |
| Scan typed into the wrong field or the address bar | Focus lost | Keep focus on the active scan field; a page-level keydown fallback that routes bursts to the active field | Tap the field before scanning |
| Some barcodes never read | Symbology disabled, or a 1D laser on QR, a screen or a damaged label | Show which formats the labels use | Enable the symbology; use a 2D imager |
| Paired but nothing types | Bluetooth in SPP or BLE mode instead of HID | (Web Serial, if supported) | Scan the "HID / teclado" pairing code, then re-pair |
| Characters missing on a Zebra handheld | Keystroke delivery too fast for Chrome | Do not do heavy work on each keystroke | DataWedge inter-character delay of 6 ms or more |

### Gaps
- I found no vendor-neutral statistics on which problems are most frequent.
- The double-scan timing values above are inference, not vendor defaults.

## 7. Camera scanning in Chrome on Android (and Windows)

### Takeaway
The native `BarcodeDetector` exists in Chrome on Android (it needs Google Play Services), on macOS and on ChromeOS, but **not in Chrome on Windows**. miDepo's ZXing-WASM ponyfill fallback is therefore what Windows laptops actually use. Torch and continuous focus are Android-Chrome-only, and should be applied with `track.applyConstraints({advanced:[...]})` after the stream starts, guarded by `getCapabilities()`.

### Cited Findings
- **Platforms.** Barcode detection is available on macOS, ChromeOS and Android; Android requires Google Play Services. Browser compatibility data says desktop support is ChromeOS and macOS only. A Windows user saw "BarcodeDetector is not defined". A 2019 blink-dev thread noted there was no Windows OS API for barcode detection. — [Chrome Developers: Shape Detection API](https://developer.chrome.com/docs/capabilities/shape-detection); [MDN BCD: BarcodeDetector](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/HEAD/api/BarcodeDetector.json); [blink-dev: Intent to Ship: Barcode Detection API](https://groups.google.com/a/chromium.org/g/blink-dev/c/j-PLtssE5fo/m/budv_U6fCwAJ) (search extracts)
- **Feature detection.** Check `'BarcodeDetector' in window`, then check that `await BarcodeDetector.getSupportedFormats()` includes the formats you need. The method returns a Promise of format strings. Sources disagree on version boundaries (BCD says Chrome Android 83; caniuse lists getSupportedFormats from 147). — [Chrome Developers: Shape Detection](https://developer.chrome.com/docs/capabilities/shape-detection); [caniuse: getSupportedFormats](https://caniuse.com/mdn-api_barcodedetector_getsupportedformats_static)
- **Torch.** It cannot be reliably requested in the initial getUserMedia constraints. Apply it to the running video track with `track.applyConstraints({ advanced: [{ torch: true }] })` inside a try/catch. — [W3C public-webrtc-logs (mediacapture-image #202)](https://lists.w3.org/Archives/Public/public-webrtc-logs/2019Jan/0051.html); [W3C public-webrtc 2022-06](https://lists.w3.org/Archives/Public/public-webrtc/2022Jun/0000.html)
- **Focus.** `focusMode` (continuous or manual) and `focusDistance` work on Chrome for Android but not on desktop Chrome or iOS Safari. Some devices reject certain constraint forms. — [Dynamsoft: camera focus control on web](https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html); [Stack Overflow via kiwix](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/68912208/use-the-focusmode-constraint-to-get-required-media-device)
- **Resolution.** `applyConstraints()` rejects if exact constraints cannot be met. Use ideal values. — [MDN: Capabilities, constraints, and settings](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints)

### Inferences
- Request `facingMode: {ideal: "environment"}` and `width: {ideal: 1280}`, `height: {ideal: 720}`. 720p is usually enough for EAN-13 and keeps per-frame decode fast. Then read `track.getCapabilities()` and show a torch button only if `torch` is present. Set `focusMode: "continuous"` if it is listed.
- Decode a center crop, throttle to about 10–15 fps, and stop on the first valid result. Validate the EAN-13 check digit before accepting it, to filter partial reads.
- Narrow the format list per field: `ean_13`, `upc_a` and `code_128` for products, `code_128` for shelves. Fewer formats means fewer false positives and faster decoding.
- miDepo's current list (`ean_13, ean_8, code_128, code_39, upc_a, qr_code` in `src/components/Camera.tsx`) is reasonable. Add-ons are not decoded by BarcodeDetector's standard format list, so the camera returns only the base code.
- BarcodeDetector is unavailable in Android WebView without Play Services, and on some de-Googled rugged devices. The ZXing fallback covers those.

### Gaps
- I could not confirm whether BarcodeDetector on Android decodes EAN add-ons, or its exact format list on current Play Services.

## 8. Other floor hardware (brief)

### Takeaway
USB scales usually expose the HID Scale page (0x8D) and can be read through WebHID with a vendor or usage-page filter. Serial scales and many receipt printers can be reached through Web Serial on desktop. Label applicators and RFID are out of scope.

### Cited Findings
- **Dymo scales.** Dymo's M10/M25 postal scales report usage page 0x8D, usage 0x20, vendor ID 0x0922. A community guide gives the input report layout:
  - report ID
  - status
  - unit (3 = kg, 11 = oz, 12 = lb)
  - signed power-of-ten scaling
  - weight LSB, then MSB
  - — [Antradar: Dymo USB scale interface specs](https://new.antradar.com/blog-dymo-usb-scale-interface-specs); [gist: tresf USB scale](https://gist.github.com/tresf/898ab2d4d259aef2d4f7)
- **Zeroing over WebHID.** Sending output report 2 to zero a Dymo scale was accepted but had no effect, and the question went unanswered. Some vendors misreport the usage page, so filtering by vendor ID can be needed. — [Stack Overflow: zero a USB scale using WebHID](https://kiwix.lema.org/stackoverflow_en_all_2023-11/questions/66972686/how-do-i-zero-a-usb-scale-using-webhid); [github.com/dunmatt/weighty](https://github.com/dunmatt/weighty)
- **The POS usage tables.** The HID POS usage tables cover barcode scanners and scales. — [USB-IF HUT](https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf)
- **Web Serial.** Web Serial covers serial-port devices on desktop Chrome, and Bluetooth SPP on Android. — [Chrome blog: Serial over Bluetooth](https://developer.chrome.com/blog/serial-over-bluetooth)

### Inferences
- **Receipt and label printers.** These are better handled through the OS print dialog. miDepo already has A4 print layouts. Web Serial or WebUSB ESC/POS printing is possible but needs per-model work.
- **Label applicators and RFID.** Out of scope for a small book warehouse.

### Gaps
- I did not research shipping or postal scales sold in Argentina, or serial scale protocols, for example from Systel or Kretz.
