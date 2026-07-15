"use client";

import { useCallback, useEffect, useState } from "react";
import { RpcClient } from "@/lib/rpc";
import { Button, Field, inputClass } from "./ui";

interface MediaStatus {
  playback?: { enable?: boolean; volume?: number };
}
interface Ringtone {
  id: number;
  title?: string;
  filename?: string;
}

const MAX_VOLUME = 10;

export function MediaPanel({ rpc }: { rpc: RpcClient | null }) {
  const [volume, setVolume] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ringtones, setRingtones] = useState<Ringtone[]>([]);
  const [selectedRingtone, setSelectedRingtone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rpc) return;
    setBusy(true);
    setError(null);
    try {
      const [status, list] = await Promise.all([
        rpc.call<MediaStatus>("Media.GetStatus"),
        rpc.call<{ list?: Ringtone[] }>("Media.List", { type: "ringtone" }),
      ]);
      setVolume(status.playback?.volume ?? 0);
      setPlaying(status.playback?.enable ?? false);
      const tones = list.list ?? [];
      setRingtones(tones);
      setSelectedRingtone((prev) => prev ?? tones[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media state");
    } finally {
      setBusy(false);
    }
  }, [rpc]);

  useEffect(() => {
    // Load media state whenever the target device changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rpc) load();
  }, [rpc, load]);

  const run = useCallback(
    async (method: string, params?: Record<string, unknown>) => {
      if (!rpc) return;
      setError(null);
      try {
        await rpc.call(method, params);
      } catch (err) {
        setError(err instanceof Error ? err.message : `${method} failed`);
      }
    },
    [rpc]
  );

  async function commitVolume(v: number) {
    setVolume(v);
    await run("Media.SetVolume", { volume: v });
  }

  if (!rpc) {
    return <p className="text-sm text-neutral-500">Enter the device IP above to control media.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run("Media.MediaPlayer.Previous")}>⏮ Prev</Button>
        <Button
          variant="primary"
          onClick={async () => {
            await run("Media.MediaPlayer.PlayOrPause");
            setPlaying((p) => !p);
          }}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </Button>
        <Button
          onClick={async () => {
            await run("Media.MediaPlayer.Stop");
            setPlaying(false);
          }}
        >
          ⏹ Stop
        </Button>
        <Button onClick={() => run("Media.MediaPlayer.Next")}>⏭ Next</Button>
      </div>

      <Field label={`Volume: ${volume} / ${MAX_VOLUME}`}>
        <input
          type="range"
          min={0}
          max={MAX_VOLUME}
          step={1}
          className="accent-blue-600"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          onPointerUp={(e) => commitVolume(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => commitVolume(Number((e.target as HTMLInputElement).value))}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-3 border-t border-neutral-800 pt-4">
        <Field label="Ringtone">
          <select
            className={`${inputClass} min-w-48`}
            value={selectedRingtone ?? ""}
            onChange={(e) => setSelectedRingtone(Number(e.target.value))}
            disabled={ringtones.length === 0}
          >
            {ringtones.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title ?? r.filename ?? `#${r.id}`}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="primary"
          disabled={selectedRingtone == null}
          onClick={() => run("Media.MediaPlayer.PlayRingtone", { id: selectedRingtone })}
        >
          Play ringtone
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={load} disabled={busy}>
          {busy ? "…" : "Refresh"}
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
