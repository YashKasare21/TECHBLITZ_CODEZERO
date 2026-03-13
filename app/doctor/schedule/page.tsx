import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DoctorScheduleClient } from "./schedule-client";

export default async function DoctorSchedulePage() {
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

  return <DoctorScheduleClient doctorId={doctor.id} />;
}
