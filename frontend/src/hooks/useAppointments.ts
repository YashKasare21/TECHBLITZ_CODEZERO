'use client';

import { useState, useCallback } from 'react';
import { appointmentsApi } from '@/services/api';
import { Appointment } from '@/types';

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(
    async (params?: { doctorId?: string; date?: string; status?: string; patientId?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await appointmentsApi.getAll(params);
        setAppointments(res.data.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load appointments';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const createAppointment = async (data: {
    patientId: string;
    doctorId: string;
    startTime: string;
    duration: number;
    notes?: string;
  }) => {
    const res = await appointmentsApi.create(data);
    const newAppt = res.data.data as Appointment;
    setAppointments((prev) => [...prev, newAppt]);
    return newAppt;
  };

  const updateAppointment = async (
    id: string,
    data: { startTime?: string; duration?: number; status?: string; notes?: string },
  ) => {
    const res = await appointmentsApi.update(id, data);
    const updated = res.data.data as Appointment;
    setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  };

  const cancelAppointment = async (id: string) => {
    await appointmentsApi.cancel(id);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'CANCELLED' as const } : a)),
    );
  };

  return {
    appointments,
    isLoading,
    error,
    fetchAppointments,
    createAppointment,
    updateAppointment,
    cancelAppointment,
  };
};
