import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function findDoctorByName(name: string) {
  const { data } = await supabase
    .from("doctors")
    .select("*, profile:profiles(full_name)")
    .eq("is_active", true);

  if (!data) return null;

  const lower = name.toLowerCase();
  return data.find(
    (d: any) =>
      d.profile?.full_name?.toLowerCase().includes(lower) ||
      d.specialization?.toLowerCase().includes(lower)
  );
}

export async function findOrCreatePatientByPhone(phone: string) {
  const normalized = phone.replace(/\D/g, "");

  const { data: existing } = await supabase
    .from("patients")
    .select("*")
    .eq("phone", normalized)
    .single();

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
    (appointmentsRes.data || []).map((a: any) => a.start_time.slice(0, 5))
  );
  const blocked = blockedRes.data || [];

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
        const isBlocked = blocked.some((b: any) => {
          if (!b.start_time || !b.end_time) return true;
          return time >= b.start_time.slice(0, 5) && time < b.end_time.slice(0, 5);
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

export async function getDoctorsList() {
  const { data } = await supabase
    .from("doctors")
    .select("id, specialization, consultation_duration_mins, profile:profiles(full_name)")
    .eq("is_active", true);

  return data || [];
}
