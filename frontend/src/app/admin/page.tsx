"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  BarChart3,
  Users,
  Clock,
  AlertTriangle,
  Search,
  ChevronRight,
  Download,
  Trash2,
  RefreshCw,
  Building2,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Filter,
  Calendar,
  DollarSign,
  Zap,
  MessageSquare,
  FileText,
  Globe,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://snip-tool-backend.onrender.com";

// =============================================================================
// Types
// =============================================================================

interface DashboardStats {
  period_days: number;
  total_sessions: number;
  completed_sessions: number;
  error_count: number;
  error_rate_percent: number;
  avg_duration_seconds: number;
  total_llm_calls: number;
  total_search_calls: number;
  estimated_cost_usd: number;
  sessions_per_day: { date: string; count: number }[];
  top_companies: { name: string; count: number }[];
  category_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
}

interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  status: string;
  company_name: string | null;
  company_domain: string | null;
  country: string | null;
  is_manual_entry: boolean;
  service_category: string | null;
  is_in_scope: boolean | null;
  is_vlop: boolean | null;
  applicable_obligations_count: number | null;
  total_obligations_count: number | null;
  total_duration_seconds: number | null;
  total_llm_calls: number;
  total_search_calls: number;
  estimated_cost_usd: number;
  error_message: string | null;
  steps_count: number;
  chat_messages_count: number;
}

interface SessionDetail extends Session {
  research_summary: Record<string, unknown> | null;
  compliance_report: Record<string, unknown> | null;
  steps: SessionStep[];
  chat_messages: ChatMessage[];
}

interface SessionStep {
  id: string;
  session_id: string;
  created_at: string;
  completed_at: string | null;
  step_type: string;
  status: string;
  request_data: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  duration_seconds: number | null;
  llm_calls: number;
  search_calls: number;
  sources_found: { url: string; title?: string }[] | null;
  error_message: string | null;
}

interface ChatMessage {
  id: string;
  session_id: string;
  created_at: string;
  role: string;
  content: string;
  frontend_context: string | null;
  context_mode: string | null;
  duration_seconds: number | null;
  tools_used: string[] | null;
  sources_cited: { url: string; title?: string }[] | null;
}

// =============================================================================
// Auth Hook
// =============================================================================

function useAdminAuth() {
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for saved credentials
    const saved = localStorage.getItem("admin_credentials");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCredentials(parsed);
        // Verify credentials
        verifyCredentials(parsed).then((valid) => {
          setIsAuthenticated(valid);
          setIsLoading(false);
        });
      } catch {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyCredentials = async (creds: {
    username: string;
    password: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/stats?days=1`, {
        headers: {
          Authorization: `Basic ${btoa(`${creds.username}:${creds.password}`)}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    const creds = { username, password };
    const valid = await verifyCredentials(creds);
    if (valid) {
      setCredentials(creds);
      setIsAuthenticated(true);
      localStorage.setItem("admin_credentials", JSON.stringify(creds));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCredentials(null);
    setIsAuthenticated(false);
    localStorage.removeItem("admin_credentials");
  }, []);

  // Memoize authHeader as an object that only changes when credentials change
  const authHeader = useMemo((): Record<string, string> => {
    if (!credentials) return {};
    return {
      Authorization: `Basic ${btoa(
        `${credentials.username}:${credentials.password}`
      )}`,
    };
  }, [credentials]);

  return { isAuthenticated, isLoading, login, logout, authHeader };
}

// =============================================================================
// Login Form
// =============================================================================

function LoginForm({
  onLogin,
}: {
  onLogin: (u: string, p: string) => Promise<boolean>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const success = await onLogin(username, password);
    if (!success) {
      setError("Invalid credentials");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white border border-[#e7e5e4] p-8">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl text-[#0a0a0a] mb-2">
              Corinna Admin
            </h1>
            <p className="font-sans text-sm text-[#78716c]">
              Sign in to access the analytics dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#78716c] mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 px-4 bg-[#fafaf9] border border-[#e7e5e4] font-sans text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#78716c] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 bg-[#fafaf9] border border-[#e7e5e4] font-sans text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors"
                required
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0a0a0a] text-white font-sans text-sm hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="font-sans text-sm text-[#78716c] hover:text-[#0a0a0a]"
            >
              ← Back to Corinna
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// Stats Card
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  color?: "default" | "success" | "warning" | "error";
}) {
  const colors = {
    default: "bg-[#f5f5f4]",
    success: "bg-emerald-50",
    warning: "bg-amber-50",
    error: "bg-red-50",
  };
  const iconColors = {
    default: "text-[#78716c]",
    success: "text-emerald-600",
    warning: "text-amber-600",
    error: "text-red-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-[#e7e5e4] p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "w-10 h-10 flex items-center justify-center",
            colors[color]
          )}
        >
          <Icon className={cn("w-5 h-5", iconColors[color])} />
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-mono",
              trend.value >= 0 ? "text-emerald-600" : "text-red-600"
            )}
          >
            <TrendingUp
              className={cn("w-3 h-3", trend.value < 0 && "rotate-180")}
            />
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="font-mono text-2xl font-medium text-[#0a0a0a] mb-1">
        {value}
      </div>
      <div className="font-mono text-xs uppercase tracking-wider text-[#78716c]">
        {title}
      </div>
      {subtitle && (
        <div className="font-sans text-xs text-[#a8a29e] mt-1">{subtitle}</div>
      )}
    </motion.div>
  );
}

