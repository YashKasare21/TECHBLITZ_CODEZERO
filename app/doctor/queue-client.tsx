"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeAppointments } from "@/hooks/use-realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/appointments/status-badge";
import { formatTime } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  SignOut as SignOutIcon,
  Clock,
  User,
  NoteBlank,
  Queue,
  CircleDashed,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Appointment, AppointmentStatus } from "@/lib/types";

interface Props {
  appointments: Appointment[];
  doctorId: string;
  today: string;
}

export function DoctorQueueClient({ appointments, doctorId, today }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useRealtimeAppointments(refresh);

  const totalToday = appointments.length;
  const checkedIn = appointments.filter((a) => a.status === "checked_in").length;
  const completed = appointments.filter((a) => a.status === "checked_out").length;
  const upcoming = appointments.filter(
    (a) => a.status === "booked" || a.status === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Queue</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(today).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Upcoming", value: upcoming, icon: <Clock className="h-5 w-5" weight="duotone" />, iconClass: "text-primary bg-primary/10" },
          { label: "In Room", value: checkedIn, icon: <User className="h-5 w-5" weight="duotone" />, iconClass: "text-success bg-success/15" },
          { label: "Completed", value: completed, icon: <CheckCircle className="h-5 w-5" weight="duotone" />, iconClass: "text-muted-foreground bg-muted" },
          { label: "Total", value: totalToday, icon: <NoteBlank className="h-5 w-5" weight="duotone" />, iconClass: "text-secondary bg-secondary/15" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stat.iconClass)}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Queue */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Patient Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Queue className="h-10 w-10 text-muted-foreground/40" weight="duotone" />
              <p className="text-sm font-medium text-muted-foreground">Your queue is empty</p>
              <p className="text-xs text-muted-foreground/60">No appointments scheduled for today</p>
            </div>
          ) : (
            appointments.map((apt) => (
              <QueueCard key={apt.id} appointment={apt} onUpdate={refresh} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QueueCard({
  appointment,
  onUpdate,
}: {
  appointment: Appointment;
  onUpdate: () => void;
}) {
  const [notes, setNotes] = useState(appointment.notes || "");
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    setUpdating(true);
    const body: Record<string, unknown> = { id: appointment.id, status };
    if (status === "checked_out" && notes) {
      body.notes = notes;
    }
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
        return;
      }
      toast.success(
        status === "checked_in" ? "Patient checked in" : "Visit complete"
      );
      onUpdate();
    } finally {
      setUpdating(false);
    }
  }

  const statusBorder: Record<AppointmentStatus, string> = {
    pending: "border-l-warning",
    booked: "border-l-primary",
    checked_in: "border-l-success",
    checked_out: "border-l-border",
    cancelled: "border-l-destructive",
    no_show: "border-l-secondary",
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        "border-l-[3px]",
        statusBorder[appointment.status]
      )}
    >
      <div className="flex items-start gap-4">
        {/* Time column */}
        <div className="w-24 shrink-0 text-center">
          <p className="text-sm font-semibold">{formatTime(appointment.start_time)}</p>
          <p className="text-xs text-muted-foreground">
            to {formatTime(appointment.end_time)}
          </p>
        </div>

        {/* Patient info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{appointment.patient?.full_name}</p>
            <span className="text-xs font-mono text-primary">
              {appointment.patient?.patient_uid}
            </span>
            <StatusBadge status={appointment.status} />
          </div>
          {appointment.chief_complaint && (
            <p className="mt-1 text-sm text-muted-foreground">
              {appointment.chief_complaint}
            </p>
          )}

          {/* Notes (visible on checked_in) */}
          {appointment.status === "checked_in" && (
            <div className="mt-3">
              <Input
                placeholder="Clinical notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-accent text-sm"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {(appointment.status === "booked" || appointment.status === "pending") && (
            <Button
              size="sm"
              onClick={() => updateStatus("checked_in")}
              disabled={updating}
              className="gap-1.5"
            >
              {updating ? (
                <CircleDashed className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" weight="bold" />
              )}
              Check In
            </Button>
          )}
          {appointment.status === "checked_in" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus("checked_out")}
              disabled={updating}
              className="gap-1.5"
            >
              {updating ? (
                <CircleDashed className="h-4 w-4 animate-spin" />
              ) : (
                <SignOutIcon className="h-4 w-4" weight="bold" />
              )}
              Check Out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
