import { Request, Response, NextFunction } from 'express';
import * as scheduleService from '../services/schedule.service';
import {
  weeklyScheduleSchema,
  scheduleExceptionSchema,
  consultationDurationSchema,
} from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import { qs } from '../utils/query';

export const getWeeklySchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const schedule = await scheduleService.getWeeklySchedule(doctorId);
    res.json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
};

export const updateWeeklySchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const input = weeklyScheduleSchema.parse(req.body);
    const schedule = await scheduleService.updateWeeklySchedule(doctorId, input);
    res.json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
};

export const copyScheduleToWeekdays = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const schedule = await scheduleService.copyScheduleToWeekdays(doctorId);
    res.json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
};

export const getExceptions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const startDate = qs(req.query.startDate);
    const endDate = qs(req.query.endDate);

    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required', 400);
    }

    const exceptions = await scheduleService.getExceptions(
      doctorId,
      startDate,
      endDate,
    );
    res.json({ success: true, data: exceptions });
  } catch (err) {
    next(err);
  }
};

export const createException = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const input = scheduleExceptionSchema.parse(req.body);
    const result = await scheduleService.createException(doctorId, input);

    res.status(201).json({
      success: true,
      data: {
        exception: result.exception,
        rescheduledCount: result.rescheduledAppointments.length,
        rescheduledAppointments: result.rescheduledAppointments,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteException = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    await scheduleService.deleteException(String(req.params.id), doctorId);
    res.json({ success: true, message: 'Exception removed' });
  } catch (err) {
    next(err);
  }
};

export const getAvailableSlots = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const date = qs(req.query.date);

    if (!date) {
      throw new AppError('date is required (YYYY-MM-DD format)', 400);
    }

    const slotDuration = req.query.duration
      ? parseInt(String(req.query.duration), 10)
      : undefined;

    const slots = await scheduleService.getAvailableSlots(
      doctorId,
      date,
      slotDuration,
    );
    res.json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
};

export const updateConsultationDuration = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const input = consultationDurationSchema.parse(req.body);
    const result = await scheduleService.updateConsultationDuration(
      doctorId,
      input.duration,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const settings = await scheduleService.getDoctorSettings(doctorId);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};
