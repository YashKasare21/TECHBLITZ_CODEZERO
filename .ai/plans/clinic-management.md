# Clinic Management System - Implementation Plan

## Overview
- **Project Type:** Full-stack web application (prototype)
- **Tech Stack:** Next.js 14 (App Router) + ShadCN UI + Supabase + Tailwind CSS
- **Deployment:** Vercel

## Simplified Architecture (Prototype)

### Authentication
- **Supabase Auth** with new publishable key pattern
- **Environment Variables:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Client:** `@supabase/ssr` package

### Database (8 Tables)
- Tables created via SQL scripts run in Supabase dashboard
- RLS enabled for security
- Profiles table auto-created via trigger on auth.users

---

## File Structure

```
clinic-management/
├── .env.local.example
├── package.json
├── next.config.js
├── tailwind.config.ts
├── components.json
├── middleware.ts
├── supabase/
│   └── schema.sql          # Run this in Supabase SQL Editor
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx        # Landing/Login
│   │   ├── globals.css
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx    # Role-based redirect
│   │   ├── appointments/
│   │   │   ├── page.tsx    # List view
│   │   │   └── new/
│   │   │       └── page.tsx # Booking form
│   │   ├── doctors/
│   │   │   └── page.tsx
│   │   ├── patients/
│   │   │   └── page.tsx
│   │   └── schedule/
│   │       └── page.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts   # Browser client
│   │   │   ├── server.ts   # Server client
│   │   │   └── middleware.ts
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/             # ShadCN components
│   │   ├── AuthProvider.tsx
│   │   ├── Navbar.tsx
│   │   ├── AppointmentCard.tsx
│   │   ├── BookingForm.tsx
│   │   └── DoctorCalendar.tsx
│   └── types/
│       └── index.ts
```

---

## Implementation Steps

### Step 1: Initialize Project
```bash
npx create-next-app@latest clinic-management --typescript --tailwind --eslint
cd clinic-management
npx shadcn@latest init
npx shadcn@latest add button card input form calendar dialog select table avatar dropdown-menu toast
npm install @supabase/ssr @supabase/supabase-js date-fns lucide-react
```

### Step 2: Configure Supabase Client
Create `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`

### Step 3: Set Up Database
Run `supabase/schema.sql` in Supabase SQL Editor

### Step 4: Build Authentication
- Login/Register pages with Supabase Auth
- Middleware for session management
- Protected routes

### Step 5: Core Features
- Appointment booking with slot generation
- Doctor schedule management
- Patient management
- Role-based dashboards

---

## Database Schema (SQL)

### Profiles (extends auth.users)
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT CHECK (role IN ('admin', 'doctor', 'receptionist', 'patient')) DEFAULT 'patient',
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile trigger
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Doctors
```sql
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  specialty TEXT,
  qualification TEXT,
  experience_years INT,
  bio TEXT,
  consultation_fee DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Patients
```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  date_of_birth DATE,
  gender TEXT,
  blood_group TEXT,
  address TEXT,
  emergency_contact TEXT,
  medical_history TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Appointments
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  visit_type TEXT DEFAULT 'consultation',
  status TEXT CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')) DEFAULT 'pending',
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Doctor Sessions (Working Hours)
```sql
CREATE TABLE doctor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  UNIQUE(doctor_id, day_of_week)
);
```

### Holidays
```sql
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_full_day BOOLEAN DEFAULT true,
  reason TEXT
);
```

### Services
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT DEFAULT 30,
  fee DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true
);
```

---

## RLS Policies (Simplified for Prototype)

Enable RLS on all tables:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
```

Basic policies (allow authenticated access - prototype only):
```sql
-- All authenticated users can read
CREATE POLICY "Allow read" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON doctor_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read" ON services FOR SELECT TO authenticated USING (true);

-- Authenticated users can create/update
CREATE POLICY "Allow all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON doctors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON doctor_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## Core Features (Priority Order)

1. **Authentication** - Login, Register, Session management
2. **Dashboard** - Role-based redirects (admin/doctor/receptionist/patient)
3. **Appointment Booking** - Select doctor, date, time slot, prevent conflicts
4. **Schedule Management** - Doctor working hours, holidays
5. **Patient Management** - CRUD patients
6. **Doctor Directory** - List doctors with specialties

---

## Slot Generation Algorithm (Core Logic)

```typescript
function getAvailableSlots(doctorId: string, date: Date, duration: number) {
  // 1. Get doctor's working sessions for the day
  // 2. Get existing appointments for that date
  // 3. Get holidays for that date
  // 4. Generate all possible slots within sessions
  // 5. Filter out:
  //    - Slots overlapping with existing appointments
  //    - Slots during holidays
  //    - Past times (if same day)
  // 6. Return available slots
}
```

---

## ShadCN Components Needed

```bash
npx shadcn@latest add button card input form calendar dialog select table avatar dropdown-menu toast label textarea
```

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Get these from: Supabase Dashboard → Settings → API

---

## User Flow

1. **Landing Page** → Login or Register
2. **Register** → Choose role (patient default), enter details
3. **Login** → Redirect based on role:
   - **Admin** → Full dashboard with stats
   - **Doctor** → Today's appointments, schedule management
   - **Receptionist** → Today's appointments, quick booking
   - **Patient** → My appointments, book new

---

## What's Simplified for Prototype

| Feature | Production | Prototype |
|---------|-----------|----------|
| RLS Policies | Granular per-role | Full access for authenticated |
| Email Notifications | Real email via SMTP | Console log only |
| Payment Integration | Stripe/Razorpay | Skip |
| Calendar Sync | Google Calendar | Skip |
| Audit Logs | Full tracking | Skip |

---

## Next Steps

1. Provide Supabase credentials when ready
2. Run SQL schema in Supabase
3. Initialize Next.js project
4. Implement features iteratively
