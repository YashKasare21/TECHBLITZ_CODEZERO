import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from './errorHandler';

type Role = 'DOCTOR' | 'RECEPTIONIST';

export const requireRole = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError('Not authenticated'));
    }

    if (!roles.includes(req.user.role as Role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};
