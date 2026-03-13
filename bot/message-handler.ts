import { parseBookingIntent, generateResponse, type BookingIntent } from "./llm";
import { addMessage, getHistory, clearHistory } from "./conversation-store";
import { isLikelyCanonicalPhone } from "../lib/whatsapp";
import {
  type DoctorRecord,
  findDoctorByName,
  findOrCreatePatientByPhone,
  getAvailableSlots,
  bookAppointment,
  getDoctorsList,
} from "./supabase";

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

function doctorName(doctor: DoctorRecord): string {
  if (Array.isArray(doctor.profile)) {
    return doctor.profile[0]?.full_name ?? doctor.specialization;
  }

  return doctor.profile?.full_name ?? doctor.specialization;
}

export async function handleMessage(
  phone: string,
  text: string
): Promise<string> {
  addMessage(phone, "user", text);

  const lowerText = text.trim().toLowerCase();

  if (lowerText === "hi" || lowerText === "hello" || lowerText === "hey") {
    const reply =
      "Hello! 👋 Welcome to ClinicOS.\n\nI can help you with:\n• *Book* an appointment\n• *Cancel* an appointment\n• *Check* available slots\n\nHow can I help you today?";
    addMessage(phone, "assistant", reply);
    return reply;
  }

  if (lowerText === "doctors" || lowerText === "list doctors") {
    const doctors = await getDoctorsList();
    if (doctors.length === 0) {
      const reply = "No doctors are currently available. Please try again later.";
      addMessage(phone, "assistant", reply);
      return reply;
    }
    let reply = "Available doctors:\n\n";
    doctors.forEach((doctor, index) => {
      reply += `${index + 1}. *Dr. ${doctorName(doctor)}* — ${doctor.specialization} (${doctor.consultation_duration_mins} min slots)\n`;
    });
    reply += "\nTo book, just say something like: _Book with Dr. [Name] on [Date] at [Time]_";
    addMessage(phone, "assistant", reply);
    return reply;
  }

  const history = getHistory(phone);
  const intent: BookingIntent = await parseBookingIntent(history);

  if (intent.intent === "book") {
    return handleBookingFlow(phone, intent);
  }

  if (intent.intent === "cancel") {
    const reply =
      "To cancel an appointment, please provide your appointment details or contact the clinic directly. We'll have this automated soon!";
    addMessage(phone, "assistant", reply);
    return reply;
  }

  if (intent.intent === "query") {
    if (intent.doctorName && intent.preferredDate) {
      const doctor = await findDoctorByName(intent.doctorName);
      if (!doctor) {
        const reply = `I couldn't find a doctor named "${intent.doctorName}". Type *doctors* to see the list.`;
        addMessage(phone, "assistant", reply);
        return reply;
      }
      const slots = await getAvailableSlots(doctor.id, intent.preferredDate);
      if (slots.length === 0) {
        const reply = `No available slots for Dr. ${doctorName(doctor)} on ${intent.preferredDate}. Try another date?`;
        addMessage(phone, "assistant", reply);
        return reply;
      }
      const reply = `Available slots for *Dr. ${doctorName(doctor)}* on *${intent.preferredDate}*:\n\n${slots.map((slot) => `• ${formatTime12(slot)}`).join("\n")}\n\nWhich time works for you?`;
      addMessage(phone, "assistant", reply);
      return reply;
    }
  }

  const reply = await generateResponse(
    `The user said: "${text}". Respond helpfully as a clinic assistant. If they seem to want to book, ask them for the doctor name, date, and time.`
  );
  addMessage(phone, "assistant", reply);
  return reply;
}

async function handleBookingFlow(
  phone: string,
  intent: BookingIntent
): Promise<string> {
  if (intent.missingInfo.length > 0) {
    const missing = intent.missingInfo;
    let reply = "I'd love to help you book! I just need a few more details:\n\n";
    if (missing.includes("doctorName"))
      reply += "• Which *doctor* would you like to see? (type *doctors* to see the list)\n";
    if (missing.includes("preferredDate"))
      reply += "• What *date* works for you?\n";
    if (missing.includes("preferredTime"))
      reply += "• What *time* do you prefer?\n";
    addMessage(phone, "assistant", reply);
    return reply;
  }

  if (!isLikelyCanonicalPhone(phone)) {
    const reply =
      "I need your phone number before I can complete the booking. Please reply with your mobile number in international format, for example +919876543210.";
    addMessage(phone, "assistant", reply);
    return reply;
  }

  const doctor = await findDoctorByName(intent.doctorName!);
  if (!doctor) {
    const reply = `I couldn't find a doctor matching "${intent.doctorName}". Type *doctors* to see available doctors.`;
    addMessage(phone, "assistant", reply);
    return reply;
  }

  const slots = await getAvailableSlots(doctor.id, intent.preferredDate!);
  if (slots.length === 0) {
    const reply = `Sorry, Dr. ${doctorName(doctor)} has no available slots on ${intent.preferredDate}. Would you like to try another date?`;
    addMessage(phone, "assistant", reply);
    return reply;
  }

  let selectedSlot = intent.preferredTime;
  if (selectedSlot && !slots.includes(selectedSlot)) {
    const closest = slots.reduce((prev, curr) =>
      Math.abs(timeToMins(curr) - timeToMins(selectedSlot!)) <
      Math.abs(timeToMins(prev) - timeToMins(selectedSlot!))
        ? curr
        : prev
    );
    selectedSlot = closest;
  }

  if (!selectedSlot) {
    selectedSlot = slots[0];
  }

  const patient = await findOrCreatePatientByPhone(phone);
  if (!patient) {
    const reply = "I couldn't create your patient record. Please contact the clinic.";
    addMessage(phone, "assistant", reply);
    return reply;
  }

  const result = await bookAppointment(
    doctor.id,
    patient.id,
    intent.preferredDate!,
    selectedSlot,
    doctor.consultation_duration_mins
  );

  if (result.error) {
    const reply = `Booking failed: ${result.error}`;
    addMessage(phone, "assistant", reply);
    return reply;
  }

  clearHistory(phone);
  const reply = `✅ *Appointment Booked!*\n\n🩺 *Doctor:* Dr. ${doctorName(doctor)}\n📅 *Date:* ${intent.preferredDate}\n⏰ *Time:* ${formatTime12(selectedSlot)}\n\nYou'll receive a reminder before your appointment. Reply *cancel* if you need to cancel.`;
  addMessage(phone, "assistant", reply);
  return reply;
}

function timeToMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
