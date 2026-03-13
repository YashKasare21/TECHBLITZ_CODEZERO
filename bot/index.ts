import {
  createEventStream,
  connectWhatsApp,
  getConnectionStatus,
  getQRCode,
  sendMessage,
} from "./whatsapp";
import { normalizePhone } from "../lib/whatsapp";

const PORT = parseInt(process.env.BOT_PORT || "3001");

connectWhatsApp().catch(console.error);

Bun.serve({
  port: PORT,
  idleTimeout: 60,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/status") {
      return new Response(
        JSON.stringify({
          status: getConnectionStatus(),
          qr: getQRCode(),
        }),
        { headers }
      );
    }

    if (url.pathname === "/send" && req.method === "POST") {
      try {
        const { phoneNumber, message } = await req.json();
        const phone = normalizePhone(phoneNumber);
        const jid = `${phone}@s.whatsapp.net`;
        await sendMessage(jid, message);
        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (error: unknown) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Failed to send message",
          }),
          { status: 500, headers }
        );
      }
    }

    if (url.pathname === "/events") {
      return new Response(createEventStream(req.signal), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  },
});

console.log(`[Bot] HTTP server running on port ${PORT}`);
