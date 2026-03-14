import { prisma } from '../lib/prisma';
import { BlockSlotInput } from '../utils/validation';
import { ConflictError, NotFoundError } from '../middleware/errorHandler';

export const getSchedule = async (doctorId: string, startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const [appointments, blockedSlots] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId,
        startTime: { gte: start, lt: end },
      },
      orderBy: { startTime: 'asc' },
      include: {
        patient: { select: { id: true, name: true, phone: true, email: true } },
      },
    }),
    prisma.blockedSlot.findMany({
      where: {
        doctorId,
        startTime: { gte: start, lt: end },
      },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  return { appointments, blockedSlots };
};

export const blockSlot = async (doctorId: string, input: BlockSlotInput) => {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);

  if (endTime <= startTime) {
    throw new ConflictError('End time must be after start time');
  }

  // Check for existing appointments in the block window
  const conflictingAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId,
      status: { not: 'CANCELLED' },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    include: { patient: { select: { name: true } } },
  });

  if (conflictingAppointment) {
    throw new ConflictError(
      `Cannot block: appointment exists for ${conflictingAppointment.patient.name} in this slot`,
    );
  }

  return prisma.blockedSlot.create({
    data: {
      doctorId,
      startTime,
      endTime,
      reason: input.reason || null,
    },
  });
};

export const deleteBlockedSlot = async (slotId: string, doctorId: string) => {
  const slot = await prisma.blockedSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new NotFoundError('Blocked slot');
  if (slot.doctorId !== doctorId) throw new ConflictError('Not authorized to delete this slot');

  return prisma.blockedSlot.delete({ where: { id: slotId } });
};
