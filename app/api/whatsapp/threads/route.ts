import { NextResponse } from "next/server";
import { listWhatsAppThreads } from "@/lib/whatsapp-server";

export async function GET() {
  try {
    const threads = await listWhatsAppThreads();
    return NextResponse.json(threads);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load WhatsApp threads",
      },
      { status: 500 }
    );
  }
}
