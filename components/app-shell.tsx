"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Stethoscope,
  CalendarDots,
  Users,
  Queue,
  Clock,
  SignOut,
  CalendarBlank,
  ChartBar,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type { Profile } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const receptionistNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/receptionist",
    icon: <ChartBar className="h-5 w-5" weight="duotone" />,
  },
  {
    label: "Appointments",
    href: "/receptionist/appointments",
    icon: <CalendarDots className="h-5 w-5" weight="duotone" />,
  },
  {
    label: "Patients",
    href: "/receptionist/patients",
    icon: <Users className="h-5 w-5" weight="duotone" />,
  },
  {
    label: "WhatsApp",
    href: "/receptionist/whatsapp",
    icon: <WhatsappLogo className="h-5 w-5" weight="duotone" />,
  },
];

const doctorNav: NavItem[] = [
  {
    label: "My Queue",
    href: "/doctor",
    icon: <Queue className="h-5 w-5" weight="duotone" />,
  },
  {
    label: "Schedule",
    href: "/doctor/schedule",
    icon: <CalendarBlank className="h-5 w-5" weight="duotone" />,
  },
  {
    label: "Availability",
    href: "/doctor/availability",
    icon: <Clock className="h-5 w-5" weight="duotone" />,
  },
];

export function AppShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: Profile;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const navItems = profile.role === "doctor" ? doctorNav : receptionistNav;

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-[260px] flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Stethoscope className="h-5 w-5 text-primary-foreground" weight="duotone" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ClinicOS</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              item.href === pathname ||
              (item.href !== "/" + profile.role && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {profile.role}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={handleSignOut}
            >
              <SignOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
