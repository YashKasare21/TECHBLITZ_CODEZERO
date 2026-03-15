# AGENTS.md

Coding guidelines for AI agents working in this repository.

## Project Overview

Clinic appointment management system with:
- **Backend**: Express.js + Prisma + PostgreSQL (TypeScript, Bun runtime)
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Telegram Bot**: grammY + Vercel AI SDK for LLM-powered patient interactions

## Commands

### Backend (`/backend`)

```bash
bun dev              # Development server with hot reload
bun run build        # TypeScript compilation
bun run start        # Production server (requires build first)

# Database
bun run db:generate  # Generate Prisma client
bun run db:migrate   # Run migrations
bun run db:seed      # Seed database
bun run db:studio    # Open Prisma Studio

# Type checking
npx tsc --noEmit     # Type check without emitting
```

### Frontend (`/frontend`)

```bash
bun dev              # Development server (localhost:3000)
bun run build        # Production build
bun run start        # Production server
bun run lint         # Run ESLint
```

### Testing

No test framework is currently configured. When adding tests, prefer:
- Backend: Jest or Vitest with supertest for API tests
- Frontend: Jest with React Testing Library

## Code Style

### Imports

**Backend** - Relative imports, external packages first:
```typescript
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import * as controller from '../controllers/patients.controller';
```

**Frontend** - Use `@/` alias for internal imports:
```typescript
import { Patient, Appointment } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { patientsApi } from '@/services/api';
```

### Naming Conventions

| Entity | Convention | Example |
|--------|------------|---------|
| Backend files | kebab-case with dot notation | `patients.service.ts`, `auth.routes.ts` |
| Frontend components | PascalCase | `AppointmentModal.tsx` |
| Frontend hooks | camelCase with `use` prefix | `usePatients.ts` |
| Functions/variables | camelCase | `getAvailableSlots`, `handleSubmit` |
| Types/Interfaces | PascalCase | `Patient`, `ApiResponse<T>` |
| Constants | SCREAMING_SNAKE_CASE | `DURATIONS`, `STATUS_STYLES` |

### File Structure

**Backend service pattern:**
```typescript
// patients.service.ts
export const getAll = async () => { /* Prisma queries */ };
export const getById = async (id: string) => { /* ... */ };
export const create = async (input: CreateInput) => { /* ... */ };
```

**Backend controller pattern:**
```typescript
// patients.controller.ts
export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await service.getAll();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
```

**Frontend component pattern:**
```typescript
'use client';

import { useState } from 'react';
import { ComponentType } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ComponentName({ isOpen, onClose }: Props) {
  const [state, setState] = useState(initialValue);
  
  if (!isOpen) return null;
  
  return ( /* JSX */ );
}
```

## Error Handling

### Custom Error Classes

```typescript
// Throw specific errors in services
throw new NotFoundError('Patient');      // 404
throw new ConflictError('Slot booked');  // 409
throw new AppError('Message', 400);      // Custom status
```

### API Response Format

**Success:**
```typescript
res.json({ success: true, data: result });
res.status(201).json({ success: true, data: created });
```

**Error:**
```typescript
res.status(404).json({ success: false, error: 'Patient not found' });
```

## TypeScript Guidelines

### Types vs Interfaces

- Use `interface` for object shapes: `interface Patient { ... }`
- Use `type` for unions and aliases: `type Role = 'DOCTOR' | 'RECEPTIONIST'`

### Zod Validation

Schemas in `backend/src/utils/validation.ts`:
```typescript
export const createPatientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Invalid phone number'),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
```

### Nullish Handling

- Use `|| null` for optional fields: `input.email || null`
- Use `?.` for optional chaining: `doctor?.defaultConsultationMinutes`
- Database stores `null` for optional fields, not `undefined`

## Prisma Patterns

```typescript
// Select specific fields
await prisma.patient.findMany({
  select: { id: true, name: true, phone: true },
});

// Include relations with select
await prisma.appointment.findMany({
  include: { patient: { select: { name: true } } },
});

// Transaction
await prisma.$transaction(async (tx) => {
  await tx.appointment.update({ ... });
  await tx.appointment.create({ ... });
});
```

## Frontend Patterns

### Styling

Tailwind CSS with dark mode support:
```typescript
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
```

### Protected Routes

```typescript
<ProtectedRoute allowedRoles={['RECEPTIONIST']}>
  <DashboardContent />
</ProtectedRoute>
```

### Dynamic Imports

For heavy components (calendars, editors):
```typescript
const Calendar = dynamic(() => import('@/components/Calendar'), { ssr: false });
```

## Environment Variables

Backend `.env`:
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
TELEGRAM_BOT_TOKEN=...
LLM_BASE_URL=https://...
LLM_API_KEY=...
LLM_MODEL=zai-org/glm-4.7-maas
ENABLE_DEVTOOLS=true
```

## Important Notes

- **Use `bun` over `npm`** - Project uses Bun as the package manager
- **No comments in code** unless explicitly requested
- **Early returns** for conditional rendering in React components
- **Handle errors with `next(err)`** in Express middleware chain
- **Validate with Zod** at controller level before passing to services
