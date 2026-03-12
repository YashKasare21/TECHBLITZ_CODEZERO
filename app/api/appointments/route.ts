import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const searchParams = req.nextUrl.searchParams;
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const doctorId = searchParams.get("doctorId");
  const status = searchParams.get("status");

  let query = supabase
    .from("appointments")
    .select(
      `*, doctor:doctors(*, profile:profiles(*)), patient:patients(*)`
    )
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (date) query = query.eq("appointment_date", date);
  if (startDate) query = query.gte("appointment_date", startDate);
  if (endDate) query = query.lte("appointment_date", endDate);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appointmentData = {
    doctor_id: body.doctor_id,
    patient_id: body.patient_id,
    appointment_date: body.appointment_date,
    start_time: body.start_time,
    end_time: body.end_time,
    status: body.status || "booked",
    visit_type: body.visit_type || "in_person",
    chief_complaint: body.chief_complaint || null,
    booked_via: body.booked_via || "web",
    booked_by: user?.id || null,
  };

  const { data, error } = await supabase
    .from("appointments")
    .insert(appointmentData)
    .select(
      `*, doctor:doctors(*, profile:profiles(*)), patient:patients(*)`
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This time slot is already booked" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (updates.status === "cancelled") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    updates.cancelled_at = new Date().toISOString();
    updates.cancelled_by = user?.id;
  }

  const { data, error } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", id)
    .select(
      `*, doctor:doctors(*, profile:profiles(*)), patient:patients(*)`
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
