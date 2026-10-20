import { prisma } from '../config/database';
import { aiRateLimiterService } from './aiRateLimiter.service';
import { aiToolsService, AuthenticatedAiUser, ToolEvidenceItem, ToolContextParams } from './aiTools.service';
import { aiGeminiService, StructuredAiResponse, ConversationHistoryItem } from './aiGemini.service';
import { createAuditLog } from '../modules/audit/audit.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface AiQueryResult extends StructuredAiResponse {
  analysisId: string;
  toolsUsed: string[];
}

export class AiOrchestratorService {
  /**
   * Executes an end-to-end evidence-grounded AI query.
   * Supports conversation history, multi-lingual Tamil/Tanglish, entity resolution, and general Q&A.
   */
  async processAiQuery(
    user: AuthenticatedAiUser,
    rawPrompt: string,
    history: ConversationHistoryItem[] = []
  ): Promise<AiQueryResult> {
    const startTime = Date.now();

    // 1. Prompt validation & rate limiting guardrails
    const prompt = aiRateLimiterService.validatePrompt(rawPrompt);
    aiRateLimiterService.checkRateLimit(user.id, user.role);

    // 2. Audit: Query Started
    await createAuditLog({
      userId: user.id,
      action: 'AI_QUERY_STARTED',
      entityType: 'AI_QUERY',
      entityId: user.id,
      metadata: { role: user.role, promptLength: prompt.length },
    });

    // 3. Resolve context: entities, follow-up references, days, departments, etc.
    const resolvedContext = await this.resolveContextFromPromptAndHistory(prompt, history, user);

    // 4. Classify question intent & select allowed tools
    const { toolsToCall, analysisType, isGeneralQuery } = this.selectToolsForPrompt(prompt, user.role, resolvedContext);

    // 5. Execute authorized tools & collect evidence
    const aggregatedFacts: string[] = [];
    const aggregatedEvidence: ToolEvidenceItem[] = [];
    const ruleConditions: string[] = [];
    const successfullyUsedTools: string[] = [];

    for (const toolName of toolsToCall) {
      try {
        aiToolsService.assertToolAuthorization(toolName, user);
        const result = await this.executeToolByName(toolName, user, prompt, resolvedContext);
        successfullyUsedTools.push(toolName);
        aggregatedFacts.push(...result.facts);
        aggregatedEvidence.push(...result.evidence);

        // Audit each tool execution
        await createAuditLog({
          userId: user.id,
          action: 'AI_TOOL_CALLED',
          entityType: 'AI_TOOL',
          entityId: toolName,
          metadata: { recordCount: result.recordCount },
        });
      } catch (err: any) {
        logger.warn(`Tool ${toolName} execution skipped: ${err.message}`);
        if (err.statusCode === 403) {
          await createAuditLog({
            userId: user.id,
            action: 'AI_ACCESS_DENIED',
            entityType: 'AI_TOOL',
            entityId: toolName,
            metadata: { reason: err.message },
          });
        }
      }
    }

    // 6. Evaluate Rule-based Conditions from Retrieved Evidence
    if (aggregatedEvidence.some((e) => e.evidence_type === 'UNRECORDED_CLASS_ACTIVITY')) {
      ruleConditions.push(
        'Scheduled class activity has not been recorded after the configured monitoring grace period.'
      );
    }
    if (aggregatedEvidence.some((e) => e.explanation.includes('OVERDUE') || e.explanation.includes('overdue'))) {
      ruleConditions.push('Tasks with due date prior to today remain incomplete and are flagged as OVERDUE.');
    }
    if (aggregatedEvidence.some((e) => e.evidence_type === 'OPERATIONAL_SIGNAL')) {
      ruleConditions.push('Active operational signals have been flagged by the deterministic rule engine.');
    }

    // 7. Call Gemini Service with strictly grounded evidence or General Q&A
    const response = await aiGeminiService.generateAnalysis({
      prompt,
      userRole: user.role,
      facts: aggregatedFacts,
      evidence: aggregatedEvidence,
      ruleConditions,
      history,
      isGeneralQuery,
      disambiguationOptions: resolvedContext.ambiguousStaffNames,
    });

    // 8. Persist AiAnalysisRun in Database
    const analysisRun = await prisma.aiAnalysisRun.create({
      data: {
        user_id: user.id,
        question: prompt,
        analysis_type: analysisType,
        authorized_scope: response.dataScope,
        tools_used: JSON.stringify(successfullyUsedTools),
        model: response.modelUsed,
        status: response.status,
        response_summary: response.answer,
        completed_at: new Date(),
      },
    });

    // 9. Persist AiEvidence records linked to analysis run
    if (aggregatedEvidence.length > 0) {
      await Promise.all(
        aggregatedEvidence.slice(0, 30).map((ev) =>
          prisma.aiEvidence.create({
            data: {
              analysis_run_id: analysisRun.id,
              entity_type: ev.entity_type,
              entity_id: ev.entity_id,
              evidence_type: ev.evidence_type,
              explanation: ev.explanation,
            },
          })
        )
      );

      await createAuditLog({
        userId: user.id,
        action: 'AI_EVIDENCE_CREATED',
        entityType: 'AI_ANALYSIS',
        entityId: analysisRun.id,
        metadata: { evidenceCount: aggregatedEvidence.length },
      });
    }

    // 10. Audit: Query Completed
    await createAuditLog({
      userId: user.id,
      action: 'AI_QUERY_COMPLETED',
      entityType: 'AI_ANALYSIS',
      entityId: analysisRun.id,
      metadata: {
        durationMs: Date.now() - startTime,
        evidenceCount: aggregatedEvidence.length,
        status: response.status,
      },
    });

    return {
      ...response,
      analysisId: analysisRun.id,
      toolsUsed: successfullyUsedTools,
    };
  }

