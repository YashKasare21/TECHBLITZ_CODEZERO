import { NextResponse } from "next/server";
import { listWhatsAppMessagesByThread } from "@/lib/whatsapp-server";

interface RouteContext {
  params: Promise<{ threadId: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  const { threadId } = await context.params;

  try {
    const messages = await listWhatsAppMessagesByThread(threadId);
    return NextResponse.json(messages);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load WhatsApp messages",
      },
      { status: 500 }
    );
  }
}
