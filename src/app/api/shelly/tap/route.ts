import { NextRequest, NextResponse } from "next/server";
import { shellyFetch } from "@/lib/shellyDigest";

export async function POST(req: NextRequest) {
  const { ip, username, password, x, y } = await req.json();
  if (!ip || typeof x !== "number" || typeof y !== "number") {
    return NextResponse.json({ error: "Missing ip/x/y" }, { status: 400 });
  }

  const url = `http://${ip}/rpc/Ui.Tap?x=${Math.round(x)}&y=${Math.round(y)}`;
  try {
    const res = await shellyFetch(
      url,
      username ? { username, password: password ?? "" } : undefined
    );
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Device responded with ${res.status}: ${text}` },
        { status: res.status }
      );
    }
    return new NextResponse(text || "{}", {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request to device failed" },
      { status: 502 }
    );
  }
}