  /**
   * Resolves contextual entities (staff members, pronouns, departments, day of week)
   * across prompt text and recent multi-turn conversation history.
   */
  private async resolveContextFromPromptAndHistory(
    prompt: string,
    history: ConversationHistoryItem[],
    user: AuthenticatedAiUser
  ): Promise<{
    targetStaffId?: string;
    targetStaffName?: string;
    targetDepartmentId?: string;
    targetDayOfWeek?: number;
    ambiguousStaffNames?: string[];
  }> {
    const q = prompt.toLowerCase();
    const result: {
      targetStaffId?: string;
      targetStaffName?: string;
      targetDepartmentId?: string;
      targetDayOfWeek?: number;
      ambiguousStaffNames?: string[];
    } = {};

    // 1. Day of week resolution (English, Tamil, Tanglish)
    if (q.includes('monday') || q.includes('திங்கள்') || q.includes('thingal')) result.targetDayOfWeek = 1;
    else if (q.includes('tuesday') || q.includes('செவ்வாய்') || q.includes('sevvaai')) result.targetDayOfWeek = 2;
    else if (q.includes('wednesday') || q.includes('புதன்') || q.includes('budhan')) result.targetDayOfWeek = 3;
    else if (q.includes('thursday') || q.includes('வியாழன்') || q.includes('vyazhan')) result.targetDayOfWeek = 4;
    else if (q.includes('friday') || q.includes('வெள்ளி') || q.includes('velli')) result.targetDayOfWeek = 5;
    else if (q.includes('saturday') || q.includes('சனி') || q.includes('sani')) result.targetDayOfWeek = 6;
    else if (q.includes('sunday') || q.includes('ஞாயிறு') || q.includes('gnyayiru')) result.targetDayOfWeek = 7;

    // 2. Department resolution
    if (q.includes('cse') || q.includes('computer science')) {
      const dept = await prisma.department.findFirst({ where: { code: 'CSE' } });
      if (dept) result.targetDepartmentId = dept.id;
    } else if (q.includes('ece') || q.includes('electronics')) {
      const dept = await prisma.department.findFirst({ where: { code: 'ECE' } });
      if (dept) result.targetDepartmentId = dept.id;
    } else if (q.includes('mech') || q.includes('mechanical')) {
      const dept = await prisma.department.findFirst({ where: { code: 'MECH' } });
      if (dept) result.targetDepartmentId = dept.id;
    }

    // 3. Staff resolution (If Admin, can query anyone; If Staff, defaults or restricted to self)
    if (user.role === 'STAFF') {
      result.targetStaffId = user.staffRecordId;
      return result;
    }

    // Check pronouns in prompt referring to previous context ("avanga", "his", "her", "their", "them", "the staff")
    const hasPronoun =
      q.includes('avanga') ||
      q.includes('avan') ||
      q.includes('avaru') ||
      q.includes('his') ||
      q.includes('her') ||
      q.includes('their') ||
      q.includes('same staff');

    if (hasPronoun && history.length > 0) {
      // Find latest staff mentioned in history
      for (let i = history.length - 1; i >= 0; i--) {
        const item = history[i];
        const match = await this.findStaffInText(item.text);
        if (match.found) {
          result.targetStaffId = match.staff.id;
          result.targetStaffName = match.staff.full_name;
          break;
        }
      }
    }

    // If not found from pronoun, check current prompt for staff names
    if (!result.targetStaffId) {
      const match = await this.findStaffInText(prompt);
      if (match.ambiguous && match.options) {
        result.ambiguousStaffNames = match.options;
      } else if (match.found) {
        result.targetStaffId = match.staff.id;
        result.targetStaffName = match.staff.full_name;
      }
    }

    return result;
  }

