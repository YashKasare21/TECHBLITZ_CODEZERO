"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/appointments/status-badge";
import { formatTime } from "@/lib/scheduling";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/lib/types";

const statusColors: Record<AppointmentStatus, string> = {
  pending: "border-l-[#FFC107] bg-[#FFC107]/5",
  booked: "border-l-primary bg-primary/5",
  checked_in: "border-l-success bg-success/5",
  checked_out: "border-l-muted-foreground bg-muted/30",
  cancelled: "border-l-destructive bg-destructive/5",
  no_show: "border-l-secondary bg-secondary/5",
};

interface WeekCalendarProps {
  fetchAppointments: (startDate: string, endDate: string) => Promise<Appointment[]>;
}

function getWeekDates(baseDate: Date) {
  const day = baseDate.getDay();
  const start = new Date(baseDate);
  start.setDate(start.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function WeekCalendar({ fetchAppointments }: WeekCalendarProps) {
  const [baseDate, setBaseDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const weekDates = getWeekDates(baseDate);
  const startStr = weekDates[0].toISOString().split("T")[0];
  const endStr = weekDates[6].toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setLoading(true);
    fetchAppointments(startStr, endStr).then((data) => {
      setAppointments(data);
      setLoading(false);
    });
  }, [startStr, endStr, fetchAppointments]);

  function shiftWeek(dir: number) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dir * 7);
    setBaseDate(d);
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Week View</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => shiftWeek(-1)}>
            <CaretLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBaseDate(new Date())}
          >
            Today
          </Button>
          <Button size="icon" variant="outline" onClick={() => shiftWeek(1)}>
            <CaretRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayAppointments = appointments.filter(
                (a) => a.appointment_date === dateStr
              );
              const isToday = dateStr === todayStr;

              return (
                <div key={dateStr} className="min-h-[200px]">
                  <div
                    className={cn(
                      "mb-2 rounded-md px-2 py-1 text-center text-xs font-medium",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <div>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div className="text-lg font-semibold">
                      {date.getDate()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className={cn(
                          "rounded border-l-2 px-2 py-1.5 text-xs",
                          statusColors[apt.status]
                        )}
                      >
                        <p className="font-medium">
                          {formatTime(apt.start_time)}
                        </p>
                        <p className="truncate text-muted-foreground">
                          {apt.patient?.full_name}
                        </p>
                      </div>
                    ))}
                    {dayAppointments.length === 0 && (
                      <p className="py-2 text-center text-[10px] text-muted-foreground">
                        —
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
