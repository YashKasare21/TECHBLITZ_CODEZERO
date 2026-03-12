import { createClient } from "@/lib/supabase/server";
import { ReceptionistDashboardClient } from "./dashboard-client";

export default async function ReceptionistDashboard() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [appointmentsRes, doctorsRes, patientsCountRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, doctor:doctors(*, profile:profiles(full_name)), patient:patients(*)")
      .eq("appointment_date", today)
      .order("start_time", { ascending: true }),

    supabase
      .from("doctors")
      .select("*, profile:profiles(full_name)")
      .eq("is_active", true),

    supabase.from("patients").select("id", { count: "exact", head: true }),
  ]);

  return (
    <ReceptionistDashboardClient
      todayAppointments={appointmentsRes.data || []}
      doctors={doctorsRes.data || []}
      totalPatients={patientsCountRes.count || 0}
      today={today}
    />
  );
}