  private async findStaffInText(text: string): Promise<{ found: boolean; staff?: any; ambiguous?: boolean; options?: string[] }> {
    const clean = text.replace(/[?,.:;!]/g, ' ');
    const stopWords = new Set(['what', 'tell', 'sollu', 'show', 'details', 'enna', 'list', 'about', 'full', 'please', 'the', 'for']);
    const tokens = clean.split(/\s+/).filter((t) => t.length >= 3 && !stopWords.has(t.toLowerCase()));

    // 1. Try full multi-word phrases first (e.g. "Arun Kumar")
    for (let i = 0; i < tokens.length - 1; i++) {
      const phrase = `${tokens[i]} ${tokens[i + 1]}`;
      const candidates = await prisma.staff.findMany({
        where: {
          full_name: { contains: phrase, mode: 'insensitive' },
        },
        include: { department: true },
      });
      if (candidates.length === 1) {
        return { found: true, staff: candidates[0] };
      } else if (candidates.length > 1) {
        return {
          found: false,
          ambiguous: true,
          options: candidates.map((c) => `${c.full_name} (${c.staff_id} - ${c.designation}, ${c.department?.name})`),
        };
      }
    }

    // 2. Try individual tokens
    for (const token of tokens) {
      const candidates = await prisma.staff.findMany({
        where: {
          OR: [
            { full_name: { contains: token, mode: 'insensitive' } },
            { staff_id: { contains: token, mode: 'insensitive' } },
          ],
        },
        include: { department: true },
        take: 5,
      });

      if (candidates.length === 1) {
        return { found: true, staff: candidates[0] };
      } else if (candidates.length > 1) {
        // If one of the candidates is an exact word match in full_name, prioritize it
        const exactMatch = candidates.find((c) =>
          c.full_name.toLowerCase().split(/\s+/).includes(token.toLowerCase())
        );
        if (exactMatch && candidates.filter((c) => c.full_name.toLowerCase().split(/\s+/).includes(token.toLowerCase())).length === 1) {
          return { found: true, staff: exactMatch };
        }
        return {
          found: false,
          ambiguous: true,
          options: candidates.map((c) => `${c.full_name} (${c.staff_id} - ${c.designation}, ${c.department?.name})`),
        };
      }
    }

    return { found: false };
  }

