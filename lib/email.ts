import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface AppointmentEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  date: string;
  time: string;
}

export async function sendBookingConfirmation(data: AppointmentEmailData) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: "ClinicOS <onboarding@resend.dev>",
      to: data.patientEmail,
      subject: `Appointment Confirmed - ${data.date}`,
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <div style="background: #7093E5; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">ClinicOS</h1>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Appointment Confirmation</p>
          </div>
          <div style="border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
            <p style="color: #3F414D; font-size: 16px;">Hi <strong>${data.patientName}</strong>,</p>
            <p style="color: #6E7990;">Your appointment has been confirmed:</p>
            <div style="background: #F0F4FD; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0 0 8px; color: #3F414D;"><strong>Doctor:</strong> Dr. ${data.doctorName}</p>
              <p style="margin: 0 0 8px; color: #3F414D;"><strong>Date:</strong> ${data.date}</p>
              <p style="margin: 0; color: #3F414D;"><strong>Time:</strong> ${data.time}</p>
            </div>
            <p style="color: #6E7990; font-size: 14px;">Please arrive 10 minutes before your scheduled time.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendCancellationEmail(data: AppointmentEmailData) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: "ClinicOS <onboarding@resend.dev>",
      to: data.patientEmail,
      subject: `Appointment Cancelled - ${data.date}`,
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <div style="background: #F68685; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">ClinicOS</h1>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Appointment Cancelled</p>
          </div>
          <div style="border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
            <p style="color: #3F414D; font-size: 16px;">Hi <strong>${data.patientName}</strong>,</p>
            <p style="color: #6E7990;">Your appointment has been cancelled:</p>
            <div style="background: #FFF5F5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0 0 8px; color: #3F414D;"><strong>Doctor:</strong> Dr. ${data.doctorName}</p>
              <p style="margin: 0 0 8px; color: #3F414D;"><strong>Date:</strong> ${data.date}</p>
              <p style="margin: 0; color: #3F414D;"><strong>Time:</strong> ${data.time}</p>
            </div>
            <p style="color: #6E7990; font-size: 14px;">Please contact the clinic to reschedule.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send cancellation email:", error);
  }
}
