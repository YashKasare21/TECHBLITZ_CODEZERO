import { prisma } from '../lib/prisma';
import { sendNotification } from './llm.service';

export const notifyRescheduledAppointments = async (
  rescheduledAppointments: {
    appointmentId: string;
    patientName: string;
    oldTime: string;
    newTime: string | null;
    success: boolean;
  }[],
  reason?: string,
) => {
  const results: { patientId: string; notified: boolean }[] = [];

  for (const appt of rescheduledAppointments) {
    if (!appt.success || !appt.newTime) continue;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appt.appointmentId },
      select: {
        patientId: true,
        patient: { select: { telegramChatId: true, name: true } },
        doctor: { select: { name: true } },
        startTime: true,
      },
    });

    if (!appointment || !appointment.patient.telegramChatId) {
      results.push({ patientId: appointment?.patientId || appt.appointmentId, notified: false });
      continue;
    }

    const oldDate = new Date(appt.oldTime);
    const newDate = new Date(appt.newTime);

    const formatDate = (d: Date) => {
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    const message =
      `📅 **Appointment Rescheduled**\n\n` +
      `Hello ${appointment.patient.name},\n\n` +
      `Your appointment with Dr. ${appointment.doctor.name} has been rescheduled.\n\n` +
      `**Previous time:** ${formatDate(oldDate)}\n` +
      `**New time:** ${formatDate(newDate)}\n` +
      (reason ? `\n**Reason:** ${reason}\n` : '') +
      `\nIf this doesn't work for you, reply here to reschedule.\n\n` +
      `Thank you for your understanding!`;

    const notified = await sendNotification(appointment.patient.telegramChatId, message);
    results.push({ patientId: appointment.patientId, notified });
  }

  return results;
};

export const sendAppointmentReminder = async (appointmentId: string) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { telegramChatId: true, name: true } },
      doctor: { select: { name: true } },
    },
  });

  if (!appointment || !appointment.patient.telegramChatId) {
    return false;
  }

  const dateStr = appointment.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = appointment.startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const message =
    `🔔 **Appointment Reminder**\n\n` +
    `Hello ${appointment.patient.name},\n\n` +
    `This is a reminder for your upcoming appointment:\n\n` +
    `**Doctor:** Dr. ${appointment.doctor.name}\n` +
    `**Date:** ${dateStr}\n` +
    `**Time:** ${timeStr}\n\n` +
    `Please arrive 10 minutes early. If you need to reschedule or cancel, reply here.\n\n` +
    `See you soon!`;

  return notifyPatient(appointment.patientId, message);
};

export const sendBookingConfirmation = async (appointmentId: string) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { telegramChatId: true, name: true } },
      doctor: { select: { name: true } },
    },
  });

  if (!appointment || !appointment.patient.telegramChatId) {
    return false;
  }

  const dateStr = appointment.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = appointment.startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const endTimeStr = appointment.endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const message =
    `✅ **Appointment Confirmed**\n\n` +
    `Hello ${appointment.patient.name},\n\n` +
    `Your appointment has been booked:\n\n` +
    `**Doctor:** Dr. ${appointment.doctor.name}\n` +
    `**Date:** ${dateStr}\n` +
    `**Time:** ${timeStr} - ${endTimeStr}\n\n` +
    `Appointment ID: ${appointment.id}\n\n` +
    `Reply here if you need to reschedule or cancel.\n\n` +
    `Thank you for choosing our clinic!`;

  return notifyPatient(appointment.patientId, message);
};

export const sendCancellationConfirmation = async (
  patientId: string,
  doctorName: string,
  dateTime: Date,
) => {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { telegramChatId: true, name: true },
  });

  if (!patient || !patient.telegramChatId) {
    return false;
  }

  const dateStr = dateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = dateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const message =
    `❌ **Appointment Cancelled**\n\n` +
    `Hello ${patient.name},\n\n` +
    `Your appointment has been cancelled:\n\n` +
    `**Doctor:** Dr. ${doctorName}\n` +
    `**Date:** ${dateStr}\n` +
    `**Time:** ${timeStr}\n\n` +
    `If you'd like to book a new appointment, reply here.\n\n` +
    `We hope to see you again soon!`;

  return notifyPatient(patientId, message);
};
