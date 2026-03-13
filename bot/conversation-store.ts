import type { CoreMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const HISTORY_LIMIT = 20;
const DB_SEED_LIMIT = 10;

const conversations = new Map<string, CoreMessage[]>();
const seeded = new Set<string>();

async function seedFromDb(phone: string): Promise<void> {
  if (seeded.has(phone)) return;
  seeded.add(phone);

  try {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("direction, sender_type, text")
      .eq("phone", phone)
      .order("raw_timestamp", { ascending: false })
      .limit(DB_SEED_LIMIT);

    if (!data || data.length === 0) return;

    // Messages came back newest-first; reverse to chronological order
    const messages: CoreMessage[] = data
      .reverse()
      .map((row) => ({
        role: row.direction === "out" ? ("assistant" as const) : ("user" as const),
        content: row.text as string,
      }));

    // Only seed if not already populated (race condition guard)
    if (!conversations.has(phone)) {
      conversations.set(phone, messages);
    }
  } catch (error) {
    console.error("[ConversationStore] DB seed failed:", error);
  }
}

export async function getHistory(phone: string): Promise<CoreMessage[]> {
  await seedFromDb(phone);
  return conversations.get(phone) || [];
}

export function addMessage(
  phone: string,
  role: "user" | "assistant",
  content: string
) {
  const history = conversations.get(phone) || [];
  history.push({ role, content });
  if (history.length > HISTORY_LIMIT) {
    history.splice(0, history.length - HISTORY_LIMIT);
  }
  conversations.set(phone, history);
}

export function clearHistory(phone: string) {
  conversations.delete(phone);
  seeded.delete(phone);
}
