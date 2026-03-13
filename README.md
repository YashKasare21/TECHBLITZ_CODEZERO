# ClinicOS

The single operating system for your doctor's clinic. Built with Next.js, Supabase, shadcn/ui, and a WhatsApp AI booking bot.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), Tailwind v4, shadcn/ui, Phosphor Icons
- **Backend**: Supabase (Postgres, Auth, Realtime, RLS)
- **WhatsApp Bot**: Baileys v6 (separate Bun process)
- **AI**: Vercel AI SDK v6 with OpenAI-compatible endpoint
- **Email**: Resend

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Set Up Supabase

- Create a project at [supabase.com](https://supabase.com)
- Go to SQL Editor and run `supabase/migrations/001_initial_schema.sql`
- Copy your project URL and keys

### 3. Configure Environment

```bash
cp .env.local.example .env.local
# Fill in your Supabase keys, LLM endpoint, and Resend API key
```

### 4. Create Seed Users

In Supabase Dashboard > Authentication > Users, create:
- A receptionist: email `receptionist@clinic.com`, set password, add user metadata: `{"full_name": "Sarah Admin", "role": "receptionist"}`
- A doctor: email `doctor@clinic.com`, set password, add user metadata: `{"full_name": "Ahmed Khan", "role": "doctor"}`

Then in Supabase Table Editor, add a row to `doctors`:
- `profile_id`: the doctor user's UUID
- `specialization`: "General Medicine"

### 5. Run the App

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Run the WhatsApp Bot (Optional)

```bash
cd bot
cp .env.example .env
# Fill in your Supabase and LLM keys
bun dev
```

Scan the QR code with WhatsApp. Manage from the Receptionist > WhatsApp page.

## Features

### Phase 1 — Core
- Role-based auth (receptionist / doctor)
- Receptionist dashboard with real-time appointment timeline
- Quick-book drawer with slot picker (clash-safe via DB unique constraint)
- Appointment list with filters (date, doctor, status)
- Patient management with auto-generated UIDs (PT-0001)
- Doctor queue with check-in/check-out flow
- Weekly availability editor + blocked dates

### Phase 2 — Polish
- Week calendar view with color-coded status
- Supabase Realtime — dashboards update live
- Email notifications via Resend

### Phase 3 — Killer Features
- WhatsApp AI chatbot for natural-language booking
- LLM intent parsing (book/cancel/reschedule)
- Multi-turn conversational booking flow
- WhatsApp admin panel with QR, message log, manual send

## Project Structure

```
├── app/
│   ├── (auth)/login/          # Auth
│   ├── receptionist/          # Receptionist dashboard, appointments, patients, whatsapp
│   ├── doctor/                # Doctor queue, schedule, availability
│   └── api/                   # REST endpoints (appointments, slots, whatsapp bridge)
├── components/
│   ├── appointments/          # StatusBadge, SlotPicker, BookingDrawer
│   ├── schedule/              # WeekCalendar
│   └── ui/                    # shadcn components
├── lib/
│   ├── supabase/              # Client, server, middleware helpers
│   ├── scheduling.ts          # Slot generation + clash prevention
│   ├── email.ts               # Resend email templates
│   └── types.ts               # TypeScript interfaces
├── hooks/
│   └── use-realtime.ts        # Supabase Realtime subscription hook
├── bot/                       # WhatsApp bot (separate Bun process)
│   ├── index.ts               # HTTP server + WhatsApp init
│   ├── whatsapp.ts            # Baileys connection + message routing
│   ├── message-handler.ts     # Intent → action flow
│   ├── llm.ts                 # AI SDK v6 structured output
│   ├── supabase.ts            # DB queries for bot
│   └── conversation-store.ts  # In-memory session state
├── supabase/
│   └── migrations/            # SQL schema
└── middleware.ts               # Auth + role routing
```
