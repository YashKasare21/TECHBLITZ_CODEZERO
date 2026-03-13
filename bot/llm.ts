import { generateText, tool, type CoreMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import {
  getDoctorsList,
  findDoctorByName,
  getAvailableSlots,
  findOrCreatePatientByPhone,
  bookAppointment,
  getPatientAppointments,
  cancelAppointment,
  type DoctorRecord,
} from "./supabase";

const provider = createOpenAICompatible({
  name: "clinic-llm",
  apiKey: process.env.LLM_API_KEY || "",
  baseURL: process.env.LLM_BASE_URL || "http://localhost:11434/v1",
});

const model = provider(process.env.LLM_MODEL || "gpt-4o-mini");

function doctorDisplayName(doctor: DoctorRecord): string {
  const profile = Array.isArray(doctor.profile)
    ? doctor.profile[0]
    : doctor.profile;
  return profile?.full_name ?? doctor.specialization;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

const tools = {
  list_doctors: tool({
    description:
      "List all available doctors at the clinic with their specializations and appointment slot duration.",
    parameters: z.object({}),
    execute: async () => {
      const doctors = await getDoctorsList();
      if (doctors.length === 0) {
        return "No doctors are currently available.";
      }
      return doctors
        .map(
          (d, i) =>
            `${i + 1}. Dr. ${doctorDisplayName(d)} — ${d.specialization} (${d.consultation_duration_mins} min slots)`
        )
        .join("\n");
    },
  }),

  check_availability: tool({
    description:
      "Check available appointment slots for a specific doctor on a given date.",
    parameters: z.object({
      doctorName: z
        .string()
        .describe("The doctor's name or specialization to search for"),
      date: z
        .string()
        .describe("Date in YYYY-MM-DD format"),
    }),
    execute: async ({ doctorName, date }) => {
      const doctor = await findDoctorByName(doctorName);
      if (!doctor) {
        return `No doctor found matching "${doctorName}". Use the list_doctors tool to see available doctors.`;
      }
      const slots = await getAvailableSlots(doctor.id, date);
      if (slots.length === 0) {
        return `Dr. ${doctorDisplayName(doctor)} has no available slots on ${date}.`;
      }
      return `Available slots for Dr. ${doctorDisplayName(doctor)} on ${date}:\n${slots.map((s) => `• ${formatTime12(s)} (${s})`).join("\n")}`;
    },
  }),

  book_appointment: tool({
    description:
      "Book an appointment for the patient. Always confirm the details with the patient before calling this tool.",
    parameters: z.object({
      doctorName: z
        .string()
        .describe("The doctor's name or specialization"),
      date: z
        .string()
        .describe("Appointment date in YYYY-MM-DD format"),
      time: z
        .string()
        .describe("Appointment time in 24-hour HH:MM format"),
      patientPhone: z
        .string()
        .describe("Patient's phone number (digits only, with country code)"),
      patientName: z
        .string()
        .optional()
        .describe("Patient's full name if known"),
    }),
    execute: async ({ doctorName, date, time, patientPhone, patientName }) => {
      const doctor = await findDoctorByName(doctorName);
      if (!doctor) {
        return `No doctor found matching "${doctorName}".`;
      }

      const slots = await getAvailableSlots(doctor.id, date);
      if (slots.length === 0) {
        return `Dr. ${doctorDisplayName(doctor)} has no available slots on ${date}.`;
      }

      // Find exact slot or closest match
      let selectedSlot = slots.includes(time)
        ? time
        : slots.reduce((prev, curr) => {
            const toMins = (t: string) => {
              const [h, m] = t.split(":").map(Number);
              return h * 60 + m;
            };
            return Math.abs(toMins(curr) - toMins(time)) <
              Math.abs(toMins(prev) - toMins(time))
              ? curr
              : prev;
          });

      const patient = await findOrCreatePatientByPhone(
        patientPhone,
        patientName
      );
      if (!patient) {
        return "Could not create patient record. Please contact the clinic.";
      }

      const result = await bookAppointment(
        doctor.id,
        patient.id,
        date,
        selectedSlot,
        doctor.consultation_duration_mins
      );

      if (result.error) {
        return `Booking failed: ${result.error}`;
      }

      return `Appointment booked successfully!\nDoctor: Dr. ${doctorDisplayName(doctor)}\nDate: ${date}\nTime: ${formatTime12(selectedSlot)}\nAppointment ID: ${result.data?.id}`;
    },
  }),

  get_my_appointments: tool({
    description:
      "Retrieve upcoming appointments for the patient by their phone number.",
    parameters: z.object({
      patientPhone: z
        .string()
        .describe("Patient's phone number (digits only, with country code)"),
    }),
    execute: async ({ patientPhone }) => {
      const appointments = await getPatientAppointments(patientPhone);
      if (appointments.length === 0) {
        return "No upcoming appointments found.";
      }
      return appointments
        .map(
          (a) =>
            `• ${a.appointment_date} at ${formatTime12(a.start_time)} with Dr. ${a.doctorName} (${a.specialization}) — Status: ${a.status} — ID: ${a.id}`
        )
        .join("\n");
    },
  }),

  cancel_appointment: tool({
    description:
      "Cancel an existing appointment by its ID. Always confirm with the patient before cancelling.",
    parameters: z.object({
      appointmentId: z
        .string()
        .describe("The UUID of the appointment to cancel"),
    }),
    execute: async ({ appointmentId }) => {
      const result = await cancelAppointment(appointmentId);
      if (!result.success) {
        return `Failed to cancel appointment: ${result.error}`;
      }
      return "Appointment cancelled successfully.";
    },
  }),
};

export async function runAgentTurn(
  phone: string,
  messages: CoreMessage[]
): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  try {
    const { text } = await generateText({
      model,
      tools,
      maxSteps: 10,
      system: `You are a friendly and helpful clinic appointment assistant for ClinicOS.
Today's date is ${today}. The patient's WhatsApp number is ${phone}.

Your capabilities:
- List available doctors
- Check appointment availability for a specific doctor and date
- Book appointments (always confirm details first before booking)
- Show a patient's upcoming appointments
- Cancel appointments (always confirm before cancelling)

Guidelines:
- Be concise and conversational. Use WhatsApp-friendly formatting (*bold*, _italic_).
- When booking, collect: doctor name, date, preferred time. If the patient gives all of these upfront, confirm once then book.
- Always confirm appointment details before calling book_appointment.
- If a requested time slot is unavailable, suggest the closest available slot.
- For cancellations, first call get_my_appointments to find the appointment ID, then confirm with the patient before calling cancel_appointment.
- If you don't know the patient's name, use their phone number to create the booking; the clinic staff will update their record.
- Keep responses under 200 words unless listing multiple items.`,
      messages,
    });

    return (
      text ||
      "I'm sorry, I couldn't process your request. Please try again or contact the clinic directly."
    );
  } catch (error) {
    console.error("Agent turn error:", error);
    return "I'm having trouble right now. Please try again or contact the clinic directly.";
  }
}
