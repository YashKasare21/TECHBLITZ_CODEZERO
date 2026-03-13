import { existsSync, readFileSync } from "node:fs";
import {
  buildCanonicalJid,
  buildFallbackJid,
  isLikelyCanonicalPhone,
  normalizePhone,
  type WhatsAppMessageDirection,
  type WhatsAppMessageSource,
  type WhatsAppSenderType,
} from "../lib/whatsapp";
import { supabase } from "./supabase";

const LEGACY_LOG_PATH = "./sessions/messages.json";

type ThreadRow = {
  id: string;
  phone: string;
  jid: string;
  push_name: string | null;
  patient_id: string | null;
  unmatched: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
};

type LegacyMessage = {
  id: string;
  phone: string;
  direction: WhatsAppMessageDirection;
  text: string;
  timestamp: number;
  pushName?: string;
};

export interface PersistWhatsAppMessageInput {
  id: string;
  phone: string;
  jid: string;
  direction: WhatsAppMessageDirection;
  senderType: WhatsAppSenderType;
  text: string;
  timestamp: number;
  pushName?: string;
  source: WhatsAppMessageSource;
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function inferStoredJid(phone: string): string {
  return isLikelyCanonicalPhone(phone) ? buildCanonicalJid(phone) : buildFallbackJid(phone);
}

async function findPatientIdByPhone(phone: string): Promise<string | null> {
  if (!isLikelyCanonicalPhone(phone)) return null;

  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[WhatsAppStore] Failed to match patient by phone:", error.message);
    return null;
  }

  return data?.id ?? null;
}

async function getThreadByPhone(phone: string): Promise<ThreadRow | null> {
  const { data, error } = await supabase
    .from("whatsapp_threads")
    .select(
      "id, phone, jid, push_name, patient_id, unmatched, last_message_at, last_message_preview"
    )
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("[WhatsAppStore] Failed to load thread:", error.message);
    return null;
  }

  return data;
}

async function refreshThreadSummary(threadId: string) {
  const { data: latest, error } = await supabase
    .from("whatsapp_messages")
    .select("raw_timestamp, text")
    .eq("thread_id", threadId)
    .order("raw_timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[WhatsAppStore] Failed to refresh thread summary:", error.message);
    return;
  }

  await supabase
    .from("whatsapp_threads")
    .update({
      last_message_at: latest?.raw_timestamp ?? null,
      last_message_preview: latest?.text ?? null,
    })
    .eq("id", threadId);
}

async function ensureThreadRecord(args: {
  phone: string;
  jid: string;
  pushName?: string;
  timestamp?: number;
  preview?: string;
}): Promise<ThreadRow> {
  const phone = normalizePhone(args.phone);
  const patientId = await findPatientIdByPhone(phone);
  const unmatched = !isLikelyCanonicalPhone(phone) || args.jid.endsWith("@lid");
  const existing = await getThreadByPhone(phone);
  const nextLastMessageAt = args.timestamp ? toIsoString(args.timestamp) : existing?.last_message_at ?? null;
  const nextPreview = args.preview ?? existing?.last_message_preview ?? null;

  if (!existing) {
    const { data, error } = await supabase
      .from("whatsapp_threads")
      .insert({
        phone,
        jid: args.jid,
        push_name: args.pushName ?? null,
        patient_id: patientId,
        unmatched,
        last_message_at: nextLastMessageAt,
        last_message_preview: nextPreview,
      })
      .select(
        "id, phone, jid, push_name, patient_id, unmatched, last_message_at, last_message_preview"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create WhatsApp thread");
    }

    return data;
  }

  const updates: Partial<ThreadRow> = {};

  if (existing.jid !== args.jid) updates.jid = args.jid;
  if (args.pushName && args.pushName !== existing.push_name) updates.push_name = args.pushName;
  if (existing.patient_id !== patientId) updates.patient_id = patientId;
  if (existing.unmatched !== unmatched) updates.unmatched = unmatched;

  if (
    args.timestamp &&
    (!existing.last_message_at ||
      new Date(nextLastMessageAt ?? 0).getTime() >= new Date(existing.last_message_at).getTime())
  ) {
    updates.last_message_at = nextLastMessageAt;
    updates.last_message_preview = nextPreview;
  }

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from("whatsapp_threads")
      .update(updates)
      .eq("id", existing.id)
      .select(
        "id, phone, jid, push_name, patient_id, unmatched, last_message_at, last_message_preview"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update WhatsApp thread");
    }

    return data;
  }

  return existing;
}

export async function persistWhatsAppMessage(
  input: PersistWhatsAppMessageInput
): Promise<{ threadId: string; inserted: boolean }> {
  const phone = normalizePhone(input.phone);
  const jid = input.jid || inferStoredJid(phone);
  const thread = await ensureThreadRecord({
    phone,
    jid,
    pushName: input.pushName,
    timestamp: input.timestamp,
    preview: input.text,
  });

  const { error } = await supabase.from("whatsapp_messages").insert({
    id: input.id,
    thread_id: thread.id,
    phone,
    jid,
    direction: input.direction,
    sender_type: input.senderType,
    text: input.text,
    raw_timestamp: toIsoString(input.timestamp),
    push_name: input.pushName ?? null,
    source: input.source,
  });

  if (error) {
    if (error.code === "23505") {
      return { threadId: thread.id, inserted: false };
    }

    throw new Error(error.message);
  }

  return { threadId: thread.id, inserted: true };
}

