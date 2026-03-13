import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export interface DoctorRecord {
  id: string;
  specialization: string;
  consultation_duration_mins: number;
  profile:
    | {
        full_name: string;
      }
    | {
        full_name: string;
      }[]
    | null;
}

interface PatientRecord {
  id: string;
}

interface AppointmentSlotRow {
  start_time: string;
}

interface BlockedWindowRow {
  start_time: string | null;
  end_time: string | null;
}

export async function findDoctorByName(name: string): Promise<DoctorRecord | null> {
  const { data } = await supabase
    .from("doctors")
    .select("*, profile:profiles(full_name)")
    .eq("is_active", true);

  if (!data) return null;

  const lower = name.toLowerCase();
  return (
    (data as unknown as DoctorRecord[]).find((doctor) => {
      const profileName = Array.isArray(doctor.profile)
        ? doctor.profile[0]?.full_name
        : doctor.profile?.full_name;

      return (
        profileName?.toLowerCase().includes(lower) ||
        doctor.specialization?.toLowerCase().includes(lower)
      );
    }) ?? null
  );
}

export async function findOrCreatePatientByPhone(phone: string) {
  const normalized = phone.replace(/\D/g, "");

  const { data: existing } = await supabase
    .from("patients")
    .select("*")
    .eq("phone", normalized)
    .single<PatientRecord>();

  if (existing) return existing;

  const { data: created } = await supabase
    .from("patients")
    .insert({ full_name: `WhatsApp User (${normalized})`, phone: normalized })
    .select()
    .single();

  return created;
}

export async function getAvailableSlots(doctorId: string, date: string) {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();

  const [sessionsRes, appointmentsRes, blockedRes] = await Promise.all([
    supabase
      .from("doctor_sessions")
      .select("start_time, end_time, slot_duration_mins")
      .eq("doctor_id", doctorId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true),

    supabase
      .from("appointments")
      .select("start_time")
      .eq("doctor_id", doctorId)
      .eq("appointment_date", date)
      .neq("status", "cancelled"),

    supabase
      .from("blocked_dates")
      .select("start_time, end_time")
      .eq("doctor_id", doctorId)
      .lte("start_date", date)
      .gte("end_date", date),
  ]);

  const sessions = sessionsRes.data || [];
  const booked = new Set(
    ((appointmentsRes.data || []) as AppointmentSlotRow[]).map((appointment) =>
      appointment.start_time.slice(0, 5)
    )
  );
  const blocked = (blockedRes.data || []) as BlockedWindowRow[];

  const slots: string[] = [];
  for (const s of sessions) {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + s.slot_duration_mins <= end) {
      const time = `${Math.floor(cur / 60)
        .toString()
        .padStart(2, "0")}:${(cur % 60).toString().padStart(2, "0")}`;
      if (!booked.has(time)) {
        const isBlocked = blocked.some((window) => {
          if (!window.start_time || !window.end_time) return true;
          return (
            time >= window.start_time.slice(0, 5) &&
            time < window.end_time.slice(0, 5)
          );
        });
        if (!isBlocked) slots.push(time);
      }
      cur += s.slot_duration_mins;
    }
  }

  return slots;
}

export async function bookAppointment(
  doctorId: string,
  patientId: string,
  date: string,
  startTime: string,
  slotDurationMins: number = 30
) {
  const [h, m] = startTime.split(":").map(Number);
  const totalMins = h * 60 + m + slotDurationMins;
  const endTime = `${Math.floor(totalMins / 60)
    .toString()
    .padStart(2, "0")}:${(totalMins % 60).toString().padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      doctor_id: doctorId,
      patient_id: patientId,
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      status: "booked",
      booked_via: "whatsapp",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "This time slot is already booked. Please choose another." };
    }
    return { error: error.message };
  }
  return { data };
}

export async function getDoctorsList(): Promise<DoctorRecord[]> {
  const { data } = await supabase
    .from("doctors")
    .select("id, specialization, consultation_duration_mins, profile:profiles(full_name)")
    .eq("is_active", true);

  return (data as unknown as DoctorRecord[]) || [];
}
