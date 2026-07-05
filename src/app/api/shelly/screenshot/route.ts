import { NextRequest, NextResponse } from "next/server";
import { shellyFetch } from "@/lib/shellyDigest";

export async function POST(req: NextRequest) {
  const { ip, username, password } = await req.json();
  if (!ip) {
    return NextResponse.json({ error: "Missing ip" }, { status: 400 });
  }

  try {
    const res = await shellyFetch(
      `http://${ip}/screenshot`,
      username ? { username, password: password ?? "" } : undefined
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Device responded with ${res.status}` },
        { status: res.status }
      );
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request to device failed" },
      { status: 502 }
    );
  }
}
