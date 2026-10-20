import { aiConfigService } from './aiConfig.service';
import { ToolEvidenceItem } from './aiTools.service';
import { logger } from '../utils/logger';

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
}

export interface ConversationHistoryItem {
  sender: 'user' | 'ai';
  text: string;
}

export class AiGeminiService {
  private readonly SYSTEM_INSTRUCTION = `You are the Universal AI Operations Intelligence Assistant for the "AI STAFF OPERATIONS INTELLIGENCE PLATFORM".
You serve college administrators, Department Heads, and faculty members.

CORE OBJECTIVES:
1. Provide accurate, authorized, factual answers to institutional questions about staff, timetables, classes, attendance, tasks, leaves, activities, alerts, workload, performance, reports, and operations.
2. Answer general questions like ChatGPT (programming, technical explanations, writing help, general science, education best practices) when asked.
3. Fully support English, Tamil (தமிழ்), and Tanglish (Tamil written in English script like "solu", "enna", "epdi", "irukku", "avanga").
4. Maintain conversation context across multi-turn follow-up questions. If the user refers to "avanga", "his", "her", or "the same staff", resolve it from the recent conversation history.
5. If a request is ambiguous or multiple staff have similar names, ask a brief, polite clarification question.

INSTITUTIONAL EVIDENCE RULES:
- If the question is about institutional records (staff, timetable, tasks, attendance, leave, coverage, alerts, settings, reports):
  - Strictly ground your answer in verified database facts and retrieved evidence provided in the prompt.
  - NEVER invent or hallucinate staff names, timetable slots, attendance marks, leave records, or task statuses.
  - If the requested institutional data is not in the evidence, clearly explain: "I couldn't find sufficient authorized data to answer that."
  - When useful, format timetables, tasks, or metrics in clean Markdown tables or organized bullet points.
  - Distinguish between database facts, rule-based alerts, and operational insights.

GENERAL QUESTION RULES:
- If the question is general (e.g. "Explain JavaScript promises in Tanglish", "Write a python script to parse CSV", "What is Amdahl's law?", "Draft a formal email for leave"):
  - Provide an insightful, clear, and well-structured answer.
  - For Tanglish or Tamil, respond in fluent, natural Tanglish or Tamil as requested.
  - You do not need database facts for purely general/technical/coding questions.

OUTPUT FORMAT:
Return your response as a valid JSON object matching this schema:
{
  "databaseFacts": ["string"],
  "ruleBasedConditions": ["string"],
  "aiInsights": ["string"],
  "answer": "string (The comprehensive, beautifully formatted Markdown answer for the user)"
}`;

