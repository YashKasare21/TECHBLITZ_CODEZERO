import { NextRequest, NextResponse } from "next/server";

const BOT_URL = process.env.BOT_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BOT_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Bot server unreachable" },
      { status: 503 }
    );
  }
}
