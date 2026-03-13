"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";
import {
  normalizePhone,
  type WhatsAppEventPayload,
  type WhatsAppMessage,
  type WhatsAppStatusPayload,
  type WhatsAppThread,
} from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import {
  ArrowClockwise,
  ChatCircle,
  CheckCircle,
  CircleDashed,
  MagnifyingGlass,
  PaperPlaneTilt,
  Phone,
  Users,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react";

function formatSidebarTime(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function WhatsAppAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedPhoneRef = useRef<string | null>(null);

  const [status, setStatus] = useState<WhatsAppStatusPayload["status"]>("disconnected");
  const [qr, setQr] = useState<string | null>(null);
  const [threads, setThreads] = useState<WhatsAppThread[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [leftTab, setLeftTab] = useState<"chats" | "people">("chats");
  const [search, setSearch] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  const patientByPhone = useMemo(() => {
    const map = new Map<string, Patient>();
    for (const patient of patients) {
      const phone = normalizePhone(patient.phone);
      if (phone) {
        map.set(phone, patient);
      }
    }
    return map;
  }, [patients]);

  const activeThread = selectedPhone
    ? threads.find((thread) => thread.phone === selectedPhone) ?? null
    : null;
  const activePatient = selectedPhone ? patientByPhone.get(selectedPhone) ?? null : null;
  const activeDisplayName =
    activeThread?.patient?.full_name ??
    activePatient?.full_name ??
    activeThread?.pushName ??
    (selectedPhone ? `+${selectedPhone}` : null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = (await response.json()) as WhatsAppStatusPayload;
      setStatus(data.status);
      setQr(data.qr);
    } catch {
      setStatus("disconnected");
      setQr(null);
    }
  }, []);

  const fetchMessagesForThread = useCallback(async (threadId: string | null) => {
    if (!threadId) {
      setActiveMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/whatsapp/threads/${threadId}/messages`, {
        cache: "no-store",
      });
      const data = (await response.json()) as WhatsAppMessage[];
      setActiveMessages(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load chat history");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const refreshThreads = useCallback(async (targetPhone?: string | null) => {
    const activePhone = targetPhone ?? selectedPhoneRef.current;

    setLoadingThreads(true);
    try {
      const response = await fetch("/api/whatsapp/threads", { cache: "no-store" });
      const data = (await response.json()) as WhatsAppThread[];
      const nextThreads = Array.isArray(data) ? data : [];

      setThreads(nextThreads);

      if (!activePhone) {
        return;
      }

      const nextActiveThread = nextThreads.find((thread) => thread.phone === activePhone) ?? null;
      await fetchMessagesForThread(nextActiveThread?.id ?? null);
    } catch {
      toast.error("Failed to load WhatsApp threads");
    } finally {
      setLoadingThreads(false);
    }
  }, [fetchMessagesForThread]);

  useEffect(() => {
    supabase
      .from("patients")
      .select("*")
      .order("full_name")
      .limit(500)
      .then(({ data }) => setPatients(data || []));
  }, [supabase]);

  useEffect(() => {
    void fetchStatus();
    void refreshThreads();
  }, [fetchStatus, refreshThreads]);

  useEffect(() => {
    if (!activeThread?.id) {
      setActiveMessages([]);
      return;
    }

    void fetchMessagesForThread(activeThread.id);
  }, [activeThread?.id, fetchMessagesForThread]);

  useEffect(() => {
    const eventSource = new EventSource("/api/whatsapp/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as WhatsAppEventPayload;

        if (payload.type === "status") {
          setStatus(payload.status ?? "disconnected");
          setQr(payload.qr ?? null);
          return;
        }

        if (payload.type === "thread_changed") {
          void refreshThreads(payload.phone ?? selectedPhoneRef.current);
        }
      } catch {
        // Ignore malformed events and keep the stream alive.
      }
    };

    eventSource.onerror = () => {
      void fetchStatus();
    };

    return () => {
      eventSource.close();
    };
  }, [fetchStatus, refreshThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, selectedPhone]);

  const searchLower = search.toLowerCase();
  const filteredThreads = threads.filter((thread) => {
    if (!search) return true;

    return (
      thread.phone.includes(search) ||
      (thread.patient?.full_name.toLowerCase().includes(searchLower) ?? false) ||
      (thread.pushName?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const filteredPatients = [...patients]
    .filter((patient) => {
      if (!search) return true;

      return (
        patient.full_name.toLowerCase().includes(searchLower) ||
        (patient.phone?.includes(search) ?? false)
      );
    })
    .sort((a, b) => {
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

  async function handleSend(event?: React.FormEvent) {
    event?.preventDefault();

    if (!inputText.trim() || !selectedPhone || status !== "connected") {
      return;
    }

    const text = inputText.trim();
    setSending(true);
    setInputText("");

    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: selectedPhone, message: text }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to send message");
      }

      void refreshThreads(selectedPhone);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
      setInputText(text);
    } finally {
      setSending(false);
    }
  }

  function openChatForPatient(patient: Patient) {
    const phone = normalizePhone(patient.phone);
    if (!phone) return;

    setSelectedPhone(phone);
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
      label: "Connecting",
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WhatsappLogo className="h-6 w-6 text-[#25D366]" weight="duotone" />
          <div>
            <h1 className="text-2xl font-semibold">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Live inbox for receptionist and booking assistant traffic
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sc.variant} className="gap-1.5 px-2.5 py-1 text-xs">
            {sc.icon}
            {sc.label}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              void fetchStatus();
              void refreshThreads();
            }}
            className="h-8 w-8"
          >
            <ArrowClockwise className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
                <p className="text-xs text-muted-foreground">
                  Status and new messages will appear live after the device links.
                </p>
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
                  to start the WhatsApp bridge.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
        <div className="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-r border-border">
          <div className="flex shrink-0 border-b border-border">
            <button
              onClick={() => {
                setLeftTab("chats");
                setSearch("");
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
                leftTab === "chats"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ChatCircle className="h-3.5 w-3.5" />
              Chats
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                {threads.length}
              </span>
            </button>
            <button
              onClick={() => {
                setLeftTab("people");
                setSearch("");
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
                leftTab === "people"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Patients
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {patients.length}
              </span>
            </button>
          </div>

          <div className="shrink-0 p-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={leftTab === "chats" ? "Search chats…" : "Search patients…"}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-8 bg-accent pl-8 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {leftTab === "chats" ? (
              loadingThreads ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <CircleDashed className="h-8 w-8 animate-spin text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Loading conversations…</p>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <ChatCircle className="h-8 w-8 text-muted-foreground/30" weight="duotone" />
                  <p className="text-xs text-muted-foreground">
                    {status === "connected" ? "No conversations yet" : "Connect to load chats"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredThreads.map((thread) => {
                    const displayName =
                      thread.patient?.full_name ?? thread.pushName ?? `+${thread.phone}`;
                    const initial = displayName.charAt(0).toUpperCase();
                    const isActive = selectedPhone === thread.phone;

                    return (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedPhone(thread.phone)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                          isActive && "bg-accent"
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium">{displayName}</span>
                              {thread.unmatched && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  Unmatched
                                </Badge>
                              )}
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatSidebarTime(thread.lastMessageAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-foreground/60">
                            {thread.lastMessagePreview ?? "No messages yet"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30" weight="duotone" />
                <p className="text-xs text-muted-foreground">No patients found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        patient.phone
                          ? "bg-[#25D366]/10 text-[#25D366]"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {patient.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{patient.full_name}</p>
                      {patient.phone ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {patient.phone}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40">No phone number</p>
                      )}
                    </div>
                    {patient.phone && (
                      <Button
                        size="sm"
                        variant={
                          selectedPhone === normalizePhone(patient.phone) ? "default" : "outline"
                        }
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => openChatForPatient(patient)}
                        disabled={status !== "connected"}
                        title={
                          status !== "connected"
                            ? "Connect WhatsApp first"
                            : `Chat with ${patient.full_name}`
                        }
                      >
                        <WhatsappLogo className="h-3.5 w-3.5" />
                        Chat
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {selectedPhone ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {(activeDisplayName ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{activeDisplayName}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>+{selectedPhone}</span>
                    {activeThread?.patient && (
                      <span className="text-[#25D366]">Saved patient</span>
                    )}
                    {activeThread?.unmatched && (
                      <span className="text-amber-600">Needs patient match</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void refreshThreads(selectedPhone)}
                  className="h-7 w-7 p-0"
                >
                  <ArrowClockwise className="h-3.5 w-3.5" />
                </Button>
              </div>

              <ScrollArea className="min-h-0 flex-1 px-5 py-4">
                {loadingMessages ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-center">
                    <CircleDashed className="h-8 w-8 animate-spin text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Loading messages…</p>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-center">
                    <ChatCircle
                      className="h-10 w-10 text-muted-foreground/20"
                      weight="duotone"
                    />
                    <p className="text-sm text-muted-foreground">No messages in this thread yet</p>
                    <p className="text-xs text-muted-foreground/60">
                      Send a message below to start the conversation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeMessages.map((message, index) => {
                      const showDate =
                        index === 0 ||
                        new Date(activeMessages[index - 1].timestamp).toDateString() !==
                          new Date(message.timestamp).toDateString();

                      return (
                        <div key={message.id}>
                          {showDate && (
                            <div className="my-3 flex items-center gap-3">
                              <div className="h-px flex-1 bg-border" />
                              <span className="text-[10px] text-muted-foreground">
                                {formatMessageDate(message.timestamp)}
                              </span>
                              <div className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex",
                              message.direction === "out" ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                                message.direction === "out"
                                  ? message.senderType === "assistant"
                                    ? "rounded-br-sm bg-[#25D366]/20 text-foreground"
                                    : "rounded-br-sm bg-[#25D366]/12 text-foreground"
                                  : "rounded-bl-sm bg-accent text-foreground"
                              )}
                            >
                              {message.direction === "out" && message.senderType === "assistant" && (
                                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#25D366]">
                                  Assistant
                                </p>
                              )}
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {message.text}
                              </p>
                              <p
                                className={cn(
                                  "mt-1 text-right text-[10px]",
                                  message.direction === "out"
                                    ? "text-[#25D366]/70"
                                    : "text-muted-foreground/60"
                                )}
                              >
                                {new Date(message.timestamp).toLocaleTimeString([], {
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

              <div className="shrink-0 border-t border-border p-3">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    placeholder={
                      status === "connected"
                        ? "Type a message… (Enter to send)"
                        : "Bot disconnected"
                    }
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
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
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/10">
                <WhatsappLogo className="h-8 w-8 text-[#25D366]" weight="duotone" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Select a conversation</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Choose any live thread on the left, or open the{" "}
                  <button
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => setLeftTab("people")}
                  >
                    Patients
                  </button>{" "}
                  tab to start a new chat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
