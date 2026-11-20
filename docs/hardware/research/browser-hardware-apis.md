# Browser hardware APIs for label printers and warehouse devices (Chrome on Windows and Android, Nov 2026)

Research note on sources and method: this session's network reached only GitHub (raw files) and a web search engine. developer.chrome.com, web.dev, wicg.github.io, chromestatus.com, groups.google.com, MDN and docs.zebra.com could not be fetched directly. So the primary sources here are the spec sources on GitHub (WICG `index.bs` files), the Chromium source mirror on GitHub (policy definitions, `runtime_enabled_features.json5`, permissions-policy features, HID protection code), MDN's browser-compat-data JSON, the Zebra ISV sample repo, and npm registry metadata. Search-engine summaries of Chrome release notes and forum threads are marked as such. Chromium `main` was at version 160.0.8173 when read ([chrome/VERSION](https://github.com/chromium/chromium/blob/main/chrome/VERSION)), so anything read from `main` can be ahead of Stable.

## WebUSB: support, filters, claiming, the Windows driver problem, Android

### Takeaway
WebUSB has shipped since Chrome 61 on desktop, Android included. The USB printer class (0x07) is **not** a protected class, so a label printer can be claimed. On Android and ChromeOS this generally works over OTG. On Windows the inbox `usbprint.sys` print driver owns the device and `open()`/`claimInterface()` fails with "Access denied". The only fixes are to rebind the device to WinUSB (Zadig, or an INF) or to use firmware that declares WinUSB through Microsoft OS descriptors. Either way, the Windows printer queue and WebUSB are mutually exclusive on the same machine.

### Cited Findings
- **Support:** `navigator.usb`, `requestDevice`, `getDevices` and `connect`/`disconnect` events arrived in Chrome 61. Chrome Android "mirrors" desktop (same version); Edge also mirrors Chrome. WebUSB also works in dedicated workers (Chrome 70) and extension service workers (Chrome 118), but not in shared workers or normal service workers — [MDN browser-compat-data api/USB.json](https://github.com/mdn/browser-compat-data/blob/main/api/USB.json)
- The `WebUSB` runtime feature is `status: "stable"` in Chromium `main` — [runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)
- **Protected interface classes** per the spec: 0x01 Audio, 0x03 HID, 0x08 Mass Storage, 0x09 Hub, 0x0B Smart Card, 0x0E Video, 0x10 Audio/Video, 0xE0 Wireless Controller. When an interface has a protected class, `isProtectedClass` is set and claiming it is refused. **0x07 (Printer) is not on the list** — [WICG WebUSB spec source, index.bs §"has a protected interface class"](https://github.com/WICG/webusb/blob/main/index.bs)
- A Chromium intent thread describes the same list (Audio, HID, Mass Storage, Smart Card, Video, Audio/Video, Wireless Controller), with Printer absent. This comes from a search summary — [blink-dev: Intent to Implement and Ship: WebUSB Interface Class Filtering](https://groups.google.com/a/chromium.org/g/blink-dev/c/LZXocaeCwDw)
- Blocklisted devices are removed from `requestDevice`/`getDevices` results. The blocklist is published at `https://raw.githubusercontent.com/WICG/webusb/main/blocklist.txt` — [WebUSB index.bs §The USB Blocklist](https://github.com/WICG/webusb/blob/main/index.bs)
- The `"usb-unrestricted"` permissions-policy feature lifts both the blocklist and protected-class limits, but only for **Isolated Web Apps** that declare it in their manifest. For ordinary sites the effective default allowlist is `none`, so it cannot help a Vercel-hosted app — [WebUSB index.bs §Permissions Policy](https://github.com/WICG/webusb/blob/main/index.bs); see also [Intent to Ship: Unrestricted WebUSB (IWA only)](https://groups.google.com/a/chromium.org/g/blink-dev/c/hXgwRCYta-k/m/NsLkciF1BwAJ)
- **Calling conventions:** `requestDevice` needs transient activation (a user gesture), and the API is `[SecureContext]` only (HTTPS) — [WebUSB index.bs](https://github.com/WICG/webusb/blob/main/index.bs)
- **Windows failure mode:** Zebra, receipt-printer and LP2844 users report `DOMException: Access denied` on `open()` or `claimInterface()` in Windows 10/11, in both Chrome and Edge. The accepted explanation is that the OS print driver has already claimed the device. One Zebra-forum developer said "Zadig is not viable for our customer base" — [Zebra developer forum: DOMException failed to execute open on USBDevice: Access denied](https://developer.zebra.com/content/domexception-failed-execute-open-usbdevice-access-denied); [SO 49078873 (LP2844, Windows 10)](https://windows-hexerror.linestarve.com/q/so49078873-windows-10-webusb-printing-issues-with-zebra-lp2844-domexception-access-denied); [SO 47143148](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/47143148/webusb-access-denied-trying-to-open-printer-on-windows) (search summaries)
- The point-of-sale library author states it directly: "On most platforms you can directly talk to USB connected receipt printers using WebUSB. The main exception to this is on Windows where the printer driver exclusively claims the printer." The suggested workaround is to let the driver create a virtual serial port and use Web Serial instead. This does **not** work for Star printers, whose virtual COM port is incompatible with Web Serial — [at-point-of-sale/WebUSBReceiptPrinter README](https://github.com/at-point-of-sale/WebUSBReceiptPrinter/blob/main/README.md)
- **WebZLP's documented Windows fix:** use Zadig, choose Options → List All Devices, select the printer (it may show under another name, e.g. "TLP2844"), confirm the change is "replacing the `usbprint` driver with the `WinUSB` driver", then Replace Driver. Expect a red "driver isn't trusted" warning, because Zadig generates a self-signed driver on the fly; some Windows settings must be changed to allow it. The doc also recommends ChromeOS, Linux, macOS or Android over Windows — [WebZLP docs/windows_driver.md](https://github.com/Cellivar/WebZLP/blob/main/docs/windows_driver.md); [Zadig wiki](https://github.com/pbatard/libwdi/wiki/Zadig)
- Mixed results with Zadig are reported. Some users still got `claimInterface` errors afterwards; one LP2844 user succeeded only with a hand-written WinUSB INF. Windows can roll a Zadig driver back after a reboot or replug — [chromium webusb group: WebUSB windows issues](https://groups.google.com/a/chromium.org/g/webusb/c/qmbqfPNj97A); [thermal-label.github.io: Connecting your printer](https://thermal-label.github.io/connecting) (search summaries)
- **Driver-less WinUSB from firmware:** Microsoft says a device is identified as WinUSB only if its firmware has Microsoft OS descriptors with a compatibleID of `WINUSB`. On a composite device, each function section needs it. MS OS 2.0 descriptors fix the reliability problems of 1.0 — [Microsoft: Automatic installation of WinUSB](https://learn.microsoft.com/windows-hardware/drivers/usbcon/automatic-installation-of-winusb); [Microsoft: Building USB devices for Windows](https://learn.microsoft.com/en-us/windows-hardware/drivers/usbcon/building-usb-devices-for-windows). A community WebUSB guide adds that MS OS 2.0 needs bcdUSB ≥ 0x0201 and that "on Windows, WebUSB depends on WinUSB" — [xiongyihui/webusb](https://www.github.com/xiongyihui/webusb) (search summary). Google's own article on this is [Build a device to take full advantage of the WebUSB API](https://developer.chrome.com/docs/capabilities/build-for-webusb) (not fetched)
- Microsoft's UWP `Windows.Devices.Usb` API also refuses printer-class (0x07) devices. This shows that Windows reserves printers for its print stack — [Windows.Devices.Usb namespace](https://learn.microsoft.com/en-us/uwp/api/windows.devices.usb) (search summary)
- **Vendor IDs**, checked in the usb.ids database: Zebra Technologies `0x0A5F`; TSC Auto ID `0x1203`; Datamax-O'Neil `0x0B0B` (now Honeywell); Honeywell, Inc. `0x10AC`; Intermec `0x067E` (now Honeywell); Hand Held Products/Welch Allyn `0x0536` and Metrologic `0x0C2E` (Honeywell scanners); Sato `0x0828`; Brother `0x04F9`; Dymo-CoStar `0x0922`; Bixolon `0x1504`; Toshiba TEC `0x08A6`; Citizen `0x1343` (Citizen Systems) and `0x08BD`; Seiko Epson `0x04B8`; SNBC `0x154F`; Symbol (Zebra scanners) `0x05E0`. USB-serial bridges: WCH/QinHeng `0x1A86`, Prolific `0x067B`, FTDI `0x0403`, Silicon Labs `0x10C4` — [systemd hwdb usb.ids](https://github.com/systemd/systemd/blob/main/hwdb.d/usb.ids)
- **Not in usb.ids:** Godex (commonly `0x195F`) and Argox (`0x1664`). Generic Chinese "Xprinter"-class devices usually enumerate with chip-vendor IDs such as STMicro `0x0483`, Winbond `0x0416` or NXP `0x1FC9` rather than a brand VID — [usb.ids](https://github.com/systemd/systemd/blob/main/hwdb.d/usb.ids) (absence checked; the Godex, Argox and Xprinter mappings are not verified)

### Inferences
- **Code pattern:**
  - Call `navigator.usb.requestDevice({filters:[{vendorId:0x0A5F},{vendorId:0x1203},{classCode:0x07}, …]})`. A class filter on 0x07 catches unknown brands.
  - Then `open()` → `selectConfiguration(1)` if `configuration` is null → find the interface with class 0x07 (or 0xFF vendor-specific) → `claimInterface(n)`.
  - Write with `transferOut(outEndpoint, bytes)` to the bulk OUT endpoint, taken from `alternate.endpoints` where `direction === "out" && type === "bulk"`.
  - Read status with `transferIn(inEndpoint, 64…512)` after sending a query: ZPL `~HS` or `! U1 getvar`, TSPL `<ESC>!?`, ESC/POS `DLE EOT`. Bidirectional printer-class interfaces (protocol 0x02) have a bulk IN endpoint; unidirectional ones (protocol 0x01) do not.
  - This is standard USB printer-class behaviour, not taken from a source fetched here.
- On Windows the practical consequence is binary per machine. Either the printer has a Windows queue (usbprint, usable from the print dialog and ZebraDesigner) or it is bound to WinUSB (usable from WebUSB only). A WMS for small warehouses should treat "WebUSB on Windows" as an opt-in, admin-performed setup step, and default Windows users to the print-dialog route or to Web Serial over a virtual COM port.
- Android: Android has no kernel printer driver claiming USB printers, so Chrome's own Android USB permission prompt grants access. This is consistent with WebZLP and the point-of-sale libraries saying Android works. A USB-OTG adapter is needed, and the printer needs its own power.

### Gaps
- Could not fetch Chrome's own WebUSB article or chromestatus to confirm any 2025–2026 change to the Windows behaviour. Nothing found suggests Chrome can now share a usbprint-owned device.
- Zebra's official stance on WebUSB (docs.zebra.com) was not reachable. Zebra's supported browser route has historically been the installed "Browser Print" agent (the [zebra-browser-print-wrapper](https://www.npmjs.com/package/zebra-browser-print-wrapper) npm package wraps it; last published 2021).
- Godex, Xprinter, Argox and Honeywell desktop-printer (PC42/PC43) product VIDs are unverified. Each needs checking against a real device or the vendor's INF.

## Web Serial: desktop, Android (USB and Bluetooth RFCOMM), virtual COM ports

### Takeaway
Web Serial has been stable on desktop since Chrome 89. On Android it shipped first for Bluetooth RFCOMM (SPP) only, in Chrome 138, then generally in Chrome 148 (stable May 5, 2026). Wired USB-serial ports on Android appear only on devices whose Android build exposes them, and the intent thread ties that to Android 17. On Windows, any USB-CDC or USB-serial printer, a printer driver's virtual COM port, or a paired Bluetooth Classic SPP printer that Windows maps to a COM port can be opened with Web Serial.

### Cited Findings
- **Support:** Chrome desktop 89 for `getPorts` and `requestPort`. Chrome Android 138 is partial: "Serial ports are only available if they're provided by Bluetooth RFCOMM serial port emulation". Chrome Android 148 has full support. Edge mirrors Chrome — [MDN browser-compat-data api/Serial.json](https://github.com/mdn/browser-compat-data/blob/main/api/Serial.json)
- Chrome 148 release notes: "Web Serial API on Android … Now it is supported on Android". Chrome 148 Stable shipped May 5, 2026, with Beta on April 8, 2026 (search summary) — [Chrome 148 release notes](https://developer.chrome.com/release-notes/148); [Notebookcheck: Chrome 148 Beta for Android adds Web Serial](https://www.notebookcheck.net/Chrome-148-Beta-for-Android-adds-Web-Serial-SharedWorker-support.1269721.0.html)
- The Intent to Ship (March 2026), per a search summary, says the platform API is "available on Android 17 this year". All Android devices have the API, but "only devices configured to expose wired serial ports will return non-empty lists", and others always return empty lists — [blink-dev: Intent to Ship: Web Serial API on Android](https://groups.google.com/a/chromium.org/g/blink-dev/c/HBJ-uYFvkpM)
- The earlier Android Bluetooth launch said `SerialAllowUsbDevicesForUrls` would come later, once Android supports wired serial at system level — [blink-dev: Intent to Ship: Web serial over Bluetooth on Android](https://groups.google.com/a/chromium.org/g/blink-dev/c/BqUGCcurReE) (search summary). Consistent with this, the policy definition still lists `android` under `future_on` and `supported_on: chrome.*:94-` — [SerialAllowUsbDevicesForUrls.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/SerialAllowUsbDevicesForUrls.yaml). `DefaultSerialGuardSetting` is supported on `android:140-` — [DefaultSerialGuardSetting.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/DefaultSerialGuardSetting.yaml)
- **Filters:** a `SerialPortFilter` takes `usbVendorId`, `usbProductId` (requires `usbVendorId`) or `bluetoothServiceClassId`. `requestPort` options include `allowedBluetoothServiceClassIds` for non-standard RFCOMM service UUIDs. It requires transient activation and the `serial` permissions-policy feature — [WICG serial index.bs](https://github.com/WICG/serial/blob/main/index.bs)
- Desktop Bluetooth RFCOMM support in Web Serial had its own intent — [blink-dev: Intent to Ship: Web Serial support for Bluetooth RFCOMM services](https://groups.google.com/a/chromium.org/g/blink-dev/c/P4YwDCcvdvs) (version not fetched)
- The `SerialPortConnected` runtime feature (the `port.connected` attribute and RFCOMM connection events) is enabled on Android and "experimental" elsewhere in `main` — [runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5); [blink-dev: Intent to Ship: Web Serial: connected attribute and RFCOMM connection events](https://groups.google.com/a/chromium.org/g/blink-dev/c/KPN62vo5Pp4)
- WebSerialReceiptPrinter is meant for "a printer connected using a serial port, or … any other way where the driver sets up a virtual serial port". It takes a `baudRate` option (e.g. 9600) and reconnects by USB vendor and product ID, which are null when not available — [NielsLeenheer/WebSerialReceiptPrinter README](https://github.com/NielsLeenheer/WebSerialReceiptPrinter/blob/master/README.md)

### Inferences
- On Windows, Web Serial avoids the usbprint conflict when the printer exposes a USB CDC-ACM interface. Many TSC, Xprinter and Godex models do, or the vendor driver can add a virtual COM port. A Bluetooth Classic printer paired in Windows settings gets "Standard Serial over Bluetooth link" COM ports, which Chrome lists as serial ports.
- On Android 2026, Bluetooth Classic SPP label printers (most mobile Zebra ZQ, TSC Alpha, cheap Chinese models) are reachable through Web Serial with `{bluetoothServiceClassId: "00001101-0000-1000-8000-00805f9b34fb"}`, the standard SPP UUID. That UUID is general Bluetooth knowledge, not from a fetched source. Wired USB-serial printers on Android should be considered unavailable unless the phone runs Android 17 and exposes ports.
- Serial gives a raw byte stream, so status read-back depends on the printer echoing replies (ZPL `~HS`, TSPL `?`) on the same port.

### Gaps
- No primary source confirms which Android 17 devices expose wired serial ports, or whether `SerialAllowUsbDevicesForUrls` has moved to `supported_on: android` in Stable.
- The Chrome desktop version that added Bluetooth RFCOMM to Web Serial could not be confirmed (believed to be 117, unverified).

## Web Bluetooth: BLE printers, Zebra Parser Service, chunking, support

### Takeaway
Web Bluetooth is GATT, meaning Bluetooth Low Energy only; Classic SPP goes through Web Serial instead. It is supported on Chrome Android (56) and Chrome Windows (70). Zebra ZQ300/ZQ500, ZD400/ZD600 and ZT600 printers expose the "Zebra Parser Service" over BLE. ZPL must be written in small chunks with pacing, and persistent permissions (`bluetooth.getDevices()`) are still behind a flag.

### Cited Findings
- **Support:** Chrome Android 56. Desktop: macOS from 56, Chrome 70 broadly ("Linux support is not enabled by default"), so Windows from 70. `getAvailability` arrived in 78. `getDevices` is Chrome 85 **behind `#enable-experimental-web-platform-features`**. Edge mirrors Chrome — [MDN browser-compat-data api/Bluetooth.json](https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json)
- `WebBluetoothGetDevices` and `WebBluetoothWatchAdvertisements` are still `status: "experimental"` in Chromium `main`. `WebBluetoothMaxWriteWithoutResponseSize` is `stable` — [runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)
- **Zebra BLE:** ZQ300 & ZQ500 mobile, ZD400 & ZD600 desktop and ZT600 industrial printers "have both Bluetooth Classic and Low Energy (LE)". BLE mode is checked with `! U1 getvar "bluetooth.le.controller_mode"` and enabled with `setvar … "le"` or `"both"`. The services are Device Information `0x180A` and the Parser Service `38eb4a80-c570-11e3-9507-0002a5d5c51b`, which has characteristics "From Printer Data" `38EB4A81-…` (read/notify) and "To Printer Data" `38EB4A82-…` (write). "These services cannot be discovered unless the central device has connected to the printer." Writes must be chunked: the default is 20 bytes and the sample uses 300 bytes with a 250 ms delay between chunks on Android. The source is Zebra's "Link-OS Environment Bluetooth Low Energy AppNote" — [ZebraISV Zebra-Printer-Samples, WeChatPrintDemo README](https://github.com/ZebraISV/Zebra-Printer-Samples-master/blob/master/WeChat-MiniProgram-Samples/WeChatPrintDemo/README.md); [Zebra AppNote-BlueToothLE-v4.pdf](https://www.zebra.com/content/dam/zebra/software/en/application-notes/AppNote-BlueToothLE-v4.pdf) (not fetched)
- The same UUIDs appear in independent code: a Zebra printer emulator, a React Native plugin and Rock check-in — [cabal95/Zemulator ZPrinterLEConstants.cs](https://github.com/cabal95/Zemulator); [GeekyAnts/react-native-zebra-bluetooth-printer](https://github.com/GeekyAnts/react-native-zebra-bluetooth-printer)
- **Cheap BLE printers:** WebBluetoothReceiptPrinter supports "cat"/"Meow" BLE printers (GB01, GB02, GB03, GT01, MX05, MX06; not MXW01 or newer). Raw data is "chunked into writes of 200 bytes with a short pause between them" — [at-point-of-sale/WebBluetoothReceiptPrinter README](https://github.com/at-point-of-sale/WebBluetoothReceiptPrinter/blob/main/README.md)
- **GATT blocklist:** it excludes HID-over-GATT `0x1812`, among others. Generic vendor services such as `0xFFF0`-family are not blanket-blocked, though `0xFFF9`, `0xFFFD` and `0xFDE2` are listed — [WebBluetoothCG registries gatt_blocklist.txt](https://github.com/WebBluetoothCG/registries/blob/master/gatt_blocklist.txt)
- The `bluetooth` permissions-policy feature exists in Chromium (`depends_on: WebBluetooth`) — [permissions_policy_features.json5](https://github.com/chromium/chromium/blob/main/services/network/public/cpp/permissions_policy/permissions_policy_features.json5)

### Inferences
- **Request pattern:** `navigator.bluetooth.requestDevice({filters:[{namePrefix:"ZQ"},{namePrefix:"ZD"},{services:[ZEBRA_PARSER]}], optionalServices:[ZEBRA_PARSER, 0x180a, 0xff00, 0xfff0, 0x18f0, 0xe7810a71-…]})`. Every service UUID the code will touch must appear in `filters` or `optionalServices`, otherwise `getPrimaryService` throws. Because Zebra services are only discoverable after connecting, filter on name prefix and list the Parser Service in `optionalServices`.
  - The other UUIDs are commonly seen on cheap Chinese printers: `0xFF00`, `0xFFF0` (Meow), `0x18F0`, and `e7810a71-73ae-499d-8c15-faa9aef0c3f2` (Xprinter and others). These come from general knowledge and are not verified here.
- **Chunking:** use `writeValueWithoutResponse` in chunks no larger than MTU−3. Web Bluetooth does not expose the negotiated MTU, so start with 20 to 180 bytes and pace the writes, or use `writeValueWithResponse` for flow control.
- Without `getDevices()` in Stable, a BLE printer needs a fresh chooser on every page load or session unless the user enables the flag. This makes BLE the weakest option for a "connected devices" panel.

### Gaps
- No primary source fetched on Windows-specific Web Bluetooth limits, such as needing to pair in Windows settings first, or on behaviour on Windows 10 versus 11.
- Which TSC, Xprinter and Brother label models expose BLE GATT, and their UUIDs, was not verified.

## WebHID: HID-POS scanners, blocklist, Android

### Takeaway
WebHID has been stable on Chrome desktop since 89 and is not shipped on Chrome Android according to MDN data. Chromium's enterprise policy files now list `android:155-`, which suggests an Android launch around Chrome 155, but this is unverified. Keyboard usage pages are always protected, so a barcode scanner in keyboard-wedge mode is unreachable through WebHID. Scanners must be switched to HID-POS (usage page 0x8C) or vendor mode.

### Cited Findings
- WebHID: Chrome 89 desktop; `chrome_android: false`; Edge mirrors Chrome — [MDN browser-compat-data api/HID.json](https://github.com/mdn/browser-compat-data/blob/main/api/HID.json)
- `DefaultWebHidGuardSetting` has `supported_on: chrome.*:100-, chrome_os:100-, android:155-`, and `WebHidAllowDevicesForUrls` likewise lists `android:155-` — [DefaultWebHidGuardSetting.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/DefaultWebHidGuardSetting.yaml); [WebHidAllowDevicesForUrls.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/WebHidAllowDevicesForUrls.yaml)
- **Always-protected HID usages** (`IsAlwaysProtected`):
  - the whole Keyboard usage page;
  - Generic Desktop Pointer, Mouse, Keyboard and Keypad (input and output reports; feature reports are allowed);
  - Generic Desktop System Control through System Warm Restart, and System Dock through System Display Swap.
  - Everything else, including the POS barcode scanner page, is not protected by this rule — [chromium services/device/public/cpp/hid/hid_report_utils.cc](https://github.com/chromium/chromium/blob/main/services/device/public/cpp/hid/hid_report_utils.cc)
- There is also a static device blocklist, `kStaticEntries` in `hid_blocklist.cc`, plus the spec blocklist at `hid.spec.whatwg.org/blocklist.txt` — [hid_blocklist.cc](https://github.com/chromium/chromium/blob/main/services/device/public/cpp/hid/hid_blocklist.cc); [WICG webhid index.bs](https://github.com/WICG/webhid/blob/main/index.bs)
- WebHID needs transient activation for `requestDevice`, and the permissions-policy feature `hid` — [WICG webhid index.bs](https://github.com/WICG/webhid/blob/main/index.bs); [permissions_policy_features.json5](https://github.com/chromium/chromium/blob/main/services/network/public/cpp/permissions_policy/permissions_policy_features.json5)

### Inferences
- For miDepo, keyboard-wedge scanning into the existing `ScanForm` needs no API and works everywhere. WebHID only adds value for scanners set to HID-POS mode, which gives raw symbology data without focus problems, and only on desktop until Android ships.

### Gaps
- No release note confirming that WebHID on Android has reached Stable. The `android:155-` policy entries were read from `main` (Chrome 160 trunk).

## Persistence, detection and permissions: building a "connected devices" panel

### Takeaway
WebUSB (`usb.getDevices()`) and Web Serial (`serial.getPorts()`) return previously granted devices without a user gesture, and fire `connect`/`disconnect` events. That is enough for a live "connected devices" panel. Web Bluetooth `getDevices()` is still flag-only. The first grant always needs a click (chooser). Enterprise policies can pre-grant USB devices by VID/PID to the app's origin on Windows and Android, and serial devices on desktop only. Everything requires HTTPS. A cross-origin iframe needs an explicit `allow="usb; serial; bluetooth; hid"` delegation.

### Cited Findings
- `getDevices` and the `connect`/`disconnect` events for USB date from Chrome 61; serial `getPorts` from 89 (Android 138); HID `getDevices` and `connect`/`disconnect` from 89. Bluetooth `getDevices` is flag-only — [MDN BCD USB.json](https://github.com/mdn/browser-compat-data/blob/main/api/USB.json), [Serial.json](https://github.com/mdn/browser-compat-data/blob/main/api/Serial.json), [HID.json](https://github.com/mdn/browser-compat-data/blob/main/api/HID.json), [Bluetooth.json](https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json)
- The permissions-policy feature names in Chromium are `usb`, `usb-unrestricted`, `serial`, `hid` and `bluetooth`. The WebUSB spec gives `usb` a default allowlist of `["self"]`, so top-level same-origin documents work without a header. Cross-origin iframes need delegation — [permissions_policy_features.json5](https://github.com/chromium/chromium/blob/main/services/network/public/cpp/permissions_policy/permissions_policy_features.json5); [WebUSB index.bs §Permissions Policy](https://github.com/WICG/webusb/blob/main/index.bs)
- **`WebUsbAllowDevicesForUrls`:** automatically grants listed URL patterns access to USB devices by `vendor_id` and optional `product_id` (omitting the product ID matches the whole vendor). The grant is to the top-level origin; "If embedded frames need to access USB devices, the 'usb' feature-policy header should be used". It overrides `DefaultWebUsbGuardSetting`, `WebUsbAskForUrls`, `WebUsbBlockedForUrls` and user preferences. Supported on `chrome.*:74-`, `chrome_os:74-` and **`android:75-`**, with dynamic refresh. Policy IDs are decimal, e.g. Zebra = 2655 — [WebUsbAllowDevicesForUrls.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/WebUsbAllowDevicesForUrls.yaml)
- `DefaultWebUsbGuardSetting` (`BlockWebUsb` = 2, Ask = 3) is supported on desktop, ChromeOS and Android 67+. `WebUsbBlockedForUrls` is supported on Android 68+ — [DefaultWebUsbGuardSetting.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/DefaultWebUsbGuardSetting.yaml); [WebUsbBlockedForUrls.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/WebUsbBlockedForUrls.yaml)
- `SerialAllowUsbDevicesForUrls` grants USB serial devices by VID/PID; only the URL origin is considered. Supported on desktop from Chrome 94, Android is "future" — [SerialAllowUsbDevicesForUrls.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/SerialAllowUsbDevicesForUrls.yaml)
- WebUSBReceiptPrinter's `reconnect(lastUsedDevice)` takes serial number, vendor ID and product ID, and "will do nothing" if no previously connected printer matches. `connect()` "must be called as the result of an user action … You cannot call this function on page load" — [WebUSBReceiptPrinter README](https://github.com/at-point-of-sale/WebUSBReceiptPrinter/blob/main/README.md)

### Inferences
- **Panel design:**
  - On load, call `navigator.usb.getDevices()` and `navigator.serial.getPorts()`. Use feature detection (`"usb" in navigator`, `"serial" in navigator`) and hide the device types the platform lacks. Show each device with `productName`, `manufacturerName` and `serialNumber` (USB) or `getInfo()` (serial: VIDs, or `bluetoothServiceClassId`).
  - Listen to `connect`/`disconnect` to update status live. Offer "Add device" buttons that open the choosers, and `device.forget()` / `port.forget()` for removal.
  - Store the user's chosen default printer as VID/PID/serial in miDepo's database per device, not as a handle.
  - Bluetooth must show as "tap to reconnect".
- Installed PWA versus tab: no source found saying permissions differ. Grants are per origin, so an installed PWA on the same origin should share them. This is unverified.
- These APIs live in `window` and dedicated workers only (USB in dedicated workers since 70). A Next.js app must call them from client components after user events, never in server components or service workers.

### Gaps
- PWA-specific behaviour (permission persistence, any auto-grant for installed apps) was not found in fetched sources.
- Whether Chrome desktop yet has persistent grants for serial ports without a USB serial number (e.g. Bluetooth COM ports) was not verified.

## System print dialog route: @page sizing, driver paper sizes, silent printing, Android print services

### Takeaway
Printing HTML or PDF at label size works everywhere, but CSS `@page { size: 100mm 150mm; margin: 0 }` only sets the document's page size. The printer still needs matching media, and on Windows the driver has to offer a paper size of that dimension, or Chrome scales or clips. Silent printing to the default printer exists via `--kiosk-printing` or the `SilentPrintingEnabled` policy, using the default printer's default settings. On Android, Chrome prints through Android print services (Mopria built in; vendor plugins), and suitability for thermal labels depends on the plugin.

### Cited Findings
- **Silent printing:** Chromium's code defines `kKioskModePrinting = "kiosk-printing"`, and `SilentPrintingEnabled()` "checks if silent printing is enabled via the --kiosk-printing command line flag or the SilentPrintingEnabled policy, which immediately closes the print preview dialog and prints to the default printer with default options" — [chrome_switches.h](https://github.com/chromium/chromium/blob/main/chrome/common/chrome_switches.h); [print_preview_utils.h](https://github.com/chromium/chromium/blob/main/chrome/browser/ui/webui/print_preview/print_preview_utils.h)
- A policy page says `SilentPrintingEnabled` is "supported on Windows from version 144". That is a search summary of a Samsung Internet policy mirror, so its version is unverified for Chrome — [developer.samsung.com: silent-printing-enabled](https://developer.samsung.com/browser/policy/silent-printing-enabled.html)
- `PrintingPaperSizeDefault` (Chrome 84+, desktop and ChromeOS; not Android) sets the default paper in print preview by name or `custom` with `custom_size` width and height in **micrometers** (e.g. 100 mm = 100000) — [PrintingPaperSizeDefault.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/Printing/PrintingPaperSizeDefault.yaml)
- **Limits of kiosk printing:** every job goes to the single default printer with default settings, which is a problem when label and A4 printers coexist (Chromium dev thread). Users report margins resetting and Chrome reverting the default paper to A4 after updates; the Jamf admins' workaround was the OS dialog — [chromium-dev: Having chrome auto print without setup options](https://groups.google.com/a/chromium.org/g/chromium-dev/c/f_VXrJAd_D0); [Jamf community: Set default page size for Google Chrome](https://community.jamf.com/t5/jamf-pro/set-default-page-size-for-google-chrome/m-p/154223); [crbug 40783463](https://issues.chromium.org/40783463) (search summaries)
- **Practical label guidance:**
  - Shipping-label vendors tell Windows users to pick paper size "4x6" or "100x150mm" under More settings, and say most failures are a paper-size mismatch — [Pirate Ship: Windows 4x6 label printer](https://support.pirateship.com/en/articles/2610080-windows-how-to-print-with-a-4x6-label-printer)
  - CSS `@page size` "won't actually put that size of paper into your printer's feed tray", and the printable box is the `@page` size minus margins — [voussoir.net: CSS for printing to paper](https://voussoir.net/writing/css_for_printing)
  - All of the above are search summaries.
- **Android:**
  - Most Android devices ship a Mopria-based print service, and the Default Print Service uses Mopria core technology — [mopria.org: Print from Android](https://mopria.org/how-to-print)
  - Zebra ships an Android Printer Setup Utility (guide updated January 2026) and a free "Zebra Print" app for label jobs — [Zebra Printer Setup Utility for Android docs](https://docs.zebra.com/us/en/printers/software/mpsu-android.html); [Zebra blog 2024](https://www.zebra.com/gb/en/blog/posts/2024/free-app-makes-it-easy-to-setup-connect-zebra-printers-to-android-mobile-devices.html)
  - Search summaries; no source confirmed a Zebra plugin for the Android print framework.
- **Client-side PDF:** jsPDF 4.2.1 (MIT, published 2026-03-17) is maintained; pdf-lib 1.17.1 (MIT) was last published 2021-11-06 — [npm registry: jspdf](https://registry.npmjs.org/jspdf); [npm registry: pdf-lib](https://registry.npmjs.org/pdf-lib)

### Inferences
- **Recommended print CSS:** `@page { size: 100mm 150mm; margin: 0 }`, one label per `.label { width:100mm; height:150mm; break-after: page; overflow:hidden }`, and no `break-after` on the last one. Use `mm` units, not px, and 1-bit-friendly black graphics; barcodes as SVG, not raster, to avoid thermal dithering.
- In Chrome's preview the user should see "Paper size" equal to the label stock and "Margins: None/Default", with Scale 100% (not "Fit to page"). Chrome fits content to the selected paper, not the CSS size, so the Windows driver (ZDesigner, TSC, Godex) must have a stock or custom size defined at the label dimensions. That is an inference from the cited reports; no Chromium source found states how CSS size maps to the driver's paper list.
- Kiosk printing suits a single-purpose packing station with the label printer as default. It is not suited to mixed A4/label use, and it is a launch flag or managed policy, so the web app cannot turn it on.
- On Android the dialog route needs a print service for the specific printer and is the least predictable for 4×6 thermal stock. Web Serial over RFCOMM, or WebUSB, sending ZPL/TSPL is more dependable on phones.

### Gaps
- Could not confirm from Chromium source whether print preview auto-selects a printer paper size matching CSS `@page size` (it was searched for and not found).
- No primary confirmation of `SilentPrintingEnabled`'s exact Chrome version and platforms; its YAML path was not found on `main`.
- Zebra "PrintConnect" is intent-based for Android apps, not reachable from a web page; this is from general knowledge, not verified here.

## Open-source JS libraries (license and maintenance, from npm, Nov 2026)

### Takeaway
The best-maintained web-native stack is the MIT `@point-of-sale` family (receipt/ESC-POS focus, WebUSB, Web Serial and Web Bluetooth; updated September 2026). For ZPL/EPL over WebUSB the main option is WebZLP, which is GPL-2.0 — a licensing concern for a closed web app. ZPL builders are small and mixed-license. QZ Tray (LGPL-2.1) remains the installed-agent alternative.

### Cited Findings
- `@point-of-sale/webusb-receipt-printer` 2.1.0, MIT, published 2026-09-18 — [npm](https://registry.npmjs.org/@point-of-sale/webusb-receipt-printer); [GitHub](https://github.com/at-point-of-sale/WebUSBReceiptPrinter)
- `@point-of-sale/webbluetooth-receipt-printer` 2.1.0, MIT, 2026-09-18 — [npm](https://registry.npmjs.org/@point-of-sale/webbluetooth-receipt-printer)
- `@point-of-sale/webserial-receipt-printer` 2.0.0, MIT, 2024-09-21 — [npm](https://registry.npmjs.org/@point-of-sale/webserial-receipt-printer)
- `@point-of-sale/receipt-printer-encoder` 4.0.1, MIT, 2026-09-18 (ESC/POS, StarPRNT). It is the successor of `esc-pos-encoder` 3.0.0 (2024) — [npm](https://registry.npmjs.org/@point-of-sale/receipt-printer-encoder); [npm esc-pos-encoder](https://registry.npmjs.org/esc-pos-encoder)
- `webzlp` 2.0.4, **GPL-2.0**, 2025-09-05. It is a WebUSB library "for communicating with EPL or ZPL printers", with a demo running in Chrome, Edge and Chrome Android — [npm](https://registry.npmjs.org/webzlp); [Cellivar/WebZLP README](https://github.com/Cellivar/WebZLP/blob/main/README.md)
- `jszpl` 2.0.1 (ZPL builder), **GPL-3.0**, 2026-05-05 — [npm](https://registry.npmjs.org/jszpl)
- `zpl-image` 0.3.0 (image to ZPL `^GF`), MIT, 2025-11-17 — [npm](https://registry.npmjs.org/zpl-image)
- `zpl-js` 0.1.5, MIT, 2025-03-24 — [npm](https://registry.npmjs.org/zpl-js)
- `@thermal-print/escpos` 0.3.0, MIT, last version 2025-11-28 — [npm](https://registry.npmjs.org/@thermal-print/escpos)
- `qz-tray` 2.3.0, LGPL-2.1, 2026-09-11. It needs the QZ Tray desktop agent installed — [npm](https://registry.npmjs.org/qz-tray)
- `zebra-browser-print-wrapper` 0.1.4, GPL-3.0, last published 2021-06-16. It needs Zebra Browser Print installed — [npm](https://registry.npmjs.org/zebra-browser-print-wrapper)

### Inferences
- ZPL and TSPL are plain ASCII command languages. A small in-house encoder (template string → `TextEncoder` → bytes) plus a thin transport layer over WebUSB, Web Serial and BLE is likely simpler, and avoids GPL, compared with adopting WebZLP. The MIT point-of-sale libraries are good reference implementations for chooser, reconnect and chunking logic.

### Gaps
- GitHub API metadata (stars, open issues) was blocked in this session; maintenance is judged only from npm publish dates.

## Security and UX constraints

### Takeaway
All four APIs need a secure context (HTTPS; Vercel is fine). The first access always needs a user gesture plus a browser chooser. Cross-origin iframes need permissions-policy delegation. Some device classes are off-limits no matter what: USB HID, mass storage, audio and video; HID keyboards and mice; blocklisted GATT services.

### Cited Findings
- WebUSB interfaces are `[SecureContext]`; `requestDevice` requires transient activation — [WebUSB index.bs](https://github.com/WICG/webusb/blob/main/index.bs)
- Web Serial `requestPort` requires transient activation and the `serial` policy feature — [WICG serial index.bs](https://github.com/WICG/serial/blob/main/index.bs)
- WebHID `requestDevice` requires transient activation and the `hid` policy feature — [WICG webhid index.bs](https://github.com/WICG/webhid/blob/main/index.bs)
- The enterprise grant applies to the top-level origin; embedded frames need the `usb` policy — [WebUsbAllowDevicesForUrls.yaml](https://github.com/chromium/chromium/blob/main/components/policy/resources/templates/policy_definitions/ContentSettings/WebUsbAllowDevicesForUrls.yaml)
- Protected USB classes and the IWA-only unrestricted mode are described in the WebUSB section above — [WebUSB index.bs](https://github.com/WICG/webusb/blob/main/index.bs)

### Inferences
- miDepo needs no `Permissions-Policy` header for top-level use, because the defaults are `self`. Setting `Permissions-Policy: usb=(self), serial=(self), bluetooth=(self), hid=(self)` documents intent and blocks third-party frames.
- Choosers are browser UI, so the app should explain in one line beside the button what device the user will pick. That fits the "say problems before the click" rule.

### Gaps
- Not verified: whether Chrome on Android shows an extra Android-level USB permission dialog in addition to Chrome's chooser.
