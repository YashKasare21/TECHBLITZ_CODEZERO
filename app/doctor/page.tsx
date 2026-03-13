import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DoctorQueueClient } from "./queue-client";

export default async function DoctorQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, patient:patients(*)")
    .eq("doctor_id", doctor.id)
    .eq("appointment_date", today)
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });

  return (
    <DoctorQueueClient
      appointments={appointments || []}
      doctorId={doctor.id}
      today={today}
    />
  );
}