// =============================================================================
// Session Row
// =============================================================================

function SessionRow({
  session,
  onClick,
  onExportPdf,
}: {
  session: Session;
  onClick: () => void;
  onExportPdf: () => void;
}) {
  const statusColors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    error: "bg-red-100 text-red-700",
    started: "bg-blue-100 text-blue-700",
    researching: "bg-amber-100 text-amber-700",
    classifying: "bg-purple-100 text-purple-700",
    abandoned: "bg-gray-100 text-gray-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-[#e7e5e4] hover:bg-[#fafaf9] transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Company */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#78716c] shrink-0" />
            <span className="font-sans text-sm text-[#0a0a0a] truncate">
              {session.company_name || "Unknown Company"}
            </span>
          </div>
          {session.company_domain && (
            <div className="flex items-center gap-2 mt-1">
              <Globe className="w-3 h-3 text-[#a8a29e] shrink-0" />
              <span className="font-mono text-xs text-[#a8a29e] truncate">
                {session.company_domain}
              </span>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="shrink-0">
          <span
            className={cn(
              "inline-flex items-center px-2 py-1 text-xs font-mono uppercase tracking-wider",
              statusColors[session.status] || "bg-gray-100 text-gray-600"
            )}
          >
            {session.status}
          </span>
        </div>

        {/* Category */}
        <div className="w-32 shrink-0 hidden md:block">
          {session.service_category ? (
            <span className="font-sans text-xs text-[#78716c]">
              {session.service_category}
            </span>
          ) : (
            <span className="font-sans text-xs text-[#a8a29e]">—</span>
          )}
        </div>

        {/* Duration */}
        <div className="w-20 shrink-0 hidden lg:block text-right">
          {session.total_duration_seconds ? (
            <span className="font-mono text-xs text-[#78716c]">
              {Math.round(session.total_duration_seconds)}s
            </span>
          ) : (
            <span className="font-mono text-xs text-[#a8a29e]">—</span>
          )}
        </div>

        {/* Date */}
        <div className="w-28 shrink-0 text-right">
          <span className="font-mono text-xs text-[#78716c]">
            {new Date(session.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {session.status === "completed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExportPdf();
              }}
              className="p-2 hover:bg-[#e7e5e4] transition-colors"
              title="Export PDF"
            >
              <Download className="w-4 h-4 text-[#78716c]" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-[#a8a29e]" />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Session Detail Panel
// =============================================================================

function SessionDetailPanel({
  session,
  onClose,
  onExportPdf,
  onDelete,
}: {
  session: SessionDetail;
  onClose: () => void;
  onExportPdf: () => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "company_matcher"
    | "company_researcher"
    | "service_categorizer"
    | "chat"
    | "research"
    | "compliance"
  >("overview");

  // Group steps by type
  const companyMatcherSteps =
    session.steps?.filter((s) => s.step_type === "company_matcher") || [];
  const companyResearcherSteps =
    session.steps?.filter((s) => s.step_type === "company_researcher") || [];
  const serviceCategorizerSteps =
    session.steps?.filter((s) => s.step_type === "service_categorizer") || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-[#e7e5e4] bg-[#fafaf9]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-[#78716c] hover:text-[#0a0a0a] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-sans text-sm">Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onExportPdf}
                className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] text-white text-sm hover:bg-[#1a1a1a] transition-colors"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
          <div>
            <h1 className="font-serif text-3xl text-[#0a0a0a] mb-2">
              {session.company_name || "Unknown Company"}
            </h1>
            <div className="flex items-center gap-4 text-sm text-[#78716c]">
              <span className="font-mono">Session ID: {session.id}</span>
              <span>•</span>
              <span>
                Started: {new Date(session.created_at).toLocaleString()}
              </span>
              {session.completed_at && (
                <>
                  <span>•</span>
                  <span>
                    Completed: {new Date(session.completed_at).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-[#e7e5e4] bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-1 overflow-x-auto">
            {(
              [
                { key: "overview", label: "Overview" },
                {
                  key: "company_matcher",
                  label: `Company Matcher (${companyMatcherSteps.length})`,
                },
                {
                  key: "company_researcher",
                  label: `Company Researcher (${companyResearcherSteps.length})`,
                },
                {
                  key: "service_categorizer",
                  label: `Service Categorizer (${serviceCategorizerSteps.length})`,
                },
                {
                  key: "chat",
                  label: `Chat History (${session.chat_messages?.length || 0})`,
                },
                { key: "research", label: "Research Summary" },
                { key: "compliance", label: "Compliance Report" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors whitespace-nowrap border-b-2",
                  activeTab === key
                    ? "text-[#0a0a0a] border-[#0a0a0a]"
                    : "text-[#78716c] border-transparent hover:text-[#0a0a0a] hover:border-[#a8a29e]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#fafaf9] p-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-1">
                    Status
                  </div>
                  <div className="font-sans text-sm text-[#0a0a0a] capitalize">
                    {session.status}
                  </div>
                </div>
                <div className="bg-[#fafaf9] p-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-1">
                    Duration
                  </div>
                  <div className="font-sans text-sm text-[#0a0a0a]">
                    {session.total_duration_seconds
                      ? `${Math.round(session.total_duration_seconds)}s`
                      : "—"}
                  </div>
                </div>
                <div className="bg-[#fafaf9] p-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-1">
                    Service Category
                  </div>
                  <div className="font-sans text-sm text-[#0a0a0a]">
                    {session.service_category || "Not classified"}
                  </div>
                </div>
                <div className="bg-[#fafaf9] p-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-1">
                    Obligations
                  </div>
                  <div className="font-sans text-sm text-[#0a0a0a]">
                    {session.applicable_obligations_count ?? 0} /{" "}
                    {session.total_obligations_count ?? 0}
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                  Usage Metrics
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#fafaf9] p-4 text-center">
                    <div className="font-mono text-xl font-medium text-[#0a0a0a]">
                      {session.total_llm_calls}
                    </div>
                    <div className="font-mono text-xs text-[#78716c]">
                      LLM Calls
                    </div>
                  </div>
                  <div className="bg-[#fafaf9] p-4 text-center">
                    <div className="font-mono text-xl font-medium text-[#0a0a0a]">
                      {session.total_search_calls}
                    </div>
                    <div className="font-mono text-xs text-[#78716c]">
                      Searches
                    </div>
                  </div>
                  <div className="bg-[#fafaf9] p-4 text-center">
                    <div className="font-mono text-xl font-medium text-[#0a0a0a]">
                      ${session.estimated_cost_usd?.toFixed(3) || "0.000"}
                    </div>
                    <div className="font-mono text-xs text-[#78716c]">
                      Est. Cost
                    </div>
                  </div>
                </div>
              </div>

              {/* Error */}
              {session.error_message && (
                <div className="bg-red-50 border border-red-200 p-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-red-700 mb-2">
                    Error
                  </div>
                  <div className="font-mono text-sm text-red-800">
                    {session.error_message}
                  </div>
                </div>
              )}

              {/* Compliance Report Summary */}
              {session.compliance_report && (
                <div>
                  <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                    Compliance Summary
                  </h3>
                  <div className="bg-[#fafaf9] p-4">
                    <p className="font-sans text-sm text-[#0a0a0a] line-clamp-4">
                      {(session.compliance_report as { summary?: string })
                        .summary || "No summary available"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Company Matcher Tab */}
          {activeTab === "company_matcher" && (
            <div className="space-y-6">
              {companyMatcherSteps.length === 0 ? (
                <div className="text-center py-12 text-[#78716c]">
                  No company matcher steps recorded
                </div>
              ) : (
                companyMatcherSteps.map((step, i) => (
                  <div
                    key={step.id}
                    className="border border-[#e7e5e4] bg-white"
                  >
                    <div className="p-6 border-b border-[#e7e5e4] bg-[#fafaf9]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm bg-[#0a0a0a] text-white px-3 py-1">
                            Step {i + 1}
                          </span>
                          <span className="font-mono text-lg text-[#0a0a0a]">
                            Company Matcher
                          </span>
                        </div>
                        <span
                          className={cn(
                            "font-mono text-xs px-3 py-1",
                            step.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : step.status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {step.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            Started:
                          </span>{" "}
                          <span className="font-sans">
                            {new Date(step.created_at).toLocaleString()}
                          </span>
                        </div>
                        {step.completed_at && (
                          <div>
                            <span className="font-mono text-xs text-[#78716c]">
                              Completed:
                            </span>{" "}
                            <span className="font-sans">
                              {new Date(step.completed_at).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            Duration:
                          </span>{" "}
                          <span className="font-sans">
                            {step.duration_seconds?.toFixed(1) || "—"}s
                          </span>
                        </div>
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            LLM Calls:
                          </span>{" "}
                          <span className="font-sans">{step.llm_calls}</span>
                          {" • "}
                          <span className="font-mono text-xs text-[#78716c]">
                            Searches:
                          </span>{" "}
                          <span className="font-sans">{step.search_calls}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Request Data */}
                      {step.request_data && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Request
                          </h3>
                          <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                            <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(step.request_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Response Data */}
                      {step.response_data && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Response
                          </h3>
                          <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                            <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(step.response_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Sources Found */}
                      {step.sources_found && step.sources_found.length > 0 && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Sources Found ({step.sources_found.length})
                          </h3>
                          <div className="space-y-2">
                            {step.sources_found.map((source, j) => (
                              <a
                                key={j}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-[#fafaf9] border border-[#e7e5e4] hover:bg-[#f5f5f4] transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <Globe className="w-4 h-4 text-[#78716c] shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    {source.title && (
                                      <div className="font-sans text-sm font-medium text-[#0a0a0a] mb-1">
                                        {source.title}
                                      </div>
                                    )}
                                    <div className="font-mono text-xs text-[#78716c] break-all">
                                      {source.url}
                                    </div>
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-[#78716c] shrink-0" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {step.error_message && (
                        <div className="bg-red-50 border border-red-200 p-4">
                          <div className="font-mono text-xs uppercase tracking-wider text-red-700 mb-2">
                            Error
                          </div>
                          <div className="font-mono text-sm text-red-800">
                            {step.error_message}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Company Researcher Tab */}
          {activeTab === "company_researcher" && (
            <div className="space-y-6">
              {companyResearcherSteps.length === 0 ? (
                <div className="text-center py-12 text-[#78716c]">
                  No company researcher steps recorded
                </div>
              ) : (
                companyResearcherSteps.map((step, i) => (
                  <div
                    key={step.id}
                    className="border border-[#e7e5e4] bg-white"
                  >
                    <div className="p-6 border-b border-[#e7e5e4] bg-[#fafaf9]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm bg-[#0a0a0a] text-white px-3 py-1">
                            Step {i + 1}
                          </span>
                          <span className="font-mono text-lg text-[#0a0a0a]">
                            Company Researcher
                          </span>
                        </div>
                        <span
                          className={cn(
                            "font-mono text-xs px-3 py-1",
                            step.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : step.status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {step.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            Started:
                          </span>{" "}
                          <span className="font-sans">
                            {new Date(step.created_at).toLocaleString()}
                          </span>
                        </div>
                        {step.completed_at && (
                          <div>
                            <span className="font-mono text-xs text-[#78716c]">
                              Completed:
                            </span>{" "}
                            <span className="font-sans">
                              {new Date(step.completed_at).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            Duration:
                          </span>{" "}
                          <span className="font-sans">
                            {step.duration_seconds?.toFixed(1) || "—"}s
                          </span>
                        </div>
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            LLM Calls:
                          </span>{" "}
                          <span className="font-sans">{step.llm_calls}</span>
                          {" • "}
                          <span className="font-mono text-xs text-[#78716c]">
                            Searches:
                          </span>{" "}
                          <span className="font-sans">{step.search_calls}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Request Data */}
                      {step.request_data && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Request
                          </h3>
                          <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                            <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(step.request_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Response Data */}
                      {step.response_data && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Research Results
                          </h3>
                          <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                            <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(step.response_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Sources Found */}
                      {step.sources_found && step.sources_found.length > 0 && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Sources Found ({step.sources_found.length})
                          </h3>
                          <div className="space-y-2">
                            {step.sources_found.map((source, j) => (
                              <a
                                key={j}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-[#fafaf9] border border-[#e7e5e4] hover:bg-[#f5f5f4] transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <Globe className="w-4 h-4 text-[#78716c] shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    {source.title && (
                                      <div className="font-sans text-sm font-medium text-[#0a0a0a] mb-1">
                                        {source.title}
                                      </div>
                                    )}
                                    <div className="font-mono text-xs text-[#78716c] break-all">
                                      {source.url}
                                    </div>
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-[#78716c] shrink-0" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {step.error_message && (
                        <div className="bg-red-50 border border-red-200 p-4">
                          <div className="font-mono text-xs uppercase tracking-wider text-red-700 mb-2">
                            Error
                          </div>
                          <div className="font-mono text-sm text-red-800">
                            {step.error_message}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Service Categorizer Tab */}
          {activeTab === "service_categorizer" && (
            <div className="space-y-6">
              {serviceCategorizerSteps.length === 0 ? (
                <div className="text-center py-12 text-[#78716c]">
                  No service categorizer steps recorded
                </div>
              ) : (
                serviceCategorizerSteps.map((step, i) => (
                  <div
                    key={step.id}
                    className="border border-[#e7e5e4] bg-white"
                  >
                    <div className="p-6 border-b border-[#e7e5e4] bg-[#fafaf9]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm bg-[#0a0a0a] text-white px-3 py-1">
                            Step {i + 1}
                          </span>
                          <span className="font-mono text-lg text-[#0a0a0a]">
                            Service Categorizer
                          </span>
                        </div>
                        <span
                          className={cn(
                            "font-mono text-xs px-3 py-1",
                            step.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : step.status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {step.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            Started:
                          </span>{" "}
                          <span className="font-sans">
                            {new Date(step.created_at).toLocaleString()}
                          </span>
                        </div>
                        {step.completed_at && (
                          <div>
                            <span className="font-mono text-xs text-[#78716c]">
                              Completed:
                            </span>{" "}
                            <span className="font-sans">
                              {new Date(step.completed_at).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            Duration:
                          </span>{" "}
                          <span className="font-sans">
                            {step.duration_seconds?.toFixed(1) || "—"}s
                          </span>
                        </div>
                        <div>
                          <span className="font-mono text-xs text-[#78716c]">
                            LLM Calls:
                          </span>{" "}
                          <span className="font-sans">{step.llm_calls}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Request Data */}
                      {step.request_data && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Company Profile (Input)
                          </h3>
                          <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                            <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(step.request_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Response Data */}
                      {step.response_data && (
                        <div>
                          <h3 className="font-mono text-xs uppercase tracking-wider text-[#78716c] mb-3">
                            Classification & Compliance Report
                          </h3>
                          <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                            <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(step.response_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {step.error_message && (
                        <div className="bg-red-50 border border-red-200 p-4">
                          <div className="font-mono text-xs uppercase tracking-wider text-red-700 mb-2">
                            Error
                          </div>
                          <div className="font-mono text-sm text-red-800">
                            {step.error_message}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chat History Tab */}
          {activeTab === "chat" && (
            <div className="space-y-6">
              {session.chat_messages?.length === 0 ? (
                <div className="text-center py-12 text-[#78716c]">
                  No chat messages recorded
                </div>
              ) : (
                session.chat_messages?.map((msg, i) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "border border-[#e7e5e4]",
                      msg.role === "user"
                        ? "bg-[#0a0a0a] text-white"
                        : "bg-white"
                    )}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm bg-white/10 px-3 py-1">
                            {i + 1}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-sm uppercase tracking-wider",
                              msg.role === "user"
                                ? "text-white/80"
                                : "text-[#78716c]"
                            )}
                          >
                            {msg.role}
                          </span>
                          {msg.context_mode && (
                            <span className="font-mono text-xs text-white/60 bg-white/10 px-2 py-1">
                              {msg.context_mode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span
                            className={cn(
                              "font-mono",
                              msg.role === "user"
                                ? "text-white/60"
                                : "text-[#a8a29e]"
                            )}
                          >
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                          {msg.duration_seconds && (
                            <span
                              className={cn(
                                "font-mono",
                                msg.role === "user"
                                  ? "text-white/60"
                                  : "text-[#a8a29e]"
                              )}
                            >
                              {msg.duration_seconds.toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Message Content */}
                      <div
                        className={cn(
                          "font-sans text-sm whitespace-pre-wrap mb-4",
                          msg.role === "user" ? "text-white" : "text-[#0a0a0a]"
                        )}
                      >
                        {msg.content}
                      </div>

                      {/* Frontend Context */}
                      {msg.frontend_context && (
                        <div className="mb-4 p-3 bg-white/10 border border-white/20">
                          <div className="font-mono text-xs uppercase tracking-wider text-white/60 mb-2">
                            Frontend Context
                          </div>
                          <pre className="font-mono text-xs text-white/80 whitespace-pre-wrap overflow-x-auto">
                            {msg.frontend_context}
                          </pre>
                        </div>
                      )}

                      {/* Tools Used */}
                      {msg.tools_used && msg.tools_used.length > 0 && (
                        <div className="mb-4">
                          <div className="font-mono text-xs uppercase tracking-wider text-white/60 mb-2">
                            Tools Used
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {msg.tools_used.map((tool, j) => (
                              <span
                                key={j}
                                className="font-mono text-xs bg-white/20 px-2 py-1"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sources Cited */}
                      {msg.sources_cited && msg.sources_cited.length > 0 && (
                        <div>
                          <div className="font-mono text-xs uppercase tracking-wider text-white/60 mb-2">
                            Sources Cited ({msg.sources_cited.length})
                          </div>
                          <div className="space-y-2">
                            {msg.sources_cited.map((source, j) => (
                              <a
                                key={j}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-2 bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <Globe className="w-3 h-3 text-white/60 shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    {source.title && (
                                      <div className="font-sans text-xs font-medium text-white mb-1">
                                        {source.title}
                                      </div>
                                    )}
                                    <div className="font-mono text-xs text-white/60 break-all">
                                      {source.url}
                                    </div>
                                  </div>
                                  <ExternalLink className="w-3 h-3 text-white/60 shrink-0" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Research Summary Tab */}
          {activeTab === "research" && (
            <div className="space-y-6">
              {session.research_summary ? (
                <div className="border border-[#e7e5e4] bg-white">
                  <div className="p-6 border-b border-[#e7e5e4] bg-[#fafaf9]">
                    <h2 className="font-mono text-lg text-[#0a0a0a]">
                      Research Summary
                    </h2>
                    <p className="font-mono text-xs text-[#78716c] mt-1">
                      Complete research data collected during company research
                      phase
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                      <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(session.research_summary, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-[#78716c]">
                  No research summary available
                </div>
              )}
            </div>
          )}

          {/* Compliance Report Tab */}
          {activeTab === "compliance" && (
            <div className="space-y-6">
              {session.compliance_report ? (
                <div className="border border-[#e7e5e4] bg-white">
                  <div className="p-6 border-b border-[#e7e5e4] bg-[#fafaf9]">
                    <h2 className="font-mono text-lg text-[#0a0a0a]">
                      Compliance Report
                    </h2>
                    <p className="font-mono text-xs text-[#78716c] mt-1">
                      Complete compliance analysis and obligations assessment
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="bg-[#fafaf9] p-4 border border-[#e7e5e4]">
                      <pre className="font-mono text-sm text-[#0a0a0a] whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(session.compliance_report, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-[#78716c]">
                  No compliance report available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Dashboard
// =============================================================================

export default function AdminDashboard() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    login,
    logout,
    authHeader,
  } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [daysFilter, setDaysFilter] = useState(7);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/stats?days=${daysFilter}`,
        {
          headers: authHeader,
        }
      );
      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error("Authentication failed. Please login again.");
        }
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Failed to fetch stats: ${response.status} ${errorText}`
        );
      }
      const data = await response.json();
      setStats(data);
      setError(null); // Clear error on success
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch stats";
      // Only show network errors, not auth errors (auth errors trigger logout)
      if (!errorMsg.includes("Authentication failed")) {
        if (err instanceof TypeError && err.message.includes("fetch")) {
          setError(
            `Cannot connect to backend at ${API_BASE_URL}. Is the server running?`
          );
        } else {
          setError(errorMsg);
        }
      }
    }
  }, [daysFilter, authHeader, logout]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
        days: String(daysFilter),
      });
      if (statusFilter) params.append("status", statusFilter);
      if (searchQuery) params.append("company", searchQuery);

      const response = await fetch(`${API_BASE_URL}/admin/sessions?${params}`, {
        headers: authHeader,
      });
      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error("Authentication failed. Please login again.");
        }
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Failed to fetch sessions: ${response.status} ${errorText}`
        );
      }
      const data = await response.json();
      setSessions(data.sessions);
      setTotalPages(data.total_pages);
      setError(null); // Clear error on success
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      // Only show network errors, not auth errors
      if (!errorMsg.includes("Authentication failed")) {
        if (err instanceof TypeError && err.message.includes("fetch")) {
          setError(
            `Cannot connect to backend at ${API_BASE_URL}. Is the server running?`
          );
        } else {
          setError(errorMsg);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [page, daysFilter, statusFilter, searchQuery, authHeader, logout]);

  const fetchSessionDetail = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/admin/sessions/${sessionId}`,
          {
            headers: authHeader,
          }
        );
        if (!response.ok) {
          if (response.status === 401) {
            logout();
            throw new Error("Authentication failed. Please login again.");
          }
          throw new Error("Failed to fetch session");
        }
        const data = await response.json();
        setSelectedSession(data);
      } catch (err) {
        console.error("Failed to fetch session detail:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch session"
        );
      }
    },
    [authHeader, logout]
  );

  const exportPdf = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/admin/sessions/${sessionId}/export/pdf`,
          {
            headers: authHeader,
          }
        );
        if (!response.ok) {
          if (response.status === 401) {
            logout();
            throw new Error("Authentication failed. Please login again.");
          }
          throw new Error("Failed to export PDF");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session_${sessionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Failed to export PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to export PDF");
      }
    },
    [authHeader, logout]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!confirm("Are you sure you want to delete this session?")) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/admin/sessions/${sessionId}`,
          {
            method: "DELETE",
            headers: authHeader,
          }
        );
        if (!response.ok) {
          if (response.status === 401) {
            logout();
            throw new Error("Authentication failed. Please login again.");
          }
          throw new Error("Failed to delete session");
        }
        setSelectedSession(null);
        fetchSessions();
      } catch (err) {
        console.error("Failed to delete session:", err);
        setError(
          err instanceof Error ? err.message : "Failed to delete session"
        );
      }
    },
    [authHeader, logout, fetchSessions]
  );

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Refetch sessions when filters change (debounced)
  useEffect(() => {
    if (!isAuthenticated) return;

    const timeoutId = setTimeout(() => {
      fetchSessions();
    }, 300); // Debounce search queries

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, daysFilter, statusFilter, searchQuery, isAuthenticated]);

  // Refetch stats when days filter changes
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysFilter, isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#78716c]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  return (
    <div className="h-screen bg-[#fafaf9] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-[#e7e5e4] px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-serif text-2xl text-[#0a0a0a]">
              Corinna
            </Link>
            <span className="font-mono text-xs bg-[#0a0a0a] text-white px-2 py-1">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                fetchStats();
                fetchSessions();
              }}
              className="flex items-center gap-2 px-3 py-2 text-[#78716c] hover:text-[#0a0a0a] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-[#f5f5f4] text-[#0a0a0a] text-sm hover:bg-[#e7e5e4] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                title="Total Sessions"
                value={stats.total_sessions}
                icon={Users}
                subtitle={`Last ${stats.period_days} days`}
              />
              <StatCard
                title="Completed"
                value={stats.completed_sessions}
                icon={CheckCircle2}
                color="success"
              />
              <StatCard
                title="Error Rate"
                value={`${stats.error_rate_percent}%`}
                icon={AlertTriangle}
                color={stats.error_rate_percent > 10 ? "error" : "default"}
                subtitle={`${stats.error_count} errors`}
              />
              <StatCard
                title="Estimated Cost"
                value={`$${stats.estimated_cost_usd.toFixed(2)}`}
                icon={DollarSign}
                subtitle={`${stats.total_llm_calls} LLM / ${stats.total_search_calls} searches`}
              />
            </div>
          )}

          {/* Filters */}
          <div className="bg-white border border-[#e7e5e4] p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a8a29e]" />
                  <input
                    type="text"
                    placeholder="Search by company name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-[#fafaf9] border border-[#e7e5e4] font-sans text-sm focus:outline-none focus:border-[#0a0a0a] transition-colors"
                  />
                </div>
              </div>
              <select
                value={statusFilter || ""}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                className="h-10 px-4 bg-[#fafaf9] border border-[#e7e5e4] font-mono text-xs focus:outline-none focus:border-[#0a0a0a]"
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="error">Error</option>
                <option value="started">Started</option>
                <option value="researching">Researching</option>
                <option value="classifying">Classifying</option>
              </select>
              <select
                value={daysFilter}
                onChange={(e) => setDaysFilter(Number(e.target.value))}
                className="h-10 px-4 bg-[#fafaf9] border border-[#e7e5e4] font-mono text-xs focus:outline-none focus:border-[#0a0a0a]"
              >
                <option value={1}>Last 24 hours</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>

          {/* Sessions List */}
          <div className="bg-white border border-[#e7e5e4]">
            <div className="px-5 py-4 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-[#78716c]">
                Sessions
              </span>
              <span className="font-mono text-xs text-[#a8a29e]">
                Page {page} of {totalPages}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#78716c]" />
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <XCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <p className="text-red-600">{error}</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-[#78716c]">
                No sessions found
              </div>
            ) : (
              <>
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onClick={() => fetchSessionDetail(session.id)}
                    onExportPdf={() => exportPdf(session.id)}
                  />
                ))}
                {/* Pagination */}
                <div className="px-5 py-4 border-t border-[#e7e5e4] flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-[#f5f5f4] text-[#0a0a0a] text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-[#f5f5f4] text-[#0a0a0a] text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Session Detail Overlay */}
      <AnimatePresence>
        {selectedSession && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedSession(null)}
            />
            <SessionDetailPanel
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
              onExportPdf={() => exportPdf(selectedSession.id)}
              onDelete={() => deleteSession(selectedSession.id)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
