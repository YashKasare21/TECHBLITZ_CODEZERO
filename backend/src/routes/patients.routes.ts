import { Router } from 'express';
import * as patientsController from '../controllers/patients.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);

router.get('/search', patientsController.search);
router.get('/', patientsController.getAll);
router.get('/:id', patientsController.getById);

router.post('/', requireRole('RECEPTIONIST'), patientsController.create);
router.put('/:id', requireRole('RECEPTIONIST'), patientsController.update);

export default router;
