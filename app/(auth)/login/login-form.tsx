"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope,
  CheckCircle,
  CalendarCheck,
  Users,
  WhatsappLogo,
} from "@phosphor-icons/react";

const features = [
  {
    icon: <CalendarCheck className="h-4 w-4" weight="duotone" />,
    text: "Smart appointment scheduling",
  },
  {
    icon: <Users className="h-4 w-4" weight="duotone" />,
    text: "Real-time patient queue management",
  },
  {
    icon: <WhatsappLogo className="h-4 w-4" weight="duotone" />,
    text: "WhatsApp booking automation",
  },
];

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Failed to get user");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "doctor") {
      router.push("/doctor");
    } else {
      router.push("/receptionist");
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand + features */}
      <div className="relative hidden flex-col overflow-hidden bg-primary lg:flex lg:w-[45%]">
        {/* Subtle radial glow */}
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Stethoscope className="h-5 w-5 text-white" weight="duotone" />
            </div>
            <span className="text-xl font-semibold text-white">ClinicOS</span>
          </div>

          {/* Main headline */}
          <div className="mt-auto mb-12">
            <h1 className="text-4xl font-bold leading-tight text-white">
              The operating
              <br />
              system for your
              <br />
              clinic.
            </h1>
            <p className="mt-4 text-base text-white/70 leading-relaxed">
              Streamline appointments, manage your patient flow, and automate
              booking — all from one place.
            </p>

            <div className="mt-10 space-y-4">
              {features.map((f) => (
                <div key={f.text} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <span className="text-white">{f.icon}</span>
                  </div>
                  <span className="text-sm text-white/85">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Stethoscope
                className="h-6 w-6 text-primary-foreground"
                weight="duotone"
              />
            </div>
            <span className="text-xl font-semibold">ClinicOS</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage your clinic
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <span className="mt-px shrink-0">⚠</span>
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-accent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-accent"
              />
            </div>

            <Button
              type="submit"
              className="mt-2 w-full font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
