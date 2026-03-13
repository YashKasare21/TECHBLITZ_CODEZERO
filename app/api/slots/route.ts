import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/scheduling";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");

  if (!doctorId || !date) {
    return NextResponse.json(
      { error: "doctorId and date are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
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
      .select("start_time, end_time")
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
  const bookedSlots = appointmentsRes.data || [];
  const blockedRanges = blockedRes.data || [];

  const slots = getAvailableSlots(sessions, bookedSlots, blockedRanges);
  return NextResponse.json(slots);
}
