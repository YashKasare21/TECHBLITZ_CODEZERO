"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/scheduling";
import type { TimeSlot } from "@/lib/types";

interface SlotPickerProps {
  doctorId: string;
  date: string;
  selectedSlot: string | null;
  onSelectSlot: (slot: TimeSlot) => void;
}

export function SlotPicker({
  doctorId,
  date,
  selectedSlot,
  onSelectSlot,
}: SlotPickerProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doctorId || !date) return;
    setLoading(true);
    fetch(`/api/slots?doctorId=${doctorId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [doctorId, date]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading available slots...
      </div>
    );
  }

  if (!doctorId || !date) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Select a doctor and date to see available slots
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);
  if (availableSlots.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No available slots for this date
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
      {slots.map((slot) => (
        <button
          key={slot.start_time}
          disabled={!slot.available}
          onClick={() => onSelectSlot(slot)}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            !slot.available &&
              "cursor-not-allowed border-border bg-muted/50 text-muted-foreground line-through",
            slot.available &&
              selectedSlot !== slot.start_time &&
              "border-border bg-card text-foreground hover:border-primary hover:bg-accent",
            selectedSlot === slot.start_time &&
              "border-primary bg-primary text-primary-foreground"
          )}
        >
          {formatTime(slot.start_time)}
        </button>
      ))}
    </div>
  );
}
