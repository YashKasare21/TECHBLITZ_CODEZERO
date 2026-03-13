import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { handleMessage } from "./message-handler";

let sock: WASocket | null = null;
let qrCode: string | null = null;
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

const LOG_PATH = "./sessions/messages.json";
const messageLog: { jid: string; direction: "in" | "out"; text: string; timestamp: number }[] = [];

// Maps @lid JID → @s.whatsapp.net JID so messages from the same person are
// always stored under one canonical key regardless of which identifier Baileys
// gives us in a given event.
const lidToPhoneJid = new Map<string, string>();

if (existsSync(LOG_PATH)) {
  try {
    const saved = JSON.parse(readFileSync(LOG_PATH, "utf8"));
    messageLog.push(...saved);
    console.log(`[WhatsApp] Loaded ${saved.length} messages from disk`);
  } catch {
    console.warn("[WhatsApp] Could not load message log from disk, starting fresh");
  }
}

function persistLog() {
  try {
    writeFileSync(LOG_PATH, JSON.stringify(messageLog.slice(-5000)));
  } catch (err) {
    console.error("[WhatsApp] Failed to persist message log:", err);
  }
}

/**
 * Resolve a @lid JID to its @s.whatsapp.net equivalent using the contacts map.
 * Falls back to the original JID when the mapping is not yet known.
 */
function resolveJid(jid: string): string {
  if (jid.endsWith("@lid")) {
    return lidToPhoneJid.get(jid) ?? jid;
  }
  return jid;
}

/**
 * Update the LID→JID map from a contacts array and retroactively fix any
 * messages that were stored under the @lid key before the map was populated.
 */
function applyContacts(contacts: { id?: string; lid?: string }[]) {
  let updated = false;
  for (const contact of contacts) {
    if (!contact.lid || !contact.id) continue;
    lidToPhoneJid.set(contact.lid, contact.id);
    for (const msg of messageLog) {
      if (msg.jid === contact.lid) {
        msg.jid = contact.id;
        updated = true;
      }
    }
  }
  if (updated) persistLog();
}

export function getQRCode() {
  return qrCode;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function getMessageLog() {
  return messageLog.slice(-2000);
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
    // Desktop browser fingerprint gives access to full message history sync.
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: true,
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

  // Build LID → @s.whatsapp.net mapping; retroactively fix stored messages.
  sock.ev.on("contacts.upsert", (contacts) => applyContacts(contacts));
  sock.ev.on("contacts.update", (updates) => applyContacts(updates as { id?: string; lid?: string }[]));

  // Load historical messages that WhatsApp syncs on connection.
  sock.ev.on("messaging-history.set", ({ messages: histMsgs, contacts }) => {
    // First apply any contacts so JIDs resolve correctly.
    if (contacts?.length) applyContacts(contacts);

    let added = 0;
    for (const msg of histMsgs) {
      if (!msg.key.remoteJid || !msg.message) continue;

      const jid = resolveJid(msg.key.remoteJid);
      if (jid.endsWith("@g.us")) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";
      if (!text) continue;

      const direction: "in" | "out" = msg.key.fromMe ? "out" : "in";
      // Baileys historical timestamps are Unix seconds → convert to ms.
      const ts = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();

      // Skip duplicates (same jid + text within a 10 s window).
      const isDupe = messageLog.some(
        (m) => m.jid === jid && m.text === text && Math.abs(m.timestamp - ts) < 10_000
      );
      if (!isDupe) {
        messageLog.push({ jid, direction, text, timestamp: ts });
        added++;
      }
    }

    if (added > 0) {
      messageLog.sort((a, b) => a.timestamp - b.timestamp);
      persistLog();
      console.log(`[WhatsApp] Loaded ${added} historical messages from sync`);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // 'append' = history loading; 'notify' = genuinely new incoming messages.
    // Only auto-reply and store for new messages.
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;

      const rawJid = msg.key.remoteJid!;
      if (rawJid.endsWith("@g.us")) continue;

      // Resolve @lid to @s.whatsapp.net so outgoing replies land in the same thread.
      const jid = resolveJid(rawJid);

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text) continue;

      console.log(`[WhatsApp] Message from ${jid}: ${text}`);
      messageLog.push({ jid, direction: "in", text, timestamp: Date.now() });
      persistLog();

      try {
        const reply = await handleMessage(jid, text);
        await sock!.sendMessage(jid, { text: reply });
        messageLog.push({ jid, direction: "out", text: reply, timestamp: Date.now() });
        persistLog();
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
  persistLog();
}
