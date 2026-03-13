import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WAMessage,
  type WASocket,
  useMultiFileAuthState as baileysMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import {
  normalizePhone,
  type WhatsAppConnectionStatus,
  type WhatsAppEventPayload,
} from "../lib/whatsapp";
import {
  importLegacyMessagesIfNeeded,
  persistWhatsAppMessage,
  repairThreadIdentity,
} from "./whatsapp-store";
import { handleMessage } from "./message-handler";

let sock: WASocket | null = null;
let qrCode: string | null = null;
let connectionStatus: WhatsAppConnectionStatus = "disconnected";
let legacyImportPromise: Promise<void> | null = null;

const lidToPhoneJid = new Map<string, string>();
const eventControllers = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

type ContactLike = { id?: string | null; lid?: string | null };
type IMessage = NonNullable<WAMessage["message"]>;

function emitEvent(payload: WhatsAppEventPayload) {
  const chunk = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  for (const controller of eventControllers) {
    try {
      controller.enqueue(chunk);
    } catch {
      eventControllers.delete(controller);
    }
  }
}

function emitStatusEvent() {
  emitEvent({
    type: "status",
    status: connectionStatus,
    qr: qrCode,
  });
}

function emitThreadChanged(phone: string, threadId?: string) {
  emitEvent({
    type: "thread_changed",
    phone,
    threadId,
  });
}

