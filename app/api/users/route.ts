import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient();
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  const query = supabase
    .from("profiles")
    .select("*, doctor:doctors(id, specialization, bio, consultation_duration_mins, is_active)")
    .order("created_at", { ascending: false });

  if (role === "doctor" || role === "receptionist") {
    query.eq("role", role);
  } else {
    query.in("role", ["doctor", "receptionist"]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient();
  const body = await request.json();

  const {
    email,
    password,
    full_name,
    role,
    phone,
    specialization,
    bio,
    consultation_duration_mins,
  } = body;

  if (!email || !password || !full_name || !role) {
    return NextResponse.json(
      { error: "email, password, full_name, and role are required" },
      { status: 400 }
    );
  }

  if (!["doctor", "receptionist"].includes(role)) {
    return NextResponse.json(
      { error: "role must be 'doctor' or 'receptionist'" },
      { status: 400 }
    );
  }

  if (role === "doctor" && !specialization) {
    return NextResponse.json(
      { error: "specialization is required for doctors" },
      { status: 400 }
    );
  }

  // Create the auth user — handle_new_user trigger creates the profile row
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, phone: phone || "" },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // For doctors, insert a row in the doctors table
  if (role === "doctor") {
    const { error: doctorError } = await supabase.from("doctors").insert({
      profile_id: userId,
      specialization,
      bio: bio || null,
      consultation_duration_mins: consultation_duration_mins || 30,
      is_active: true,
    });

    if (doctorError) {
      // Roll back: delete the auth user to avoid orphaned accounts
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: doctorError.message }, { status: 500 });
    }
  }

  // Return the created profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, doctor:doctors(id, specialization, bio, consultation_duration_mins, is_active)")
    .eq("id", userId)
    .single();

  return NextResponse.json(profile, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Get the profile to determine the role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (profile.role === "doctor") {
    // Soft-delete: set is_active = false on the doctors row
    const { error } = await supabase
      .from("doctors")
      .update({ is_active: false })
      .eq("profile_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // For receptionists, disable their auth account
    const { error } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: "876600h", // ~100 years
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServiceClient();
  const body = await request.json();
  const { id, specialization, bio, consultation_duration_mins, is_active, full_name, phone } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Update profile fields
  if (full_name !== undefined || phone !== undefined) {
    const { error } = await supabase
      .from("profiles")
      .update({
        ...(full_name !== undefined && { full_name }),
        ...(phone !== undefined && { phone }),
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update doctor-specific fields
  if (
    specialization !== undefined ||
    bio !== undefined ||
    consultation_duration_mins !== undefined ||
    is_active !== undefined
  ) {
    const { error } = await supabase
      .from("doctors")
      .update({
        ...(specialization !== undefined && { specialization }),
        ...(bio !== undefined && { bio }),
        ...(consultation_duration_mins !== undefined && { consultation_duration_mins }),
        ...(is_active !== undefined && { is_active }),
      })
      .eq("profile_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, doctor:doctors(id, specialization, bio, consultation_duration_mins, is_active)")
    .eq("id", id)
    .single();

  return NextResponse.json(profile);
}
