import { api } from './api';

export interface AuditLogFilterParams {
  startDate?: string;
  endDate?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogEntity {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_value: string | null;
  after_value: string | null;
  metadata: string | null;
  created_at: string;
  user?: {
    id: string;
    email: string;
    role: string;
    staff?: {
      id: string;
      staff_id: string;
      full_name: string;
      department?: { id: string; name: string };
    };
  };
}

export interface AuditLogListResponse {
  logs: AuditLogEntity[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const auditApi = {
  async getAuditLogs(params: AuditLogFilterParams = {}): Promise<AuditLogListResponse> {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.action) query.append('action', params.action);
    if (params.entityType) query.append('entityType', params.entityType);
    if (params.entityId) query.append('entityId', params.entityId);
    if (params.userId) query.append('userId', params.userId);
    if (params.role) query.append('role', params.role);
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await api.get(`/audit-logs?${query.toString()}`);
    return {
      logs: res.data.data,
      pagination: res.data.pagination || { total: res.data.data.length, page: 1, limit: 50, totalPages: 1 },
    };
  },

  async getAuditLogById(id: string): Promise<AuditLogEntity> {
    const res = await api.get(`/audit-logs/${id}`);
    return res.data.data;
  },
};
