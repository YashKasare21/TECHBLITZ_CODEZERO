import { prisma } from '../lib/prisma';
import { CreatePatientInput } from '../utils/validation';
import { NotFoundError, AppError } from '../middleware/errorHandler';

export const getAll = async () => {
  return prisma.patient.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { appointments: true } } },
  });
};

export const getById = async (id: string) => {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { startTime: 'desc' },
        include: {
          doctor: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!patient) throw new NotFoundError('Patient');
  return patient;
};

export const search = async (query: string) => {
  return prisma.patient.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
    take: 20,
  });
};

export const create = async (input: CreatePatientInput) => {
  const existing = await prisma.patient.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw new AppError('Phone number already registered', 409);
  }

  return prisma.patient.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      notes: input.notes || null,
    },
  });
};

export const update = async (id: string, input: Partial<CreatePatientInput>) => {
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) throw new NotFoundError('Patient');

  if (input.phone && input.phone !== patient.phone) {
    const existing = await prisma.patient.findUnique({ where: { phone: input.phone } });
    if (existing) throw new AppError('Phone number already registered', 409);
  }

  return prisma.patient.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.phone && { phone: input.phone }),
      email: input.email !== undefined ? input.email || null : undefined,
      notes: input.notes !== undefined ? input.notes || null : undefined,
    },
  });
};