  /**
   * Intelligently maps user prompt keywords to allowlisted tools.
   */
  private selectToolsForPrompt(
    prompt: string,
    role: string,
    context: { targetStaffId?: string; targetDepartmentId?: string; targetDayOfWeek?: number }
  ): { toolsToCall: string[]; analysisType: string; isGeneralQuery: boolean } {
    const q = prompt.toLowerCase();
    const tools: string[] = [];
    let analysisType = 'GENERAL_OPERATIONAL_QUERY';
    let isGeneralQuery = false;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    // General knowledge keywords check (coding, explanations, creative writing, non-institutional queries)
    const isExplicitGeneral =
      q.includes('explain') && (q.includes('javascript') || q.includes('python') || q.includes('promise') || q.includes('code') || q.includes('react') || q.includes('algorithm') || q.includes('sql') || q.includes('css')) ||
      q.includes('how to write') ||
      q.includes('what is the capital') ||
      q.includes('difference between') ||
      q.includes('chatgpt') ||
      q.includes('write a poem') ||
      q.includes('write an email');

    // Timetable & Class Schedules (English, Tamil, Tanglish: timetable, schedule, class, teach, lecture, inliku, inniku)
    if (
      q.includes('teach') ||
      q.includes('class') ||
      q.includes('lecture') ||
      q.includes('period') ||
      q.includes('timetable') ||
      q.includes('schedule') ||
      q.includes('வகுப்பு') ||
      q.includes('நேர அட்டவணை') ||
      context.targetDayOfWeek !== undefined
    ) {
      tools.push('get_timetable');
      tools.push('get_current_activities');
      if (isAdmin && (q.includes('coverage') || q.includes('unrecorded') || q.includes('monitoring'))) {
        tools.push('get_class_coverage');
      }
      analysisType = 'TIMETABLE_AND_CLASS_ACTIVITY';
    }

    // Tasks & Assignments (task, assignment, overdue, pending, deadline, mudichacha)
    if (
      q.includes('task') ||
      q.includes('assignment') ||
      q.includes('overdue') ||
      q.includes('pending') ||
      q.includes('deadline') ||
      q.includes('வேலை') ||
      q.includes('panrathu')
    ) {
      tools.push('get_staff_tasks');
      tools.push('get_task_statistics');
      analysisType = 'TASK_OPERATIONS';
    }

    // Attendance & Leaves (attend, absent, present, leave, half day, varala, vandhanga, iniku, inniku)
    if (
      q.includes('attend') ||
      q.includes('absent') ||
      q.includes('present') ||
      q.includes('leave') ||
      q.includes('half day') ||
      q.includes('வருகை') ||
      q.includes('விடுப்பு') ||
      q.includes('varala') ||
      q.includes('vandhanga')
    ) {
      tools.push('get_staff_attendance');
      tools.push('get_attendance_statistics');
      tools.push('get_leave_requests');
      analysisType = 'ATTENDANCE_AND_LEAVE';
    }

    // Workload & Hours (workload, hours, teaching hours, pressure, bhaarama)
    if (
      q.includes('workload') ||
      q.includes('hours') ||
      q.includes('teaching hours') ||
      q.includes('pressure') ||
      q.includes('distribution')
    ) {
      tools.push('get_workload_metrics');
      if (isAdmin) {
        tools.push('get_department_workload');
      }
      analysisType = 'WORKLOAD_EVALUATION';
    }

    // Performance & Rating (performance, score, evaluation, rating)
    if (
      q.includes('performance') ||
      q.includes('score') ||
      q.includes('evaluation') ||
      q.includes('metrics') ||
      q.includes('rating')
    ) {
      tools.push('get_performance');
      if (isAdmin) {
        tools.push('get_department_performance');
      }
      analysisType = 'PERFORMANCE_METRICS';
    }

    // Alerts & Operational Signals
    if (
      q.includes('alert') ||
      q.includes('signal') ||
      q.includes('warning') ||
      q.includes('conflict') ||
      q.includes('risk')
    ) {
      tools.push('get_operational_alerts');
      if (isAdmin) {
        tools.push('get_class_coverage');
      }
      analysisType = 'OPERATIONAL_ALERTS';
    }

    // Departments, Classes, Sections, Subjects & Academic Structure
    if (
      q.includes('department') ||
      q.includes('subject') ||
      q.includes('academic year') ||
      q.includes('section') ||
      q.includes('course')
    ) {
      tools.push('get_academic_structure');
      if (isAdmin) {
        tools.push('get_department_statistics');
      }
      analysisType = 'INSTITUTIONAL_STRUCTURE';
    }

    // Staff profiles & Details (profile, details, sollu, yaar, who is, designation, phone)
    if (
      q.includes('staff') ||
      q.includes('details') ||
      q.includes('profile') ||
      q.includes('designation') ||
      q.includes('sollu') ||
      context.targetStaffId
    ) {
      tools.push('get_staff');
      if (tools.length === 1) {
        tools.push('get_timetable', 'get_staff_tasks');
      }
      analysisType = 'STAFF_PROFILE_INTELLIGENCE';
    }

    // Reports & Summaries
    if (q.includes('report') || q.includes('export') || q.includes('summary')) {
      tools.push('get_reports_summary');
      analysisType = 'REPORTS_AND_EXPORTS';
    }

    // Timetable PDF Imports (Admin)
    if (isAdmin && (q.includes('pdf') || q.includes('import') || q.includes('upload'))) {
      tools.push('get_timetable_imports');
      analysisType = 'TIMETABLE_PDF_IMPORTS';
    }

    // Audit logs & System Settings (Admin only)
    if (isAdmin && (q.includes('audit') || q.includes('trail') || q.includes('security') || q.includes('who changed'))) {
      tools.push('get_audit_records');
      analysisType = 'AUDIT_SECURITY';
    }
    if (isAdmin && (q.includes('setting') || q.includes('config') || q.includes('parameter') || q.includes('threshold'))) {
      tools.push('get_system_settings');
      analysisType = 'SYSTEM_SETTINGS';
    }

    // Notifications
    if (q.includes('notification') || q.includes('notice') || q.includes('announcement')) {
      tools.push('get_notifications');
      analysisType = 'NOTIFICATION_AUDIT';
    }

    // If general knowledge query was detected and no database tools were requested
    if (isExplicitGeneral && tools.length === 0) {
      isGeneralQuery = true;
      tools.push('get_general_qa');
      analysisType = 'GENERAL_KNOWLEDGE_ASSISTANT';
    }

    // Default fallbacks if no specific keywords matched
    if (tools.length === 0) {
      if (isExplicitGeneral) {
        isGeneralQuery = true;
        tools.push('get_general_qa');
        analysisType = 'GENERAL_KNOWLEDGE_ASSISTANT';
      } else if (isAdmin) {
        tools.push('get_staff', 'get_operational_alerts', 'get_task_statistics', 'get_current_activities', 'get_department_statistics');
      } else {
        tools.push('get_timetable', 'get_staff_tasks', 'get_current_activities');
      }
    }

    return {
      toolsToCall: Array.from(new Set(tools)),
      analysisType,
      isGeneralQuery,
    };
  }

