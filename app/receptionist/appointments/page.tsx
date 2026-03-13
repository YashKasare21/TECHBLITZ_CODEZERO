"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/appointments/status-badge";
import { BookingDrawer } from "@/components/appointments/booking-drawer";
import { WeekCalendar } from "@/components/schedule/week-calendar";
import { useRealtimeAppointments } from "@/hooks/use-realtime";
import { formatTime } from "@/lib/scheduling";
import { createClient } from "@/lib/supabase/client";
import { CalendarPlus, FunnelSimple, List, CalendarBlank, CircleDashed } from "@phosphor-icons/react";
import type { Appointment, AppointmentStatus, Doctor } from "@/lib/types";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<(Doctor & { profile: { full_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [dateFilter, setDateFilter] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const supabase = createClient();

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (doctorFilter !== "all") params.set("doctorId", doctorFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/appointments?${params}`);
    const data = await res.json();
    setAppointments(data);
    setLoading(false);
  }, [dateFilter, doctorFilter, statusFilter]);

  useRealtimeAppointments(fetchAppointments);

  const fetchCalendarAppointments = useCallback(
    async (startDate: string, endDate: string) => {
      const res = await fetch(
        `/api/appointments?startDate=${startDate}&endDate=${endDate}`
      );
      return res.json();
    },
    []
  );

  useEffect(() => {
    supabase
      .from("doctors")
      .select("*, profile:profiles(full_name)")
      .eq("is_active", true)
      .then(({ data }) => setDoctors((data as typeof doctors) || []));
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchAppointments();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appointments</h1>
        <Button onClick={() => setDrawerOpen(true)} className="gap-2 font-semibold uppercase tracking-wide">
          <CalendarPlus className="h-4 w-4" weight="bold" />
          Book
        </Button>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5">
            <List className="h-4 w-4" /> List
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarBlank className="h-4 w-4" /> Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <WeekCalendar fetchAppointments={fetchCalendarAppointments} />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <FunnelSimple className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-44 bg-accent"
          />
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="w-52 bg-accent">
              <SelectValue placeholder="All Doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  Dr. {d.profile.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-accent">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="checked_out">Checked Out</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Complaint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CircleDashed className="h-6 w-6 animate-spin" />
                      <span className="text-sm">Loading appointments…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CalendarBlank className="h-10 w-10 opacity-30" weight="duotone" />
                      <p className="text-sm font-medium">No appointments found</p>
                      <p className="text-xs opacity-60">Try adjusting your filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((apt) => {
                  const dr = apt.doctor as unknown as { profile: { full_name: string } };
                  return (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">
                        {formatTime(apt.start_time)}
                        <span className="text-muted-foreground"> – {formatTime(apt.end_time)}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{apt.patient?.full_name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {apt.patient?.patient_uid}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>Dr. {dr?.profile?.full_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {apt.chief_complaint || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={apt.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {apt.status === "booked" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(apt.id, "checked_in")}>
                              Check In
                            </Button>
                          )}
                          {apt.status === "checked_in" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(apt.id, "checked_out")}>
                              Check Out
                            </Button>
                          )}
                          {(apt.status === "booked" || apt.status === "pending") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus(apt.id, "cancelled")}
                              className="text-destructive"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      <BookingDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onBooked={fetchAppointments} />
    </div>
  );
}
