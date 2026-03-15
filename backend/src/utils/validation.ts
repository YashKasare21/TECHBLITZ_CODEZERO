import { z } from 'zod';

export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

export const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['DOCTOR', 'RECEPTIONIST']),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createPatientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  startTime: z.string().datetime({ message: 'Invalid start time' }),
  duration: z.number().int().min(15).max(120),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  startTime: z.string().datetime().optional(),
  duration: z.number().int().min(15).max(120).optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

export const blockSlotSchema = z.object({
  startTime: z.string().datetime({ message: 'Invalid start time' }),
  endTime: z.string().datetime({ message: 'Invalid end time' }),
  reason: z.string().optional(),
});

export const scheduleEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  isActive: z.boolean().optional(),
});

export const weeklyScheduleSchema = z.object({
  schedules: z.array(scheduleEntrySchema),
  defaultConsultationMinutes: z.number().int().min(5).max(120).optional(),
});

export const scheduleExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional().nullable(),
  endTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional().nullable(),
  reason: z.string().optional(),
});

export const consultationDurationSchema = z.object({
  duration: z.number().int().min(5).max(120),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type BlockSlotInput = z.infer<typeof blockSlotSchema>;
export type ScheduleEntryInput = z.infer<typeof scheduleEntrySchema>;
export type WeeklyScheduleInput = z.infer<typeof weeklyScheduleSchema>;
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionSchema>;
export type ConsultationDurationInput = z.infer<typeof consultationDurationSchema>;
