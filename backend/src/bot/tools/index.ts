import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

export const getDoctorsTool = tool({
  description: 'Get a list of all available doctors in the clinic',
  inputSchema: z.object({}),
  execute: async () => {
    const doctors = await prisma.user.findMany({
      where: { role: 'DOCTOR' },
      select: { id: true, name: true },
    });
    return doctors;
  },
});

export const getDoctorScheduleTool = tool({
  description: 'Get a doctor\'s working hours for a specific date',
  inputSchema: z.object({
    doctorId: z.string().describe('The doctor\'s ID'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
  }),
  execute: async (input) => {
    const { doctorId, date } = input;
    const dayOfWeek = new Date(date).getDay();

    const schedule = await prisma.doctorSchedule.findMany({
      where: { doctorId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    const exception = await prisma.scheduleException.findFirst({
      where: { doctorId, date: new Date(date) },
    });

    return {
      workingHours: schedule.map((s) => ({
        start: s.startTime,
        end: s.endTime,
      })),
      exception: exception
        ? {
            startTime: exception.startTime,
            endTime: exception.endTime,
            reason: exception.reason,
          }
        : null,
    };
  },
});

export const getAvailableSlotsTool = tool({
  description: 'Get available appointment slots for a doctor on a specific date',
  inputSchema: z.object({
    doctorId: z.string().describe('The doctor\'s ID'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
    duration: z.number().optional().describe('Appointment duration in minutes'),
  }),
  execute: async (input) => {
    const { doctorId, date, duration } = input;
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      select: { defaultConsultationMinutes: true },
    });

    const slotDuration = duration || doctor?.defaultConsultationMinutes || 15;

    const dayOfWeek = new Date(date).getDay();
    const schedule = await prisma.doctorSchedule.findMany({
      where: { doctorId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    if (schedule.length === 0) {
      return { slots: [], isWorkingDay: false, message: 'Doctor is not available on this day' };
    }

    const exceptions = await prisma.scheduleException.findMany({
      where: { doctorId, date: new Date(date) },
    });

    const parseTime = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const formatTime = (minutes: number): string => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    let workingRanges = schedule.map((s) => ({
      start: parseTime(s.startTime),
      end: parseTime(s.endTime),
    }));

    for (const exception of exceptions) {
      if (!exception.startTime) {
        return { slots: [], isWorkingDay: false, message: 'Doctor is unavailable on this day' };
      }
      if (exception.endTime) {
        const exStart = parseTime(exception.startTime);
        const exEnd = parseTime(exception.endTime);
        workingRanges = workingRanges.flatMap((range) => {
          if (exEnd <= range.start || exStart >= range.end) return [range];
          const result: { start: number; end: number }[] = [];
          if (exStart > range.start) result.push({ start: range.start, end: exStart });
          if (exEnd < range.end) result.push({ start: exEnd, end: range.end });
          return result;
        });
      }
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [appointments, blockedSlots] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          doctorId,
          status: { not: 'CANCELLED' },
          startTime: { gte: startOfDay, lt: endOfDay },
        },
        select: { startTime: true, endTime: true },
      }),
      prisma.blockedSlot.findMany({
        where: { doctorId, startTime: { gte: startOfDay, lt: endOfDay } },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const bookedSlots = [...appointments, ...blockedSlots].map((a) => ({
      start: a.startTime.getHours() * 60 + a.startTime.getMinutes(),
      end: a.endTime.getHours() * 60 + a.endTime.getMinutes(),
    }));

    const slots: { time: string; available: boolean }[] = [];
    for (const range of workingRanges) {
      let current = range.start;
      while (current + slotDuration <= range.end) {
        const slotEnd = current + slotDuration;
        const isOverlapping = bookedSlots.some(
          (booked) => current < booked.end && slotEnd > booked.start,
        );
        slots.push({ time: formatTime(current), available: !isOverlapping });
        current += slotDuration;
      }
    }

    const availableSlots = slots.filter((s) => s.available);

    return {
      slots: availableSlots,
      isWorkingDay: true,
      slotDuration,
      totalAvailable: availableSlots.length,
    };
  },
});

export const bookAppointmentTool = tool({
  description: 'Book an appointment for a patient with a doctor',
  inputSchema: z.object({
    patientId: z.string().describe('The patient\'s ID'),
    doctorId: z.string().describe('The doctor\'s ID'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
    time: z.string().describe('Time in HH:MM format (24-hour)'),
    duration: z.number().optional().describe('Duration in minutes'),
    notes: z.string().optional().describe('Optional notes'),
  }),
  execute: async (input) => {
    const { patientId, doctorId, date, time, duration, notes } = input;
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      select: { name: true, defaultConsultationMinutes: true },
    });

    if (!doctor) {
      return { success: false, error: 'Doctor not found' };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    });

    if (!patient) {
      return { success: false, error: 'Patient not found' };
    }

    const slotDuration = duration || doctor.defaultConsultationMinutes || 15;
    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);
    const endTime = new Date(startTime.getTime() + slotDuration * 60 * 1000);

    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { not: 'CANCELLED' },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (existingAppointment) {
      return { success: false, error: 'This time slot is already booked' };
    }

    const blockedSlot = await prisma.blockedSlot.findFirst({
      where: {
        doctorId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (blockedSlot) {
      return { success: false, error: 'This time slot is blocked' };
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        startTime,
        endTime,
        notes: notes || null,
      },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { select: { name: true } },
      },
    });

    const formatTimeOnly = (d: Date): string => {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    return {
      success: true,
      appointment: {
        id: appointment.id,
        patientName: appointment.patient.name,
        doctorName: appointment.doctor.name,
        date: date,
        time: time,
        endTime: formatTimeOnly(endTime),
        duration: slotDuration,
      },
    };
  },
});

export const getMyAppointmentsTool = tool({
  description: 'Get upcoming appointments for a patient',
  inputSchema: z.object({
    patientId: z.string().describe('The patient\'s ID'),
    limit: z.number().optional().describe('Maximum number to return'),
  }),
  execute: async (input) => {
    const { patientId, limit } = input;
    const now = new Date();
    const maxResults = limit || 5;

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        startTime: { gte: now },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startTime: 'asc' },
      take: maxResults,
      include: {
        doctor: { select: { name: true } },
      },
    });

    const formatTimeOnly = (d: Date): string => {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    return appointments.map((a) => ({
      id: a.id,
      doctorName: a.doctor.name,
      date: a.startTime.toISOString().split('T')[0],
      time: formatTimeOnly(a.startTime),
      endTime: formatTimeOnly(a.endTime),
      status: a.status,
      notes: a.notes,
    }));
  },
});

export const cancelAppointmentTool = tool({
  description: 'Cancel an upcoming appointment',
  inputSchema: z.object({
    appointmentId: z.string().describe('The appointment ID to cancel'),
    patientId: z.string().describe('The patient\'s ID (for verification)'),
    reason: z.string().optional().describe('Optional reason for cancellation'),
  }),
  execute: async (input) => {
    const { appointmentId, patientId, reason } = input;
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: { select: { name: true } } },
    });

    if (!appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    if (appointment.patientId !== patientId) {
      return { success: false, error: 'You can only cancel your own appointments' };
    }

    if (appointment.status === 'CANCELLED') {
      return { success: false, error: 'Appointment is already cancelled' };
    }

    if (new Date(appointment.startTime) < new Date()) {
      return { success: false, error: 'Cannot cancel past appointments' };
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { 
        status: 'CANCELLED', 
        notes: reason ? `${appointment.notes || ''}\nCancellation reason: ${reason}`.trim() : appointment.notes 
      },
    });

    const formatTimeOnly = (d: Date): string => {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    return {
      success: true,
      message: `Appointment with Dr. ${appointment.doctor.name} on ${appointment.startTime.toISOString().split('T')[0]} at ${formatTimeOnly(appointment.startTime)} has been cancelled`,
    };
  },
});

