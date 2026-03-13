CREATE TABLE whatsapp_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  jid TEXT NOT NULL,
  push_name TEXT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  unmatched BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whatsapp_messages (
  id TEXT PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES whatsapp_threads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  jid TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'staff', 'assistant')),
  text TEXT NOT NULL,
  raw_timestamp TIMESTAMPTZ NOT NULL,
  push_name TEXT,
  source TEXT NOT NULL CHECK (
    source IN ('history_sync', 'incoming', 'manual_send', 'auto_reply', 'legacy_import', 'outgoing_sync')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_threads_last_message_at
  ON whatsapp_threads(last_message_at DESC NULLS LAST);

CREATE INDEX idx_whatsapp_threads_patient_id
  ON whatsapp_threads(patient_id);

CREATE INDEX idx_whatsapp_messages_thread_timestamp
  ON whatsapp_messages(thread_id, raw_timestamp DESC);

CREATE INDEX idx_whatsapp_messages_phone
  ON whatsapp_messages(phone);

CREATE TRIGGER update_whatsapp_threads_updated_at
  BEFORE UPDATE ON whatsapp_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read whatsapp threads"
  ON whatsapp_threads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read whatsapp messages"
  ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);
