import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth
  const publicRoutes = ["/login", "/api/whatsapp"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    if (profile?.role === "doctor") {
      url.pathname = "/doctor";
    } else if (profile?.role === "receptionist") {
      url.pathname = "/receptionist";
    } else {
      url.pathname = "/login";
      // Sign out patients/unknown roles to prevent redirect loops
      await supabase.auth.signOut();
    }
    return NextResponse.redirect(url);
  }

  // Prevent patients from accessing staff-only routes
  if (user && (pathname.startsWith("/receptionist") || pathname.startsWith("/doctor"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "patient" || !profile) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (profile.role === "doctor" && pathname.startsWith("/receptionist")) {
      const url = request.nextUrl.clone();
      url.pathname = "/doctor";
      return NextResponse.redirect(url);
    }

    if (profile.role === "receptionist" && pathname.startsWith("/doctor")) {
      const url = request.nextUrl.clone();
      url.pathname = "/receptionist";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
