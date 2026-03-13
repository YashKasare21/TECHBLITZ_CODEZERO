"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  WhatsappLogo,
  PaperPlaneTilt,
  ArrowClockwise,
  CircleDashed,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";

interface BotMessage {
  jid: string;
  direction: "in" | "out";
  text: string;
  timestamp: number;
}

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [qr, setQr] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [sendPhone, setSendPhone] = useState("");
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 3000);
    fetchStatus();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    fetchMessages();
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setStatus(data.status);
      setQr(data.qr);
    } catch {
      setStatus("disconnected");
    }
  }

  async function fetchMessages() {
    try {
      const res = await fetch("/api/whatsapp/messages");
      const data = await res.json();
      setMessages(data);
    } catch {}
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!sendPhone || !sendText) return;
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: sendPhone,
          message: sendText,
        }),
      });
      if (res.ok) {
        toast.success("Message sent!");
        setSendText("");
        setTimeout(fetchMessages, 1000);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send");
      }
    } finally {
      setSending(false);
    }
  }

  const statusConfig = {
    disconnected: {
      icon: <XCircle className="h-4 w-4" />,
      label: "Disconnected",
      variant: "destructive" as const,
    },
    connecting: {
      icon: <CircleDashed className="h-4 w-4 animate-spin" />,
      label: "Scanning QR...",
      variant: "secondary" as const,
    },
    connected: {
      icon: <CheckCircle className="h-4 w-4" />,
      label: "Connected",
      variant: "default" as const,
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WhatsappLogo className="h-7 w-7 text-[#25D366]" weight="duotone" />
          <div>
            <h1 className="text-2xl font-semibold">WhatsApp Bot</h1>
            <p className="text-sm text-muted-foreground">
              Manage the clinic&apos;s WhatsApp booking assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={currentStatus.variant} className="gap-1.5 px-3 py-1">
            {currentStatus.icon}
            {currentStatus.label}
          </Badge>
          <Button size="icon" variant="ghost" onClick={fetchStatus}>
            <ArrowClockwise className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* QR Code / Status */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Connection</CardTitle>
          </CardHeader>
          <CardContent>
            {status === "connected" ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle className="h-16 w-16 text-success" weight="duotone" />
                <p className="text-sm font-medium text-success">
                  WhatsApp is connected and ready
                </p>
                <p className="text-xs text-muted-foreground">
                  Patients can now book appointments via WhatsApp
                </p>
              </div>
            ) : status === "connecting" && qr ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with WhatsApp on your phone
                </p>
                <div className="rounded-lg border border-border bg-white p-4">
                  <pre className="text-[6px] leading-[6px] font-mono select-none">
                    {qr}
                  </pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  QR code refreshes automatically. Check your terminal for a scannable QR.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <CircleDashed className="h-16 w-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Bot server is not running
                </p>
                <p className="text-xs text-muted-foreground">
                  Run <code className="rounded bg-muted px-1.5 py-0.5">cd bot && bun dev</code> to start
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send Message */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Send Message</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-3">
              <Input
                placeholder="Phone number (e.g. 919876543210)"
                value={sendPhone}
                onChange={(e) => setSendPhone(e.target.value)}
                className="bg-accent"
              />
              <Input
                placeholder="Message text..."
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                className="bg-accent"
              />
              <Button
                type="submit"
                disabled={sending || status !== "connected"}
                className="w-full gap-2"
              >
                <PaperPlaneTilt className="h-4 w-4" weight="bold" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Message Log */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Message Log</CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchMessages}>
            <ArrowClockwise className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No messages yet
              </p>
            ) : (
              <div className="space-y-2" ref={scrollRef}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col rounded-lg px-3 py-2 text-sm ${
                      msg.direction === "in"
                        ? "items-start bg-accent"
                        : "items-end bg-primary/10"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {msg.jid.replace("@s.whatsapp.net", "")}
                      </span>
                      <span>{msg.direction === "in" ? "→" : "←"}</span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
