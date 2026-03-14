'use client';

import { useState, useCallback } from 'react';
import { scheduleApi } from '@/services/api';
import {
  WeeklyScheduleEntry,
  ScheduleException,
  TimeSlot,
  RescheduledAppointment,
  ScheduleException as ScheduleExceptionType,
} from '@/types';

export const useSchedule = () => {
  const [schedules, setSchedules] = useState<WeeklyScheduleEntry[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [defaultConsultationMinutes, setDefaultConsultationMinutes] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeeklySchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.getWeeklySchedule();
      setSchedules(res.data.data.schedules);
      setDefaultConsultationMinutes(res.data.data.defaultConsultationMinutes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load schedule';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateWeeklySchedule = async (data: {
    schedules: { dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }[];
    defaultConsultationMinutes?: number;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.updateWeeklySchedule(data);
      setSchedules(res.data.data.schedules);
      if (data.defaultConsultationMinutes) {
        setDefaultConsultationMinutes(data.defaultConsultationMinutes);
      }
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update schedule';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const copyToWeekdays = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.copyToWeekdays();
      setSchedules(res.data.data.schedules);
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to copy schedule';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExceptions = useCallback(async (startDate: string, endDate: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.getExceptions(startDate, endDate);
      setExceptions(res.data.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load exceptions';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createException = async (data: {
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string;
  }): Promise<{
    exception: ScheduleExceptionType;
    rescheduledCount: number;
    rescheduledAppointments: RescheduledAppointment[];
  }> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await scheduleApi.createException(data);
      const newException = res.data.data.exception;
      setExceptions((prev) => [...prev, newException]);
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create exception';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteException = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await scheduleApi.deleteException(id);
      setExceptions((prev) => prev.filter((e) => e.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete exception';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableSlots = async (
    date: string,
    duration?: number,
  ): Promise<{ slots: TimeSlot[]; isWorkingDay: boolean }> => {
    try {
      const res = await scheduleApi.getAvailableSlots(date, duration);
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get available slots';
      setError(msg);
      throw err;
    }
  };

  const updateConsultationDuration = async (duration: number) => {
    try {
      await scheduleApi.updateConsultationDuration(duration);
      setDefaultConsultationMinutes(duration);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update duration';
      setError(msg);
      throw err;
    }
  };

  return {
    schedules,
    exceptions,
    defaultConsultationMinutes,
    isLoading,
    error,
    fetchWeeklySchedule,
    updateWeeklySchedule,
    copyToWeekdays,
    fetchExceptions,
    createException,
    deleteException,
    getAvailableSlots,
    updateConsultationDuration,
  };
};