export function createEventStream(signal: AbortSignal) {
  return new ReadableStream({
    start(controller) {
      eventControllers.add(controller);
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "status",
            status: connectionStatus,
            qr: qrCode,
          } satisfies WhatsAppEventPayload)}\n\n`
        )
      );

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(heartbeat);
          eventControllers.delete(controller);
        }
      }, 5000);

      signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        eventControllers.delete(controller);
        controller.close();
      });
    },
  });
}

function resolveJid(jid: string): string {
  if (jid.endsWith("@lid")) {
    return lidToPhoneJid.get(jid) ?? jid;
  }

  return jid;
}

function jidToPhone(jid: string): string {
  return normalizePhone(
    jid.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "")
  );
}

function extractText(message: IMessage): string {
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    message.ephemeralMessage?.message?.conversation ??
    message.ephemeralMessage?.message?.extendedTextMessage?.text ??
    message.viewOnceMessage?.message?.conversation ??
    message.viewOnceMessage?.message?.extendedTextMessage?.text ??
    ""
  );
}

async function ensureLegacyImport() {
  if (!legacyImportPromise) {
    legacyImportPromise = importLegacyMessagesIfNeeded().catch((error) => {
      console.error("[WhatsApp] Legacy import failed:", error);
    });
  }

  await legacyImportPromise;
}

async function persistAndNotify(args: {
  id: string;
  phone: string;
  jid: string;
  direction: "in" | "out";
  senderType: "patient" | "staff" | "assistant";
  text: string;
  timestamp: number;
  pushName?: string;
  source:
    | "history_sync"
    | "incoming"
    | "manual_send"
    | "auto_reply"
    | "legacy_import"
    | "outgoing_sync";
}, notify: boolean = true) {
  const result = await persistWhatsAppMessage(args);
  if (notify && result.inserted) {
    emitThreadChanged(args.phone, result.threadId);
  }
  return result;
}

async function sendOutboundMessage(args: {
  jid: string;
  phone: string;
  text: string;
  senderType: "staff" | "assistant";
  source: "manual_send" | "auto_reply";
}) {
  if (!sock) {
    throw new Error("WhatsApp not connected");
  }

  const sent = await sock.sendMessage(args.jid, { text: args.text });
  const timestamp = Date.now();
  const messageId = sent?.key?.id ?? `${args.source}-${timestamp}-${args.phone}`;

  await persistAndNotify({
    id: messageId,
    phone: args.phone,
    jid: args.jid,
    direction: "out",
    senderType: args.senderType,
    text: args.text,
    timestamp,
    source: args.source,
  });
}

async function applyContacts(contacts: ContactLike[]) {
  for (const contact of contacts) {
    if (!contact.lid || !contact.id) continue;

    lidToPhoneJid.set(contact.lid, contact.id);

    const lidPhone = jidToPhone(contact.lid);
    const realPhone = jidToPhone(contact.id);

    if (!lidPhone || !realPhone || lidPhone === realPhone) continue;

    try {
      const repairedThreadId = await repairThreadIdentity({
        fromPhone: lidPhone,
        toPhone: realPhone,
        toJid: contact.id,
      });

      if (repairedThreadId) {
        emitThreadChanged(realPhone, repairedThreadId);
      }
    } catch (error) {
      console.error("[WhatsApp] Failed to repair LID thread identity:", error);
    }
  }
}

export function getQRCode() {
  return qrCode;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export async function connectWhatsApp() {
  await ensureLegacyImport();

  const { state, saveCreds } = await baileysMultiFileAuthState("./sessions/clinic-bot");
  const { version } = await fetchLatestBaileysVersion();

  connectionStatus = "connecting";
  emitStatusEvent();
  console.log("[WhatsApp] Connecting...");

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    markOnlineOnConnect: false,
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: true,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      connectionStatus = "connecting";
      emitStatusEvent();
      console.log("[WhatsApp] QR code generated");
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      connectionStatus = "disconnected";
      emitStatusEvent();
      console.log("[WhatsApp] Connection closed, reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => connectWhatsApp(), 3000);
      }
    }

    if (connection === "open") {
      qrCode = null;
      connectionStatus = "connected";
      emitStatusEvent();
      console.log("[WhatsApp] Connected successfully");
    }
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("contacts.upsert", (contacts) => {
    void applyContacts(contacts);
  });
  sock.ev.on("contacts.update", (updates) => {
    void applyContacts(updates as ContactLike[]);
  });

  sock.ev.on("messaging-history.set", ({ messages, contacts }) => {
    if (contacts?.length) {
      void applyContacts(contacts);
    }

    void (async () => {
      const changedThreads = new Map<string, string>();

      for (const message of messages) {
        if (!message.key.remoteJid || !message.message) continue;

        const text = extractText(message.message);
        if (!text) continue;

        const resolvedJid = resolveJid(message.key.remoteJid);
        if (resolvedJid.endsWith("@g.us")) continue;

        const phone = jidToPhone(resolvedJid);
        if (!phone) continue;

        const timestamp = message.messageTimestamp
          ? Number(message.messageTimestamp) * 1000
          : Date.now();
        const messageId =
          message.key.id ??
          `history-${phone}-${message.key.fromMe ? "out" : "in"}-${timestamp}`;

        try {
          const result = await persistAndNotify(
            {
              id: messageId,
              phone,
              jid: resolvedJid,
              direction: message.key.fromMe ? "out" : "in",
              senderType: message.key.fromMe ? "staff" : "patient",
              text,
              timestamp,
              pushName: message.pushName ?? undefined,
              source: "history_sync",
            },
            false
          );

          if (result.inserted) {
            changedThreads.set(phone, result.threadId);
          }
        } catch (error) {
          console.error("[WhatsApp] Failed to persist history message:", error);
        }
      }

      for (const [phone, threadId] of changedThreads.entries()) {
        emitThreadChanged(phone, threadId);
      }
    })();
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      if (!message.message) continue;

      const rawJid = message.key.remoteJid;
      if (!rawJid || rawJid.endsWith("@g.us")) continue;

      const resolvedJid = resolveJid(rawJid);
      const phone = jidToPhone(resolvedJid);
      if (!phone) continue;

      const text = extractText(message.message);
      if (!text) continue;

      const timestamp = message.messageTimestamp
        ? Number(message.messageTimestamp) * 1000
        : Date.now();
      const messageId =
        message.key.id ??
        `live-${phone}-${message.key.fromMe ? "out" : "in"}-${timestamp}`;

      try {
        const persisted = await persistAndNotify({
          id: messageId,
          phone,
          jid: resolvedJid,
          direction: message.key.fromMe ? "out" : "in",
          senderType: message.key.fromMe ? "staff" : "patient",
          text,
          timestamp,
          pushName: message.pushName ?? undefined,
          source: message.key.fromMe ? "outgoing_sync" : "incoming",
        });

        console.log(
          `[WhatsApp] ${message.key.fromMe ? "Sent" : "Received"} (${phone}): ${text}`
        );

        if (message.key.fromMe || !persisted.inserted) {
          continue;
        }

        const reply = await handleMessage(phone, text);
        await sendOutboundMessage({
          jid: resolvedJid,
          phone,
          text: reply,
          senderType: "assistant",
          source: "auto_reply",
        });
        console.log(`[WhatsApp] Reply sent to ${resolvedJid}`);
      } catch (error) {
        console.error("[WhatsApp] Error handling live message:", error);

        try {
          await sendOutboundMessage({
            jid: resolvedJid,
            phone,
            text: "Sorry, something went wrong. Please try again.",
            senderType: "assistant",
            source: "auto_reply",
          });
        } catch (fallbackError) {
          console.error("[WhatsApp] Failed to send fallback reply:", fallbackError);
        }
      }
    }
  });
}

export async function sendMessage(jid: string, text: string) {
  const phone = jidToPhone(jid);
  if (!phone) {
    throw new Error("Invalid phone number");
  }

  await sendOutboundMessage({
    jid,
    phone,
    text,
    senderType: "staff",
    source: "manual_send",
  });
}
