import { PrismaClient, UserRole, UserStatus, AttendanceStatus, TaskPriority, TaskStatus, ActivityStatus, LeaveStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seed() {
  console.log('🌱 Starting deterministic seed for AI Staff Operations Intelligence Platform...');

  // 1. Password Hashes (bcrypt cost 10)
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const staffPasswordHash = await bcrypt.hash('Staff@123', 10);

  // 2. Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: { id: 'ay-2025-2026' },
    update: {},
    create: {
      id: 'ay-2025-2026',
      name: '2025-2026 Academic Year',
      start_date: new Date('2025-06-01T00:00:00.000Z'),
      end_date: new Date('2026-05-31T23:59:59.000Z'),
      active: true,
    },
  });
  console.log(`✓ Seeded Academic Year: ${academicYear.name}`);

  // 3. Departments (4 departments)
  const departmentsData = [
    { id: 'dept-cse', name: 'Computer Science and Engineering', code: 'CSE', status: 'ACTIVE' },
    { id: 'dept-ece', name: 'Electronics and Communication Engineering', code: 'ECE', status: 'ACTIVE' },
    { id: 'dept-mech', name: 'Mechanical Engineering', code: 'MECH', status: 'ACTIVE' },
    { id: 'dept-sh', name: 'Science and Humanities', code: 'S&H', status: 'ACTIVE' },
  ];

  for (const dept of departmentsData) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  console.log(`✓ Seeded ${departmentsData.length} Departments`);

  // 4. Subjects
  const subjectsData = [
    { id: 'sub-cs101', name: 'Data Structures and Algorithms', code: 'CS201', department_id: 'dept-cse' },
    { id: 'sub-cs102', name: 'Database Management Systems', code: 'CS202', department_id: 'dept-cse' },
    { id: 'sub-cs103', name: 'Operating Systems & Architecture', code: 'CS203', department_id: 'dept-cse' },
    { id: 'sub-cs401', name: 'Knowledge Engineering', code: 'KE', department_id: 'dept-cse' },
    { id: 'sub-cs402', name: 'Network Security', code: 'NS', department_id: 'dept-cse' },
    { id: 'sub-cs403', name: 'Information Retrieval Techniques', code: 'IRT', department_id: 'dept-cse' },
    { id: 'sub-cs404', name: 'Human Computer Interaction', code: 'HCI', department_id: 'dept-cse' },
    { id: 'sub-cs405', name: 'Cloud Computing', code: 'CC', department_id: 'dept-cse' },
    { id: 'sub-cs406', name: 'Software Quality Management', code: 'SQM', department_id: 'dept-cse' },
    { id: 'sub-cs411', name: 'Network Security Laboratory', code: 'NS LAB', department_id: 'dept-cse' },
    { id: 'sub-cs412', name: 'Cloud Computing Laboratory', code: 'CC LAB', department_id: 'dept-cse' },
    { id: 'sub-cs413', name: 'Project Work (Phase - I)', code: 'PROJECT WORK', department_id: 'dept-cse' },
    { id: 'sub-ec101', name: 'Digital Signal Processing', code: 'EC201', department_id: 'dept-ece' },
    { id: 'sub-me101', name: 'Applied Thermodynamics', code: 'ME201', department_id: 'dept-mech' },
    { id: 'sub-sh101', name: 'Engineering Mathematics III', code: 'MA201', department_id: 'dept-sh' },
  ];

  for (const sub of subjectsData) {
    await prisma.subject.upsert({
      where: { code: sub.code },
      update: {},
      create: sub,
    });
  }
  console.log(`✓ Seeded ${subjectsData.length} Subjects`);

  // 5. Classes
  const classesData = [
    { id: 'cls-cse-a', name: 'B.Tech CSE - 3rd Year', section: 'A', department_id: 'dept-cse', academic_year_id: 'ay-2025-2026' },
    { id: 'cls-cse-b', name: 'B.Tech CSE - 3rd Year', section: 'B', department_id: 'dept-cse', academic_year_id: 'ay-2025-2026' },
    { id: 'cls-cse-4-a', name: 'B.Tech CSE - 4th Year', section: 'A', department_id: 'dept-cse', academic_year_id: 'ay-2025-2026' },
    { id: 'cls-cse-4-b', name: 'B.Tech CSE - 4th Year', section: 'B', department_id: 'dept-cse', academic_year_id: 'ay-2025-2026' },
    { id: 'cls-cse-4-c', name: 'B.Tech CSE - 4th Year', section: 'C', department_id: 'dept-cse', academic_year_id: 'ay-2025-2026' },
    { id: 'cls-cse-4-d', name: 'B.Tech CSE - 4th Year', section: 'D', department_id: 'dept-cse', academic_year_id: 'ay-2025-2026' },
    { id: 'cls-ece-a', name: 'B.Tech ECE - 2nd Year', section: 'A', department_id: 'dept-ece', academic_year_id: 'ay-2025-2026' },
    { id: 'cls-mech-a', name: 'B.Tech MECH - 4th Year', section: 'A', department_id: 'dept-mech', academic_year_id: 'ay-2025-2026' },
  ];

  for (const cls of classesData) {
    await prisma.class.upsert({
      where: { id: cls.id },
      update: {},
      create: cls,
    });
  }
  console.log(`✓ Seeded ${classesData.length} Classes`);

  // 6. Users & Staff (1 ADMIN, 1 primary STAFF Arun Kumar, plus 5 additional Staff to meet 5-10 requirement)
  // 6a. Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@college.demo' },
    update: {},
    create: {
      id: 'usr-admin-001',
      email: 'admin@college.demo',
      password_hash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✓ Seeded ADMIN user: ${adminUser.email}`);

  // 6b. Primary Staff User (Arun Kumar)
  const arunUser = await prisma.user.upsert({
    where: { email: 'arun.kumar@college.demo' },
    update: {},
    create: {
      id: 'usr-staff-001',
      email: 'arun.kumar@college.demo',
      password_hash: staffPasswordHash,
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
    },
  });

  const arunStaff = await prisma.staff.upsert({
    where: { staff_id: 'STF-CSE-001' },
    update: {},
    create: {
      id: 'stf-001',
      user_id: arunUser.id,
      staff_id: 'STF-CSE-001',
      full_name: 'Dr. Arun Kumar',
      email: 'arun.kumar@college.demo',
      phone: '+91 98765 43210',
      department_id: 'dept-cse',
      designation: 'Associate Professor',
      qualification: 'Ph.D. in Computer Science',
      joining_date: new Date('2020-07-15T00:00:00.000Z'),
      experience: 8,
      role: 'STAFF',
      status: 'ACTIVE',
      emergency_contact: '+91 98765 43219',
      address: '12 Faculty Enclave, Tech Campus',
    },
  });
  console.log(`✓ Seeded primary STAFF user & record: ${arunStaff.full_name} (${arunStaff.staff_id})`);

  // Additional 5 staff records
  const additionalStaffData = [
    {
      user_id: 'usr-staff-002',
      email: 'priya.sharma@college.demo',
      staff_id: 'STF-CSE-002',
      full_name: 'Prof. Priya Sharma',
      phone: '+91 98765 43211',
      department_id: 'dept-cse',
      designation: 'Assistant Professor',
      qualification: 'M.Tech CSE',
      joining_date: new Date('2022-01-10T00:00:00.000Z'),
      experience: 4,
    },
    {
      user_id: 'usr-staff-003',
      email: 'rajesh.verma@college.demo',
      staff_id: 'STF-ECE-001',
      full_name: 'Dr. Rajesh Verma',
      phone: '+91 98765 43212',
      department_id: 'dept-ece',
      designation: 'Professor & HOD',
      qualification: 'Ph.D. in VLSI',
      joining_date: new Date('2018-08-01T00:00:00.000Z'),
      experience: 14,
    },
    {
      user_id: 'usr-staff-004',
      email: 'sunita.patil@college.demo',
      staff_id: 'STF-MECH-001',
      full_name: 'Dr. Sunita Patil',
      phone: '+91 98765 43213',
      department_id: 'dept-mech',
      designation: 'Associate Professor',
      qualification: 'Ph.D. in Thermal Engineering',
      joining_date: new Date('2019-06-20T00:00:00.000Z'),
      experience: 10,
    },
    {
      user_id: 'usr-staff-005',
      email: 'manoj.nair@college.demo',
      staff_id: 'STF-SH-001',
      full_name: 'Prof. Manoj Nair',
      phone: '+91 98765 43214',
      department_id: 'dept-sh',
      designation: 'Assistant Professor',
      qualification: 'M.Sc., M.Phil Mathematics',
      joining_date: new Date('2021-09-01T00:00:00.000Z'),
      experience: 6,
    },
    {
      user_id: 'usr-staff-006',
      email: 'kavita.reddy@college.demo',
      staff_id: 'STF-CSE-003',
      full_name: 'Prof. Kavita Reddy',
      phone: '+91 98765 43215',
      department_id: 'dept-cse',
      designation: 'Assistant Professor',
      qualification: 'M.Tech Software Engineering',
      joining_date: new Date('2023-03-15T00:00:00.000Z'),
      experience: 3,
    },
    {
      user_id: 'usr-staff-007',
      email: 'aruna.a@college.demo',
      staff_id: 'STF-CSE-004',
      full_name: 'Mrs.A.ARUNA',
      phone: '+91 98765 43216',
      department_id: 'dept-cse',
      designation: 'Assistant Professor',
      qualification: 'M.Tech CSE',
      joining_date: new Date('2021-06-15T00:00:00.000Z'),
      experience: 5,
    },
    {
      user_id: 'usr-staff-008',
      email: 'meiyalagan.k@college.demo',
      staff_id: 'STF-CSE-005',
      full_name: 'Mr.K.MEIYALAGAN',
      phone: '+91 98765 43217',
      department_id: 'dept-cse',
      designation: 'Assistant Professor',
      qualification: 'M.Tech CSE',
      joining_date: new Date('2020-08-10T00:00:00.000Z'),
      experience: 6,
    },
    {
      user_id: 'usr-staff-009',
      email: 'tamizharasan.m@college.demo',
      staff_id: 'STF-CSE-006',
      full_name: 'Mr.M.TAMIZHARASAN',
      phone: '+91 98765 43218',
      department_id: 'dept-cse',
      designation: 'Assistant Professor',
      qualification: 'M.Tech CSE',
      joining_date: new Date('2019-07-01T00:00:00.000Z'),
      experience: 7,
    },
    {
      user_id: 'usr-staff-010',
      email: 'vignesh.m@college.demo',
      staff_id: 'STF-CSE-007',
      full_name: 'Mr.M.VIGNESH',
      phone: '+91 98765 43219',
      department_id: 'dept-cse',
      designation: 'Assistant Professor',
      qualification: 'M.Tech CSE',
      joining_date: new Date('2022-02-15T00:00:00.000Z'),
      experience: 4,
    },
    {
      user_id: 'usr-staff-011',
      email: 'stanly.j@college.demo',
      staff_id: 'STF-CSE-008',
      full_name: 'Dr.J.STANLY JAYAPRAKASH',
      phone: '+91 98765 43220',
      department_id: 'dept-cse',
      designation: 'Associate Professor',
      qualification: 'Ph.D. in Computer Science',
      joining_date: new Date('2017-06-01T00:00:00.000Z'),
      experience: 12,
    },
    {
      user_id: 'usr-staff-012',
      email: 'jayasudha.p@college.demo',
      staff_id: 'STF-CSE-009',
      full_name: 'Mrs.P.JAYASUDHA',
      phone: '+91 98765 43221',
      department_id: 'dept-cse',
      designation: 'Assistant Professor',
      qualification: 'M.Tech CSE',
      joining_date: new Date('2021-08-01T00:00:00.000Z'),
      experience: 5,
    },
  ];

  for (const s of additionalStaffData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        id: s.user_id,
        email: s.email,
        password_hash: staffPasswordHash,
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.staff.upsert({
      where: { staff_id: s.staff_id },
      update: {},
      create: {
        id: `stf-${s.staff_id.toLowerCase()}`,
        user_id: user.id,
        staff_id: s.staff_id,
        full_name: s.full_name,
        email: s.email,
        phone: s.phone,
        department_id: s.department_id,
        designation: s.designation,
        qualification: s.qualification,
        joining_date: s.joining_date,
        experience: s.experience,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });
  }
  console.log(`✓ Seeded 6 total staff profiles linked to user accounts`);

  // 7. Timetable records for Arun Kumar
  await prisma.timetable.upsert({
    where: { id: 'tt-001' },
    update: {},
    create: {
      id: 'tt-001',
      staff_id: arunStaff.id,
      class_id: 'cls-cse-a',
      subject_id: 'sub-cs101',
      academic_year_id: 'ay-2025-2026',
      day_of_week: 1, // Monday
      start_time: '09:00',
      end_time: '10:00',
      room: 'CS-Lab-1',
      status: 'SCHEDULED',
    },
  });

  await prisma.timetable.upsert({
    where: { id: 'tt-002' },
    update: {},
    create: {
      id: 'tt-002',
      staff_id: arunStaff.id,
      class_id: 'cls-cse-b',
      subject_id: 'sub-cs102',
      academic_year_id: 'ay-2025-2026',
      day_of_week: 2, // Tuesday
      start_time: '11:15',
      end_time: '12:15',
      room: 'Room-302',
      status: 'SCHEDULED',
    },
  });

  await prisma.timetable.upsert({
    where: { id: 'tt-003' },
    update: {},
    create: {
      id: 'tt-003',
      staff_id: arunStaff.id,
      class_id: 'cls-cse-a',
      subject_id: 'sub-cs101',
      academic_year_id: 'ay-2025-2026',
      day_of_week: 4, // Thursday (Today)
      start_time: '09:00',
      end_time: '10:00',
      room: 'CS-Lab-1',
      status: 'SCHEDULED',
    },
  });

  await prisma.timetable.upsert({
    where: { id: 'tt-004' },
    update: {},
    create: {
      id: 'tt-004',
      staff_id: arunStaff.id,
      class_id: 'cls-cse-b',
      subject_id: 'sub-cs102',
      academic_year_id: 'ay-2025-2026',
      day_of_week: 4, // Thursday (Today - Afternoon)
      start_time: '14:00',
      end_time: '15:00',
      room: 'Room-302',
      status: 'SCHEDULED',
    },
  });

  await prisma.timetable.upsert({
    where: { id: 'tt-005' },
    update: {},
    create: {
      id: 'tt-005',
      staff_id: arunStaff.id,
      class_id: 'cls-cse-a',
      subject_id: 'sub-cs103',
      academic_year_id: 'ay-2025-2026',
      day_of_week: 5, // Friday
      start_time: '10:00',
      end_time: '11:00',
      room: 'CS-Lab-2',
      status: 'SCHEDULED',
    },
  });
  console.log(`✓ Seeded Timetable entries`);

  // 8. Deterministic Attendance for Arun Kumar
  await prisma.attendance.upsert({
    where: {
      staff_id_attendance_date: {
        staff_id: arunStaff.id,
        attendance_date: new Date('2026-09-20T00:00:00.000Z'),
      },
    },
    update: {},
    create: {
      id: 'att-001',
      staff_id: arunStaff.id,
      attendance_date: new Date('2026-09-20T00:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      remarks: 'Biometric verified at 08:52 AM',
      created_by: 'system',
    },
  });
  console.log(`✓ Seeded Attendance record`);

  // 9. Initial Task
  const sampleTask = await prisma.task.upsert({
    where: { id: 'task-001' },
    update: {},
    create: {
      id: 'task-001',
      title: 'Submit Mid-Term Curriculum Progress Report',
      description: 'Prepare and submit completion report for CS201 and CS202 subjects for CSE-A & CSE-B.',
      assigned_staff_id: arunStaff.id,
      assigned_by: adminUser.id,
      assigned_date: new Date('2026-09-15T00:00:00.000Z'),
      due_date: new Date('2026-09-30T17:00:00.000Z'),
      priority: TaskPriority.HIGH,
      category: 'ACADEMIC_COMPLIANCE',
      status: TaskStatus.IN_PROGRESS,
    },
  });

  await prisma.taskUpdate.upsert({
    where: { id: 'tu-001' },
    update: {},
    create: {
      id: 'tu-001',
      task_id: sampleTask.id,
      old_status: TaskStatus.PENDING,
      new_status: TaskStatus.IN_PROGRESS,
      changed_by: arunStaff.id,
      remarks: 'Started gathering syllabus metrics from lab records',
    },
  });
  console.log(`✓ Seeded Task and TaskUpdate records`);

  // 10. Initial Settings
  await prisma.setting.upsert({
    where: { key: 'SYSTEM_NAME' },
    update: {},
    create: {
      key: 'SYSTEM_NAME',
      value: 'AI Staff Operations Intelligence Platform',
      data_type: 'STRING',
      updated_by: adminUser.id,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'PHASE_VERSION' },
    update: {},
    create: {
      key: 'PHASE_VERSION',
      value: '1.0.0-foundation',
      data_type: 'STRING',
      updated_by: adminUser.id,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES' },
    update: {},
    create: {
      key: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES',
      value: '5',
      data_type: 'NUMBER',
      updated_by: adminUser.id,
    },
  });

  console.log('✅ Deterministic seed completed successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
