import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../utils/validation';
import { AppError, NotFoundError } from '../middleware/errorHandler';

export const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

  return { user, token };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new NotFoundError('User');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  };
};

export const getDoctors = async () => {
  return prisma.user.findMany({
    where: { role: 'DOCTOR' },
    select: { id: true, name: true, email: true },
  });
};
