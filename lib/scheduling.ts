import type { TimeSlot } from "./types";

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  slotDurationMins: number
): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let currentMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  while (currentMins + slotDurationMins <= endMins) {
    const h = Math.floor(currentMins / 60);
    const m = currentMins % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    currentMins += slotDurationMins;
  }

  return slots;
}

export function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMins = h * 60 + m + mins;
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
}

export function getAvailableSlots(
  sessions: { start_time: string; end_time: string; slot_duration_mins: number }[],
  bookedSlots: { start_time: string; end_time: string }[],
  blockedRanges: { start_time: string | null; end_time: string | null }[]
): TimeSlot[] {
  const allSlots: TimeSlot[] = [];
  const bookedSet = new Set(bookedSlots.map((s) => s.start_time.slice(0, 5)));

  for (const session of sessions) {
    const starts = generateTimeSlots(
      session.start_time,
      session.end_time,
      session.slot_duration_mins
    );

    for (const start of starts) {
      const endTime = addMinutesToTime(start, session.slot_duration_mins);

      const isBlocked = blockedRanges.some((b) => {
        if (!b.start_time || !b.end_time) return true;
        const bStart = b.start_time.slice(0, 5);
        const bEnd = b.end_time.slice(0, 5);
        return start < bEnd && endTime > bStart;
      });

      allSlots.push({
        start_time: start,
        end_time: endTime,
        available: !bookedSet.has(start) && !isBlocked,
      });
    }
  }

  allSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return allSlots;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}
