import { Router } from 'express';
import * as doctorController from '../controllers/doctor.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate, requireRole('DOCTOR'));

router.get('/schedule', doctorController.getSchedule);
router.post('/block-slot', doctorController.blockSlot);
router.delete('/block-slot/:id', doctorController.deleteBlockedSlot);

export default router;
