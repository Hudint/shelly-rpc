"use client";

import { useCallback, useEffect, useState } from "react";
import { RpcClient } from "@/lib/rpc";
import { Button, Field, checkboxClass, inputClass } from "./ui";

interface UiConfig {
  lock_type?: string;
  use_F?: boolean;
  screen_saver?: { enable?: boolean; timeout?: number; priority_element?: string };
  brightness?: { auto?: boolean; level?: number; min_level?: number };
}

const LOCK_LABELS: Record<string, string> = {
  none: "No lock",
  sett: "Settings locked",
  full: "Fully locked",
};

export function DisplayPanel({ rpc }: { rpc: RpcClient | null }) {
  const [cfg, setCfg] = useState<UiConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rpc) return;
    setBusy(true);
    setError(null);
    try {
      setCfg(await rpc.call<UiConfig>("Ui.GetConfig"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load UI config");
    } finally {
      setBusy(false);
    }
  }, [rpc]);

  useEffect(() => {
    // Load device config whenever the target device changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rpc) load();
  }, [rpc, load]);

  async function apply() {
    if (!rpc || !cfg) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await rpc.call<{ restart_required?: boolean }>("Ui.SetConfig", {
        config: {
          lock_type: cfg.lock_type,
          screen_saver: cfg.screen_saver,
          brightness: cfg.brightness,
        },
      });
      setNote(res.restart_required ? "Saved — restart required to fully apply." : "Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (!rpc) {
    return <p className="text-sm text-neutral-500">Enter the device IP above to load settings.</p>;
  }
  if (!cfg) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Load settings"}
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  const brightness = cfg.brightness ?? {};
  const screenSaver = cfg.screen_saver ?? {};

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={brightness.auto ?? false}
          onChange={(e) =>
            setCfg((c) => ({ ...c!, brightness: { ...c!.brightness, auto: e.target.checked } }))
          }
        />
        Automatic brightness
      </label>

      <Field label={`Brightness level: ${brightness.level ?? 0}%`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          disabled={brightness.auto}
          className="accent-blue-600 disabled:opacity-40"
          value={brightness.level ?? 0}
          onChange={(e) =>
            setCfg((c) => ({
              ...c!,
              brightness: { ...c!.brightness, level: Number(e.target.value) },
            }))
          }
        />
      </Field>

      <div className="border-t border-neutral-800 pt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={screenSaver.enable ?? false}
            onChange={(e) =>
              setCfg((c) => ({
                ...c!,
                screen_saver: { ...c!.screen_saver, enable: e.target.checked },
              }))
            }
          />
          Screen saver
        </label>
        <Field label="Screen saver timeout (s)">
          <input
            type="number"
            min={5}
            disabled={!screenSaver.enable}
            className={`${inputClass} w-32`}
            value={screenSaver.timeout ?? 0}
            onChange={(e) =>
              setCfg((c) => ({
                ...c!,
                screen_saver: { ...c!.screen_saver, timeout: Number(e.target.value) },
              }))
            }
          />
        </Field>
      </div>

      <div className="border-t border-neutral-800 pt-4">
        <Field label="Screen lock">
          <select
            className={`${inputClass} w-full`}
            value={cfg.lock_type ?? "none"}
            onChange={(e) => setCfg((c) => ({ ...c!, lock_type: e.target.value }))}
          >
            {Object.entries(LOCK_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button onClick={apply} disabled={busy} variant="primary">
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button onClick={load} disabled={busy}>
          Reload
        </Button>
        {note && <p className="text-sm text-neutral-400">{note}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