export const rescheduleAppointmentTool = tool({
  description: 'Reschedule an existing appointment to a new date and time',
  inputSchema: z.object({
    appointmentId: z.string().describe('The appointment ID to reschedule'),
    patientId: z.string().describe('The patient\'s ID (for verification)'),
    newDate: z.string().describe('New date in YYYY-MM-DD format'),
    newTime: z.string().describe('New time in HH:MM format'),
    duration: z.number().optional().describe('Duration in minutes'),
  }),
  execute: async (input) => {
    const { appointmentId, patientId, newDate, newTime, duration } = input;
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: { select: { id: true, name: true, defaultConsultationMinutes: true } } },
    });

    if (!existingAppointment) {
      return { success: false, error: 'Appointment not found' };
    }

    if (existingAppointment.patientId !== patientId) {
      return { success: false, error: 'You can only reschedule your own appointments' };
    }

    if (existingAppointment.status === 'CANCELLED') {
      return { success: false, error: 'Cannot reschedule a cancelled appointment' };
    }

    const doctor = existingAppointment.doctor;
    const slotDuration = duration || doctor.defaultConsultationMinutes || 15;
    const [hours, minutes] = newTime.split(':').map(Number);
    const newStartTime = new Date(newDate);
    newStartTime.setHours(hours, minutes, 0, 0);
    const newEndTime = new Date(newStartTime.getTime() + slotDuration * 60 * 1000);

    const conflict = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        id: { not: appointmentId },
        status: { not: 'CANCELLED' },
        startTime: { lt: newEndTime },
        endTime: { gt: newStartTime },
      },
    });

    if (conflict) {
      return { success: false, error: 'The new time slot is already booked' };
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    const newAppointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId: doctor.id,
        startTime: newStartTime,
        endTime: newEndTime,
        rescheduledFrom: appointmentId,
        notes: existingAppointment.notes,
      },
      include: {
        doctor: { select: { name: true } },
      },
    });

    return {
      success: true,
      message: `Appointment rescheduled to ${newDate} at ${newTime} with Dr. ${doctor.name}`,
      newAppointmentId: newAppointment.id,
    };
  },
});

