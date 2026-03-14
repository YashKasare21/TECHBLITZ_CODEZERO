'use client';

import { useState, useEffect, FormEvent } from 'react';

interface Props {
  isOpen: boolean;
  initialNote?: string;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}

export default function NoteModal({ isOpen, initialNote = '', onClose, onSave }: Props) {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(note);
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Appointment Note</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="Add clinical notes, diagnosis, instructions..."
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
