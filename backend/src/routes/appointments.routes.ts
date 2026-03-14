import { Router } from 'express';
import * as appointmentsController from '../controllers/appointments.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', appointmentsController.getAll);
router.get('/:id', appointmentsController.getById);
router.post('/', appointmentsController.create);
router.put('/:id', appointmentsController.update);
router.delete('/:id', appointmentsController.cancel);

export default router;
