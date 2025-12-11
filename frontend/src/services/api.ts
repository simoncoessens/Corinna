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
  // eslint-disable-next-line no-console
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
  return fetchApi<CompanyMatchResult>("/agents/company_matcher", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function streamMatchCompany(
  request: CompanyMatcherRequest
): AsyncGenerator<StreamEvent> {
  return streamApi("/agents/company_matcher/stream", request);
}

// =============================================================================
// Company Researcher
// =============================================================================

export async function researchCompany(
  request: CompanyResearcherRequest
): Promise<CompanyResearchResult> {
  return fetchApi<CompanyResearchResult>("/agents/company_researcher", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function streamResearchCompany(
  request: CompanyResearcherRequest
): AsyncGenerator<StreamEvent> {
  return streamApi("/agents/company_researcher/stream", request);
}

// =============================================================================
// Service Categorizer
// =============================================================================

export async function categorizeService(
  request: ServiceCategorizerRequest
): Promise<ComplianceReport> {
  return fetchApi<ComplianceReport>("/agents/service_categorizer", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function streamCategorizeService(
  request: ServiceCategorizerRequest
): AsyncGenerator<StreamEvent> {
  return streamApi("/agents/service_categorizer/stream", request);
}

// =============================================================================
// Main Agent (Chat)
// =============================================================================

export async function chatWithAgent(
  request: MainAgentRequest
): Promise<MainAgentResponse> {
  return fetchApi<MainAgentResponse>("/agents/main_agent", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function streamChatWithAgent(
  request: MainAgentRequest
): AsyncGenerator<StreamEvent> {
  return streamApi("/agents/main_agent/stream", request);
}

// =============================================================================
// Export all as default object for convenience
// =============================================================================

const api = {
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

