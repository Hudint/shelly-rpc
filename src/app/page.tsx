"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Config {
  ip: string;
  username: string;
  password: string;
}

const STORAGE_KEY = "shelly-wd-remote-config";
const USE_AUTH_STORAGE_KEY = "shelly-wd-remote-use-auth";
const REFRESH_MS_STORAGE_KEY = "shelly-wd-remote-refresh-ms";
const MIN_REFRESH_MS = 200;
const DEFAULT_REFRESH_MS = 2000;
const EMPTY_CONFIG: Config = { ip: "", username: "", password: "" };

const inputClass =
  "rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-50";
const checkboxClass = "h-4 w-4 rounded border-neutral-600 bg-neutral-900 accent-blue-600";

export default function Home() {
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG);
  const [useAuth, setUseAuth] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);

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

  const buildRequestConfig = useCallback(
    (): Config => ({
      ip: config.ip,
      username: useAuth ? config.username : "",
      password: useAuth ? config.password : "",
    }),
    [config, useAuth]
  );

  const refreshScreenshot = useCallback(async () => {
    if (!config.ip) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shelly/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestConfig()),
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
  }, [config.ip, buildRequestConfig]);

  useEffect(() => {
    if (!autoRefresh || !config.ip) return;
    const id = setInterval(refreshScreenshot, Math.max(MIN_REFRESH_MS, refreshMs));
    return () => clearInterval(id);
  }, [autoRefresh, config.ip, refreshMs, refreshScreenshot]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;

    const rect = img.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const x = Math.round(relX * img.naturalWidth);
    const y = Math.round(relY * img.naturalHeight);

    setMarker({ x: relX * 100, y: relY * 100 });
    setError(null);
    try {
      const res = await fetch("/api/shelly/tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildRequestConfig(), x, y }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tap failed");
      return;
    }
    setTimeout(refreshScreenshot, 350);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center gap-8 p-6 sm:p-10">
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
            <label className="flex-1 flex flex-col gap-1.5 text-sm text-neutral-400">
              Device IP
              <input
                className={inputClass}
                placeholder="192.168.1.50"
                value={config.ip}
                onChange={(e) => setConfig((c) => ({ ...c, ip: e.target.value }))}
                required
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
              disabled={loading || !config.ip}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
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
                <label className="flex flex-col gap-1.5 text-sm text-neutral-400">
                  Username
                  <input
                    className={inputClass}
                    placeholder="admin"
                    value={config.username}
                    onChange={(e) => setConfig((c) => ({ ...c, username: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm text-neutral-400">
                  Password
                  <input
                    type="password"
                    className={inputClass}
                    value={config.password}
                    onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
                  />
                </label>
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
                className="block w-full cursor-crosshair select-none"
                onClick={handleImageClick}
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
          Click the image to tap that spot on the Wall Display. The screenshot
          reloads automatically after each tap.
        </p>
      </section>
    </div>
  );
}
