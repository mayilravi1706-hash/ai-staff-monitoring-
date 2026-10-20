import { api } from './api';

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  academicYearId?: string;
  departmentId?: string;
  staffId?: string;
  classId?: string;
  subjectId?: string;
  attendanceStatus?: string;
  taskStatus?: string;
  taskPriority?: string;
  leaveStatus?: string;
  workloadStatus?: string;
  alertSeverity?: string;
  alertStatus?: string;
}

export interface GeneratedReport {
  id: string;
  title?: string;
  reportType: string;
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  status: string;
  recordCount?: number;
  filename?: string;
  downloadUrl?: string;
  generatedAt?: string;
  generated_at?: string;
  filters?: string;
}

export const reportsApi = {
  async generateReport(
    reportType: string,
    format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON',
    filters?: ReportFilterParams
  ): Promise<GeneratedReport> {
    const res = await api.post('/reports', {
      reportType,
      format,
      filters,
    });
    return res.data.data;
  },

  async getReportHistory(): Promise<GeneratedReport[]> {
    const res = await api.get('/reports');
    return res.data.data;
  },

  async getReportById(id: string): Promise<GeneratedReport> {
    const res = await api.get(`/reports/${id}`);
    return res.data.data;
  },

  async deleteReport(id: string): Promise<void> {
    await api.delete(`/reports/${id}`);
  },

  getDownloadUrl(id: string): string {
    return `/api/reports/${id}/download`;
  },
};
