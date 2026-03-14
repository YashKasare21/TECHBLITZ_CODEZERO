import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patients.routes';
import appointmentRoutes from './routes/appointments.routes';
import doctorRoutes from './routes/doctor.routes';
import scheduleRoutes from './routes/schedule.routes';
import botRoutes from './routes/bot.routes';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/bot', botRoutes);

app.use(errorHandler);

export default app;
