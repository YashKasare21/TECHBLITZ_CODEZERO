import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { handleMessage } from "./message-handler";

let sock: WASocket | null = null;
let qrCode: string | null = null;
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

const messageLog: { jid: string; direction: "in" | "out"; text: string; timestamp: number }[] = [];

export function getQRCode() {
  return qrCode;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function getMessageLog() {
  return messageLog.slice(-50);
}

export function getSocket() {
  return sock;
}

export async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./sessions/clinic-bot");
  const { version } = await fetchLatestBaileysVersion();

  connectionStatus = "connecting";
  console.log("[WhatsApp] Connecting...");

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    markOnlineOnConnect: false,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      connectionStatus = "connecting";
      console.log("[WhatsApp] QR code generated — scan with your phone");
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      connectionStatus = "disconnected";
      console.log("[WhatsApp] Connection closed, reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => connectWhatsApp(), 3000);
      }
    }

    if (connection === "open") {
      qrCode = null;
      connectionStatus = "connected";
      console.log("[WhatsApp] Connected successfully!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;

      const jid = msg.key.remoteJid!;
      if (jid.endsWith("@g.us")) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text) continue;

      console.log(`[WhatsApp] Message from ${jid}: ${text}`);
      messageLog.push({ jid, direction: "in", text, timestamp: Date.now() });

      try {
        const reply = await handleMessage(jid, text);
        await sock!.sendMessage(jid, { text: reply });
        messageLog.push({ jid, direction: "out", text: reply, timestamp: Date.now() });
        console.log(`[WhatsApp] Reply sent to ${jid}`);
      } catch (error) {
        console.error("[WhatsApp] Error handling message:", error);
        await sock!.sendMessage(jid, {
          text: "Sorry, something went wrong. Please try again.",
        });
      }
    }
  });
}

export async function sendMessage(jid: string, text: string) {
  if (!sock) throw new Error("WhatsApp not connected");
  await sock.sendMessage(jid, { text });
  messageLog.push({ jid, direction: "out", text, timestamp: Date.now() });
}
