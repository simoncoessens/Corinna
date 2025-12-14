/**
 * Corinna API Service
 * Handles all communication with the backend
 */

import type {
  CompanyMatcherRequest,
  CompanyMatchResult,
  CompanyResearcherRequest,
  CompanyResearchResult,
  ServiceCategorizerRequest,
  ComplianceReport,
  MainAgentRequest,
  MainAgentResponse,
  HealthStatus,
  StreamEvent,
} from "@/types/api";

// =============================================================================
// Session Management
// =============================================================================

const SESSION_STORAGE_KEY = "corinna_session_id";

/**
 * Generate a new session ID (UUID v4).
 */
function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the current session ID, creating one if it doesn't exist.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") {
    return generateSessionId();
  }
  
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Start a new session (clears the current session ID).
 */
export function startNewSession(): string {
  const sessionId = generateSessionId();
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Clear the current session.
 */
export function clearSession(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

// =============================================================================
// Configuration
// =============================================================================

// Get API URL from environment variable (set at build time)
// - In development (npm run dev), ALWAYS default to local backend (ignores hosted env var)
// - In production, default to hosted backend but allow override via NEXT_PUBLIC_API_URL
const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL || "https://snip-tool-backend.onrender.com";

// Helpful debug log (visible in browser devtools console)
if (typeof window !== "undefined") {
   
  console.log("[SNIP] Using API base URL:", API_BASE_URL);
}

// =============================================================================
// Base Fetch Utilities
// =============================================================================

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API Error: ${response.status}`);
  }

  return response.json();
}

async function* streamApi(
  endpoint: string,
  body: unknown
): AsyncGenerator<StreamEvent> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API Error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data) as StreamEvent;
            yield event;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkHealth(): Promise<HealthStatus> {
  return fetchApi<HealthStatus>("/health");
}

// =============================================================================
// Company Matcher
// =============================================================================

export async function matchCompany(
  request: CompanyMatcherRequest
): Promise<CompanyMatchResult> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return fetchApi<CompanyMatchResult>("/agents/company_matcher", {
    method: "POST",
    body: JSON.stringify(requestWithSession),
  });
}

export function streamMatchCompany(
  request: CompanyMatcherRequest
): AsyncGenerator<StreamEvent> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return streamApi("/agents/company_matcher/stream", requestWithSession);
}

// =============================================================================
// Company Researcher
// =============================================================================

export async function researchCompany(
  request: CompanyResearcherRequest
): Promise<CompanyResearchResult> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return fetchApi<CompanyResearchResult>("/agents/company_researcher", {
    method: "POST",
    body: JSON.stringify(requestWithSession),
  });
}

export function streamResearchCompany(
  request: CompanyResearcherRequest
): AsyncGenerator<StreamEvent> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return streamApi("/agents/company_researcher/stream", requestWithSession);
}

// =============================================================================
// Service Categorizer
// =============================================================================

export async function categorizeService(
  request: ServiceCategorizerRequest
): Promise<ComplianceReport> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return fetchApi<ComplianceReport>("/agents/service_categorizer", {
    method: "POST",
    body: JSON.stringify(requestWithSession),
  });
}

export function streamCategorizeService(
  request: ServiceCategorizerRequest
): AsyncGenerator<StreamEvent> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return streamApi("/agents/service_categorizer/stream", requestWithSession);
}

// =============================================================================
// Main Agent (Chat)
// =============================================================================

export async function chatWithAgent(
  request: MainAgentRequest
): Promise<MainAgentResponse> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return fetchApi<MainAgentResponse>("/agents/main_agent", {
    method: "POST",
    body: JSON.stringify(requestWithSession),
  });
}

export function streamChatWithAgent(
  request: MainAgentRequest
): AsyncGenerator<StreamEvent> {
  const requestWithSession = { ...request, session_id: getSessionId() };
  return streamApi("/agents/main_agent/stream", requestWithSession);
}

// =============================================================================
// Export all as default object for convenience
// =============================================================================

const api = {
  // Session management
  getSessionId,
  startNewSession,
  clearSession,
  // API methods
  checkHealth,
  matchCompany,
  streamMatchCompany,
  researchCompany,
  streamResearchCompany,
  categorizeService,
  streamCategorizeService,
  chatWithAgent,
  streamChatWithAgent,
};

export default api;

