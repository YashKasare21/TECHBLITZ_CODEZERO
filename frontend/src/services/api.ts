import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string, role: string) =>
    api.post('/api/auth/register', { name, email, password, role }),
  me: () => api.get('/api/auth/me'),
  getDoctors: () => api.get('/api/auth/doctors'),
};

// Patients
export const patientsApi = {
  getAll: () => api.get('/api/patients'),
  getById: (id: string) => api.get(`/api/patients/${id}`),
  search: (q: string) => api.get(`/api/patients/search?q=${encodeURIComponent(q)}`),
  create: (data: { name: string; phone: string; email?: string; notes?: string }) =>
    api.post('/api/patients', data),
  update: (id: string, data: Partial<{ name: string; phone: string; email: string; notes: string }>) =>
    api.put(`/api/patients/${id}`, data),
};

// Appointments
export const appointmentsApi = {
  getAll: (params?: { doctorId?: string; date?: string; status?: string; patientId?: string }) =>
    api.get('/api/appointments', { params }),
  getById: (id: string) => api.get(`/api/appointments/${id}`),
  create: (data: {
    patientId: string;
    doctorId: string;
    startTime: string;
    duration: number;
    notes?: string;
  }) => api.post('/api/appointments', data),
  update: (
    id: string,
    data: {
      startTime?: string;
      duration?: number;
      status?: string;
      notes?: string;
    },
  ) => api.put(`/api/appointments/${id}`, data),
  cancel: (id: string) => api.delete(`/api/appointments/${id}`),
};

// Doctor
export const doctorApi = {
  getSchedule: (startDate: string, endDate: string) =>
    api.get('/api/doctor/schedule', { params: { startDate, endDate } }),
  blockSlot: (data: { startTime: string; endTime: string; reason?: string }) =>
    api.post('/api/doctor/block-slot', data),
  deleteBlockedSlot: (id: string) => api.delete(`/api/doctor/block-slot/${id}`),
};

// Schedule
export const scheduleApi = {
  getWeeklySchedule: () => api.get('/api/schedule/weekly'),
  updateWeeklySchedule: (data: {
    schedules: { dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }[];
    defaultConsultationMinutes?: number;
  }) => api.put('/api/schedule/weekly', data),
  copyToWeekdays: () => api.post('/api/schedule/copy-weekdays'),
  getExceptions: (startDate: string, endDate: string) =>
    api.get('/api/schedule/exceptions', { params: { startDate, endDate } }),
  createException: (data: {
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string;
  }) => api.post('/api/schedule/exceptions', data),
  deleteException: (id: string) => api.delete(`/api/schedule/exceptions/${id}`),
  getAvailableSlots: (date: string, duration?: number) =>
    api.get('/api/schedule/available-slots', {
      params: { date, duration },
    }),
  getSettings: () => api.get('/api/schedule/settings'),
  updateConsultationDuration: (duration: number) =>
    api.put('/api/schedule/settings', { duration }),
};

export default api;
