import { api } from './api';

export interface ToolEvidenceItem {
  id?: string;
  entity_type: string;
  entity_id: string;
  evidence_type: string;
  explanation: string;
}

export interface StructuredAiResponse {
  databaseFacts: string[];
  ruleBasedConditions: string[];
  aiInsights: string[];
  answer: string;
  evidence: ToolEvidenceItem[];
  timestamp: string;
  dataScope: string;
  modelUsed: string;
  status: 'SUCCESS' | 'INSUFFICIENT_DATA' | 'FALLBACK_SYNTHESIS' | 'GENERAL_QA' | 'ERROR';
  analysisId?: string;
  toolsUsed?: string[];
}

export interface ConversationHistoryItem {
  sender: 'user' | 'ai';
  text: string;
}

export interface AiHealthStatus {
  aiEnabled: boolean;
  configurationStatus: 'CONFIGURED' | 'CREDENTIALS_MISSING' | 'DISABLED';
  configuredModel: string;
  credentialsAvailable: boolean;
  lastSuccessfulRequest: string | null;
  lastErrorCategory: string | null;
}

export interface AiAnalysisRunEntity {
  id: string;
  user_id: string;
  question: string;
  analysis_type: string;
  authorized_scope: string | null;
  tools_used: string | null;
  model: string | null;
  status: string;
  response_summary: string | null;
  started_at: string;
  completed_at: string | null;
  evidence?: ToolEvidenceItem[];
}

export const aiApi = {
  async askAdminCopilot(prompt: string, history?: ConversationHistoryItem[]): Promise<StructuredAiResponse> {
    const res = await api.post('/ai/admin/chat', { prompt, history });
    return res.data.data;
  },

  async askStaffAssistant(prompt: string, history?: ConversationHistoryItem[]): Promise<StructuredAiResponse> {
    const res = await api.post('/ai/staff/chat', { prompt, history });
    return res.data.data;
  },

  async getAiStatus(): Promise<AiHealthStatus> {
    const res = await api.get('/ai/status');
    return res.data.data;
  },

  async getHistory(): Promise<AiAnalysisRunEntity[]> {
    const res = await api.get('/ai/history');
    return res.data.data;
  },

  async getAnalysisById(id: string): Promise<AiAnalysisRunEntity> {
    const res = await api.get(`/ai/analysis/${id}`);
    return res.data.data;
  },

  async getAnalysisEvidence(id: string): Promise<ToolEvidenceItem[]> {
    const res = await api.get(`/ai/analysis/${id}/evidence`);
    return res.data.data;
  },

  async submitFeedback(
    id: string,
    rating: 'HELPFUL' | 'NOT_HELPFUL' | 'INCORRECT' | 'ISSUE',
    comment?: string
  ): Promise<void> {
    await api.post(`/ai/analysis/${id}/feedback`, { rating, comment });
  },
};
