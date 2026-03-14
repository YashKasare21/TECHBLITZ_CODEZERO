import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError, AppError } from '../middleware/errorHandler';
import { DayOfWeek, ScheduleExceptionInput, WeeklyScheduleInput } from '../utils/validation';
import { notifyRescheduledAppointments } from './notification.service';

export const getWeeklySchedule = async (doctorId: string) => {
  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    select: { defaultConsultationMinutes: true },
  });

  return {
    schedules,
    defaultConsultationMinutes: doctor?.defaultConsultationMinutes || 15,
  };
};

export const updateWeeklySchedule = async (
  doctorId: string,
  input: WeeklyScheduleInput,
) => {
  await prisma.$transaction(async (tx) => {
    await tx.doctorSchedule.deleteMany({ where: { doctorId } });

    if (input.schedules.length > 0) {
      await tx.doctorSchedule.createMany({
        data: input.schedules.map((s) => ({
          doctorId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive ?? true,
        })),
      });
    }

    if (input.defaultConsultationMinutes !== undefined) {
      await tx.user.update({
        where: { id: doctorId },
        data: { defaultConsultationMinutes: input.defaultConsultationMinutes },
      });
    }
  });

  return getWeeklySchedule(doctorId);
};

export const getExceptions = async (
  doctorId: string,
  startDate: string,
  endDate: string,
) => {
  return prisma.scheduleException.findMany({
    where: {
      doctorId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    orderBy: { date: 'asc' },
  });
};

const parseTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getWorkingHoursForDate = async (doctorId: string, date: Date) => {
  const dayOfWeek = date.getDay();

  const schedule = await prisma.doctorSchedule.findMany({
    where: { doctorId, dayOfWeek, isActive: true },
    orderBy: { startTime: 'asc' },
  });

  const dateStr = date.toISOString().split('T')[0];

  const exceptions = await prisma.scheduleException.findMany({
    where: {
      doctorId,
      date: new Date(dateStr),
    },
  });

  if (exceptions.some((e) => !e.startTime)) {
    return [];
  }

  let workingRanges = schedule.map((s) => ({
    start: parseTime(s.startTime),
    end: parseTime(s.endTime),
  }));

  for (const exception of exceptions) {
    if (exception.startTime && exception.endTime) {
      const exStart = parseTime(exception.startTime);
      const exEnd = parseTime(exception.endTime);

      workingRanges = workingRanges.flatMap((range) => {
        if (exEnd <= range.start || exStart >= range.end) {
          return [range];
        }

        const result: { start: number; end: number }[] = [];
        if (exStart > range.start) {
          result.push({ start: range.start, end: exStart });
        }
        if (exEnd < range.end) {
          result.push({ start: exEnd, end: range.end });
        }
        return result;
      });
    }
  }

  return workingRanges;
};

export const getAvailableSlots = async (
  doctorId: string,
  dateStr: string,
  slotDuration?: number,
) => {
  const date = new Date(dateStr);
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    select: { defaultConsultationMinutes: true },
  });

  const duration = slotDuration || doctor?.defaultConsultationMinutes || 15;

  const workingRanges = await getWorkingHoursForDate(doctorId, date);

  if (workingRanges.length === 0) {
    return { slots: [], isWorkingDay: false };
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
      where: {
        doctorId,
        startTime: { gte: startOfDay, lt: endOfDay },
      },
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
    while (current + duration <= range.end) {
      const slotEnd = current + duration;

      const isOverlapping = bookedSlots.some(
        (booked) => current < booked.end && slotEnd > booked.start,
      );

      slots.push({
        time: formatTime(current),
        available: !isOverlapping,
      });

      current += duration;
    }
  }

  return { slots, isWorkingDay: true };
};

