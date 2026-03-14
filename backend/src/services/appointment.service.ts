import { prisma } from '../lib/prisma';
import { CreateAppointmentInput, UpdateAppointmentInput } from '../utils/validation';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';

const checkConflicts = async (
  doctorId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string,
) => {
  // Check overlapping appointments
  const conflictingAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { not: 'CANCELLED' },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    include: { patient: { select: { name: true } } },
  });

  if (conflictingAppointment) {
    throw new ConflictError(
      `Time slot conflicts with existing appointment for ${conflictingAppointment.patient.name}`,
    );
  }

  // Check overlapping blocked slots
  const conflictingSlot = await prisma.blockedSlot.findFirst({
    where: {
      doctorId,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });

  if (conflictingSlot) {
    throw new ConflictError(
      `Time slot conflicts with a blocked period${conflictingSlot.reason ? `: ${conflictingSlot.reason}` : ''}`,
    );
  }
};

export const getAll = async (filters: {
  doctorId?: string;
  date?: string;
  status?: string;
  patientId?: string;
}) => {
  const where: Record<string, unknown> = {};

  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.status) where.status = filters.status;

  if (filters.date) {
    const day = new Date(filters.date);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    where.startTime = { gte: day, lt: nextDay };
  }

  return prisma.appointment.findMany({
    where,
    orderBy: { startTime: 'asc' },
    include: {
      patient: { select: { id: true, name: true, phone: true, email: true } },
      doctor: { select: { id: true, name: true } },
    },
  });
};

export const getById = async (id: string) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { select: { id: true, name: true, email: true } },
    },
  });

  if (!appointment) throw new NotFoundError('Appointment');
  return appointment;
};

export const create = async (input: CreateAppointmentInput) => {
  const startTime = new Date(input.startTime);
  const endTime = new Date(startTime.getTime() + input.duration * 60 * 1000);

  await checkConflicts(input.doctorId, startTime, endTime);

  return prisma.appointment.create({
    data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      startTime,
      endTime,
      notes: input.notes || null,
    },
    include: {
      patient: { select: { id: true, name: true, phone: true, email: true } },
      doctor: { select: { id: true, name: true } },
    },
  });
};

export const update = async (id: string, input: UpdateAppointmentInput) => {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Appointment');

  let startTime = existing.startTime;
  let endTime = existing.endTime;

  if (input.startTime) {
    startTime = new Date(input.startTime);
    const duration = input.duration
      ? input.duration * 60 * 1000
      : existing.endTime.getTime() - existing.startTime.getTime();
    endTime = new Date(startTime.getTime() + duration);
  } else if (input.duration) {
    endTime = new Date(startTime.getTime() + input.duration * 60 * 1000);
  }

  if (input.startTime || input.duration) {
    await checkConflicts(existing.doctorId, startTime, endTime, id);
  }

  return prisma.appointment.update({
    where: { id },
    data: {
      startTime,
      endTime,
      ...(input.status && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    },
    include: {
      patient: { select: { id: true, name: true, phone: true, email: true } },
      doctor: { select: { id: true, name: true } },
    },
  });
};

export const cancel = async (id: string) => {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Appointment');

  return prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
};
