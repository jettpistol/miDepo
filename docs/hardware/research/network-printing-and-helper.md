# Network label printing, printer discovery, and local print helpers for a cloud web app

Research date: 2026-11-20. Method note: in this session, direct page fetches to qz.io, developer.chrome.com and www.zebra.com were blocked by the sandbox network policy (DNS fail). Most findings below therefore come from search-engine result summaries of those primary pages, and from one GitHub issue that worked through the same problem (Komisio #525, a Vercel + Supabase app), which is a secondary source. Items marked **[background, unverified]** are from the researcher's prior knowledge and were not confirmed against a source this session; the report writer should treat them as leads, not facts.

## 1. Protocols: raw 9100, LPD, IPP/IPPS/IPP Everywhere, WSD. What label printers support; raw ZPL/TSPL over IPP

### Takeaway
Raw TCP on port 9100 (AppSocket/JetDirect) is the one transport every networked label printer brand accepts, and it carries the native language (ZPL, TSPL, EPL, ESC/POS) unchanged; it is what a helper should speak. IPP on label printers is recent and partial (Zebra added IPP/IPPS on 631 only in Link-OS 7.4, "IPP Everywhere not fully supported"), and Zebra printers do not support AirPrint, so IPP is not a dependable route for raw label languages.

### Cited Findings
- Zebra Browser Print uses ports 9100 and 9101 for RAW printing (sending printer-language commands such as ZPL); 9100 is the default for Zebra desktop/tabletop printers, 6101 for Zebra mobile printers. — [Zebra web printing solutions app notes (PDF)](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/zebra-web-printing-solutions-app-notes.pdf); [Zebra Browser Print user guide v1.3](https://www.zebra.com/content/dam/zebra_dam/en/guide/portfolio/zebra-browser-print-user-guide-v1-3-en-us.pdf)
- Zebra Link-OS ports: UDP 4201 discovery (`ip.discovery.enable`, `ip.discovery.port`), UDP 161 SNMP (`ip.snmp.enable`); discovery can be turned off with a `setvar`. — [Zebra support: Default IP ports used by Link-OS printers](https://support.zebra.com/article/000031643)
- Third-party troubleshooting lists TCP 9100/9200/6101 for Zebra configuration/printing alongside UDP 161 and 4201. — [Whizz-Tech](https://whizz-tech.com/support/printers/zebra-printer-profile-manager-not-seeing-printer/)
- Zebra Print for Android requires UDP 4201 for network discovery and TCP/UDP 9100 for printing; minimum Link-OS 5.2. — [Zebra Print system requirements](https://docs.zebra.com/us/en/software/zebra-print-ug/introduction/system-requirements.html)
- Link-OS 7.4 adds IPP/IPPS on port 631, supported only for Windows 10/11 and Linux CUPS; Zebra states "IPP Everywhere … is not fully supported" and driverless discovery is not supported (as summarized from Zebra's Link-OS IPP/IPPS configuration guide). — [Komisio issue #525, citing Zebra's Link-OS IPP/IPPS guide](https://github.com/Komisio/komisio/issues/525)
- "None of Zebra printers supports AirPrint" (Zebra developer forum); only the consumer ZSB series (e.g. ZSB-DP12/14) supports AirPrint. Brother label printers with AirPrint include QL-820NWB, QL-1110NWB, TD-4550DNWB. — [Komisio issue #525, citing developer.zebra.com and zsbsupport.zebra.com](https://github.com/Komisio/komisio/issues/525)
- Brother QL network guide (QL-720NW): Ethernet 10BASE-T/100BASE-TX, protocols include LPR/LPD and "Custom Raw Port/Port9100". — [Brother QL Series Network User's Guide (PDF)](https://download.brother.com/welcome/docp000487/cv_ql720nw_asaoceeng_net_d.pdf); [Brother QL-710W network manual](https://www.manualslib.com/manual/414461/Brother-Andamp-Trade-Ql-710w.html?page=28)
- A third-party label software vendor reports Xprinter and TSC clones are detected as TSPL, Godex has no language it supports natively (needs ZPL/TSPL emulation), and it uses raw TCP 9100 for network printers. — [LabelInn thermal printer software](https://www.labelinn.com/en/thermal-printer-software)
- QZ Tray's wiki explains "raw printing" as sending printer-language commands directly, bypassing driver rendering. — [QZ Tray wiki: What is Raw Printing](https://github.com/qzind/tray/wiki/What-is-Raw-Printing)
- On Windows, raw 9100 vs LPR queue choice matters; jobs can stall on a wrongly configured RAW 9100 queue. — [Whizz-Tech: RAW 9100 jobs stuck](https://whizz-tech.com/support/printers/raw-9100-jobs-stuck-lpr-vs-raw-correct-queue/)

### Inferences
- A helper that opens a TCP socket to `printer-ip:9100` and writes ZPL/TSPL bytes covers Zebra, TSC, Godex, Honeywell and Xprinter network models; Brother QL is the exception in language (raster or ESC/P / P-touch Template, not ZPL), so miDepo should treat Brother QL as "PDF via driver" or a separate encoder.
- Sending raw ZPL over IPP would require the printer to advertise a raw/vendor `document-format` (e.g. `application/octet-stream` or `application/vnd.zebra-zpl`); none of the sources confirm any label printer accepts this, so it should not be relied on.
- **[background, unverified]** RFC 1179 defines LPD on TCP 515; IPP/1.1 is RFC 8010 (encoding/transport) and RFC 8011 (model/semantics); IPPS is IPP over TLS on 631; IPP Everywhere (PWG 5100.14) mandates PWG Raster, JPEG and (optionally) PDF, not raw label languages. Windows WSD printing (WS-Print over HTTP, discovery via WS-Discovery multicast UDP 3702) is offered mainly by office printers; label printers rarely implement it.
- **[background, unverified]** Honeywell (Intermec) PD/PM series accept raw DP/IPL/ZPL-emulation on 9100; TSC Ethernet models accept TSPL on 9100 and usually LPD; Godex accepts EZPL on 9100. Confirm per model manual.

### Gaps
- Primary TSC, Godex, Honeywell and Xprinter network manuals were not retrieved; their exact protocol lists (LPD, IPP, SNMP, FTP) are unconfirmed.
- Whether ZDesigner drivers or Link-OS IPP accept a raw ZPL document format over IPP was not found.
- RFCs and PWG specs were not fetched this session (network policy); RFC numbers above are from background knowledge.

## 2. Discovery: mDNS/DNS-SD, SNMP, Zebra UDP 4201, subnet scan, WSD. What each reveals

### Takeaway
Three discovery methods are practical for a helper: Zebra's proprietary UDP 4201 broadcast (Zebra only, returns model/serial/IP), mDNS/DNS-SD browsing of `_pdl-datastream._tcp` / `_ipp._tcp` / `_printer._tcp` (any brand that advertises; TXT records give make/model and languages), and a /24 TCP connect scan of 9100 followed by a status query (works for everything, reveals nothing until you query). SNMP (UDP 161) adds model and status for any brand that leaves it enabled.

### Cited Findings
- Zebra network discovery: the client sends small unicast or broadcast UDP packets to port 4201 and printers answer; clients repeat probes to compensate for UDP loss. The protocol is undocumented by Zebra and was reverse-engineered. — [jfr.im: Zebra network discovery protocol](https://jfr.im/blog/2024/09/zebra-network-discovery-protocol/)
- Zebra recommends leaving UDP 4201 open for discovery and notes multicast may be needed. — [Zebra PPME best practices (PDF)](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/software/ppme-best-practices-for-installation-and-setup-en.pdf)
- Apple's Bonjour Printing Specification (v1.2.1) defines printer TXT keys including `ty` (human make/model), `product`, `pdl` (list of MIME types of supported page description languages), `priority`, `adminurl`. — [Apple Bonjour Printing Specification](https://developer.apple.com/bonjour/printing-specification)
- `_pdl-datastream._tcp` is AppSocket, typically port 9100; IPP (631) and LPD (515) are also advertised. If `priority` is omitted, `_pdl-datastream` takes precedence over `_ipp`, which takes precedence over `_printer`. — [Avahi mailing list example](https://lists.freedesktop.org/archives/avahi/2012-November/002208.html); [Apple Bonjour Printing Specification](https://developer.apple.com/bonjour/printing-specification)
- The spec requires printers to register `_printer._tcp` as the "flagship" name even when LPD is unsupported (port 0). — [CUPS mailing list](https://lists.cups.org/pipermail/cups/2008-November/065372.html)
- Zebra printer status can be queried with `~HS` or SGD `device.host_status` over the same raw connection. — [Komisio issue #525](https://github.com/Komisio/komisio/issues/525)
- Zebra Link-OS printers expose SNMP on UDP 161 (`ip.snmp.enable`). — [Zebra support article 000031643](https://support.zebra.com/article/000031643)

### Inferences
- Discovery cannot run in the browser or on Vercel; it is a helper-only feature. A sensible helper order: (1) mDNS browse, (2) Zebra 4201 broadcast, (3) TCP 9100 connect-scan of the local /24 with a short timeout, (4) SNMP GET of sysDescr/sysObjectID and Printer MIB on hits.
- mDNS does not cross subnets/VLANs and is often blocked on guest Wi-Fi; a 9100 scan still works across routed subnets if the helper is told the range.
- **[background, unverified]** SNMP objects: `sysDescr` (1.3.6.1.2.1.1.1.0) usually contains model and firmware; `sysObjectID` (1.3.6.1.2.1.1.2.0) is under the vendor's enterprise arc (Zebra 1.3.6.1.4.1.10642; TSC enterprise number not confirmed); Host Resources MIB `hrDeviceDescr` and `hrPrinterStatus`/`hrPrinterDetectedErrorState` give status bits (paper out, door open); Printer MIB v2 (RFC 3805) `prtInterpreterLangFamily` lists supported languages and `prtAlertTable` lists alerts. Label printers implement these unevenly.
- **[background, unverified]** WSD discovery (WS-Discovery multicast to 239.255.255.250:3702) is what Windows "Add printer" uses for many office printers; label printers rarely answer it.
- Status after printing over raw 9100 is best done in-band (Zebra `~HS`, TSC `<ESC>!?` status byte [background, unverified]) rather than SNMP.

### Gaps
- Exact Zebra and TSC enterprise OID trees and which Printer MIB objects label printers populate: not retrieved.
- Zebra Link-OS SDK discovery APIs (multicast, directed broadcast, subnet search) docs were not retrieved (zebra.com blocked).
- Which label brands advertise mDNS by default: not found.

## 3. Getting a printer onto Wi-Fi

### Takeaway
Sources found this session were thin; Zebra's tooling (Printer Setup Utility, which can push a JSON settings file, over BLE on ZD421/ZD621) is the documented path for Zebra. Most of the practical advice (2.4 GHz vs 5 GHz, DHCP reservation, client isolation) is background knowledge to verify per model.

### Cited Findings
- Zebra Printer Setup Utility can send a JSON settings file to a printer (this is how Zebra sets values such as the WebLink URL); the iOS version works over Bluetooth LE on BLE-equipped models such as ZD421 and ZD621. — [Komisio issue #525, citing Zebra PSU for iOS on the App Store](https://github.com/Komisio/komisio/issues/525)
- Zebra's WebLink TLS needs a correct printer clock (`rtc.date`), relevant after setup. — [Zebra docs: WebLink SSL/TLS certificate errors](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-weblink-using-weblink/r-zpl-weblink-ssltls-certificate-errors.html)
- Zebra Android devices' WPA/WPA2/WPA3 Enterprise path uses EAP methods PEAP, TLS, TTLS (this is for Zebra mobile computers, not printers). — [Zebra TC22/TC27 guide](https://docs.zebra.com/us/en/mobile-computers/handheld/tc2-series/tc22-tc27-prg/wireless/wlan-configuration/configuring-a-secure-wi-fi-network.html)

### Inferences
- **[background, unverified]** Zebra tools: Zebra Printer Setup Utility (Android/iOS, Bluetooth/BLE or USB-OTG), Zebra Setup Utilities (Windows, USB), and the printer's web page once on Ethernet. TSC Console (Windows) configures TSC Wi-Fi modules over USB. Xprinter ships a Windows "Printer Tool"/net-config utility and usually a fixed default IP (often 192.168.123.100) on Ethernet models. Brother QL-820NWB/1110NWB support WPS push-button and the Brother iPrint&Label / Printer Setting Tool.
- **[background, unverified]** Many label printer Wi-Fi modules are 2.4 GHz only (newer Zebra ZD4/ZD6 Wi-Fi modules are dual-band 802.11ac); a combined 2.4/5 GHz SSID with band steering, captive portals (guest networks), client/AP isolation (printer and PC cannot see each other), and WPA2-Enterprise/802.1X without the right EAP/certificates are the usual failures.
- Advice for the miDepo manual: give the printer a DHCP reservation in the router (or a static IP outside the DHCP pool), use the main (non-guest) network, and print the printer's network config label to read its IP. A changing IP breaks any helper that stores the IP; mDNS hostname or MAC-based rediscovery mitigates that.

### Gaps
- ZD421/ZD621, TSC, Godex, Xprinter Wi-Fi band and WPA-Enterprise support were not confirmed from manuals.
- SoftAP / "Wi-Fi Direct setup mode" behavior per brand not retrieved.

## 4. Browser to local helper: Chrome Local Network Access, mixed content

### Takeaway
Since Chrome 142 (stable 2025-10-28), a public HTTPS site (like a Vercel-hosted miDepo) that calls `http://localhost` or a LAN IP triggers a per-site permission prompt ("Look for and connect to any device on your local network"); in Chrome 145 the permission was split into `local-network` and `loopback-network`. WebSockets came under LNA later (reported Chrome 147), and a `targetAddressSpace` escape hatch for mixed content exists for fetch and was added (then reverted, per the bug tracker) for WebSocket around Chrome 154. A helper that connects outbound to the cloud avoids all of this.

### Cited Findings
- Chrome 142 went stable on October 28, 2025 and restricts requests to the user's local network behind a permission prompt; the permission is restricted to secure contexts. — [Chrome 142 release notes](https://developer.chrome.com/release-notes/142)
- Opt-in testing began in Chrome 138, covering `fetch()`, subresource loads and subframe navigation. — [Chrome blog: New permission prompt for Local Network Access](https://developer.chrome.com/blog/local-network-access)
- Chrome 145 splits the permission into `local-network` (LAN IPs) and `loopback-network` (localhost, 127.0.0.1); the old name became an alias. — [blink-dev: Intent to Ship LNA split permissions](https://groups.google.com/a/chromium.org/g/Blink-dev/c/Zl3P6NHhMBw); [mail-archive copy](https://www.mail-archive.com/blink-dev@chromium.org/msg15688.html)
- Same-space requests (localhost page to localhost) do not prompt; only public origin to local/loopback does; grants are per site; enterprise policy `LocalNetworkAccessAllowedForUrls` allows origins without a prompt. — [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access); [OpenReplay explainer](https://blog.openreplay.com/chrome-local-network-access-lna-permission/); [VertiGIS support](https://support.vertigis.com/hc/en-us/articles/32555952561682-Local-Network-Access-changes-in-Chromium)
- MDN: when the permission is granted, mixed-content checks are relaxed for private IP literals and `.local` names. — [MDN: Local network access](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access)
- Chrome 154 release notes describe `new WebSocket("ws://local-server.example", { targetAddressSpace: "local" })` as a mixed-content escape hatch for local servers without HTTPS; requires the permission and that the name resolves to a local IP. A Chromium issue shows the CL was reverted and to be re-enabled later. — [Chrome 154 release notes](https://developer.chrome.com/release-notes/154); [chromestatus 154](https://chromestatus.com/release-notes/154); [Chromium issue 517413738](https://issues.chromium.org/issues/517413738). Sources conflict on current status.
- WICG spec: WebSocket connections should be subject to the same LNA permission. — [WICG Local Network Access](https://wicg.github.io/local-network-access/)
- Third-party (unofficial) claims: LNA extended to WebSocket and WebTransport in Chrome 147; Chrome 156 (stable ~2026-10-20) removes the enterprise opt-out. Not confirmed against Google. — [superchargebrowser.com](https://www.superchargebrowser.com/library/chrome-156-local-network-access/)
- Real breakage reports after 142 (Shopify CLI, Box "Open in Desktop", Duo Desktop) show vendors now ship in-app guidance telling users to allow the prompt. — [Shopify dev community](https://community.shopify.dev/t/chrome-142-default-flag-breaks-network-requests/24658); [Box support](https://support.box.com/hc/en-us/articles/45821516452627-In-app-guidance-to-allow-Box-local-network-access-in-Chromium-142-for-Open-in-Desktop); [Northwestern Duo KB](https://services.northwestern.edu/TDClient/30/Portal/KB/Article/2819/Duo-Desktop-Allowing-Local-Network-Access-for-Google-Chrome-version-142)

### Inferences
- Browser to localhost helper (Browser Print, QZ Tray style) still works in Chrome on Windows but now costs one permission click per site per profile, and can be blocked outright by enterprise policy; on Android, a localhost helper is not an option for most users.
- Browser to printer directly (fetch to `http://192.168.x.x:9100`) cannot work: 9100 is not HTTP, and Chrome blocks port 9100 as a "restricted port" **[background, unverified]**. Zebra's HTTP POST printing to the printer's web server (`/pstprnt`) is subject to CORS and now LNA. — [Zebra dev blog: HTTP POST printing and CORS](https://developer.zebra.com/community/home/blog/2015/08/13/http-post-printing-and-cors)
- An outbound helper (helper polls or holds a WebSocket to the cloud) sidesteps LNA, mixed content, and per-browser setup, and also serves Android scanners that cannot run a helper.

### Gaps
- Official current (Nov 2026) status of LNA for WebSocket and of the Chrome 156 enterprise-policy change could not be confirmed (developer.chrome.com fetch blocked).
- Whether `targetAddressSpace` for fetch is shipped and in which version: not confirmed.

## 5. Existing helpers and services: license, cost, mechanism

### Takeaway
Free options: Zebra Browser Print (Zebra only, localhost service, now subject to LNA), QZ Tray (LGPL 2.1, free but shows a trust dialog unless requests are signed with a purchased certificate or a self-built root), Zebra WebLink (printer itself opens a TLS WebSocket to your server; free, Link-OS non-Basic models only, certificate chain needed on each printer). PrintNode is a paid cloud relay with a small free tier. Odoo uses its own agent (IoT Box / Windows virtual IoT), paid subscription.

### Cited Findings
- **Zebra Browser Print**: local service; communicates with Zebra Legacy and Link-OS printers over USB and network; uses ports 9100/9101 locally and will not start if another program holds them. A 2016 post said Windows 7/10, Chrome/IE, USB only at that time; forum posts say not all Zebra printers are supported; not supported on iOS. — [Zebra app notes](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/zebra-web-printing-solutions-app-notes.pdf); [Zebra dev blog 2016](https://developer.zebra.com/community/home/blog/2016/08/30/new-developer-tool-released-browser-print); [Zebra dev forum: alternatives](https://developer.zebra.com/thread/36265); [Komisio #525](https://github.com/Komisio/komisio/issues/525)
- **QZ Tray**: open source under LGPL 2.1; free; unsigned requests ("untrusted website") keep showing a warning dialog; silent printing requires a certificate purchased from QZ Industries or implementing your own root certificate; official binaries carry a code restriction that encourages premium support purchase. — [QZ Tray FAQ (GitHub wiki)](https://github.com/qzind/tray/wiki/faq); [qz.io FAQ](https://qz.io/docs/faq); [qz.io licensing](https://qz.io/docs/licensing); [QZ signing wiki](https://github.com/qzind/tray/wiki/Signing/54148463597367d0048913c5902961a913a7b231)
- QZ Tray price claim "$29+/site/mo" appears only in a third-party package listing; unverified. — [Packagist bitdreamit/laravel-qz-tray](https://packagist.org/packages/bitdreamit/laravel-qz-tray)
- A self-signed override route exists, but one answer says the override must be accepted every launch. — [qz-print Google Group](https://groups.google.com/g/qz-print/c/KtthQO0eYfs); [blog 2017](https://ijustlearnedsomethingnewtoday.blogspot.com/2017/04/using-self-signed-certificates-with-qz.html)
- QZ Tray supports raw commands for ZPL, EPL, ESC/POS, ESC/P (repo topics). — [qzind/tray](https://github.com/qzind/tray)
- **PrintNode**: cloud relay with a desktop client; first month free; aggregator listings show a free Lite tier (one computer, low volume; Komisio cites 50 prints/month), Essential $29/mo, Premium $99/mo, Integrator tiers; another aggregator says from $9/mo (conflict). Standalone self-hosted server "contact us". — [apis.io PrintNode plans](https://apis.io/plans/printnode/printnode-plans-pricing/); [PrintNode pricing](https://www.printnode.com/pricing); [FitGap](https://us.fitgap.com/products/018782/printnode); [Komisio #525](https://github.com/Komisio/komisio/issues/525)
- **Zebra WebLink (Cloud Connect)**: built into Link-OS; the printer opens an outbound TLS WebSocket to a server set in `weblink.ip.conn1.location` (or `conn2`; the two must not point at the same URL or they cancel each other); available on all Link-OS printers except Link-OS Basic (e.g. ZD220/ZD230, ZT111). — [Zebra developer: WebLink WebSocket](https://developer.zebra.com/content/weblink-websocket); [Zebra dev blog: Link-OS SDK for Webservices](https://developer.zebra.com/blog/using-link-os-sdk-webservices-print-websites); [Komisio #525](https://github.com/Komisio/komisio/issues/525)
- WebLink certificates: printers ship with a Zebra device cert and Zebra server CA; custom certificates from Link-OS v5 (article says 5.2+), files `WEBLINK1_CA.NRD`, `WEBLINK1_CERT.NRD`, `WEBLINK1_KEY.NRD`; Zebra recommends mutual auth; the server needs Zebra Root and Subordinate CA when using Zebra certs; printer clock must be right; the hostname must match a DNS name in the cert. Zebra-signed server certificates take 7–10 days, last 3 years, wildcard must include a `z`/`zebra`/`zserver` label. SHA-1 WebLink certs stopped working in Link-OS 7.2 (secondary). — [Zebra support: self-signed WebLink certificates](https://support.zebra.com/article/How-to-Create-Self-Signed-Server-and-Device-Certificates-for-Weblink-Websockets-Connections?language=tr); [Zebra docs: SSL/TLS certificate errors](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-weblink-using-weblink/r-zpl-weblink-ssltls-certificate-errors.html); [Komisio #525](https://github.com/Komisio/komisio/issues/525)
- Zebra reference server is the Link-OS Webservices SDK (Java/Tomcat), example URL `https://mypc.weblink.zebratest.lan:443/zebra/weblink/`. — [Zebra developer: Printer setup for SendFileToPrinter](https://developer.zebra.com/docs/printer-setup-sendfiletoprinter)
- **Zebra Cloud Print API / SendFileToPrinter**: cloud API through Zebra; paid licences, free tier about 50 calls/day (secondary). — [Zebra dev blog: SendFileToPrinter](https://developer.zebra.com/blog/use-sendfiletoprinter-api-your-cloud-based-printing-needs); [Komisio #525](https://github.com/Komisio/komisio/issues/525)
- **Odoo**: Windows virtual IoT is an Odoo IoT program for Windows 10/11 that needs a valid IoT box subscription; uses printers Windows already sees (driver installed); MRP devices not supported. Delivery labels are sent to the IoT-connected printer on validation; ZPL reports go straight to Zebra printers. Third-party summary of Odoo Experience 2025: transport negotiates WebRTC, long polling, WebSocket. — [Odoo 18 docs: Windows virtual IoT](https://www.odoo.com/documentation/18.0/applications/general/iot/windows_iot.html); [Odoo 18 docs: print on validation](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/print_on_validation.html); [Odoo forum: auto print labels](https://www.odoo.com/forum/help-1/can-i-automatically-print-my-product-labels-in-odoo-198667); [Oduist OXP 2025 summary](https://oduist.com/blog/odoo-experience-2025-ai-summaries-2/266-let-s-demystify-the-iot-discover-recent-improvements-268)
- **Comparable open-source pattern (Komisio print agent)**: a ~475-line dependency-free Node agent polls a `claim_print_job` RPC every 3 s, heartbeats every 60 s, prints raw TCP to `host:9100`, does USB via a small .NET Winspool RAW helper, packaged as a Node SEA and wrapped as a Windows service with WinSW; agents are a `device` role bound to one printer through a hashed pairing code that expires in 15 minutes; jobs go `queued → claimed → printed|failed|cancelled`, claims older than 10 minutes are re-offered; ZPL payload up to 20,000 chars; values sanitized by stripping `^`, `~`, backslash and control characters. The same project later shipped WebLink support with a public SHA-256 cert on its own VPS, because Vercel cannot host long-lived inbound WebSockets. — [Komisio #525](https://github.com/Komisio/komisio/issues/525)

### Inferences
- **[background, unverified]** JSPrintManager/Neodynamic: commercial, per-site/developer licence; a localhost WebSocket client app ("JSPM client") plus a JS library; same LNA exposure as QZ Tray. Zebra PrintConnect (Android): free Zebra app that receives Android intents and fills printer-stored templates; useful for a native Android app, not for a Chrome web page. ShipStation Connect and ShipHero's desktop printing client work the outbound way (desktop app logs into the cloud account and receives jobs), similar to PrintNode. NetSuite commonly uses PrintNode or QZ Tray via partners. Shopify Shipping prints PDFs/4x6 via the browser dialog or uses a ZPL option through a local helper in some apps.
- WebLink is attractive for miDepo only if a non-Vercel always-on endpoint exists (a small VPS); it removes the PC entirely but needs per-printer certificate setup and excludes cheap Link-OS Basic models and every non-Zebra brand.
- QZ Tray is free to use but every print shows a trust dialog unless miDepo buys a certificate or ships its own root-cert build; the "own root" route means building/distributing a custom QZ Tray, which is effectively writing a helper anyway.

### Gaps
- Current QZ Tray prices and exact free-tier terms (qz.io blocked).
- Official PrintNode pricing page contents (aggregators conflict: $9 vs $29 entry).
- ShipStation Connect, ShipHero, NetSuite, Shopify Shipping printing mechanisms: no primary docs retrieved.
- JSPrintManager licensing and Zebra PrintConnect docs: not retrieved.
- Zebra Browser Print current supported-printer list and licence text: not retrieved.

## 6. Minimal free helper architecture for Vercel; pairing; job queue; status; risks

### Takeaway
The architecture that fits Vercel is outbound-only: the helper polls (or long-polls) a miDepo API for jobs every few seconds, claims them atomically in the database, writes raw bytes to `ip:9100` (or the Windows spooler for USB), and reports the result and printer status back. Pair it with a short-lived one-time code shown in the app, exchanged for a device token scoped to one company. This is the pattern PrintNode, Odoo and Komisio use, and it avoids Chrome LNA entirely.

### Cited Findings
- Vercel serverless (with Supabase) cannot host long-lived inbound WebSocket servers; Komisio's agent therefore polls every 3 s with a 60 s heartbeat, and its WebLink endpoint lives on a separate VPS. — [Komisio #525](https://github.com/Komisio/komisio/issues/525)
- Komisio's design: pairing code hashed, 15-minute expiry, exchanged for a device identity bound to one printer; revocation closes the socket; claimed jobs re-offered after 10 minutes; payload sanitization of `^`/`~`. — [Komisio #525](https://github.com/Komisio/komisio/issues/525)
- Odoo Windows virtual IoT reportedly negotiates WebRTC, long polling or WebSocket. — [Oduist OXP 2025](https://oduist.com/blog/odoo-experience-2025-ai-summaries-2/266-let-s-demystify-the-iot-discover-recent-improvements-268)

### Inferences
- Proposed miDepo shape (inference): tables `print_device` (company, name, token hash, last_seen, version), `printer` (device, address/queue name, language ZPL/TSPL/PDF, label size, last status), `print_job` (company, printer, payload, status, attempts, claimed_at, error). Endpoints: `POST /api/print/pair` (code → token), `POST /api/print/claim` (returns up to N jobs, `UPDATE … WHERE status='queued' … RETURNING` with `FOR UPDATE SKIP LOCKED`), `POST /api/print/report` (printed/failed + `~HS` status), `POST /api/print/heartbeat` (also uploads discovered printers so the app can offer them in its `<Select>`, keeping "database is the source of truth").
- Polling cost: one request every 3–5 s per helper is ~17–29k invocations/day; on Vercel's free tier this is acceptable for a few helpers but should be measured; long-polling (hold ~25 s, within function time limits) cuts that by roughly 5–8x. A free realtime service (e.g. Supabase Realtime, if already used) could push instead, but that adds a dependency.
- Status reporting: after each job, read Zebra `~HS` (paper out, head open, pause) and report; show it beside the print button ("Impresora sin papel") per the owner's "say problems before the click" rule.
- Risks: (1) a leaked device token lets someone print on, or read job payloads of, that company: scope tokens to one company, allow revocation, store only hashes; (2) ZPL injection from product names (`^`, `~` in data) can run printer commands, including `~JR`/config changes: escape with `^FH` or strip as Komisio does; (3) printer IP changes under DHCP: rediscover by MAC/serial; (4) duplicate prints on retry: idempotent job IDs and the claim timeout; (5) the helper becomes a LAN foothold: it must never accept inbound connections and should only connect to the configured printers; (6) offline helper: show "Ayudante sin conexión desde …" from `last_seen`.
- Android: no helper; either WebLink (Zebra), the same queue served by a Windows PC on site, or the existing browser PDF print path.

### Gaps
- Vercel free-tier invocation/time limits as of Nov 2026 were not checked.
- No measured data on polling load or latency for such helpers.

## 7. Windows specifics: raw via spooler, driver passthrough, service vs tray, code signing

### Takeaway
For USB printers (or any printer installed with a Windows driver), the helper should send RAW data through the spooler API (`OpenPrinter` → `StartDocPrinter` with datatype "RAW" → `WritePrinter`), which bypasses the driver's rendering; this is documented by Microsoft and widely used for ZPL. Network printers are simpler via direct TCP 9100. V4 drivers can produce empty spool files for RAW, a known caveat.

### Cited Findings
- Microsoft sample `RawDataToPrinter`: open printer, set document datatype RAW, `StartDocPrinter`, `StartPagePrinter`, `WritePrinter`, end calls; sends bytes directly to the printer. — [Microsoft Learn: Send data directly to a GDI printer](https://learn.microsoft.com/en-us/windows/win32/printdocs/sending-data-directly-to-a-printer)
- RAW datatype data goes to the print monitor without further processing (processor may insert form feeds). — [Microsoft Learn: RAW data type](https://learn.microsoft.com/en-us/windows-hardware/drivers/print/raw-data-type)
- V4 print drivers sending PCL/PostScript in RAW mode produce a 0-byte spool file; Microsoft recommends XPS_PASS there. — [Microsoft Learn: V4 drivers RAW 0-byte spool](https://learn.microsoft.com/en-us/previous-versions/troubleshoot/windows/win32/v4-print-driver-raw-mode-pcl-postscript)
- Zebra printers printing ZPL as text through the driver was fixed by sending via spooler API calls; .NET RAW sample for Zebra. — [MSDN forum archive](https://learn.microsoft.com/he-il/archive/msdn-technet-forums/1aa4134a-c1ab-4f76-9704-99a444d5aa47); [ijun.org .NET ZPL sample](https://blog.ijun.org/2015/11/net-code-to-send-zpl-to-zebra-printers.html)
- QZ Tray notes most applications won't send raw commands correctly even with "raw" set in driver properties. — [QZ Tray wiki: What is Raw Printing](https://github.com/qzind/tray/wiki/What-is-Raw-Printing)
- Komisio packages its agent as a Node single-executable app wrapped by WinSW as a Windows service, with a .NET Framework helper for Winspool RAW USB printing; config in `%ProgramData%`. — [Komisio #525](https://github.com/Komisio/komisio/issues/525)

### Inferences
- A Windows service (runs at boot, no user logged in, survives logoff) suits an always-on dock PC; a tray app is easier to pair and show status but stops when the user logs off. A service plus a small tray/status page (or simply the miDepo web screen showing helper status) is the common compromise.
- **[background, unverified]** ZDesigner drivers pass through raw ZPL sent with the RAW datatype and also have a "passthrough" mode (`${...}$` delimiters) for embedding ZPL in GDI print jobs. Unsigned installers trigger Microsoft Defender SmartScreen "Windows protected your PC" until the file gains reputation; an OV/EV Authenticode certificate costs money (EV gives immediate reputation; since 2023 OV keys must be on hardware tokens/HSM); free alternatives: distribute via winget or Microsoft Store (Store signs MSIX for free for individual devs), or document the "More info → Run anyway" step. Azure Trusted Signing is a low-cost (not free) signing service.

### Gaps
- ZDesigner passthrough behavior, SmartScreen reputation rules and code-signing costs as of Nov 2026 were not verified this session.
- No source retrieved on Windows service vs tray trade-offs for print agents specifically.
