const BOT_URL = process.env.BOT_URL || "http://localhost:3001";

export async function GET() {
  try {
    const response = await fetch(`${BOT_URL}/events`, {
      cache: "no-store",
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!response.ok || !response.body) {
      return new Response("Bot event stream unavailable", { status: 503 });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Bot event stream unavailable", { status: 503 });
  }
}
