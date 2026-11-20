"use client";

import { useCallback, useEffect, useState } from "react";
import { InfoHint } from "@/components/Hint";
import { Badge, EmptyRow } from "@/components/ui";
import { toast } from "@/components/Toast";
import { USB_VENDORS } from "@/lib/labels/models";
import { withCode } from "@/lib/errors";

/**
 * What this browser can reach, and the devices it was allowed to use. A browser lists only
 * devices someone authorized here (a click and the browser's chooser); keyboard-wedge scanners
 * never appear, since to the browser they are a keyboard.
 */

type Found = { key: string; via: string; name: string; detail: string; connected: boolean; forget?: () => Promise<void> };

// The Web USB, Serial and HID types are not in TypeScript's DOM library: only what is used here.
type UsbDevice = { vendorId: number; productId: number; productName?: string; manufacturerName?: string; configuration?: { interfaces: { alternates: { interfaceClass: number }[] }[] }; forget?: () => Promise<void> };
type SerialPort = { getInfo: () => { usbVendorId?: number; usbProductId?: number; bluetoothServiceClassId?: string | number }; connected?: boolean; forget?: () => Promise<void> };
type HidDevice = { vendorId: number; productId: number; productName: string; opened: boolean; forget?: () => Promise<void> };
type Hub<T> = { getDevices?: () => Promise<T[]>; getPorts?: () => Promise<T[]>; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } & Record<string, unknown>;
const nav = () => navigator as unknown as { usb?: Hub<UsbDevice>; serial?: Hub<SerialPort>; hid?: Hub<HidDevice>; bluetooth?: unknown; mediaDevices?: MediaDevices };

const hex = (n: number) => `0x${n.toString(16).padStart(4, "0")}`;
const maker = (vendorId?: number) => (vendorId != null ? (USB_VENDORS[vendorId] ?? `Fabricante ${hex(vendorId)}`) : "—");

const VENDOR_FILTERS = Object.keys(USB_VENDORS).map((v) => ({ vendorId: Number(v) }));

export function BrowserDevices() {
  const [support, setSupport] = useState<{ name: string; ok: boolean; hint: string }[]>([]);
  const [found, setFound] = useState<Found[]>([]);

  const refresh = useCallback(async () => {
    const n = nav();
    const list: Found[] = [];
    for (const d of (await n.usb?.getDevices?.()) ?? []) {
      const printer = d.configuration?.interfaces.some((i) => i.alternates.some((a) => a.interfaceClass === 7));
      list.push({ key: `usb-${d.vendorId}-${d.productId}`, via: "USB", name: d.productName || maker(d.vendorId), detail: `${maker(d.vendorId)}${printer ? " · impresora" : ""}`, connected: true, forget: d.forget?.bind(d) });
    }
    for (const [i, p] of ((await n.serial?.getPorts?.()) ?? []).entries()) {
      const info = p.getInfo();
      const bt = info.bluetoothServiceClassId != null;
      list.push({ key: `serial-${i}`, via: bt ? "Bluetooth (serie)" : "Puerto serie", name: bt ? "Dispositivo Bluetooth" : maker(info.usbVendorId), detail: info.usbVendorId != null ? `${hex(info.usbVendorId)}:${hex(info.usbProductId ?? 0)}` : "—", connected: p.connected ?? true, forget: p.forget?.bind(p) });
    }
    for (const d of (await n.hid?.getDevices?.()) ?? []) {
      list.push({ key: `hid-${d.vendorId}-${d.productId}`, via: "HID", name: d.productName || maker(d.vendorId), detail: maker(d.vendorId), connected: true, forget: d.forget?.bind(d) });
    }
    setFound(list);
  }, []);

  useEffect(() => {
    const n = nav();
    setSupport([
      { name: "USB", ok: Boolean(n.usb), hint: "WebUSB. En Windows, una impresora con su controlador instalado queda reservada para el diálogo." },
      { name: "Serie y Bluetooth clásico", ok: Boolean(n.serial), hint: "Web Serial: puertos COM, adaptadores USB-serie y Bluetooth vinculado." },
      { name: "Bluetooth LE", ok: Boolean(n.bluetooth), hint: "Web Bluetooth: impresoras móviles de bajo consumo." },
      { name: "HID", ok: Boolean(n.hid), hint: "WebHID: lectores en modo HID POS y balanzas." },
      { name: "Cámara", ok: Boolean(n.mediaDevices?.getUserMedia), hint: "Lectura de códigos con la cámara." },
    ]);
    refresh();
    const hubs = [n.usb, n.serial, n.hid].filter(Boolean) as Hub<unknown>[];
    hubs.forEach((h) => (h.addEventListener("connect", refresh), h.addEventListener("disconnect", refresh)));
    return () => hubs.forEach((h) => (h.removeEventListener("connect", refresh), h.removeEventListener("disconnect", refresh)));
  }, [refresh]);

  const ask = async (kind: "usb" | "serial" | "hid") => {
    const n = nav() as unknown as Record<string, Record<string, (o: unknown) => Promise<unknown>>>;
    try {
      if (kind === "usb") await n.usb.requestDevice({ filters: [{ classCode: 7 }, ...VENDOR_FILTERS] });
      else if (kind === "serial") await n.serial.requestPort({});
      else await n.hid.requestDevice({ filters: [{ usagePage: 0x8c }] });
      await refresh();
    } catch (e) {
      // Closing the chooser without picking is not an error.
      if (e instanceof DOMException && e.name === "NotFoundError") return;
      console.error("[DEV-01]", e);
      toast(withCode("No se pudo autorizar el dispositivo.", "DEV-01"), true);
    }
  };

  return (
    <div className="space-y-4">
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {support.map((s) => (
          <li key={s.name} className="flex min-h-8 items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-1">
              {s.name}
              <InfoHint text={s.hint} />
            </span>
            {s.ok ? <Badge tone="ok">Disponible</Badge> : <Badge>No disponible</Badge>}
          </li>
        ))}
      </ul>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>Conexión</th>
              <th className="hidden sm:table-cell">Detalle</th>
              <th>Estado</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {found.length === 0 && <EmptyRow columns={5} title="Sin dispositivos autorizados" />}
            {found.map((d) => (
              <tr key={d.key}>
                <td className="font-medium">{d.name}</td>
                <td>{d.via}</td>
                <td className="hidden text-muted sm:table-cell">{d.detail}</td>
                <td>{d.connected ? <Badge tone="ok">Conectado</Badge> : <Badge>Desconectado</Badge>}</td>
                <td>
                  {d.forget && (
                    <button type="button" className="btn-sm" onClick={() => d.forget!().then(refresh)}>
                      Olvidar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {support[0]?.ok && (
          <button type="button" className="btn-soft" onClick={() => ask("usb")}>
            Autorizar USB
          </button>
        )}
        {support[1]?.ok && (
          <button type="button" className="btn-soft" onClick={() => ask("serial")}>
            Autorizar puerto serie
          </button>
        )}
        {support[3]?.ok && (
          <button type="button" className="btn-soft" onClick={() => ask("hid")}>
            Autorizar lector HID
          </button>
        )}
      </div>
    </div>
  );
}
