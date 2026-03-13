import { createServiceClient } from "@/lib/supabase/server";
import type {
  WhatsAppMessage,
  WhatsAppPatientSummary,
  WhatsAppThread,
} from "@/lib/whatsapp";

type ThreadRow = {
  id: string;
  phone: string;
  jid: string;
  push_name: string | null;
  unmatched: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  patient: WhatsAppPatientSummary | WhatsAppPatientSummary[] | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  phone: string;
  jid: string;
  direction: "in" | "out";
  sender_type: "patient" | "staff" | "assistant";
  text: string;
  raw_timestamp: string;
  push_name: string | null;
  source:
    | "history_sync"
    | "incoming"
    | "manual_send"
    | "auto_reply"
    | "legacy_import"
    | "outgoing_sync";
};

function mapPatient(
  patient: WhatsAppPatientSummary | WhatsAppPatientSummary[] | null
): WhatsAppPatientSummary | null {
  if (!patient) return null;
  return Array.isArray(patient) ? patient[0] ?? null : patient;
}

function mapThread(row: ThreadRow): WhatsAppThread {
  return {
    id: row.id,
    phone: row.phone,
    jid: row.jid,
    pushName: row.push_name,
    unmatched: row.unmatched,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    patient: mapPatient(row.patient),
  };
}

function mapMessage(row: MessageRow): WhatsAppMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    phone: row.phone,
    jid: row.jid,
    direction: row.direction,
    senderType: row.sender_type,
    text: row.text,
    timestamp: row.raw_timestamp,
    pushName: row.push_name,
    source: row.source,
  };
}

export async function listWhatsAppThreads(): Promise<WhatsAppThread[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("whatsapp_threads")
    .select(
      "id, phone, jid, push_name, unmatched, last_message_at, last_message_preview, patient:patients(id, full_name, phone, patient_uid)"
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapThread(row as ThreadRow));
}

export async function listWhatsAppMessagesByThread(
  threadId: string
): Promise<WhatsAppMessage[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, thread_id, phone, jid, direction, sender_type, text, raw_timestamp, push_name, source"
    )
    .eq("thread_id", threadId)
    .order("raw_timestamp", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapMessage(row as MessageRow));
}

export async function findWhatsAppThreadByPhone(
  phone: string
): Promise<WhatsAppThread | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("whatsapp_threads")
    .select(
      "id, phone, jid, push_name, unmatched, last_message_at, last_message_preview, patient:patients(id, full_name, phone, patient_uid)"
    )
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapThread(data as ThreadRow) : null;
}
