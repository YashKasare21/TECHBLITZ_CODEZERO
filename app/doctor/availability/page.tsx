"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Trash } from "@phosphor-icons/react";
import { formatTime } from "@/lib/scheduling";
import type { DoctorSession, BlockedDate } from "@/lib/types";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AvailabilityPage() {
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DoctorSession[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!doctor) return;
    setDoctorId(doctor.id);

    const [sessionsRes, blockedRes] = await Promise.all([
      supabase
        .from("doctor_sessions")
        .select("*")
        .eq("doctor_id", doctor.id)
        .order("day_of_week")
        .order("start_time"),
      supabase
        .from("blocked_dates")
        .select("*")
        .eq("doctor_id", doctor.id)
        .order("start_date"),
    ]);

    setSessions(sessionsRes.data || []);
    setBlockedDates(blockedRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function deleteSession(id: string) {
    await supabase.from("doctor_sessions").delete().eq("id", id);
    toast.success("Session deleted");
    fetchData();
  }

  async function deleteBlockedDate(id: string) {
    await supabase.from("blocked_dates").delete().eq("id", id);
    toast.success("Blocked date removed");
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading availability...
      </div>
    );
  }

  const sessionsByDay = DAYS.map((day, i) => ({
    day,
    dayIndex: i,
    sessions: sessions.filter((s) => s.day_of_week === i),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Availability</h1>
          <p className="text-sm text-muted-foreground">
            Configure your weekly schedule and blocked dates
          </p>
        </div>
      </div>

      {/* Weekly Schedule */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Weekly Schedule</CardTitle>
          <Button
            size="sm"
            onClick={() => setSessionDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" weight="bold" />
            Add Session
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsByDay.map(({ day, sessions: daySessions }) => (
            <div key={day} className="flex items-start gap-4 rounded-lg border border-border p-3">
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold">{day}</p>
              </div>
              <div className="flex-1">
                {daySessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {daySessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-md border border-primary/20 bg-accent px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({s.slot_duration_mins}m)
                        </span>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Blocked Dates */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Blocked Dates</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBlockedDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" weight="bold" />
            Block Dates
          </Button>
        </CardHeader>
        <CardContent>
          {blockedDates.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No blocked dates
            </p>
          ) : (
            <div className="space-y-2">
              {blockedDates.map((bd) => (
                <div
                  key={bd.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(bd.start_date).toLocaleDateString()} –{" "}
                      {new Date(bd.end_date).toLocaleDateString()}
                    </p>
                    {bd.reason && (
                      <p className="text-xs text-muted-foreground">{bd.reason}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteBlockedDate(bd.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Session Dialog */}
      <AddSessionDialog
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        doctorId={doctorId!}
        onCreated={fetchData}
      />

      {/* Block Date Dialog */}
      <BlockDateDialog
        open={blockedDialogOpen}
        onOpenChange={setBlockedDialogOpen}
        doctorId={doctorId!}
        onCreated={fetchData}
      />
    </div>
  );
}

function AddSessionDialog({
  open,
  onOpenChange,
  doctorId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  onCreated: () => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("doctor_sessions").insert({
      doctor_id: doctorId,
      day_of_week: parseInt(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      slot_duration_mins: parseInt(slotDuration),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Session added");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Weekly Session</DialogTitle>
          <DialogDescription>
            Add a recurring weekly availability block.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger className="bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-accent"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-accent"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Slot Duration (minutes)</Label>
            <Select value={slotDuration} onValueChange={setSlotDuration}>
              <SelectTrigger className="bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="20">20 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="w-full font-semibold uppercase tracking-wide">
            {saving ? "Saving..." : "Add Session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BlockDateDialog({
  open,
  onOpenChange,
  doctorId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  onCreated: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate) {
      toast.error("Start date is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("blocked_dates").insert({
      doctor_id: doctorId,
      start_date: startDate,
      end_date: endDate || startDate,
      reason: reason || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Date blocked");
    onCreated();
    onOpenChange(false);
    setStartDate("");
    setEndDate("");
    setReason("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Block Dates</DialogTitle>
          <DialogDescription>
            Mark dates as unavailable for appointments.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="bg-accent"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-accent"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Holiday, conference, etc."
              className="bg-accent"
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full font-semibold uppercase tracking-wide">
            {saving ? "Saving..." : "Block Dates"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
