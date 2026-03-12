import {
  connectWhatsApp,
  getQRCode,
  getConnectionStatus,
  getMessageLog,
  sendMessage,
} from "./whatsapp";

const PORT = parseInt(process.env.BOT_PORT || "3001");

connectWhatsApp().catch(console.error);

const server = Bun.serve({
  port: PORT,
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

    if (url.pathname === "/messages") {
      return new Response(JSON.stringify(getMessageLog()), { headers });
    }

    if (url.pathname === "/send" && req.method === "POST") {
      try {
        const { phoneNumber, message } = await req.json();
        const jid = phoneNumber.replace(/\D/g, "") + "@s.whatsapp.net";
        await sendMessage(jid, message);
        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (error: any) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers }
        );
      }
    }

    // SSE endpoint for QR code streaming
    if (url.pathname === "/qr-stream") {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const interval = setInterval(() => {
            const data = JSON.stringify({
              status: getConnectionStatus(),
              qr: getQRCode(),
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }, 2000);

          req.signal.addEventListener("abort", () => {
            clearInterval(interval);
            controller.close();
          });
        },
      });

      return new Response(stream, {
        headers: {
          ...headers,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
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
