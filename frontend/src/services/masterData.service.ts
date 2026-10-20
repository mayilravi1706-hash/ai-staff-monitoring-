import {
  Department,
  AcademicYear,
  ClassEntity,
  SubjectEntity,
  StaffEntity,
  TimetableEntity,
  PaginationMeta,
} from '../types/masterData';

import { getErrorMessage } from '../utils/errorHandler';

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
  error?: { message: string; code: string };
  deactivated?: boolean;
  deleted?: boolean;
}

class MasterDataService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; meta?: PaginationMeta; message?: string; raw?: any }> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        credentials: 'include',
      });
    } catch (networkError: unknown) {
      const error: any = new Error(
        getErrorMessage(networkError, 'Network error: Server is currently unreachable.')
      );
      error.isNetworkError = true;
      throw error;
    }

    let resJson: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        resJson = await response.json();
      } catch {
        resJson = null;
      }
    } else {
      try {
        const text = await response.text();
        resJson = { message: text };
      } catch {
        resJson = null;
      }
    }

    if (!response.ok || (resJson && resJson.success === false)) {
      const errorMsg =
        resJson?.error?.message ||
        resJson?.message ||
        getErrorMessage({ status: response.status });
      const error: any = new Error(errorMsg);
      error.status = response.status;
      error.statusCode = response.status;
      error.data = resJson;
      error.response = { status: response.status, data: resJson };
      throw error;
    }

    // Safely assign data: prioritize resJson.data, fallback to resJson itself or empty object
    const payloadData = (resJson?.data !== undefined ? resJson.data : resJson) as T;

    return {
      data: payloadData,
      meta: resJson?.meta,
      message: resJson?.message,
      raw: resJson,
    };
  }

  // ==========================================
  // STAFF
  // ==========================================

  async getStaffList(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    department_id?: string;
    status?: string;
    role?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ staff: StaffEntity[]; meta: PaginationMeta }> {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.pageSize) q.append('pageSize', params.pageSize.toString());
    if (params?.search) q.append('search', params.search);
    if (params?.department_id) q.append('department_id', params.department_id);
    if (params?.status) q.append('status', params.status);
    if (params?.role) q.append('role', params.role);
    if (params?.sort) q.append('sort', params.sort);
    if (params?.order) q.append('order', params.order);

    const res = await this.request<StaffEntity[]>(`/api/staff?${q.toString()}`);
    return {
      staff: res.data,
      meta: res.meta || { total: res.data.length, page: 1, pageSize: res.data.length, totalPages: 1 },
    };
  }

  async getStaffById(id: string): Promise<StaffEntity> {
    const res = await this.request<StaffEntity>(`/api/staff/${id}`);
    return res.data;
  }

  async createStaff(data: any): Promise<StaffEntity> {
    const res = await this.request<StaffEntity>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateStaff(id: string, data: any): Promise<StaffEntity> {
    const res = await this.request<StaffEntity>(`/api/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteStaff(id: string): Promise<{ message: string; deactivated?: boolean; deleted?: boolean }> {
    const res = await this.request<{ message?: string; deactivated?: boolean; deleted?: boolean }>(`/api/staff/${id}`, {
      method: 'DELETE',
    });

    const data = (res.data || {}) as Record<string, any>;
    const raw = (res.raw || {}) as Record<string, any>;

    const message =
      data.message ||
      raw.message ||
      res.message ||
      'Staff member processed successfully.';

    const deactivated = Boolean(data.deactivated ?? raw.deactivated);
    const deleted = Boolean(data.deleted ?? raw.deleted);

    return {
      message,
      deactivated,
      deleted,
    };
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  async getDepartments(params?: { search?: string; status?: string; page?: number; pageSize?: number }): Promise<{ departments: Department[]; meta?: PaginationMeta }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', params.page.toString());
    if (params?.pageSize) q.append('pageSize', params.pageSize.toString());

    const res = await this.request<Department[]>(`/api/departments?${q.toString()}`);
    return { departments: res.data, meta: res.meta };
  }

  async getDepartmentById(id: string): Promise<Department> {
    const res = await this.request<Department>(`/api/departments/${id}`);
    return res.data;
  }

  async createDepartment(data: { name: string; code: string; status?: string }): Promise<Department> {
    const res = await this.request<Department>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateDepartment(id: string, data: { name?: string; code?: string; status?: string }): Promise<Department> {
    const res = await this.request<Department>(`/api/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.request(`/api/departments/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // CLASSES
  // ==========================================

  async getClasses(params?: { search?: string; department_id?: string; academic_year_id?: string; status?: string; page?: number; pageSize?: number }): Promise<{ classes: ClassEntity[]; meta?: PaginationMeta }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.department_id) q.append('department_id', params.department_id);
    if (params?.academic_year_id) q.append('academic_year_id', params.academic_year_id);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', params.page.toString());
    if (params?.pageSize) q.append('pageSize', params.pageSize.toString());

    const res = await this.request<ClassEntity[]>(`/api/classes?${q.toString()}`);
    return { classes: res.data, meta: res.meta };
  }

  async getClassById(id: string): Promise<ClassEntity> {
    const res = await this.request<ClassEntity>(`/api/classes/${id}`);
    return res.data;
  }

  async createClass(data: { name: string; section?: string; department_id: string; academic_year_id: string; status?: string }): Promise<ClassEntity> {
    const res = await this.request<ClassEntity>('/api/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateClass(id: string, data: { name?: string; section?: string; department_id?: string; academic_year_id?: string; status?: string }): Promise<ClassEntity> {
    const res = await this.request<ClassEntity>(`/api/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteClass(id: string): Promise<void> {
    await this.request(`/api/classes/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // SUBJECTS
  // ==========================================

  async getSubjects(params?: { search?: string; department_id?: string; status?: string; page?: number; pageSize?: number }): Promise<{ subjects: SubjectEntity[]; meta?: PaginationMeta }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.department_id) q.append('department_id', params.department_id);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', params.page.toString());
    if (params?.pageSize) q.append('pageSize', params.pageSize.toString());

    const res = await this.request<SubjectEntity[]>(`/api/subjects?${q.toString()}`);
    return { subjects: res.data, meta: res.meta };
  }

  async getSubjectById(id: string): Promise<SubjectEntity> {
    const res = await this.request<SubjectEntity>(`/api/subjects/${id}`);
    return res.data;
  }

  async createSubject(data: { name: string; code: string; department_id: string; status?: string }): Promise<SubjectEntity> {
    const res = await this.request<SubjectEntity>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateSubject(id: string, data: { name?: string; code?: string; department_id?: string; status?: string }): Promise<SubjectEntity> {
    const res = await this.request<SubjectEntity>(`/api/subjects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteSubject(id: string): Promise<void> {
    await this.request(`/api/subjects/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // ACADEMIC YEARS
  // ==========================================

  async getAcademicYears(params?: { search?: string; page?: number; pageSize?: number }): Promise<{ academicYears: AcademicYear[]; meta?: PaginationMeta }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.page) q.append('page', params.page.toString());
    if (params?.pageSize) q.append('pageSize', params.pageSize.toString());

    const res = await this.request<AcademicYear[]>(`/api/academic-years?${q.toString()}`);
    return { academicYears: res.data, meta: res.meta };
  }

  async getAcademicYearById(id: string): Promise<AcademicYear> {
    const res = await this.request<AcademicYear>(`/api/academic-years/${id}`);
    return res.data;
  }

  async createAcademicYear(data: { name: string; start_date: string; end_date: string; active?: boolean }): Promise<AcademicYear> {
    const res = await this.request<AcademicYear>('/api/academic-years', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateAcademicYear(id: string, data: { name?: string; start_date?: string; end_date?: string; active?: boolean }): Promise<AcademicYear> {
    const res = await this.request<AcademicYear>(`/api/academic-years/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteAcademicYear(id: string): Promise<void> {
    await this.request(`/api/academic-years/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // TIMETABLE
  // ==========================================

  async getTimetable(params?: {
    search?: string;
    staffId?: string;
    class_id?: string;
    subject_id?: string;
    academic_year_id?: string;
    department_id?: string;
    day_of_week?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ timetable: TimetableEntity[]; meta?: PaginationMeta }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.staffId) q.append('staffId', params.staffId);
    if (params?.class_id) q.append('class_id', params.class_id);
    if (params?.subject_id) q.append('subject_id', params.subject_id);
    if (params?.academic_year_id) q.append('academic_year_id', params.academic_year_id);
    if (params?.department_id) q.append('department_id', params.department_id);
    if (params?.day_of_week !== undefined) q.append('day_of_week', params.day_of_week.toString());
    if (params?.page) q.append('page', params.page.toString());
    if (params?.pageSize) q.append('pageSize', params.pageSize.toString());

    const res = await this.request<TimetableEntity[]>(`/api/timetable?${q.toString()}`);
    return { timetable: res.data, meta: res.meta };
  }

  async getTimetableById(id: string): Promise<TimetableEntity> {
    const res = await this.request<TimetableEntity>(`/api/timetable/${id}`);
    return res.data;
  }

  async createTimetable(data: {
    staff_id: string;
    class_id: string;
    subject_id: string;
    academic_year_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room?: string | null;
    status?: string;
  }): Promise<TimetableEntity> {
    const res = await this.request<TimetableEntity>('/api/timetable', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateTimetable(id: string, data: any): Promise<TimetableEntity> {
    const res = await this.request<TimetableEntity>(`/api/timetable/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteTimetable(id: string): Promise<void> {
    await this.request(`/api/timetable/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // TIMETABLE PDF IMPORT
  // ==========================================

  async uploadTimetablePdf(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/timetable/upload/pdf', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const resJson = await response.json();
    if (!response.ok || !resJson.success) {
      const errorMsg = resJson.error?.message || resJson.message || 'Failed to upload timetable PDF';
      throw new Error(errorMsg);
    }

    return resJson.data;
  }

  async confirmTimetableImport(data: {
    importId: string;
    rows?: any[];
    replaceExisting?: boolean;
  }): Promise<{ importedCount: number; updatedCount: number; errors?: string[] }> {
    const res = await this.request<{ importedCount: number; updatedCount: number; errors?: string[] }>(
      '/api/timetable/upload/confirm',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  }

  async getTimetableImportHistory(page = 1, pageSize = 20): Promise<any> {
    const res = await this.request<any>(`/api/timetable/upload/history?page=${page}&pageSize=${pageSize}`);
    return res.data;
  }
}

export const masterDataService = new MasterDataService();
