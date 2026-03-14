import { Request, Response, NextFunction } from 'express';
import * as doctorService from '../services/doctor.service';
import { blockSlotSchema } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import { qs } from '../utils/query';

export const getSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const startDate = qs(req.query.startDate);
    const endDate = qs(req.query.endDate);

    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required', 400);
    }

    const schedule = await doctorService.getSchedule(doctorId, startDate, endDate);
    res.json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
};

export const blockSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const input = blockSlotSchema.parse(req.body);
    const slot = await doctorService.blockSlot(doctorId, input);
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    next(err);
  }
};

export const deleteBlockedSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    await doctorService.deleteBlockedSlot(String(req.params.id), doctorId);
    res.json({ success: true, message: 'Blocked slot removed' });
  } catch (err) {
    next(err);
  }
};
