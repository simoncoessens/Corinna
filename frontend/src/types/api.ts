/**
 * Corinna API Types
 * Type definitions for backend API integration
 */

// =============================================================================
// Company Matcher Types
// =============================================================================

export interface CompanyMatcherRequest {
  company_name: string;
  country_of_establishment: string;
}

export interface CompanyMatch {
  name: string;
  top_domain: string;
  confidence: "exact" | "high" | "medium" | "low" | string;
  summary_short?: string | null;
  summary_long: string;
}

export interface CompanyMatchResult {
  input_name: string;
  exact_match: CompanyMatch | null;
  suggestions: CompanyMatch[];
}

// =============================================================================
// Company Researcher Types
// =============================================================================

export interface CompanyResearcherRequest {
  company_name: string;
  top_domain: string;
  summary_long: string;
}

export interface SubQuestionAnswer {
  section: string;
  question: string;
  answer: string;
  /**
   * Explicit flag for when no relevant public information was found.
   * Optional for backward compatibility with older responses.
   */
  information_found?: boolean;
  source: string;
  confidence: "High" | "Medium" | "Low";
  raw_research?: string;
}

export interface CompanyResearchResult {
  company_name: string;
  answers: SubQuestionAnswer[];
}

// =============================================================================
// Service Categorizer Types
// =============================================================================

export interface ServiceCategorizerRequest {
  company_profile: CompanyProfile;
  top_domain?: string | null;
  summary_long?: string | null;
}

export interface CompanyProfile {
  company_name: string;
  description?: string;
  services?: string[];
  monthly_active_users_eu?: number;
  monetization_model?: string[];
  has_recommendation_system?: boolean;
  allows_user_content?: boolean;
  allows_transactions?: boolean;
  // Research answers structured by section
  research_answers?: {
    geographical_scope?: ResearchAnswer[];
    company_size?: ResearchAnswer[];
    service_type?: ResearchAnswer[];
  };
  [key: string]: unknown;
}

export interface ResearchAnswer {
  question: string;
  answer: string;
  source: string;
  confidence: "High" | "Medium" | "Low";
}

export interface TerritorialScope {
  is_in_scope: boolean;
  reasoning: string;
}

export interface ServiceClassification {
  is_intermediary: boolean;
  service_category:
    | "Mere Conduit"
    | "Caching"
    | "Hosting"
    | "Online Platform"
    | "Not Applicable";
  is_online_platform: boolean;
  is_marketplace: boolean;
  is_search_engine: boolean;
  platform_reasoning?: string;
}

export interface SizeDesignation {
  is_vlop_vlose: boolean;
  qualifies_for_sme_exemption?: boolean;
  reasoning?: string;
}

export interface Classification {
  territorial_scope: TerritorialScope;
  service_classification: ServiceClassification;
  size_designation: SizeDesignation;
  summary: string;
}

export interface ObligationAnalysis {
  article: string;
  title: string;
  applies: boolean;
  implications: string;
  action_items: string[];
}

export interface ComplianceReport {
  company_name: string;
  classification: Classification;
  obligations: ObligationAnalysis[];
  summary: string;
}

// =============================================================================
// Main Agent Types
// =============================================================================

export interface MainAgentRequest {
  message: string;
  frontend_context?: string;
}

export interface MainAgentResponse {
  response: string;
}

// =============================================================================
// Streaming Event Types
// =============================================================================

export type StreamEventType =
  | "token"
  | "llm_start"
  | "tool_start"
  | "tool_end"
  | "node_start"
  | "node_end"
  | "result"
  | "error"
  | "done";

export interface BaseStreamEvent {
  type: StreamEventType;
}

export interface TokenEvent extends BaseStreamEvent {
  type: "token";
  content: string;
  node: string;
  agent: string;
}

export interface LLMStartEvent extends BaseStreamEvent {
  type: "llm_start";
  node: string;
  agent: string;
}

export interface ToolStartEvent extends BaseStreamEvent {
  type: "tool_start";
  name: string;
  node: string;
  input: string;
}

export interface SearchSource {
  title?: string;
  url: string;
}

export interface ToolEndEvent extends BaseStreamEvent {
  type: "tool_end";
  name: string;
  node: string;
  output_length: number;
  sources?: SearchSource[];
}

export interface NodeStartEvent extends BaseStreamEvent {
  type: "node_start";
  node: string;
  chain: string;
}

export interface NodeEndEvent extends BaseStreamEvent {
  type: "node_end";
  node: string;
  chain: string;
}

export interface ResultEvent<T = unknown> extends BaseStreamEvent {
  type: "result";
  data: T;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: "error";
  message: string;
}

export interface DoneEvent extends BaseStreamEvent {
  type: "done";
}

export type StreamEvent =
  | TokenEvent
  | LLMStartEvent
  | ToolStartEvent
  | ToolEndEvent
  | NodeStartEvent
  | NodeEndEvent
  | ResultEvent
  | ErrorEvent
  | DoneEvent;

// =============================================================================
// Health Check
// =============================================================================

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  agents: {
    company_matcher: boolean;
    company_researcher: boolean;
    service_categorizer: boolean;
    main_agent: boolean;
  };
}

// =============================================================================
// DSA Article Reference Types
// =============================================================================

export interface DSAArticle {
  number: number;
  title: string;
  chapter: string;
  section?: string;
  applies_to: ServiceTier[];
}

export type ServiceTier =
  | "intermediary"
  | "hosting"
  | "platform"
  | "marketplace"
  | "vlop";

export interface ComplianceStatus {
  article: DSAArticle;
  status: "compliant" | "non_compliant" | "requires_review" | "not_applicable";
  notes?: string;
}

