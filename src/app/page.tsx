"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRpcClient, ShellyConfig } from "@/lib/rpc";
import { Button, Field, Panel, checkboxClass, inputClass } from "@/components/ui";
import { DevicePanel } from "@/components/DevicePanel";
import { DisplayPanel } from "@/components/DisplayPanel";
import { MediaPanel } from "@/components/MediaPanel";

const STORAGE_KEY = "shelly-wd-remote-config";
const USE_AUTH_STORAGE_KEY = "shelly-wd-remote-use-auth";
const REFRESH_MS_STORAGE_KEY = "shelly-wd-remote-refresh-ms";
const MIN_REFRESH_MS = 200;
const DEFAULT_REFRESH_MS = 2000;
// Below this drag distance (in device pixels) a gesture counts as a tap.
const SWIPE_THRESHOLD_PX = 25;
const EMPTY_CONFIG: ShellyConfig = { ip: "", username: "", password: "" };

export default function Home() {
  const [config, setConfig] = useState<ShellyConfig>(EMPTY_CONFIG);
  const [useAuth, setUseAuth] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const gestureStart = useRef<{ x: number; y: number; relX: number; relY: number } | null>(null);

  const effectiveConfig = useMemo<ShellyConfig>(
    () => ({
      ip: config.ip,
      username: useAuth ? config.username : "",
      password: useAuth ? config.password : "",
    }),
    [config, useAuth]
  );

  const rpc = useMemo(
    () => (effectiveConfig.ip ? createRpcClient(effectiveConfig) : null),
    [effectiveConfig]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Hydrating persisted settings after mount is the standard localStorage
      // pattern; the initial empty render is expected and intentional here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setConfig({ ...EMPTY_CONFIG, ...JSON.parse(raw) });

      if (localStorage.getItem(USE_AUTH_STORAGE_KEY) === "true") setUseAuth(true);

      const storedRefreshMs = Number(localStorage.getItem(REFRESH_MS_STORAGE_KEY));
      if (storedRefreshMs >= MIN_REFRESH_MS) setRefreshMs(storedRefreshMs);
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(USE_AUTH_STORAGE_KEY, String(useAuth));
  }, [useAuth]);

  useEffect(() => {
    localStorage.setItem(REFRESH_MS_STORAGE_KEY, String(refreshMs));
  }, [refreshMs]);

  const refreshScreenshot = useCallback(async () => {
    if (!effectiveConfig.ip) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shelly/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effectiveConfig),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setImgUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screenshot failed");
    } finally {
      setLoading(false);
    }
  }, [effectiveConfig]);

  useEffect(() => {
    if (!autoRefresh || !effectiveConfig.ip) return;
    const id = setInterval(refreshScreenshot, Math.max(MIN_REFRESH_MS, refreshMs));
    return () => clearInterval(id);
  }, [autoRefresh, effectiveConfig.ip, refreshMs, refreshScreenshot]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  /** Maps a pointer event to device-pixel and relative (%) coordinates. */
  function pointToCoords(e: React.PointerEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const rect = img.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.round(relX * img.naturalWidth),
      y: Math.round(relY * img.naturalHeight),
      relX: relX * 100,
      relY: relY * 100,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLImageElement>) {
    gestureStart.current = pointToCoords(e);
  }

  async function handlePointerUp(e: React.PointerEvent<HTMLImageElement>) {
    const start = gestureStart.current;
    const end = pointToCoords(e);
    gestureStart.current = null;
    if (!start || !end || !rpc) return;

    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    setMarker({ x: end.relX, y: end.relY });
    setError(null);
    try {
      if (dist < SWIPE_THRESHOLD_PX) {
        await rpc.call("Ui.Tap", { x: start.x, y: start.y });
      } else {
        await rpc.call("Ui.Swipe", {
          x_start: start.x,
          y_start: start.y,
          x_end: end.x,
          y_end: end.y,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gesture failed");
      return;
    }
    setTimeout(refreshScreenshot, 350);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center gap-6 p-6 sm:p-10">
      <header className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Shelly Wall Display Remote</h1>
        <p className="text-sm text-neutral-500">Remote control via the local RPC interface</p>
      </header>

      <section className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            refreshScreenshot();
          }}
        >
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Field label="Device IP">
                <input
                  className={inputClass}
                  placeholder="192.168.1.50"
                  value={config.ip}
                  onChange={(e) => setConfig((c) => ({ ...c, ip: e.target.value }))}
                  required
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={loading || !config.ip} className="px-5 py-2">
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={useAuth}
                onChange={(e) => setUseAuth(e.target.checked)}
              />
              Device requires login
            </label>
            {useAuth && (
              <div className="grid grid-cols-1 gap-3 pl-6 sm:grid-cols-2">
                <Field label="Username">
                  <input
                    className={inputClass}
                    placeholder="admin"
                    value={config.username}
                    onChange={(e) => setConfig((c) => ({ ...c, username: e.target.value }))}
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    className={inputClass}
                    value={config.password}
                    onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-neutral-800 pt-4 text-sm text-neutral-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <label className={`flex items-center gap-2 ${autoRefresh ? "" : "opacity-40"}`}>
              Interval
              <input
                type="number"
                min={MIN_REFRESH_MS}
                step={100}
                disabled={!autoRefresh}
                className={`${inputClass} w-24`}
                value={refreshMs}
                onChange={(e) => setRefreshMs(Number(e.target.value))}
              />
              ms
            </label>
          </div>
        </form>
      </section>

      {error && (
        <p className="w-full max-w-2xl rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <section className="w-full max-w-2xl">
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-xs text-neutral-500">
            <span>Live preview</span>
            {loading && <span className="animate-pulse">Loading…</span>}
          </div>
          <div className="relative">
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic blob URL with click-to-tap coordinate mapping, not a static asset
              <img
                ref={imgRef}
                src={imgUrl}
                alt="Wall Display Screenshot"
                className="block w-full touch-none cursor-crosshair select-none"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                draggable={false}
              />
            ) : (
              <div className="flex aspect-[5/3] items-center justify-center text-sm text-neutral-500">
                No screenshot loaded yet
              </div>
            )}
            {marker && (
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500"
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              />
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-neutral-500">
          Click to tap that spot, or drag to swipe. The screenshot reloads
          automatically after each gesture.
        </p>
      </section>

      <Panel title="Device status &amp; actions">
        <DevicePanel rpc={rpc} />
      </Panel>
      <Panel title="Display settings">
        <DisplayPanel rpc={rpc} />
      </Panel>
      <Panel title="Media">
        <MediaPanel rpc={rpc} />
      </Panel>
    </div>
  );
}
