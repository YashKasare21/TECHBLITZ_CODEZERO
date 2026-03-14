# ClinicApp — Appointment Management System

A production-ready full-stack web application for managing a doctor's clinic. Receptionists can book, reschedule and cancel appointments; doctors can view their schedule, mark appointments completed, add notes, and block unavailable time.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, FullCalendar |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod |
| HTTP Client | Axios |

---

## Features

- **Role-based access** — Doctor and Receptionist views with separate dashboards
- **Double-booking prevention** — Overlap detection on both appointments and blocked slots
- **FullCalendar** — Day/Week/Month views with colour-coded events; drag-and-drop rescheduling
- **Patient management** — Register, search (by name/phone/email), view history
- **Appointment lifecycle** — Book → Reschedule → Complete / Cancel
- **Blocked slots** — Doctors can block breaks, holidays, or personal time
- **Clinical notes** — Per-appointment notes editable by the doctor

---

## Project Structure

```
it5/
├── backend/                   Express API
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── controllers/
│       ├── routes/
│       ├── middleware/        (auth, roles, errorHandler)
│       ├── services/          (business logic + conflict detection)
│       ├── utils/             (jwt, zod schemas)
│       ├── lib/prisma.ts
│       ├── app.ts
│       └── server.ts
└── frontend/                  Next.js app
    └── src/
        ├── app/               (login, dashboard, doctor, patients)
        ├── components/        (Calendar, AppointmentModal, Navbar…)
        ├── context/           (AuthContext)
        ├── hooks/             (useAppointments, usePatients)
        ├── services/          (api.ts – Axios wrapper)
        └── types/             (shared TypeScript interfaces)
```

---

## Local Development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- PostgreSQL running locally **or** a free connection string from [Neon](https://neon.tech) / [Supabase](https://supabase.com)

---

### 1. Clone & enter the repo

```bash
git clone <repo-url>
cd it5
```

### 2. Backend setup

```bash
cd backend

# Install dependencies
bun install

# Create .env from template and fill in your values
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/clinic_db"
JWT_SECRET="change-this-to-a-long-random-secret"
PORT=4000
FRONTEND_URL="http://localhost:3000"
```

```bash
# Run migrations (creates the database tables)
bunx prisma migrate dev --name init

# Seed sample users, patients and appointments
bun db:seed

# Start the dev server (hot-reload)
bun dev
```

The API is now available at `http://localhost:4000`.

---

### 3. Frontend setup

```bash
cd ../frontend

# Install dependencies
bun install

# Create .env.local from template
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

```bash
# Start the dev server
bun dev
```

Open `http://localhost:3000` in your browser.

---

### Demo credentials (created by seed)

| Role | Email | Password |
|------|-------|----------|
| Doctor | doctor@clinic.com | doctor123 |
| Receptionist | reception@clinic.com | reception123 |

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWTs (use a long random string in prod) | Yes |
| `PORT` | HTTP port (default: 4000) | No |
| `FRONTEND_URL` | Allowed CORS origin | No |

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | Yes |

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login, returns JWT |
| POST | `/api/auth/register` | — | Create user account |
| GET | `/api/auth/me` | JWT | Get current user |
| GET | `/api/auth/doctors` | JWT | List all doctors |

### Patients
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/patients` | JWT | List all patients |
| POST | `/api/patients` | Receptionist | Register patient |
| GET | `/api/patients/search?q=` | JWT | Search by name/phone |
| GET | `/api/patients/:id` | JWT | Get patient + history |
| PUT | `/api/patients/:id` | Receptionist | Update patient |

### Appointments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/appointments` | JWT | List (filterable by doctorId, date, status, patientId) |
| POST | `/api/appointments` | JWT | Create (conflict-checked) |
| GET | `/api/appointments/:id` | JWT | Get single |
| PUT | `/api/appointments/:id` | JWT | Reschedule / update status / add note |
| DELETE | `/api/appointments/:id` | JWT | Cancel |

### Doctor
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/doctor/schedule?startDate=&endDate=` | Doctor | Schedule + blocked slots |
| POST | `/api/doctor/block-slot` | Doctor | Block a time window |
| DELETE | `/api/doctor/block-slot/:id` | Doctor | Remove blocked slot |

---

## Database Schema

```
User           — id, name, email, passwordHash, role (DOCTOR|RECEPTIONIST)
Patient        — id, name, phone, email, notes
Appointment    — id, patientId, doctorId, startTime, endTime, status, notes
BlockedSlot    — id, doctorId, startTime, endTime, reason
```

---

## Deployment

### Frontend → Vercel

1. Push `frontend/` to GitHub (or deploy from the monorepo).
2. Create a new Vercel project, set **Root Directory** to `frontend`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend.onrender.com`
4. Deploy.

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Set **Root Directory** to `backend`.
3. Build command: `bun install && bunx prisma generate && bunx prisma migrate deploy`
4. Start command: `bun src/server.ts`
5. Add environment variables:
   - `DATABASE_URL` (from Neon/Supabase)
   - `JWT_SECRET`
   - `FRONTEND_URL` (your Vercel URL)
   - `PORT` = `4000`
6. Deploy.

### Database → Neon (recommended free tier)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string.
3. Set it as `DATABASE_URL` in both local `.env` and Render environment variables.

---

## Architectural Notes

**Conflict detection** runs in `backend/src/services/appointment.service.ts` before every create/update. It uses two Prisma queries — one against `Appointment` (excluding cancelled) and one against `BlockedSlot` — checking for time-range overlaps with the half-open interval `[start, end)`.

**JWT storage** uses `localStorage` on the client (simple for a clinic intranet tool). For public internet deployments, consider migrating to httpOnly cookies.

**Drag-and-drop rescheduling** is enabled in the Receptionist calendar via FullCalendar's `editable` prop. On drop, the frontend calls `PUT /api/appointments/:id` with the new time; if the backend rejects it (conflict), the event reverts and the list refreshes.

**`'use client'` boundary** — every interactive component is a Client Component. Data fetching uses Axios through custom hooks rather than React Server Components, keeping the architecture simple and the API layer reusable.
