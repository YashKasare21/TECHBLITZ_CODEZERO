"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CalendarDots,
  Users,
  UsersThree,
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
    label: "Users",
    href: "/receptionist/users",
    icon: <UsersThree className="h-5 w-5" weight="duotone" />,
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
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-card">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <Image src="/logo.webp" alt="ClinicOS" width={32} height={32} className="rounded-lg" />
          <span className="text-base font-semibold tracking-tight">ClinicOS</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map((item) => {
            const isActive =
              item.href === pathname ||
              (item.href !== "/" + profile.role && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-semibold leading-tight">{profile.full_name}</p>
              <p className="truncate text-[10px] capitalize text-muted-foreground">
                {profile.role}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
              title="Sign out"
            >
              <SignOut className="h-3.5 w-3.5" />
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
