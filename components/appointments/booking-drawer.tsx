"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlotPicker } from "./slot-picker";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Doctor, Patient, TimeSlot } from "@/lib/types";

interface BookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBooked: () => void;
}

export function BookingDrawer({
  open,
  onOpenChange,
  onBooked,
}: BookingDrawerProps) {
  const [doctors, setDoctors] = useState<(Doctor & { profile: { full_name: string } })[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    supabase
      .from("doctors")
      .select("*, profile:profiles(full_name)")
      .eq("is_active", true)
      .then(({ data }) => setDoctors((data as typeof doctors) || []));

    supabase
      .from("patients")
      .select("*")
      .order("full_name")
      .limit(100)
      .then(({ data }) => setPatients(data || []));

    setSelectedDoctor("");
    setSelectedDate("");
    setSelectedSlot(null);
    setSelectedPatient("");
    setChiefComplaint("");
    setPatientSearch("");
  }, [open]);

  const filteredPatients = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.patient_uid.toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.phone && p.phone.includes(patientSearch))
  );

  async function handleBook() {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !selectedPatient) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: selectedDoctor,
          patient_id: selectedPatient,
          appointment_date: selectedDate,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          chief_complaint: chiefComplaint || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to book appointment");
        return;
      }
      toast.success("Appointment booked successfully");
      onBooked();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const doctor = doctors.find((d) => d.id === selectedDoctor);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Book Appointment</SheetTitle>
          <SheetDescription>
            Select a doctor, date, time, and patient to book an appointment.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Doctor */}
          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="bg-accent">
                <SelectValue placeholder="Select a doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.profile.full_name} — {d.specialization}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
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

          {/* Slots */}
          {selectedDoctor && selectedDate && (
            <div className="space-y-2">
              <Label>Time Slot {doctor && `(${doctor.consultation_duration_mins} min)`}</Label>
              <SlotPicker
                doctorId={selectedDoctor}
                date={selectedDate}
                selectedSlot={selectedSlot?.start_time || null}
                onSelectSlot={setSelectedSlot}
              />
            </div>
          )}

          {/* Patient */}
          <div className="space-y-2">
            <Label>Patient</Label>
            <Input
              placeholder="Search by name, UID, or phone..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="bg-accent"
            />
            {patientSearch && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {filteredPatients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No patients found
                  </div>
                ) : (
                  filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p.id);
                        setPatientSearch(
                          `${p.full_name} (${p.patient_uid})`
                        );
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted",
                        selectedPatient === p.id && "bg-accent"
                      )}
                    >
                      <span className="font-medium">{p.full_name}</span>
                      <span className="text-muted-foreground">
                        {p.patient_uid}
                      </span>
                      {p.phone && (
                        <span className="ml-auto text-muted-foreground">
                          {p.phone}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Chief Complaint */}
          <div className="space-y-2">
            <Label>Chief Complaint (optional)</Label>
            <Input
              placeholder="Reason for visit..."
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="bg-accent"
            />
          </div>

          <Button
            onClick={handleBook}
            disabled={
              saving ||
              !selectedDoctor ||
              !selectedDate ||
              !selectedSlot ||
              !selectedPatient
            }
            className="w-full font-semibold uppercase tracking-wide"
          >
            {saving ? "Booking..." : "Book Appointment"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

