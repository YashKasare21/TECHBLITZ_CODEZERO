"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  WhatsappLogo,
  PaperPlaneTilt,
  ArrowClockwise,
  CircleDashed,
  CheckCircle,
  XCircle,
  MagnifyingGlass,
  ChatCircle,
  Users,
  Phone,
} from "@phosphor-icons/react";

interface BotMessage {
  jid: string;
  direction: "in" | "out";
  text: string;
  timestamp: number;
}

interface Conversation {
  jid: string;
  phone: string;
  patient: Patient | null;
  messages: BotMessage[];
  lastMessage: BotMessage | null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function jidToPhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "");
}

function phoneToJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [qr, setQr] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"chats" | "people">("chats");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setStatus(data.status);
      setQr(data.qr);
    } catch {
      setStatus("disconnected");
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/messages");
      const data = await res.json();
      setMessages(data);
    } catch {}
  }, []);

  useEffect(() => {
    supabase
      .from("patients")
      .select("*")
      .order("full_name")
      .limit(500)
      .then(({ data }) => setPatients(data || []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 3000);
    fetchStatus();
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    // Poll faster when a chat is open so new messages appear quickly.
    const interval = setInterval(fetchMessages, selectedJid ? 2000 : 5000);
    fetchMessages();
    return () => clearInterval(interval);
  }, [fetchMessages, selectedJid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedJid, messages]);

  // Build patient lookup by normalized phone
  const patientByPhone = new Map<string, Patient>();
  for (const p of patients) {
    if (p.phone) {
      patientByPhone.set(normalizePhone(p.phone), p);
    }
  }

  // Group messages into conversations keyed by normalized phone number.
  // This merges any messages that arrive under @lid vs @s.whatsapp.net for
  // the same contact (can happen before the bot's contacts map is built).
  const conversationMap = new Map<string, BotMessage[]>();
  // Also track the canonical JID seen for each phone number (prefer @s.whatsapp.net).
  const phoneToCanonicalJid = new Map<string, string>();

  for (const msg of messages) {
    const phone = normalizePhone(jidToPhone(msg.jid));
    const existing = conversationMap.get(phone) ?? [];
    existing.push(msg);
    conversationMap.set(phone, existing);
    // Prefer @s.whatsapp.net as the canonical JID; fall back to whatever we have.
    const current = phoneToCanonicalJid.get(phone);
    if (!current || msg.jid.endsWith("@s.whatsapp.net")) {
      phoneToCanonicalJid.set(phone, msg.jid);
    }
  }

  const conversations: Conversation[] = Array.from(conversationMap.entries())
    .map(([phone, msgs]) => {
      const jid = phoneToCanonicalJid.get(phone) ?? `${phone}@s.whatsapp.net`;
      const patient = patientByPhone.get(phone) ?? null;
      const sorted = [...msgs].sort((a, b) => a.timestamp - b.timestamp);
      return { jid, phone, patient, messages: sorted, lastMessage: sorted[sorted.length - 1] ?? null };
    })
    .sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));

  // Add stub entries for patients who have a phone number but no messages in the log
  const phonesWithMessages = new Set(conversations.map((c) => normalizePhone(c.phone)));
  for (const p of patients) {
    if (!p.phone) continue;
    const phone = normalizePhone(p.phone);
    if (!phonesWithMessages.has(phone)) {
      conversations.push({
        jid: phoneToJid(p.phone),
        phone,
        patient: p,
        messages: [],
        lastMessage: null,
      });
    }
  }

  const searchLower = search.toLowerCase();

  const filteredConversations = conversations.filter((c) => {
    if (!search) return true;
    return (
      c.phone.includes(search) ||
      (c.patient?.full_name.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const filteredPatients = [...patients]
    .filter((p) => {
      if (!search) return true;
      return (
        p.full_name.toLowerCase().includes(searchLower) ||
        (p.phone?.includes(search) ?? false)
      );
    })
    .sort((a, b) => {
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

  const activeMessages = selectedJid
    ? [...(conversationMap.get(normalizePhone(jidToPhone(selectedJid))) ?? [])].sort(
        (a, b) => a.timestamp - b.timestamp
      )
    : [];

  const activeConversation = selectedJid
    ? conversations.find((c) => c.jid === selectedJid) ?? null
    : null;

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!inputText.trim() || !selectedJid || status !== "connected") return;
    const text = inputText.trim();
    setSending(true);
    setInputText("");
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: jidToPhone(selectedJid), message: text }),
      });
      if (res.ok) {
        setTimeout(fetchMessages, 1000);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to send");
        setInputText(text);
      }
    } catch {
      toast.error("Network error");
      setInputText(text);
    } finally {
      setSending(false);
    }
  }

  function openChatForPatient(patient: Patient) {
    if (!patient.phone) return;
    setSelectedJid(phoneToJid(patient.phone));
    setLeftTab("chats");
    setSearch("");
  }

  const statusConfig = {
    disconnected: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      label: "Disconnected",
      variant: "destructive" as const,
    },
    connecting: {
      icon: <CircleDashed className="h-3.5 w-3.5 animate-spin" />,
      label: "Scanning QR…",
      variant: "secondary" as const,
    },
    connected: {
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      label: "Connected",
      variant: "default" as const,
    },
  };

  const sc = statusConfig[status];

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WhatsappLogo className="h-6 w-6 text-[#25D366]" weight="duotone" />
          <div>
            <h1 className="text-2xl font-semibold">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Clinic messaging &amp; booking assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sc.variant} className="gap-1.5 px-2.5 py-1 text-xs">
            {sc.icon}
            {sc.label}
          </Badge>
          <Button size="icon" variant="ghost" onClick={fetchStatus} className="h-8 w-8">
            <ArrowClockwise className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* QR / Offline Banner */}
      {status !== "connected" && (
        <div className="rounded-lg border border-border bg-accent/50 px-4 py-3">
          {status === "connecting" && qr ? (
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-md border border-border bg-white p-2">
                <pre className="select-none font-mono text-[5px] leading-[5px]">{qr}</pre>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Scan to connect</p>
                <p className="text-xs text-muted-foreground">
                  Open WhatsApp on your phone → Linked Devices → Link a Device
                </p>
                <p className="text-xs text-muted-foreground">QR refreshes automatically</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CircleDashed className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Bot server not running</p>
                <p className="text-xs text-muted-foreground">
                  Run{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">cd bot && bun dev</code>{" "}
                  to start
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
        {/* Left Sidebar */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border">
          {/* Tab Strip */}
          <div className="flex shrink-0 border-b border-border">
            <button
              onClick={() => { setLeftTab("chats"); setSearch(""); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
                leftTab === "chats"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ChatCircle className="h-3.5 w-3.5" />
              Chats
              {conversations.length > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {conversations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setLeftTab("people"); setSearch(""); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
                leftTab === "people"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Patients
              {patients.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {patients.length}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="shrink-0 p-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={leftTab === "chats" ? "Search chats…" : "Search patients…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 bg-accent pl-8 text-sm"
              />
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {leftTab === "chats" ? (
              filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <ChatCircle className="h-8 w-8 text-muted-foreground/30" weight="duotone" />
                  <p className="text-xs text-muted-foreground">
                    {status === "connected" ? "No conversations yet" : "Connect to see chats"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredConversations.map((c) => (
                    <button
                      key={c.jid}
                      onClick={() => setSelectedJid(c.jid)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                        selectedJid === c.jid && "bg-accent"
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {c.patient
                          ? c.patient.full_name.charAt(0).toUpperCase()
                          : c.phone.slice(-2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {c.patient ? c.patient.full_name : `+${c.phone}`}
                          </span>
                          {c.lastMessage && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatTime(c.lastMessage.timestamp)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-foreground/60">
                          {c.lastMessage ? (
                            <>
                              {c.lastMessage.direction === "out" && (
                                <span className="mr-1 text-[#25D366]">You:</span>
                              )}
                              {c.lastMessage.text}
                            </>
                          ) : (
                            <span className="italic text-muted-foreground/50">No messages yet</span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              /* Patients tab */
              filteredPatients.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30" weight="duotone" />
                  <p className="text-xs text-muted-foreground">No patients found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredPatients.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          p.phone
                            ? "bg-[#25D366]/10 text-[#25D366]"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {p.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.full_name}</p>
                        {p.phone ? (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/40">No phone number</p>
                        )}
                      </div>
                      {p.phone && (
                        <Button
                          size="sm"
                          variant={
                            selectedJid === phoneToJid(p.phone) ? "default" : "outline"
                          }
                          className="h-7 shrink-0 gap-1 px-2 text-xs"
                          onClick={() => openChatForPatient(p)}
                          disabled={status !== "connected"}
                          title={
                            status !== "connected"
                              ? "Connect WhatsApp first"
                              : `Chat with ${p.full_name}`
                          }
                        >
                          <WhatsappLogo className="h-3.5 w-3.5" />
                          Chat
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </ScrollArea>
        </div>

        {/* Right: Chat Window */}
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedJid ? (
            <>
              {/* Chat Header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {activeConversation?.patient
                    ? activeConversation.patient.full_name.charAt(0).toUpperCase()
                    : (activeConversation?.phone.slice(-2) ?? "?")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {activeConversation?.patient?.full_name ?? `+${activeConversation?.phone}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    +{jidToPhone(selectedJid)}
                    {activeConversation?.patient && (
                      <span className="ml-2 text-[#25D366]">· Saved patient</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchMessages}
                  className="h-7 w-7 p-0"
                >
                  <ArrowClockwise className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-5 py-4">
                {activeMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-center">
                    <ChatCircle className="h-10 w-10 text-muted-foreground/20" weight="duotone" />
                    <p className="text-sm text-muted-foreground">No messages in log</p>
                    <p className="text-xs text-muted-foreground/60">
                      Type below to start the conversation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeMessages.map((msg, i) => {
                      const showDate =
                        i === 0 ||
                        new Date(activeMessages[i - 1].timestamp).toDateString() !==
                          new Date(msg.timestamp).toDateString();
                      return (
                        <div key={i}>
                          {showDate && (
                            <div className="my-3 flex items-center gap-3">
                              <div className="h-px flex-1 bg-border" />
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(msg.timestamp).toLocaleDateString([], {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <div className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex",
                              msg.direction === "out" ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                                msg.direction === "out"
                                  ? "rounded-br-sm bg-[#25D366]/15 text-foreground"
                                  : "rounded-bl-sm bg-accent text-foreground"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {msg.text}
                              </p>
                              <p
                                className={cn(
                                  "mt-1 text-right text-[10px]",
                                  msg.direction === "out"
                                    ? "text-[#25D366]/70"
                                    : "text-muted-foreground/60"
                                )}
                              >
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="shrink-0 border-t border-border p-3">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    placeholder={
                      status === "connected" ? "Type a message… (Enter to send)" : "Bot disconnected"
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={status !== "connected" || sending}
                    className="bg-accent"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!inputText.trim() || status !== "connected" || sending}
                  >
                    <PaperPlaneTilt className="h-4 w-4" weight="bold" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            /* Empty state — no chat selected */
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/10">
                <WhatsappLogo className="h-8 w-8 text-[#25D366]" weight="duotone" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Select a conversation</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Pick a chat from the left, or go to the{" "}
                  <button
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => setLeftTab("people")}
                  >
                    Patients
                  </button>{" "}
                  tab to start a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
