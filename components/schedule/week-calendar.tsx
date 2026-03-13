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
  mode?: "day" | "week" | "month";
}

function dateToString(date: Date) {
  return date.toISOString().split("T")[0];
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

function getMonthRange(baseDate: Date) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  return { start, end };
}

function getMonthGridDates(baseDate: Date) {
  const { start, end } = getMonthRange(baseDate);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());

  const gridEnd = new Date(end);
  gridEnd.setDate(end.getDate() + (6 - end.getDay()));

  const dates: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getModeRange(baseDate: Date, mode: "day" | "week" | "month") {
  if (mode === "day") {
    const day = new Date(baseDate);
    return { start: day, end: day };
  }

  if (mode === "month") {
    return getMonthRange(baseDate);
  }

  const weekDates = getWeekDates(baseDate);
  return { start: weekDates[0], end: weekDates[6] };
}

export function WeekCalendar({ fetchAppointments, mode = "week" }: WeekCalendarProps) {
  const [baseDate, setBaseDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const weekDates = getWeekDates(baseDate);
  const monthDates = getMonthGridDates(baseDate);
  const { start, end } = getModeRange(baseDate, mode);
  const startStr = dateToString(start);
  const endStr = dateToString(end);
  const todayStr = dateToString(new Date());

  useEffect(() => {
    let cancelled = false;

    const loadAppointments = async () => {
      setLoading(true);
      try {
        const data = await fetchAppointments(startStr, endStr);
        if (!cancelled) {
          setAppointments(data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAppointments();

    return () => {
      cancelled = true;
    };
  }, [startStr, endStr, fetchAppointments]);

  function shiftWeek(dir: number) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dir * 7);
    setBaseDate(d);
  }

  function shiftDay(dir: number) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dir);
    setBaseDate(d);
  }

  function shiftMonth(dir: number) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + dir);
    setBaseDate(d);
  }

  function shiftDate(dir: number) {
    if (mode === "day") {
      shiftDay(dir);
      return;
    }

    if (mode === "month") {
      shiftMonth(dir);
      return;
    }

    shiftWeek(dir);
  }

  const title =
    mode === "day"
      ? "Day View"
      : mode === "month"
        ? "Month View"
        : "Week View";

  const rangeLabel =
    mode === "day"
      ? baseDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : mode === "month"
        ? baseDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })
        : `${weekDates[0].toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })} - ${weekDates[6].toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`;

  const dayDateStr = dateToString(baseDate);
  const dayAppointments = appointments.filter(
    (a) => a.appointment_date === dayDateStr
  );

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => shiftDate(-1)}>
            <CaretLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBaseDate(new Date())}
          >
            Today
          </Button>
          <Button size="icon" variant="outline" onClick={() => shiftDate(1)}>
            <CaretRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </p>
        ) : mode === "day" ? (
          <div className="space-y-2">
            {dayAppointments.map((apt) => (
              <div
                key={apt.id}
                className={cn(
                  "rounded-md border-l-2 px-3 py-2",
                  statusColors[apt.status]
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {formatTime(apt.start_time)}
                    <span className="text-muted-foreground"> - {formatTime(apt.end_time)}</span>
                  </p>
                  <StatusBadge status={apt.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {apt.patient?.full_name || "Unknown patient"}
                </p>
              </div>
            ))}
            {dayAppointments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No appointments for this day.
              </p>
            )}
          </div>
        ) : mode === "month" ? (
          <div className="grid grid-cols-7 gap-2">
            {monthDates.map((date) => {
              const dateStr = dateToString(date);
              const isToday = dateStr === todayStr;
              const isCurrentMonth = date.getMonth() === baseDate.getMonth();
              const dayApts = appointments.filter(
                (a) => a.appointment_date === dateStr
              );

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[110px] rounded-md border p-2",
                    isCurrentMonth ? "bg-background" : "bg-muted/40"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {isToday && (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayApts.slice(0, 2).map((apt) => (
                      <div
                        key={apt.id}
                        className={cn(
                          "truncate rounded border-l-2 px-1.5 py-1 text-[10px]",
                          statusColors[apt.status]
                        )}
                      >
                        {formatTime(apt.start_time)} {apt.patient?.full_name}
                      </div>
                    ))}
                    {dayApts.length > 2 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{dayApts.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const dateStr = dateToString(date);
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
