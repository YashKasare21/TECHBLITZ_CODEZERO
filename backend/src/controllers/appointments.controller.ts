import { Request, Response, NextFunction } from 'express';
import * as appointmentService from '../services/appointment.service';
import { createAppointmentSchema, updateAppointmentSchema } from '../utils/validation';
import { qs } from '../utils/query';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const appointments = await appointmentService.getAll({
      doctorId: qs(req.query.doctorId),
      date: qs(req.query.date),
      status: qs(req.query.status),
      patientId: qs(req.query.patientId),
    });
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const appointment = await appointmentService.getById(String(req.params.id));
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = createAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.create(input);
    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = updateAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.update(String(req.params.id), input);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
};

export const cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await appointmentService.cancel(String(req.params.id));
    res.json({ success: true, message: 'Appointment cancelled' });
  } catch (err) {
    next(err);
  }
};