  /**
   * Dispatches execution to the corresponding allowlisted tool.
   */
  private async executeToolByName(
    toolName: string,
    user: AuthenticatedAiUser,
    prompt: string,
    context: { targetStaffId?: string; targetDepartmentId?: string; targetDayOfWeek?: number }
  ) {
    switch (toolName) {
      case 'get_staff':
        return aiToolsService.getStaff(user, {
          staffId: context.targetStaffId,
          departmentId: context.targetDepartmentId,
        });
      case 'get_staff_attendance':
        return aiToolsService.getStaffAttendance(user, { staffId: context.targetStaffId });
      case 'get_staff_tasks':
        return aiToolsService.getStaffTasks(user, { staffId: context.targetStaffId });
      case 'get_current_activities':
        return aiToolsService.getCurrentActivities(user, { staffId: context.targetStaffId });
      case 'get_timetable':
        return aiToolsService.getTimetable(user, {
          dayOfWeek: context.targetDayOfWeek,
          staffId: context.targetStaffId,
          departmentId: context.targetDepartmentId,
        });
      case 'get_leave_requests':
        return aiToolsService.getLeaveRequests(user, { staffId: context.targetStaffId });
      case 'get_workload_metrics':
        return aiToolsService.getWorkloadMetrics(user, { staffId: context.targetStaffId });
      case 'get_department_statistics':
        return aiToolsService.getDepartmentStatistics(user);
      case 'get_notifications':
        return aiToolsService.getNotifications(user);
      case 'get_performance':
        return aiToolsService.getPerformance(user, { staffId: context.targetStaffId });
      case 'get_audit_records':
        return aiToolsService.getAuditRecords(user);
      case 'get_class_coverage':
        return aiToolsService.getClassCoverage(user);
      case 'get_operational_alerts':
        return aiToolsService.getOperationalAlerts(user);
      case 'get_task_statistics':
        return aiToolsService.getTaskStatistics(user);
      case 'get_attendance_statistics':
        return aiToolsService.getAttendanceStatistics(user);
      case 'get_department_workload':
        return aiToolsService.getDepartmentWorkload(user);
      case 'get_department_performance':
        return aiToolsService.getDepartmentPerformance(user);
      case 'get_academic_structure':
        return aiToolsService.getAcademicStructure(user);
      case 'get_reports_summary':
        return aiToolsService.getReportsSummary(user);
      case 'get_timetable_imports':
        return aiToolsService.getTimetableImports(user);
      case 'get_system_settings':
        return aiToolsService.getSystemSettings(user);
      case 'get_general_qa':
        return aiToolsService.getGeneralQa(user);
      default:
        throw new AppError(`Unknown tool: ${toolName}`, 400, 'UNKNOWN_TOOL');
    }
  }

  /**
   * Fetches analysis run history with strict RBAC:
   * ADMIN sees organization analysis runs; STAFF sees only their own runs.
   */
  async getAnalysisHistory(user: AuthenticatedAiUser) {
    const where: any = {};
    if (user.role === 'STAFF') {
      where.user_id = user.id;
    }
    return prisma.aiAnalysisRun.findMany({
      where,
      orderBy: { started_at: 'desc' },
      take: 50,
      include: {
        evidence: {
          select: {
            id: true,
            entity_type: true,
            entity_id: true,
            evidence_type: true,
            explanation: true,
          },
        },
      },
    });
  }

  /**
   * Fetches a single analysis run by ID with strict ownership check.
   */
  async getAnalysisById(analysisId: string, user: AuthenticatedAiUser) {
    const run = await prisma.aiAnalysisRun.findUnique({
      where: { id: analysisId },
      include: {
        evidence: true,
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!run) {
      throw new AppError(`AI Analysis Run not found: ${analysisId}`, 404, 'NOT_FOUND');
    }

    if (user.role === 'STAFF' && run.user_id !== user.id) {
      throw new AppError('Forbidden: You cannot access another user’s AI analysis.', 403, 'FORBIDDEN_IDOR');
    }

    return run;
  }
}

export const aiOrchestratorService = new AiOrchestratorService();
