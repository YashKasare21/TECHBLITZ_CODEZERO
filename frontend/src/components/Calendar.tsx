'use client';

import { useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Appointment, BlockedSlot, CalendarEvent } from '@/types';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SCHEDULED: { bg: '#3B82F6', border: '#2563EB', text: '#FFFFFF' },
  COMPLETED: { bg: '#22C55E', border: '#16A34A', text: '#FFFFFF' },
  CANCELLED: { bg: '#9CA3AF', border: '#6B7280', text: '#FFFFFF' },
  BLOCKED: { bg: '#EF4444', border: '#DC2626', text: '#FFFFFF' },
};

interface Props {
  appointments: Appointment[];
  blockedSlots?: BlockedSlot[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateSelect?: (start: Date, end: Date) => void;
  editable?: boolean;
  onEventDrop?: (id: string, newStart: Date, newEnd: Date) => void;
}

export default function ClinicCalendar({
  appointments,
  blockedSlots = [],
  onEventClick,
  onDateSelect,
  editable = false,
  onEventDrop,
}: Props) {
  const calendarRef = useRef<FullCalendar>(null);

  const appointmentEvents: CalendarEvent[] = appointments.map((appt) => ({
    id: appt.id,
    title: appt.patient.name,
    start: appt.startTime,
    end: appt.endTime,
    backgroundColor: STATUS_COLORS[appt.status].bg,
    borderColor: STATUS_COLORS[appt.status].border,
    textColor: STATUS_COLORS[appt.status].text,
    extendedProps: {
      type: 'appointment',
      status: appt.status,
      patientName: appt.patient.name,
      patientPhone: appt.patient.phone,
      notes: appt.notes || undefined,
    },
  }));

  const blockedEvents: CalendarEvent[] = blockedSlots.map((slot) => ({
    id: `blocked-${slot.id}`,
    title: slot.reason || 'Blocked',
    start: slot.startTime,
    end: slot.endTime,
    backgroundColor: STATUS_COLORS.BLOCKED.bg,
    borderColor: STATUS_COLORS.BLOCKED.border,
    textColor: STATUS_COLORS.BLOCKED.text,
    extendedProps: {
      type: 'blocked',
      reason: slot.reason || undefined,
    },
  }));

  const allEvents = [...appointmentEvents, ...blockedEvents];

  return (
    <div className="fc-clinic">
      <style>{`
        .fc-clinic .fc { 
          background: transparent;
          color: inherit;
        }
        .fc-clinic .fc-event { cursor: pointer; border-radius: 4px; font-size: 12px; padding: 1px 3px; }
        .fc-clinic .fc-timegrid-slot { height: 40px; }
        .fc-clinic .fc-toolbar-title { font-size: 1.1rem; font-weight: 600; }
        .fc-clinic .fc-button { font-size: 0.8rem; padding: 4px 10px; }
        .fc-clinic .fc-button-primary { background-color: #2563EB; border-color: #2563EB; }
        .fc-clinic .fc-button-primary:hover { background-color: #1d4ed8; border-color: #1d4ed8; }
        .fc-clinic .fc-button-primary:not(:disabled):active,
        .fc-clinic .fc-button-primary:not(:disabled).fc-button-active { background-color: #1e40af; border-color: #1e40af; }
        .fc-clinic .fc-col-header-cell { font-weight: 600; font-size: 0.8rem; }
        .fc-clinic .fc-col-header-cell-cushion { color: inherit; }
        .fc-clinic .fc-highlight { background: rgba(59,130,246,0.15); }
        .fc-clinic .fc-timegrid-axis-cushion,
        .fc-clinic .fc-timegrid-slot-label-cushion { color: inherit; }
        .fc-clinic .fc-daygrid-day-number { color: inherit; }
        .fc-clinic .fc-daygrid-day { color: inherit; }
        .dark .fc-clinic .fc-col-header-cell { background-color: #1f2937; }
        .dark .fc-clinic .fc-theme-standard td,
        .dark .fc-clinic .fc-theme-standard th { border-color: #374151; }
        .dark .fc-clinic .fc-theme-standard .fc-scrollgrid { border-color: #374151; }
        .dark .fc-clinic .fc-timegrid-slot { border-color: #374151; }
        .dark .fc-clinic .fc-timegrid-axis { border-color: #374151; }
        .dark .fc-clinic .fc-daygrid-day-frame { border-color: #374151; }
        .dark .fc-clinic .fc-daygrid-day.fc-day-today { background-color: rgba(59, 130, 246, 0.1); }
      `}</style>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={allEvents}
        editable={editable}
        selectable={!!onDateSelect}
        selectMirror
        dayMaxEvents
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:15:00"
        nowIndicator
        allDaySlot={false}
        height="auto"
        eventClick={(info) => {
          const evt = allEvents.find((e) => e.id === info.event.id);
          if (evt && onEventClick) onEventClick(evt);
        }}
        select={(info) => {
          if (onDateSelect) onDateSelect(info.start, info.end);
        }}
        eventDrop={(info) => {
          if (onEventDrop && !info.event.id.startsWith('blocked-')) {
            onEventDrop(info.event.id, info.event.start!, info.event.end!);
          } else {
            info.revert();
          }
        }}
        eventContent={(arg) => (
          <div className="px-1 py-0.5 overflow-hidden">
            <div className="font-semibold truncate text-[11px] leading-tight">
              {arg.event.title}
            </div>
            <div className="text-[10px] opacity-80">
              {format(arg.event.start!, 'h:mm a')}
            </div>
          </div>
        )}
      />
    </div>
  );
}
