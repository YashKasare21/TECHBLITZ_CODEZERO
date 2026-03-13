import { NextResponse } from "next/server";

const BOT_URL = process.env.BOT_URL || "http://localhost:3001";

export async function GET() {
  try {
    const res = await fetch(`${BOT_URL}/messages`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