export async function repairThreadIdentity(args: {
  fromPhone: string;
  toPhone: string;
  toJid: string;
  pushName?: string;
}): Promise<string | null> {
  const fromPhone = normalizePhone(args.fromPhone);
  const toPhone = normalizePhone(args.toPhone);

  if (!fromPhone || !toPhone || fromPhone === toPhone) {
    return null;
  }

  const source = await getThreadByPhone(fromPhone);
  if (!source) {
    return null;
  }

  const patientId = await findPatientIdByPhone(toPhone);
  const target = await getThreadByPhone(toPhone);

  if (!target) {
    const { data, error } = await supabase
      .from("whatsapp_threads")
      .update({
        phone: toPhone,
        jid: args.toJid,
        push_name: args.pushName ?? source.push_name,
        patient_id: patientId,
        unmatched: false,
      })
      .eq("id", source.id)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to repair WhatsApp thread identity");
    }

    await supabase
      .from("whatsapp_messages")
      .update({ phone: toPhone, jid: args.toJid })
      .eq("thread_id", source.id);

    await refreshThreadSummary(source.id);
    return source.id;
  }

  const { error: moveError } = await supabase
    .from("whatsapp_messages")
    .update({ thread_id: target.id, phone: toPhone, jid: args.toJid })
    .eq("thread_id", source.id);

  if (moveError) {
    throw new Error(moveError.message);
  }

  const { error: deleteError } = await supabase
    .from("whatsapp_threads")
    .delete()
    .eq("id", source.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await supabase
    .from("whatsapp_threads")
    .update({
      jid: args.toJid,
      push_name: args.pushName ?? target.push_name,
      patient_id: patientId,
      unmatched: false,
    })
    .eq("id", target.id);

  await refreshThreadSummary(target.id);
  return target.id;
}

export async function importLegacyMessagesIfNeeded() {
  if (!existsSync(LEGACY_LOG_PATH)) {
    return;
  }

  const { count, error: countError } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("[WhatsAppStore] Failed to check message count:", countError.message);
    return;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  let legacyMessages: LegacyMessage[] = [];

  try {
    legacyMessages = JSON.parse(readFileSync(LEGACY_LOG_PATH, "utf8")) as LegacyMessage[];
  } catch (error) {
    console.error("[WhatsAppStore] Failed to read legacy message log:", error);
    return;
  }

  if (legacyMessages.length === 0) {
    return;
  }

  const { data: patients, error: patientError } = await supabase
    .from("patients")
    .select("id, phone");

  if (patientError) {
    console.error("[WhatsAppStore] Failed to preload patients for legacy import:", patientError.message);
    return;
  }

  const patientMap = new Map<string, string>();
  for (const patient of patients ?? []) {
    const phone = normalizePhone(patient.phone);
    if (phone) {
      patientMap.set(phone, patient.id);
    }
  }

  const threadMap = new Map<
    string,
    {
      phone: string;
      jid: string;
      push_name: string | null;
      patient_id: string | null;
      unmatched: boolean;
      last_message_at: string | null;
      last_message_preview: string | null;
    }
  >();

  for (const message of legacyMessages) {
    const phone = normalizePhone(message.phone);
    if (!phone || !message.id || !message.text) continue;

    const existing = threadMap.get(phone);
    const timestamp = toIsoString(message.timestamp);
    const unmatched = !isLikelyCanonicalPhone(phone);
    const jid = inferStoredJid(phone);

    if (!existing) {
      threadMap.set(phone, {
        phone,
        jid,
        push_name: message.pushName ?? null,
        patient_id: patientMap.get(phone) ?? null,
        unmatched,
        last_message_at: timestamp,
        last_message_preview: message.text,
      });
      continue;
    }

    if (message.pushName && !existing.push_name) {
      existing.push_name = message.pushName;
    }

    if (
      !existing.last_message_at ||
      new Date(timestamp).getTime() >= new Date(existing.last_message_at).getTime()
    ) {
      existing.last_message_at = timestamp;
      existing.last_message_preview = message.text;
    }
  }

  const threadRows = [...threadMap.values()];
  if (threadRows.length === 0) {
    return;
  }

  const { error: threadError } = await supabase
    .from("whatsapp_threads")
    .upsert(threadRows, { onConflict: "phone" });

  if (threadError) {
    console.error("[WhatsAppStore] Failed to import legacy threads:", threadError.message);
    return;
  }

  const phones = threadRows.map((thread) => thread.phone);
  const threadIdMap = new Map<string, { id: string; jid: string }>();

  for (let index = 0; index < phones.length; index += 200) {
    const chunk = phones.slice(index, index + 200);
    const { data, error } = await supabase
      .from("whatsapp_threads")
      .select("id, phone, jid")
      .in("phone", chunk);

    if (error) {
      console.error("[WhatsAppStore] Failed to load imported thread IDs:", error.message);
      return;
    }

    for (const row of data ?? []) {
      threadIdMap.set(row.phone, { id: row.id, jid: row.jid });
    }
  }

  for (let index = 0; index < legacyMessages.length; index += 250) {
    const chunk = legacyMessages.slice(index, index + 250);
    const rows = chunk
      .map((message) => {
        const phone = normalizePhone(message.phone);
        const thread = threadIdMap.get(phone);
        if (!thread || !message.id || !message.text) {
          return null;
        }

        return {
          id: message.id,
          thread_id: thread.id,
          phone,
          jid: thread.jid,
          direction: message.direction,
          sender_type: message.direction === "in" ? "patient" : "staff",
          text: message.text,
          raw_timestamp: toIsoString(message.timestamp),
          push_name: message.pushName ?? null,
          source: "legacy_import",
        };
      })
      .filter(Boolean);

    if (rows.length === 0) continue;

    const { error } = await supabase
      .from("whatsapp_messages")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      console.error("[WhatsAppStore] Failed to import legacy messages:", error.message);
      return;
    }
  }

  console.log(`[WhatsAppStore] Imported ${legacyMessages.length} legacy messages`);
}
