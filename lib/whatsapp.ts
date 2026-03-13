export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected";

export type WhatsAppMessageDirection = "in" | "out";

export type WhatsAppSenderType = "patient" | "staff" | "assistant";

export type WhatsAppMessageSource =
  | "history_sync"
  | "incoming"
  | "manual_send"
  | "auto_reply"
  | "legacy_import"
  | "outgoing_sync";

export interface WhatsAppPatientSummary {
  id: string;
  full_name: string;
  phone: string | null;
  patient_uid: string;
}

export interface WhatsAppThread {
  id: string;
  phone: string;
  jid: string;
  pushName: string | null;
  unmatched: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  patient: WhatsAppPatientSummary | null;
}

export interface WhatsAppMessage {
  id: string;
  threadId: string;
  phone: string;
  jid: string;
  direction: WhatsAppMessageDirection;
  senderType: WhatsAppSenderType;
  text: string;
  timestamp: string;
  pushName: string | null;
  source: WhatsAppMessageSource;
}

export interface WhatsAppStatusPayload {
  status: WhatsAppConnectionStatus;
  qr: string | null;
}

export interface WhatsAppEventPayload {
  type: "thread_changed" | "status";
  phone?: string;
  threadId?: string;
  status?: WhatsAppConnectionStatus;
  qr?: string | null;
}

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function isLikelyCanonicalPhone(phone: string): boolean {
  return /^\d{10,15}$/.test(phone);
}

export function buildCanonicalJid(phone: string): string {
  return `${phone}@s.whatsapp.net`;
}

export function buildFallbackJid(phone: string): string {
  return `${phone}@lid`;
}
