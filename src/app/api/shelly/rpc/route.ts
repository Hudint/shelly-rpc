import { NextRequest, NextResponse } from "next/server";
import { shellyFetch } from "@/lib/shellyDigest";

/**
 * Generic proxy for the device's JSON-RPC endpoint. The client posts
 * { ip, username?, password?, method, params? }; we forward it to
 * http://<ip>/rpc as a { id, method, params } envelope and return the
 * device's `result` (or a readable error message).
 */
export async function POST(req: NextRequest) {
  const { ip, username, password, method, params } = await req.json();
  if (!ip || !method) {
    return NextResponse.json({ error: "Missing ip/method" }, { status: 400 });
  }

  try {
    const res = await shellyFetch(
      `http://${ip}/rpc`,
      username ? { username, password: password ?? "" } : undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, method, params: params ?? undefined }),
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Device responded with ${res.status}` },
        { status: res.status }
      );
    }
    if (data && data.error) {
      const msg = data.error.message ?? `RPC error ${data.error.code}`;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(data?.result ?? {});
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request to device failed" },
      { status: 502 }
    );
  }
}
