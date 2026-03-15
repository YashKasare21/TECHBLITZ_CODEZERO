import { Request, Response, NextFunction } from 'express';
import * as patientService from '../services/patient.service';
import { createPatientSchema, updatePatientSchema } from '../utils/validation';
import { qs } from '../utils/query';

export const getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const patients = await patientService.getAll();
    res.json({ success: true, data: patients });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const patient = await patientService.getById(String(req.params.id));
    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

export const search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = qs(req.query.q) ?? '';
    const patients = await patientService.search(q);
    res.json({ success: true, data: patients });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = createPatientSchema.parse(req.body);
    const patient = await patientService.create(input);
    res.status(201).json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = updatePatientSchema.parse(req.body);
    const patient = await patientService.update(String(req.params.id), input);
    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};
