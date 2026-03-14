import { PrismaClient, Role, AppointmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create doctor
  const doctorPassword = await bcrypt.hash('doctor123', 10);
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@clinic.com' },
    update: {},
    create: {
      name: 'Dr. Sarah Johnson',
      email: 'doctor@clinic.com',
      passwordHash: doctorPassword,
      role: Role.DOCTOR,
    },
  });

  // Create receptionist
  const receptionistPassword = await bcrypt.hash('reception123', 10);
  const receptionist = await prisma.user.upsert({
    where: { email: 'reception@clinic.com' },
    update: {},
    create: {
      name: 'Alice Brown',
      email: 'reception@clinic.com',
      passwordHash: receptionistPassword,
      role: Role.RECEPTIONIST,
    },
  });

  // Create patients
  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { phone: '555-0101' },
      update: {},
      create: {
        name: 'John Smith',
        phone: '555-0101',
        email: 'john.smith@email.com',
        notes: 'Allergic to penicillin',
      },
    }),
    prisma.patient.upsert({
      where: { phone: '555-0102' },
      update: {},
      create: {
        name: 'Emily Davis',
        phone: '555-0102',
        email: 'emily.davis@email.com',
      },
    }),
    prisma.patient.upsert({
      where: { phone: '555-0103' },
      update: {},
      create: {
        name: 'Michael Chen',
        phone: '555-0103',
        email: 'michael.chen@email.com',
        notes: 'Diabetic - monitor carefully',
      },
    }),
    prisma.patient.upsert({
      where: { phone: '555-0104' },
      update: {},
      create: {
        name: 'Priya Sharma',
        phone: '555-0104',
        email: 'priya.sharma@email.com',
      },
    }),
    prisma.patient.upsert({
      where: { phone: '555-0105' },
      update: {},
      create: {
        name: 'Robert Wilson',
        phone: '555-0105',
      },
    }),
  ]);

  // Create appointments for today and the next few days
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const makeTime = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  await prisma.appointment.createMany({
    data: [
      {
        patientId: patients[0].id,
        doctorId: doctor.id,
        startTime: makeTime(0, 9, 0),
        endTime: makeTime(0, 9, 30),
        status: AppointmentStatus.COMPLETED,
        notes: 'Routine checkup completed. Patient is healthy.',
      },
      {
        patientId: patients[1].id,
        doctorId: doctor.id,
        startTime: makeTime(0, 10, 0),
        endTime: makeTime(0, 10, 30),
        status: AppointmentStatus.SCHEDULED,
      },
      {
        patientId: patients[2].id,
        doctorId: doctor.id,
        startTime: makeTime(0, 11, 0),
        endTime: makeTime(0, 11, 45),
        status: AppointmentStatus.SCHEDULED,
      },
      {
        patientId: patients[3].id,
        doctorId: doctor.id,
        startTime: makeTime(0, 14, 0),
        endTime: makeTime(0, 14, 30),
        status: AppointmentStatus.CANCELLED,
      },
      {
        patientId: patients[4].id,
        doctorId: doctor.id,
        startTime: makeTime(1, 9, 0),
        endTime: makeTime(1, 9, 30),
        status: AppointmentStatus.SCHEDULED,
      },
      {
        patientId: patients[0].id,
        doctorId: doctor.id,
        startTime: makeTime(1, 10, 0),
        endTime: makeTime(1, 10, 45),
        status: AppointmentStatus.SCHEDULED,
      },
      {
        patientId: patients[1].id,
        doctorId: doctor.id,
        startTime: makeTime(2, 9, 30),
        endTime: makeTime(2, 10, 0),
        status: AppointmentStatus.SCHEDULED,
      },
    ],
    skipDuplicates: true,
  });

  // Create a blocked lunch slot for today
  await prisma.blockedSlot.createMany({
    data: [
      {
        doctorId: doctor.id,
        startTime: makeTime(0, 12, 0),
        endTime: makeTime(0, 13, 0),
        reason: 'Lunch Break',
      },
      {
        doctorId: doctor.id,
        startTime: makeTime(1, 12, 0),
        endTime: makeTime(1, 13, 0),
        reason: 'Lunch Break',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seeding complete!');
  console.log('');
  console.log('Test credentials:');
  console.log('  Doctor:      doctor@clinic.com   / doctor123');
  console.log('  Receptionist: reception@clinic.com / reception123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
