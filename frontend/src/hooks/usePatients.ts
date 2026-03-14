'use client';

import { useState, useCallback } from 'react';
import { patientsApi } from '@/services/api';
import { Patient } from '@/types';

export const usePatients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await patientsApi.getAll();
      setPatients(res.data.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load patients';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchPatients = async (q: string): Promise<Patient[]> => {
    if (!q.trim()) return [];
    const res = await patientsApi.search(q);
    return res.data.data;
  };

  const createPatient = async (data: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
  }) => {
    const res = await patientsApi.create(data);
    const newPatient = res.data.data as Patient;
    setPatients((prev) => [...prev, newPatient].sort((a, b) => a.name.localeCompare(b.name)));
    return newPatient;
  };

  const updatePatient = async (
    id: string,
    data: Partial<{ name: string; phone: string; email: string; notes: string }>,
  ) => {
    const res = await patientsApi.update(id, data);
    const updated = res.data.data as Patient;
    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  return { patients, isLoading, error, fetchPatients, searchPatients, createPatient, updatePatient };
};
