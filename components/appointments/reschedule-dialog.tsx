"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlotPicker } from "./slot-picker";
import { formatTime } from "@/lib/scheduling";
import { toast } from "sonner";
import { CircleDashed } from "@phosphor-icons/react";
import type { Appointment, TimeSlot } from "@/lib/types";

interface RescheduleDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
}

export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onRescheduled,
}: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedDate("");
      setSelectedSlot(null);
    }
    onOpenChange(next);
  }

  async function handleReschedule() {
    if (!appointment || !selectedDate || !selectedSlot) return;

    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appointment.id,
          appointment_date: selectedDate,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          status: "booked",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to reschedule");
        return;
      }
      toast.success("Appointment rescheduled");
      onRescheduled();
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  if (!appointment) return null;

  const patientName = appointment.patient?.full_name || "Unknown";
  const doctorName =
    (appointment.doctor as unknown as { profile: { full_name: string } })
      ?.profile?.full_name || "Unknown";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Move {patientName}&apos;s appointment with Dr. {doctorName} to a new
            time. The old slot will be freed automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Current slot</p>
            <p className="text-muted-foreground">
              {new Date(appointment.appointment_date).toLocaleDateString(
                "en-US",
                { weekday: "short", month: "short", day: "numeric" }
              )}{" "}
              &middot; {formatTime(appointment.start_time)} &ndash;{" "}
              {formatTime(appointment.end_time)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>New Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
              }}
              min={new Date().toISOString().split("T")[0]}
              className="bg-accent"
            />
          </div>

          {selectedDate && (
            <div className="space-y-2">
              <Label>New Time Slot</Label>
              <SlotPicker
                doctorId={appointment.doctor_id}
                date={selectedDate}
                selectedSlot={selectedSlot?.start_time || null}
                onSelectSlot={setSelectedSlot}
              />
            </div>
          )}

          <Button
            onClick={handleReschedule}
            disabled={saving || !selectedDate || !selectedSlot}
            className="w-full font-semibold uppercase tracking-wide"
          >
            {saving ? (
              <>
                <CircleDashed className="h-4 w-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              "Confirm Reschedule"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
