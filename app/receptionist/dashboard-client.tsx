"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/appointments/status-badge";
import { BookingDrawer } from "@/components/appointments/booking-drawer";
import { useRealtimeAppointments } from "@/hooks/use-realtime";
import { formatTime } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  Users,
  CalendarCheck,
  Clock,
  XCircle,
  CheckCircle,
  CalendarBlank,
} from "@phosphor-icons/react";
import type { Appointment, AppointmentStatus } from "@/lib/types";

interface Props {
  todayAppointments: Appointment[];
  doctors: { id: string; profile: { full_name: string }; specialization: string }[];
  totalPatients: number;
  today: string;
}

export function ReceptionistDashboardClient({
  todayAppointments,
  doctors,
  totalPatients,
  today,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();

  const refresh = useCallback(() => router.refresh(), [router]);
  useRealtimeAppointments(refresh);

  const totalToday = todayAppointments.length;
  const completed = todayAppointments.filter(
    (a) => a.status === "checked_out"
  ).length;
  const upcoming = todayAppointments.filter(
    (a) => a.status === "booked" || a.status === "pending"
  ).length;
  const cancelled = todayAppointments.filter(
    (a) => a.status === "cancelled"
  ).length;

  const stats = [
    {
      label: "Today's Appointments",
      value: totalToday,
      icon: <CalendarCheck className="h-5 w-5" weight="duotone" />,
      iconClass: "text-primary bg-primary/10",
    },
    {
      label: "Upcoming",
      value: upcoming,
      icon: <Clock className="h-5 w-5" weight="duotone" />,
      iconClass: "text-warning bg-warning/15",
    },
    {
      label: "Completed",
      value: completed,
      icon: <CheckCircle className="h-5 w-5" weight="duotone" />,
      iconClass: "text-success bg-success/15",
    },
    {
      label: "Total Patients",
      value: totalPatients,
      icon: <Users className="h-5 w-5" weight="duotone" />,
      iconClass: "text-secondary bg-secondary/15",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(today).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)} className="gap-2 font-semibold uppercase tracking-wide">
          <CalendarPlus className="h-4 w-4" weight="bold" />
          Book Appointment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  stat.iconClass
                )}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Schedule */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarBlank className="h-10 w-10 text-muted-foreground/40" weight="duotone" />
              <p className="text-sm font-medium text-muted-foreground">No appointments today</p>
              <p className="text-xs text-muted-foreground/60">Book an appointment to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayAppointments.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} onUpdate={refresh} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BookingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onBooked={refresh}
      />
    </div>
  );
}

function AppointmentRow({
  appointment,
  onUpdate,
}: {
  appointment: Appointment;
  onUpdate: () => void;
}) {
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    setUpdating(true);
    try {
      await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id, status }),
      });
      onUpdate();
    } finally {
      setUpdating(false);
    }
  }

  const doctorName =
    (appointment.doctor as unknown as { profile: { full_name: string } })?.profile?.full_name || "Unknown";
  const patientName = appointment.patient?.full_name || "Unknown";

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
        "flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30",
        "border-l-[3px]",
        statusBorder[appointment.status]
      )}
    >
      {/* Time */}
      <div className="w-28 shrink-0 text-center">
        <p className="text-sm font-semibold">{formatTime(appointment.start_time)}</p>
        <p className="text-xs text-muted-foreground">
          {formatTime(appointment.end_time)}
        </p>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{patientName}</p>
        <p className="truncate text-sm text-muted-foreground">
          Dr. {doctorName}
          {appointment.chief_complaint && ` · ${appointment.chief_complaint}`}
        </p>
      </div>

      <StatusBadge status={appointment.status} />

      {/* Actions */}
      <div className="flex gap-1.5">
        {appointment.status === "booked" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus("checked_in")}
            disabled={updating}
            className="text-success border-success/30 hover:bg-success/10"
          >
            Check In
          </Button>
        )}
        {appointment.status === "checked_in" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus("checked_out")}
            disabled={updating}
          >
            Check Out
          </Button>
        )}
        {(appointment.status === "booked" || appointment.status === "pending") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => updateStatus("cancelled")}
            disabled={updating}
            className="text-destructive hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
