export interface Department {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  _count?: {
    staff: number;
    classes: number;
    subjects: number;
  };
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    classes: number;
    timetable: number;
  };
}

export interface ClassEntity {
  id: string;
  name: string;
  section: string | null;
  department_id: string;
  academic_year_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  department?: Department;
  academic_year?: AcademicYear;
  _count?: {
    timetable: number;
  };
}

export interface SubjectEntity {
  id: string;
  name: string;
  code: string;
  department_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  department?: Department;
  _count?: {
    timetable: number;
  };
}

export interface StaffEntity {
  id: string;
  user_id: string;
  staff_id: string;
  full_name: string;
  profile_photo: string | null;
  email: string;
  phone: string | null;
  department_id: string;
  designation: string;
  qualification: string | null;
  joining_date: string;
  experience: number | null;
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  emergency_contact: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
    last_login_at: string | null;
    created_at: string;
  };
}

export interface TimetableEntity {
  id: string;
  staff_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  source?: string;
  source_file?: string;
  status: string;
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    staff_id: string;
    full_name: string;
    designation: string;
    email?: string;
  };
  class?: ClassEntity;
  subject?: SubjectEntity;
  academic_year?: AcademicYear;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
