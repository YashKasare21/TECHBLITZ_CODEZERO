import { Router } from 'express';
import * as scheduleController from '../controllers/schedule.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate, requireRole('DOCTOR'));

router.get('/settings', scheduleController.getSettings);
router.put('/settings', scheduleController.updateConsultationDuration);

router.get('/weekly', scheduleController.getWeeklySchedule);
router.put('/weekly', scheduleController.updateWeeklySchedule);
router.post('/copy-weekdays', scheduleController.copyScheduleToWeekdays);

router.get('/exceptions', scheduleController.getExceptions);
router.post('/exceptions', scheduleController.createException);
router.delete('/exceptions/:id', scheduleController.deleteException);

router.get('/available-slots', scheduleController.getAvailableSlots);

export default router;