export const findPatientByPhoneTool = tool({
  description: 'Find a patient by their phone number',
  inputSchema: z.object({
    phone: z.string().describe('Phone number to search for'),
  }),
  execute: async (input) => {
    const { phone } = input;
    const patient = await prisma.patient.findUnique({
      where: { phone },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        telegramChatId: true,
        phoneVerified: true,
      },
    });

    if (!patient) {
      return { found: false, message: 'No patient found with this phone number' };
    }

    return { found: true, patient };
  },
});

export const registerPatientTool = tool({
  description: 'Register a new patient in the system',
  inputSchema: z.object({
    name: z.string().describe('Patient\'s full name'),
    phone: z.string().describe('Patient\'s phone number'),
    email: z.string().optional().describe('Patient\'s email (optional)'),
    telegramChatId: z.string().optional().describe('Telegram chat ID if registering via bot'),
  }),
  execute: async (input) => {
    const { name, phone, email, telegramChatId } = input;
    const existing = await prisma.patient.findUnique({
      where: { phone },
    });

    if (existing) {
      return { success: false, error: 'A patient with this phone number already exists', existingPatientId: existing.id };
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        phone,
        email: email || null,
        telegramChatId: telegramChatId || null,
        phoneVerified: !!telegramChatId,
      },
    });

    return { success: true, patient: { id: patient.id, name: patient.name, phone: patient.phone } };
  },
});

export const linkTelegramToPatientTool = tool({
  description: 'Link a Telegram account to an existing patient record',
  inputSchema: z.object({
    patientId: z.string().describe('The patient\'s ID'),
    telegramChatId: z.string().describe('The Telegram chat ID'),
    telegramUsername: z.string().optional().describe('The Telegram username'),
  }),
  execute: async (input) => {
    const { patientId, telegramChatId, telegramUsername } = input;
    const existingLink = await prisma.patient.findFirst({
      where: { telegramChatId, id: { not: patientId } },
    });

    if (existingLink) {
      return { success: false, error: 'This Telegram account is already linked to another patient' };
    }

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        telegramChatId,
        telegramUsername: telegramUsername || null,
        phoneVerified: true,
      },
      select: { id: true, name: true, phone: true },
    });

    return { success: true, patient };
  },
});

export const completeInteractionTool = tool({
  description: 'Call this when the patient\'s request has been fully addressed. Use after booking an appointment, cancelling, rescheduling, or when you have provided all the information the patient needs.',
  inputSchema: z.object({
    summary: z.string().describe('Brief summary of what was accomplished or provided to the patient'),
    patientSatisfied: z.boolean().describe('Whether the patient\'s request was fully satisfied'),
  }),
  execute: async (input) => {
    return { 
      completed: true, 
      summary: input.summary,
      patientSatisfied: input.patientSatisfied,
    };
  },
});

export const botTools = {
  getDoctors: getDoctorsTool,
  getDoctorSchedule: getDoctorScheduleTool,
  getAvailableSlots: getAvailableSlotsTool,
  bookAppointment: bookAppointmentTool,
  getMyAppointments: getMyAppointmentsTool,
  cancelAppointment: cancelAppointmentTool,
  rescheduleAppointment: rescheduleAppointmentTool,
  findPatientByPhone: findPatientByPhoneTool,
  registerPatient: registerPatientTool,
  linkTelegramToPatient: linkTelegramToPatientTool,
  completeInteraction: completeInteractionTool,
};