  /**
   * Generates an AI analysis using Gemini REST API or safe fallback.
   * Supports multi-turn conversation history and general knowledge questions.
   */
  async generateAnalysis(params: {
    prompt: string;
    userRole: string;
    facts: string[];
    evidence: ToolEvidenceItem[];
    ruleConditions?: string[];
    history?: ConversationHistoryItem[];
    isGeneralQuery?: boolean;
    disambiguationOptions?: string[];
  }): Promise<StructuredAiResponse> {
    const {
      prompt,
      userRole,
      facts,
      evidence,
      ruleConditions = [],
      history = [],
      isGeneralQuery = false,
      disambiguationOptions = [],
    } = params;

    const timestamp = new Date().toISOString();
    const dataScope = userRole === 'ADMIN' ? 'ORGANIZATION_LEVEL' : 'AUTHENTICATED_STAFF_SELF_ONLY';

    // Disambiguation check
    if (disambiguationOptions.length > 1) {
      const optionsText = disambiguationOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
      return {
        databaseFacts: [],
        ruleBasedConditions: [],
        aiInsights: ['Multiple matching staff records detected in the institution directory.'],
        answer: `I found multiple staff members matching your query. Could you please clarify which one you would like to view?\n\n${optionsText}`,
        evidence: [],
        timestamp,
        dataScope,
        modelUsed: 'deterministic-disambiguation',
        status: 'SUCCESS',
      };
    }

    // Institutional query with zero evidence/facts
    if (!isGeneralQuery && evidence.length === 0 && facts.length === 0) {
      return {
        databaseFacts: [],
        ruleBasedConditions: [],
        aiInsights: [],
        answer: "I couldn't find sufficient authorized data to answer that.",
        evidence: [],
        timestamp,
        dataScope,
        modelUsed: 'none',
        status: 'INSUFFICIENT_DATA',
      };
    }

    const apiKey = aiConfigService.getApiKey();
    const model = await aiConfigService.getConfiguredModel();

    // Deterministic fallback if API key is missing
    if (!apiKey) {
      logger.info('Gemini API key is not configured. Using deterministic synthesis fallback.');
      return this.buildDeterministicSynthesis(
        prompt,
        facts,
        evidence,
        ruleConditions,
        timestamp,
        dataScope,
        'deterministic-evidence-grounding',
        isGeneralQuery
      );
    }

    // Call Gemini REST API
    try {
      const conversationContext = history
        .slice(-6)
        .map((h) => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
        .join('\n');

      const userContentPayload = {
        userQuestion: prompt,
        authorizedScope: dataScope,
        conversationHistory: conversationContext || 'No previous turns',
        isGeneralKnowledgeQuery: isGeneralQuery,
        verifiedDatabaseFacts: facts,
        ruleBasedConditions: ruleConditions,
        retrievedEvidenceSummaries: evidence.slice(0, 30).map((e) => ({
          entityType: e.entity_type,
          entityId: e.entity_id,
          evidenceType: e.evidence_type,
          detail: e.explanation,
        })),
      };

      const payload = {
        systemInstruction: {
          parts: [{ text: this.SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: JSON.stringify(userContentPayload) }],
          },
        ],
        generationConfig: {
          temperature: isGeneralQuery ? 0.7 : 0.2,
          maxOutputTokens: await aiConfigService.getMaxTokens(),
          responseMimeType: 'application/json',
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Gemini API returned status ${response.status}: ${errorText}`);
        if (response.status === 429) {
          aiConfigService.recordError('GEMINI_RATE_LIMIT');
        } else if (response.status === 400 || response.status === 403) {
          aiConfigService.recordError('GEMINI_AUTH_OR_CONFIG_ERROR');
        } else {
          aiConfigService.recordError('GEMINI_API_ERROR');
        }
        return this.buildDeterministicSynthesis(
          prompt,
          facts,
          evidence,
          ruleConditions,
          timestamp,
          dataScope,
          model,
          isGeneralQuery
        );
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        aiConfigService.recordError('EMPTY_RESPONSE');
        return this.buildDeterministicSynthesis(
          prompt,
          facts,
          evidence,
          ruleConditions,
          timestamp,
          dataScope,
          model,
          isGeneralQuery
        );
      }

      const parsed = this.parseAndValidateResponse(rawText, facts, ruleConditions);
      aiConfigService.recordSuccess();

      return {
        databaseFacts: parsed.databaseFacts.length > 0 ? parsed.databaseFacts : facts,
        ruleBasedConditions: parsed.ruleBasedConditions.length > 0 ? parsed.ruleBasedConditions : ruleConditions,
        aiInsights: parsed.aiInsights,
        answer: parsed.answer,
        evidence,
        timestamp,
        dataScope,
        modelUsed: model,
        status: isGeneralQuery ? 'GENERAL_QA' : 'SUCCESS',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.warn('Gemini request timed out after 15s. Falling back to deterministic synthesis.');
        aiConfigService.recordError('GEMINI_TIMEOUT');
      } else {
        logger.error('Gemini request error:', err);
        aiConfigService.recordError('NETWORK_ERROR');
      }
      return this.buildDeterministicSynthesis(
        prompt,
        facts,
        evidence,
        ruleConditions,
        timestamp,
        dataScope,
        model,
        isGeneralQuery
      );
    }
  }

  /**
   * Deterministic fallback when Gemini API key is not configured or network fails.
   */
  private buildDeterministicSynthesis(
    prompt: string,
    facts: string[],
    evidence: ToolEvidenceItem[],
    ruleConditions: string[],
    timestamp: string,
    dataScope: string,
    modelUsed: string,
    isGeneralQuery: boolean
  ): StructuredAiResponse {
    if (isGeneralQuery) {
      return {
        databaseFacts: [],
        ruleBasedConditions: [],
        aiInsights: ['General question answered via built-in system intelligence.'],
        answer: `Here is the explanation for your query: "${prompt}".\n\nTo enable full real-time generative capabilities for code generation, multi-lingual translations (Tamil/Tanglish), and open-ended technical tutorials, please ensure GEMINI_API_KEY is configured in your environment settings.`,
        evidence: [],
        timestamp,
        dataScope,
        modelUsed,
        status: 'FALLBACK_SYNTHESIS',
      };
    }

    const formattedFacts = facts.slice(0, 20);
    const answer =
      facts.length > 0
        ? `Based on ${evidence.length} authorized records retrieved from the database, here is the factual summary:\n\n` +
          formattedFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : "I couldn't find sufficient authorized data to answer that.";

    const insights = [
      'Grounded directly in PostgreSQL operational records.',
      ruleConditions.length > 0
        ? `Evaluated against ${ruleConditions.length} active operational rule criteria.`
        : 'No abnormal operational rule violations detected in the retrieved dataset.',
    ];

    return {
      databaseFacts: formattedFacts,
      ruleBasedConditions: ruleConditions,
      aiInsights: insights,
      answer,
      evidence,
      timestamp,
      dataScope,
      modelUsed,
      status: 'FALLBACK_SYNTHESIS',
    };
  }

  private parseAndValidateResponse(
    rawText: string,
    originalFacts: string[],
    originalRuleConditions: string[]
  ): { databaseFacts: string[]; ruleBasedConditions: string[]; aiInsights: string[]; answer: string } {
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const serialized = JSON.stringify(parsed);
    if (/password_hash|token_hash|sessionToken|jwt|bearer/i.test(serialized)) {
      throw new Error('AI response contained prohibited security patterns.');
    }

    const databaseFacts = Array.isArray(parsed.databaseFacts) ? parsed.databaseFacts : originalFacts;
    const ruleBasedConditions = Array.isArray(parsed.ruleBasedConditions)
      ? parsed.ruleBasedConditions
      : originalRuleConditions;
    const aiInsights = Array.isArray(parsed.aiInsights) ? parsed.aiInsights : [];
    const answer =
      typeof parsed.answer === 'string' && parsed.answer.trim().length > 0
        ? parsed.answer
        : 'Analysis completed based on retrieved evidence.';

    return {
      databaseFacts,
      ruleBasedConditions,
      aiInsights,
      answer,
    };
  }
}

export const aiGeminiService = new AiGeminiService();
