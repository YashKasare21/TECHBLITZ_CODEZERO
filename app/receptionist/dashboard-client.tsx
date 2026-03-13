"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/appointments/status-badge";
import { BookingDrawer } from "@/components/appointments/booking-drawer";
import { useRealtimeAppointments } from "@/hooks/use-realtime";
import { formatTime } from "@/lib/scheduling";
import {
  CalendarPlus,
  Users,
  CalendarCheck,
  Clock,
  XCircle,
  CheckCircle,
} from "@phosphor-icons/react";
import type { Appointment } from "@/lib/types";

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
      color: "text-primary",
    },
    {
      label: "Upcoming",
      value: upcoming,
      icon: <Clock className="h-5 w-5" weight="duotone" />,
      color: "text-warning-foreground",
    },
    {
      label: "Completed",
      value: completed,
      icon: <CheckCircle className="h-5 w-5" weight="duotone" />,
      color: "text-success",
    },
    {
      label: "Total Patients",
      value: totalPatients,
      icon: <Users className="h-5 w-5" weight="duotone" />,
      color: "text-secondary",
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
                className={`flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ${stat.color}`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-semibold">{stat.value}</p>
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
            <p className="py-8 text-center text-sm text-muted-foreground">
              No appointments scheduled for today
            </p>
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

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
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
