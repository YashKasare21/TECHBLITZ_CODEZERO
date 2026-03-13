"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/appointments/status-badge";
import { formatTime } from "@/lib/scheduling";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { Appointment } from "@/lib/types";

interface Props {
  doctorId: string;
}

export function DoctorScheduleClient({ doctorId }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/appointments?doctorId=${doctorId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [doctorId, date]);

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          View your appointments by date
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button size="icon" variant="outline" onClick={() => shiftDate(-1)}>
          <CaretLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44 bg-accent"
        />
        <Button size="icon" variant="outline" onClick={() => shiftDate(1)}>
          <CaretRight className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Appointments ({appointments.filter((a) => a.status !== "cancelled").length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          ) : appointments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No appointments on this date
            </p>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center gap-4 rounded-lg border border-border p-3"
                >
                  <div className="w-24 shrink-0 text-center">
                    <p className="text-sm font-semibold">
                      {formatTime(apt.start_time)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(apt.end_time)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{apt.patient?.full_name}</p>
                    {apt.chief_complaint && (
                      <p className="text-sm text-muted-foreground truncate">
                        {apt.chief_complaint}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={apt.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
