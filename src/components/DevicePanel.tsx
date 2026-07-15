"use client";

import { useCallback, useEffect, useState } from "react";
import { RpcClient } from "@/lib/rpc";
import { Button, StatusLine } from "./ui";

interface DeviceInfo {
  model?: string;
  ver?: string;
  uptime?: number;
}
interface WifiStatus {
  ssid?: string | null;
  rssi?: number;
}
interface IlluminanceStatus {
  lux?: number;
  illumination?: string;
}
interface SwitchStatus {
  output?: boolean;
}

function formatUptime(seconds?: number) {
  if (!seconds && seconds !== 0) return "–";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}

export function DevicePanel({ rpc }: { rpc: RpcClient | null }) {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [wifi, setWifi] = useState<WifiStatus | null>(null);
  const [lux, setLux] = useState<IlluminanceStatus | null>(null);
  const [relay, setRelay] = useState<SwitchStatus | null>(null);
  const [hasSwitch, setHasSwitch] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rpc) return;
    setBusy(true);
    setError(null);
    const [i, w, l, s] = await Promise.allSettled([
      rpc.call<DeviceInfo>("Shelly.GetDeviceInfo"),
      rpc.call<WifiStatus>("WiFi.GetStatus"),
      rpc.call<IlluminanceStatus>("Illuminance.GetStatus", { id: 0 }),
      rpc.call<SwitchStatus>("Switch.GetStatus", { id: 0 }),
    ]);
    if (i.status === "fulfilled") setInfo(i.value);
    else setError(i.reason?.message ?? "Failed to read device info");
    if (w.status === "fulfilled") setWifi(w.value);
    if (l.status === "fulfilled") setLux(l.value);
    if (s.status === "fulfilled") {
      setRelay(s.value);
      setHasSwitch(true);
    } else {
      setHasSwitch(false);
    }
    setBusy(false);
  }, [rpc]);

  useEffect(() => {
    // Load device status whenever the target device changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rpc) refresh();
  }, [rpc, refresh]);

  async function toggleRelay() {
    if (!rpc) return;
    setBusy(true);
    setError(null);
    try {
      await rpc.call("Switch.Toggle", { id: 0 });
      setRelay(await rpc.call<SwitchStatus>("Switch.GetStatus", { id: 0 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  async function reboot() {
    if (!rpc) return;
    if (!window.confirm("Reboot the Wall Display now?")) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await rpc.call("Shelly.Reboot");
      setNote("Reboot triggered.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reboot failed");
    } finally {
      setBusy(false);
    }
  }

  async function checkUpdate() {
    if (!rpc) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await rpc.call<Record<string, unknown>>("Shelly.CheckForUpdate");
      const hasUpdate = res && Object.keys(res).length > 0;
      setNote(hasUpdate ? `Update available: ${JSON.stringify(res)}` : "Firmware is up to date.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update check failed");
    } finally {
      setBusy(false);
    }
  }

  if (!rpc) {
    return <p className="text-sm text-neutral-500">Enter the device IP above to load status.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <StatusLine label="Model" value={info?.model ?? "–"} />
        <StatusLine label="Firmware" value={info?.ver ?? "–"} />
        <StatusLine label="Uptime" value={formatUptime(info?.uptime)} />
        <StatusLine
          label="Ambient light"
          value={lux?.lux != null ? `${lux.lux} lux${lux.illumination ? ` (${lux.illumination})` : ""}` : "–"}
        />
        <StatusLine
          label="Wi-Fi"
          value={wifi?.ssid ? `${wifi.ssid} (${wifi.rssi} dBm)` : "–"}
        />
        {hasSwitch && (
          <StatusLine
            label="Relay (switch:0)"
            value={relay?.output == null ? "–" : relay.output ? "on" : "off"}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={refresh} disabled={busy}>
          {busy ? "…" : "Refresh"}
        </Button>
        {hasSwitch && (
          <Button onClick={toggleRelay} disabled={busy} variant="primary">
            Toggle relay
          </Button>
        )}
        <Button onClick={checkUpdate} disabled={busy}>
          Check for update
        </Button>
        <Button onClick={reboot} disabled={busy} variant="danger">
          Reboot
        </Button>
      </div>

      {note && <p className="text-sm text-neutral-400">{note}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