const findNextAvailableSlot = async (
  doctorId: string,
  fromDate: Date,
  duration: number,
  maxDays: number = 14,
): Promise<{ date: Date; time: string } | null> => {
  let currentDate = new Date(fromDate);
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < maxDays; i++) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const { slots, isWorkingDay } = await getAvailableSlots(
      doctorId,
      dateStr,
      duration,
    );

    if (isWorkingDay) {
      const availableSlot = slots.find((s) => s.available);
      if (availableSlot) {
        return { date: new Date(dateStr), time: availableSlot.time };
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return null;
};

export const createException = async (
  doctorId: string,
  input: ScheduleExceptionInput,
) => {
  const date = new Date(input.date);

  const existingException = await prisma.scheduleException.findFirst({
    where: {
      doctorId,
      date,
      startTime: input.startTime || null,
    },
  });

  if (existingException) {
    throw new ConflictError('Exception already exists for this date/time');
  }

  if (input.startTime && input.endTime) {
    const start = parseTime(input.startTime);
    const end = parseTime(input.endTime);
    if (end <= start) {
      throw new AppError('End time must be after start time', 400);
    }
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  let affectedAppointments: {
    id: string;
    patientId: string;
    startTime: Date;
    endTime: Date;
    patient: { name: string };
  }[] = [];

  if (input.startTime && input.endTime) {
    const exStartMinutes = parseTime(input.startTime);
    const exEndMinutes = parseTime(input.endTime);

    const exceptionStart = new Date(date);
    exceptionStart.setHours(
      Math.floor(exStartMinutes / 60),
      exStartMinutes % 60,
      0,
      0,
    );

    const exceptionEnd = new Date(date);
    exceptionEnd.setHours(
      Math.floor(exEndMinutes / 60),
      exEndMinutes % 60,
      0,
      0,
    );

    affectedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        status: 'SCHEDULED',
        startTime: { gte: startOfDay, lt: endOfDay },
        OR: [
          {
            AND: [
              { startTime: { gte: exceptionStart } },
              { startTime: { lt: exceptionEnd } },
            ],
          },
          {
            AND: [
              { endTime: { gt: exceptionStart } },
              { endTime: { lte: exceptionEnd } },
            ],
          },
          {
            AND: [
              { startTime: { lt: exceptionStart } },
              { endTime: { gt: exceptionEnd } },
            ],
          },
        ],
      },
      include: { patient: { select: { name: true } } },
    });
  } else {
    affectedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        status: 'SCHEDULED',
        startTime: { gte: startOfDay, lt: endOfDay },
      },
      include: { patient: { select: { name: true } } },
    });
  }

  if (affectedAppointments.length === 0) {
    const exception = await prisma.scheduleException.create({
      data: {
        doctorId,
        date,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        reason: input.reason || null,
      },
    });

    return {
      exception,
      rescheduledAppointments: [],
      blocked: false,
    };
  }

  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    select: { defaultConsultationMinutes: true },
  });

  const defaultDuration = doctor?.defaultConsultationMinutes || 15;

  const rescheduleResults: {
    appointmentId: string;
    patientName: string;
    oldTime: string;
    newTime: string | null;
    success: boolean;
  }[] = [];

  const sortedAppointments = [...affectedAppointments].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  for (const appointment of sortedAppointments) {
    const duration = Math.round(
      (appointment.endTime.getTime() - appointment.startTime.getTime()) /
        (60 * 1000),
    );

    const searchFromDate = new Date(date);
    searchFromDate.setDate(searchFromDate.getDate() + 1);

    const nextSlot = await findNextAvailableSlot(
      doctorId,
      searchFromDate,
      duration || defaultDuration,
      14,
    );

    if (nextSlot) {
      const [hours, minutes] = nextSlot.time.split(':').map(Number);
      const newStartTime = new Date(nextSlot.date);
      newStartTime.setHours(hours, minutes, 0, 0);
      const newEndTime = new Date(
        newStartTime.getTime() + (duration || defaultDuration) * 60 * 1000,
      );

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'RESCHEDULED', rescheduleReason: input.reason || null },
      });

      const newAppointment = await prisma.appointment.create({
        data: {
          patientId: appointment.patientId,
          doctorId,
          startTime: newStartTime,
          endTime: newEndTime,
          rescheduledFrom: appointment.id,
          rescheduleReason: input.reason || null,
        },
        include: {
          patient: { select: { name: true } },
        },
      });

      rescheduleResults.push({
        appointmentId: appointment.id,
        patientName: appointment.patient.name,
        oldTime: appointment.startTime.toISOString(),
        newTime: newStartTime.toISOString(),
        success: true,
      });
    } else {
      rescheduleResults.push({
        appointmentId: appointment.id,
        patientName: appointment.patient.name,
        oldTime: appointment.startTime.toISOString(),
        newTime: null,
        success: false,
      });
    }
  }

  const failedReschedules = rescheduleResults.filter((r) => !r.success);
  if (failedReschedules.length > 0) {
    throw new ConflictError(
      `Cannot create exception: no available slots for ${failedReschedules.length} appointment(s) within next 14 days. Please manually reschedule these appointments first.`,
    );
  }

  const exception = await prisma.scheduleException.create({
    data: {
      doctorId,
      date,
      startTime: input.startTime || null,
      endTime: input.endTime || null,
      reason: input.reason || null,
    },
  });

  notifyRescheduledAppointments(rescheduleResults, input.reason).catch((err) => {
    console.error('Failed to send rescheduling notifications:', err);
  });

  return {
    exception,
    rescheduledAppointments: rescheduleResults,
    blocked: false,
  };
};

export const deleteException = async (exceptionId: string, doctorId: string) => {
  const exception = await prisma.scheduleException.findUnique({
    where: { id: exceptionId },
  });

  if (!exception) {
    throw new NotFoundError('Schedule exception');
  }

  if (exception.doctorId !== doctorId) {
    throw new ConflictError('Not authorized to delete this exception');
  }

  await prisma.scheduleException.delete({ where: { id: exceptionId } });

  return { success: true };
};

export const updateConsultationDuration = async (
  doctorId: string,
  duration: number,
) => {
  if (duration < 5 || duration > 120) {
    throw new AppError('Duration must be between 5 and 120 minutes', 400);
  }

  return prisma.user.update({
    where: { id: doctorId },
    data: { defaultConsultationMinutes: duration },
    select: { id: true, defaultConsultationMinutes: true },
  });
};

export const copyScheduleToWeekdays = async (doctorId: string) => {
  const mondaySchedule = await prisma.doctorSchedule.findMany({
    where: { doctorId, dayOfWeek: DayOfWeek.Monday, isActive: true },
  });

  if (mondaySchedule.length === 0) {
    throw new AppError(
      'No schedule found for Monday. Please set Monday schedule first.',
      400,
    );
  }

  const weekdays = [
    DayOfWeek.Tuesday,
    DayOfWeek.Wednesday,
    DayOfWeek.Thursday,
    DayOfWeek.Friday,
  ];

  await prisma.$transaction(async (tx) => {
    for (const day of weekdays) {
      await tx.doctorSchedule.deleteMany({
        where: { doctorId, dayOfWeek: day },
      });

      await tx.doctorSchedule.createMany({
        data: mondaySchedule.map((s) => ({
          doctorId,
          dayOfWeek: day,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: true,
        })),
      });
    }
  });

  return getWeeklySchedule(doctorId);
};

export const getDoctorSettings = async (doctorId: string) => {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      name: true,
      email: true,
      defaultConsultationMinutes: true,
    },
  });

  if (!doctor) {
    throw new NotFoundError('Doctor');
  }

  return doctor;
};
