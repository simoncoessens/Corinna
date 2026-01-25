"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Scale,
  FileText,
  Building2,
  Download,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Server,
  Users,
  Banknote,
  Shield,
  Gavel,
  BookOpen,
  ListChecks,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui";
import { ArticleViewer } from "./ArticleViewer";
import type {
  ComplianceReport,
  ObligationAnalysis,
  CompanyProfile,
} from "@/types/api";
import type { ChatContext } from "./ChatPopup";

// Configure marked for inline parsing (no wrapping <p> tags for single lines)
marked.use({
  breaks: true,
});

/**
 * Renders markdown text to sanitized HTML
 */
function renderMarkdown(text: string | undefined | null): string {
  if (!text) return "";
  return DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
}

/**
 * Component for rendering markdown text inline
 */
function MarkdownText({
  children,
  className = "",
}: {
  children: string | undefined | null;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdown(children), [children]);
  return (
    <span
      className={`markdown-inline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface ComplianceDashboardProps {
  report: ComplianceReport;
  companyProfile: CompanyProfile;
  onBack?: () => void;
  /**
   * Emits a snapshot of what the user can currently see in this screen.
   */
  onVisibleStateChange?: (state: ChatContext["visibleUi"]) => void;
  /**
   * Called when user clicks "Ask Corinna" on an obligation
   */
  onAskCorinna?: (obligation: ObligationAnalysis) => void;
}

type DashboardTab = "overview" | "obligations" | "company" | "download";

const tabConfig: { id: DashboardTab; label: string; icon: React.ReactNode }[] =
  [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "obligations",
      label: "Obligations",
      icon: <Scale className="w-4 h-4" />,
    },
    {
      id: "company",
      label: "Company",
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: "download",
      label: "Download",
      icon: <Download className="w-4 h-4" />,
    },
  ];

export function ComplianceDashboard({
  report,
  companyProfile,
  onBack,
  onVisibleStateChange,
  onAskCorinna,
}: ComplianceDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [selectedObligation, setSelectedObligation] =
    useState<ObligationAnalysis | null>(null);
  const [obligationsFilter, setObligationsFilter] = useState<
    "all" | "applicable" | "not-applicable"
  >("applicable");
  const [viewingArticle, setViewingArticle] = useState<string | null>(null);

  const applicableObligations = useMemo(
    () => report.obligations.filter((o) => o.applies),
    [report.obligations]
  );

  const notApplicableObligations = useMemo(
    () => report.obligations.filter((o) => !o.applies),
    [report.obligations]
  );

  const visibleObligations = useMemo(() => {
    if (activeTab === "overview") {
      return report.obligations
        .filter((o) => o.applies)
        .slice(0, 5)
        .map((o) => ({
          article: o.article,
          title: o.title,
          applies: o.applies,
          action_items_count: o.action_items.length,
        }));
    }
    if (activeTab === "obligations") {
      const filtered =
        obligationsFilter === "applicable"
          ? report.obligations.filter((o) => o.applies)
          : obligationsFilter === "not-applicable"
          ? report.obligations.filter((o) => !o.applies)
          : report.obligations;
      return filtered.map((o) => ({
        article: o.article,
        title: o.title,
        applies: o.applies,
        action_items_count: o.action_items.length,
      }));
    }
    return undefined;
  }, [activeTab, obligationsFilter, report.obligations]);

  useEffect(() => {
    if (!onVisibleStateChange) return;
    onVisibleStateChange({
      report: {
        activeTab,
        obligationsFilter:
          activeTab === "obligations" ? obligationsFilter : undefined,
        selectedObligation: selectedObligation
          ? {
              article: selectedObligation.article,
              title: selectedObligation.title,
              applies: selectedObligation.applies,
              implications: selectedObligation.implications,
              action_items: selectedObligation.action_items,
            }
          : null,
        visibleObligations,
      },
    });
  }, [
    onVisibleStateChange,
    activeTab,
    obligationsFilter,
    selectedObligation,
    visibleObligations,
  ]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
            Compliance Report
          </span>
          <span className="text-[#d4d4d4]">·</span>
          <span className="font-mono text-[10px] text-[#b8860b] uppercase tracking-wider px-2 py-0.5 bg-[#b8860b]/10 border border-[#b8860b]/20">
            {report.classification.service_classification.service_category}
          </span>
        </div>
        <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2 text-left">
          {report.company_name}
        </h2>
        <p className="font-sans text-sm text-[#57534e] text-left">
          {applicableObligations.length} applicable obligation{applicableObligations.length !== 1 ? 's' : ''} identified under the Digital Services Act
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-[#e7e5e4]">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-1 py-3 text-sm transition-all cursor-pointer whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-[#0a0a0a] text-[#0a0a0a] font-medium"
                : "border-transparent text-[#78716c] hover:text-[#57534e]"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="pb-4">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <OverviewTab
              key="overview"
              report={report}
              applicableCount={applicableObligations.length}
              onViewObligation={(o) => {
                setSelectedObligation(o);
                setActiveTab("obligations");
              }}
            />
          )}
          {activeTab === "obligations" && (
            <ObligationsTab
              key="obligations"
              obligations={report.obligations}
              selectedObligation={selectedObligation}
              onSelectObligation={setSelectedObligation}
              filter={obligationsFilter}
              onFilterChange={setObligationsFilter}
              onAskCorinna={onAskCorinna}
              onViewArticle={setViewingArticle}
            />
          )}
          {activeTab === "company" && (
            <CompanyTab
              key="company"
              report={report}
              companyProfile={companyProfile}
            />
          )}
          {activeTab === "download" && (
            <DownloadTab key="download" report={report} />
          )}
        </AnimatePresence>
      </div>

      {/* Article Viewer Modal */}
      <ArticleViewer
        articleNumber={viewingArticle || ""}
        isOpen={viewingArticle !== null}
        onClose={() => setViewingArticle(null)}
      />
    </div>
  );
}

// Overview Tab Component
interface OverviewTabProps {
  report: ComplianceReport;
  applicableCount: number;
  onViewObligation: (o: ObligationAnalysis) => void;
}

function OverviewTab({
  report,
  applicableCount,
  onViewObligation,
}: OverviewTabProps) {
  const summaryHtml = useMemo(() => {
    return DOMPurify.sanitize(
      marked.parse(report.summary || "", { async: false }) as string
    );
  }, [report.summary]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          icon={<Globe className="w-4 h-4" />}
          title="Territorial Scope"
          value={
            report.classification.territorial_scope.is_in_scope
              ? "In Scope"
              : "Out of Scope"
          }
          status={
            report.classification.territorial_scope.is_in_scope
              ? "success"
              : "error"
          }
          subtitle="Article 2 DSA"
        />
        <SummaryCard
          icon={<Server className="w-4 h-4" />}
          title="Service Category"
          value={report.classification.service_classification.service_category}
          status="neutral"
          subtitle="Articles 3-6 DSA"
        />
        <SummaryCard
          icon={<Users className="w-4 h-4" />}
          title="Size Designation"
          value={
            report.classification.size_designation.is_vlop_vlose
              ? "VLOP/VLOSE"
              : report.classification.size_designation
                  .qualifies_for_sme_exemption
              ? "SME Exempt"
              : "Standard"
          }
          status={
            report.classification.size_designation.is_vlop_vlose
              ? "warning"
              : "neutral"
          }
          subtitle="Recital 77 DSA"
        />
      </div>

      {/* Executive Summary */}
      <div className="bg-white border border-[#e7e5e4] p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Shield className="w-4 h-4 text-[#57534e]" />
          <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
            Executive Summary
          </span>
        </div>
        <div
          className="prose prose-sm max-w-none text-[#57534e] text-left leading-relaxed [&>p]:mb-3 [&>p:last-child]:mb-0 [&>ul]:text-left [&>ul]:pl-4 [&>ol]:text-left [&>ol]:pl-4"
          dangerouslySetInnerHTML={{ __html: summaryHtml }}
        />
      </div>

      {/* Key Obligations Preview */}
      <div className="bg-white border border-[#e7e5e4]">
        <div className="px-6 py-4 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Gavel className="w-4 h-4 text-[#57534e]" />
            <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
              Key Obligations
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#57534e]">
            {applicableCount} applicable
          </span>
        </div>
        <div className="divide-y divide-[#f5f5f4]">
          {report.obligations
            .filter((o) => o.applies)
            .slice(0, 5)
            .map((obligation) => (
              <button
                key={obligation.article}
                onClick={() => onViewObligation(obligation)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#fafaf9] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#003399]/5 border border-[#003399]/10 flex items-center justify-center shrink-0">
                    <span className="font-mono text-xs text-[#003399]">
                      {obligation.article}
                    </span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-sans text-sm font-medium text-[#0a0a0a] mb-0.5 text-left">
                      {obligation.title}
                    </h3>
                    <div className="text-xs text-[#78716c] line-clamp-1 max-w-lg text-left [&>p]:m-0 [&_strong]:font-semibold [&_strong]:text-[#57534e]">
                      <MarkdownText>{obligation.implications}</MarkdownText>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#a8a29e] group-hover:text-[#57534e] transition-colors shrink-0" />
              </button>
            ))}
        </div>
        {applicableCount > 5 && (
          <div className="px-6 py-3 border-t border-[#e7e5e4] text-left">
            <button
              onClick={() =>
                onViewObligation(report.obligations.find((o) => o.applies)!)
              }
              className="font-mono text-[11px] text-[#003399] hover:underline cursor-pointer tracking-wide"
            >
              View all {applicableCount} obligations →
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  status: "success" | "error" | "warning" | "neutral";
  subtitle: string;
}

function SummaryCard({
  icon,
  title,
  value,
  status,
  subtitle,
}: SummaryCardProps) {
  const statusColors = {
    success: "text-[#16a34a]",
    error: "text-[#dc2626]",
    warning: "text-[#b8860b]",
    neutral: "text-[#0a0a0a]",
  };

  const statusBgColors = {
    success: "bg-[#dcfce7]",
    error: "bg-[#fee2e2]",
    warning: "bg-[#b8860b]/10",
    neutral: "bg-[#f5f5f4]",
  };

  return (
    <div className="bg-white border border-[#e7e5e4] p-5">
      <div className="flex items-center gap-2.5 text-[#78716c] mb-4">
        <div className="w-8 h-8 bg-[#f5f5f4] flex items-center justify-center">
          {icon}
        </div>
        <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className="text-left">
        <div className={`text-lg font-medium mb-1 ${statusColors[status]}`}>
          {value}
        </div>
        <div className="font-mono text-[10px] text-[#a8a29e] uppercase tracking-wider">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// Obligations Tab Component
interface ObligationsTabProps {
  obligations: ObligationAnalysis[];
  selectedObligation: ObligationAnalysis | null;
  onSelectObligation: (o: ObligationAnalysis | null) => void;
  filter: "all" | "applicable" | "not-applicable";
  onFilterChange: (f: "all" | "applicable" | "not-applicable") => void;
  onAskCorinna?: (obligation: ObligationAnalysis) => void;
  onViewArticle?: (articleNumber: string) => void;
}

function ObligationsTab({
  obligations,
  selectedObligation,
  onSelectObligation,
  filter,
  onFilterChange,
  onAskCorinna,
  onViewArticle,
}: ObligationsTabProps) {
  const filteredObligations = useMemo(() => {
    switch (filter) {
      case "applicable":
        return obligations.filter((o) => o.applies);
      case "not-applicable":
        return obligations.filter((o) => !o.applies);
      default:
        return obligations;
    }
  }, [obligations, filter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Filters */}
      <div className="flex gap-1.5 p-1.5 bg-[#f5f5f4] border border-[#e7e5e4] w-fit">
        {[
          { id: "all" as const, label: "All", count: obligations.length },
          {
            id: "applicable" as const,
            label: "Applicable",
            count: obligations.filter((o) => o.applies).length,
          },
          {
            id: "not-applicable" as const,
            label: "Not Applicable",
            count: obligations.filter((o) => !o.applies).length,
          },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wide transition-all cursor-pointer ${
              filter === f.id
                ? "bg-white text-[#0a0a0a] shadow-sm border border-[#e7e5e4]"
                : "text-[#78716c] hover:text-[#0a0a0a] border border-transparent"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Obligations List - Accordion Style */}
      <div className="space-y-2">
        {filteredObligations.map((obligation) => (
          <div key={obligation.article}>
            <ObligationCard
              obligation={obligation}
              isSelected={selectedObligation?.article === obligation.article}
              onClick={() => onSelectObligation(
                selectedObligation?.article === obligation.article ? null : obligation
              )}
            />
            {/* Expandable Detail */}
            <AnimatePresence>
              {selectedObligation?.article === obligation.article && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ObligationDetail
                    obligation={obligation}
                    onClose={() => onSelectObligation(null)}
                    onAskCorinna={onAskCorinna}
                    onViewArticle={onViewArticle}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Obligation Card Component
interface ObligationCardProps {
  obligation: ObligationAnalysis;
  isSelected: boolean;
  onClick: () => void;
}

function ObligationCard({
  obligation,
  isSelected,
  onClick,
}: ObligationCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border transition-all cursor-pointer group ${
        isSelected
          ? "border-[#0a0a0a] border-b-transparent"
          : "border-[#e7e5e4] hover:border-[#a8a29e]"
      }`}
    >
      <div className="flex items-start gap-4 p-4">
        <div
          className={`w-10 h-10 flex items-center justify-center shrink-0 ${
            obligation.applies
              ? "bg-[#003399]/5 border border-[#003399]/10"
              : "bg-[#f5f5f4] border border-[#e7e5e4]"
          }`}
        >
          <span
            className={`font-mono text-xs ${
              obligation.applies ? "text-[#003399]" : "text-[#a8a29e]"
            }`}
          >
            {obligation.article}
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-sans text-sm font-medium text-[#0a0a0a] leading-snug">
              {obligation.title}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              {obligation.applies ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 uppercase tracking-wide">
                  <CheckCircle2 className="w-3 h-3" />
                  Applies
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#78716c] bg-[#f5f5f4] px-2 py-0.5 uppercase tracking-wide">
                  <XCircle className="w-3 h-3" />
                  N/A
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-[#78716c] transition-transform ${isSelected ? "rotate-180" : ""}`} />
            </div>
          </div>
          {!isSelected && (
            <p className="text-xs text-[#78716c] mt-1.5 line-clamp-1">
              {obligation.implications.replace(/[*_#]/g, '').substring(0, 120)}...
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// Obligation Detail Component
interface ObligationDetailProps {
  obligation: ObligationAnalysis;
  onClose?: () => void;
  onAskCorinna?: (obligation: ObligationAnalysis) => void;
  onViewArticle?: (articleNumber: string) => void;
}

function ObligationDetail({
  obligation,
  onAskCorinna,
  onViewArticle,
}: ObligationDetailProps) {
  return (
    <div className="bg-[#fafaf9] border-x border-b border-[#e7e5e4] -mt-px">
      {/* Content - Two columns */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Implications */}
        <div className="text-left">
          <h4 className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider mb-2">
            Implications
          </h4>
          <div className="text-sm text-[#57534e] leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-[#0a0a0a]">
            <MarkdownText>{obligation.implications}</MarkdownText>
          </div>
        </div>

        {/* Action Items */}
        {obligation.applies && obligation.action_items.length > 0 && (
          <div className="text-left">
            <h4 className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider mb-2">
              Required Actions
            </h4>
            <div className="space-y-1.5">
              {obligation.action_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="text-[10px] font-medium text-[#b8860b] mt-0.5">
                    {idx + 1}.
                  </span>
                  <div className="text-[#57534e] leading-relaxed [&>p]:m-0 [&_strong]:font-semibold [&_strong]:text-[#0a0a0a]">
                    <MarkdownText>{item}</MarkdownText>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="px-4 py-2 border-t border-[#e7e5e4] flex items-center gap-3">
        <button
          onClick={() => onViewArticle?.(obligation.article)}
          className="px-2 py-1 flex items-center gap-1.5 text-[#003399] hover:bg-[#003399]/10 transition-colors text-xs"
        >
          <BookOpen className="w-3.5 h-3.5" />
          View Full Article
        </button>
        {onAskCorinna && (
          <button
            onClick={() => onAskCorinna(obligation)}
            className="px-2 py-1 flex items-center gap-1.5 text-[#78716c] hover:text-[#003399] transition-colors text-xs"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Ask Corinna
          </button>
        )}
      </div>
    </div>
  );
}

// Company Tab Component
interface CompanyTabProps {
  report: ComplianceReport;
  companyProfile: CompanyProfile;
}

function CompanyTab({ report, companyProfile }: CompanyTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-5"
    >
      {/* Company Profile */}
      <div className="bg-white border border-[#e7e5e4] p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <Building2 className="w-4 h-4 text-[#57534e]" />
          <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
            Company Profile
          </span>
        </div>
        <dl className="space-y-1">
          <InfoRow label="Company Name" value={report.company_name} />
          {companyProfile.description && (
            <InfoRow label="Description" value={companyProfile.description} markdown />
          )}
          {companyProfile.services && companyProfile.services.length > 0 && (
            <InfoRow
              label="Services"
              value={companyProfile.services.join(", ")}
              markdown
            />
          )}
          {companyProfile.monthly_active_users_eu && (
            <InfoRow
              label="Monthly Active EU Users"
              value={companyProfile.monthly_active_users_eu.toLocaleString()}
            />
          )}
        </dl>
      </div>

      {/* DSA Classification */}
      <div className="bg-white border border-[#e7e5e4] p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <Scale className="w-4 h-4 text-[#57534e]" />
          <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
            DSA Classification
          </span>
        </div>
        <dl className="space-y-1">
          <InfoRow
            label="Territorial Scope"
            value={
              report.classification.territorial_scope.is_in_scope
                ? "In Scope (EU)"
                : "Out of Scope"
            }
            highlight={report.classification.territorial_scope.is_in_scope}
          />
          <InfoRow
            label="Service Category"
            value={
              report.classification.service_classification.service_category
            }
          />
          <InfoRow
            label="Intermediary Service"
            value={
              report.classification.service_classification.is_intermediary
                ? "Yes"
                : "No"
            }
          />
          <InfoRow
            label="Online Platform"
            value={
              report.classification.service_classification.is_online_platform
                ? "Yes"
                : "No"
            }
          />
          <InfoRow
            label="Online Marketplace"
            value={
              report.classification.service_classification.is_marketplace
                ? "Yes"
                : "No"
            }
          />
          <InfoRow
            label="Search Engine"
            value={
              report.classification.service_classification.is_search_engine
                ? "Yes"
                : "No"
            }
          />
          <InfoRow
            label="VLOP/VLOSE Designation"
            value={
              report.classification.size_designation.is_vlop_vlose
                ? "Yes (Very Large Platform)"
                : "No"
            }
            highlight={report.classification.size_designation.is_vlop_vlose}
          />
          <InfoRow
            label="SME Exemption"
            value={
              report.classification.size_designation.qualifies_for_sme_exemption
                ? "Eligible"
                : "Not Eligible"
            }
          />
        </dl>
        {report.classification.size_designation.reasoning && (
          <div className="mt-5 pt-5 border-t border-[#e7e5e4]">
            <div className="text-sm text-[#57534e] leading-relaxed text-left [&>p]:mb-2 [&>p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-[#0a0a0a]">
              <MarkdownText>{report.classification.size_designation.reasoning}</MarkdownText>
            </div>
          </div>
        )}
      </div>

      {/* Research Findings */}
      {companyProfile.research_answers && (
        <div className="lg:col-span-2 bg-white border border-[#e7e5e4] p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <FileText className="w-4 h-4 text-[#57534e]" />
            <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
              Research Findings
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {companyProfile.research_answers.geographical_scope && (
              <ResearchSection
                title="Territorial Scope"
                answers={companyProfile.research_answers.geographical_scope}
              />
            )}
            {companyProfile.research_answers.company_size && (
              <ResearchSection
                title="Company Size"
                answers={companyProfile.research_answers.company_size}
              />
            )}
            {companyProfile.research_answers.service_type && (
              <ResearchSection
                title="Service Type"
                answers={companyProfile.research_answers.service_type}
              />
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Info Row Component
interface InfoRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  markdown?: boolean;
}

function InfoRow({ label, value, highlight, markdown }: InfoRowProps) {
  return (
    <div className="py-2.5 border-b border-[#f5f5f4] last:border-b-0">
      <dt className="text-[11px] text-[#78716c] uppercase tracking-wide mb-1">
        {label}
      </dt>
      <dd
        className={`text-sm text-left ${
          highlight ? "text-[#b8860b] font-medium" : "text-[#0a0a0a]"
        } ${markdown ? "[&>p]:mb-2 [&>p:last-child]:mb-0 [&_strong]:font-semibold" : ""}`}
      >
        {markdown ? <MarkdownText>{value}</MarkdownText> : value}
      </dd>
    </div>
  );
}

// Research Section Component
interface ResearchSectionProps {
  title: string;
  answers: { question: string; answer: string; confidence: string }[];
}

function ResearchSection({ title, answers }: ResearchSectionProps) {
  return (
    <div className="text-left">
      <h3 className="font-sans text-sm font-medium text-[#0a0a0a] mb-4 text-left">
        {title}
      </h3>
      <div className="space-y-4">
        {answers.map((a, idx) => (
          <div key={idx} className="text-left">
            <div className="text-xs text-[#78716c] mb-1.5 text-left">{a.question}</div>
            <div className="text-sm text-[#0a0a0a] text-left leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&_strong]:font-semibold">
              <MarkdownText>{a.answer}</MarkdownText>
            </div>
            <div
              className={`font-mono text-[10px] mt-1.5 uppercase tracking-wide ${
                a.confidence === "High"
                  ? "text-[#16a34a]"
                  : a.confidence === "Medium"
                  ? "text-[#b8860b]"
                  : "text-[#dc2626]"
              }`}
            >
              {a.confidence} confidence
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Download Tab Component
interface DownloadTabProps {
  report: ComplianceReport;
}

function DownloadTab({ report }: DownloadTabProps) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleCopyJSON = async () => {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    setGenerating(true);

    // Generate PDF content
    const pdfContent = generatePDFContent(report);

    // Create blob and download
    const blob = new Blob([pdfContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    // Open print dialog in new window
    const printWindow = window.open(url, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }

    setGenerating(false);
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.company_name
      .toLowerCase()
      .replace(/\s+/g, "-")}-dsa-report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl"
    >
      <div className="mb-6">
        <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
          Export Options
        </span>
      </div>

      <div className="space-y-4">
        {/* PDF Download */}
        <div className="bg-white border border-[#e7e5e4] p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-[#f5f5f4] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#57534e]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-sans text-sm font-medium text-[#0a0a0a] mb-1.5 text-left">
                PDF Report
              </h3>
              <p className="text-sm text-[#78716c] mb-4 text-left leading-relaxed">
                Professional compliance report formatted for printing and sharing
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadPDF}
                loading={generating}
              >
                <Download className="w-3.5 h-3.5" />
                Generate PDF
              </Button>
            </div>
          </div>
        </div>

        {/* JSON Download */}
        <div className="bg-white border border-[#e7e5e4] p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-[#f5f5f4] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#57534e]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-sans text-sm font-medium text-[#0a0a0a] mb-1.5 text-left">
                JSON Data
              </h3>
              <p className="text-sm text-[#78716c] mb-4 text-left leading-relaxed">
                Machine-readable format for system integration
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJSON}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopyJSON}>
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="bg-[#fafaf9] border border-[#e7e5e4] p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
              Data Preview
            </span>
          </div>
          <pre className="text-[11px] text-[#57534e] overflow-x-auto max-h-48 font-mono text-left leading-relaxed">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      </div>
    </motion.div>
  );
}

// PDF Content Generator
function generatePDFContent(report: ComplianceReport): string {
  const applicableObligations = report.obligations.filter((o) => o.applies);
  const notApplicableObligations = report.obligations.filter((o) => !o.applies);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DSA Compliance Report - ${report.company_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    
    @page { 
      margin: 1.5cm 2cm; 
      size: A4;
    }
    
    :root {
      --ink: #0a0a0a;
      --paper: #fafaf9;
      --parchment: #f5f5f4;
      --border: #e7e5e4;
      --stone: #78716c;
      --muted: #a8a29e;
      --accent: #b8860b;
      --eu-blue: #003399;
      --success: #16a34a;
      --error: #dc2626;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: var(--ink);
      background: white;
      max-width: 21cm;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      padding: 40px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 30px;
    }
    
    .header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .logo {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 18pt;
      color: var(--ink);
      letter-spacing: -0.02em;
    }
    
    .badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--stone);
      background: var(--parchment);
      border: 1px solid var(--border);
      padding: 4px 10px;
    }
    
    .header h1 {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 28pt;
      font-weight: 400;
      color: var(--ink);
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    
    .header-meta {
      font-size: 10pt;
      color: var(--stone);
    }
    
    .header-meta strong {
      color: var(--ink);
    }
    
    /* Section Labels */
    .section-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--stone);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-label::before {
      content: '';
      width: 12px;
      height: 1px;
      background: var(--border);
    }
    
    /* Cards */
    .card {
      background: white;
      border: 1px solid var(--border);
      padding: 20px;
      margin-bottom: 16px;
    }
    
    .card-header {
      background: var(--parchment);
      border: 1px solid var(--border);
      padding: 12px 16px;
      margin-bottom: 0;
      border-bottom: none;
    }
    
    .card-body {
      border: 1px solid var(--border);
      border-top: none;
      padding: 16px;
    }
    
    /* Classification Grid */
    .classification-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 20px 0;
    }
    
    .classification-card {
      border: 1px solid var(--border);
      padding: 16px;
    }
    
    .classification-card .label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--stone);
      margin-bottom: 8px;
    }
    
    .classification-card .value {
      font-family: 'Inter', sans-serif;
      font-size: 11pt;
      font-weight: 500;
      color: var(--ink);
    }
    
    .classification-card .value.success { color: var(--success); }
    .classification-card .value.warning { color: var(--accent); }
    .classification-card .value.accent { color: var(--accent); }
    
    .classification-card .subtitle {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }
    
    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 16px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--parchment);
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .info-row .label {
      font-size: 9pt;
      color: var(--stone);
    }
    
    .info-row .value {
      font-size: 9pt;
      color: var(--ink);
      text-align: right;
    }
    
    .info-row .value.yes { color: var(--success); }
    .info-row .value.no { color: var(--muted); }
    
    /* Obligations */
    .obligation {
      border: 1px solid var(--border);
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    
    .obligation-header {
      background: var(--parchment);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }
    
    .obligation-header .left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .article-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      color: var(--eu-blue);
      background: rgba(0, 51, 153, 0.05);
      border: 1px solid rgba(0, 51, 153, 0.1);
      padding: 4px 8px;
    }
    
    .obligation-title {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      font-weight: 500;
      color: var(--ink);
    }
    
    .status-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
    }
    
    .status-badge.applies {
      background: #dcfce7;
      color: var(--success);
    }
    
    .status-badge.not-applies {
      background: var(--parchment);
      color: var(--muted);
    }
    
    .obligation-body {
      padding: 16px;
    }
    
    .obligation-body p {
      font-size: 9pt;
      color: var(--stone);
      line-height: 1.6;
      margin-bottom: 12px;
    }
    
    .action-items {
      margin-top: 12px;
    }
    
    .action-items-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--stone);
      margin-bottom: 8px;
    }
    
    .action-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px;
      background: var(--parchment);
      border: 1px solid var(--border);
      margin-bottom: 6px;
    }
    
    .action-item .number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      color: var(--accent);
      background: rgba(184, 134, 11, 0.1);
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .action-item .text {
      font-size: 9pt;
      color: var(--stone);
    }
    
    /* Summary */
    .summary-card {
      background: var(--parchment);
      border: 1px solid var(--border);
      padding: 20px;
      margin: 20px 0;
    }
    
    .summary-card p {
      font-size: 10pt;
      color: var(--stone);
      line-height: 1.7;
      margin-bottom: 12px;
    }
    
    .summary-card p:last-child {
      margin-bottom: 0;
    }
    
    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      text-align: center;
    }
    
    .footer p {
      font-size: 8pt;
      color: var(--muted);
      margin-bottom: 4px;
    }
    
    .footer .disclaimer {
      font-style: italic;
      margin-top: 12px;
    }
    
    /* Page breaks */
    .page-break { 
      page-break-before: always; 
      margin-top: 0;
      padding-top: 20px;
    }
    
    /* Section headings */
    h2 {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 14pt;
      font-weight: 400;
      color: var(--ink);
      margin: 30px 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    
    h3 {
      font-family: 'Inter', sans-serif;
      font-size: 11pt;
      font-weight: 500;
      color: var(--ink);
      margin: 20px 0 12px 0;
    }
    
    @media print {
      body { 
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div class="logo">Corinna</div>
      <div class="badge">DSA Compliance Assessment</div>
    </div>
    <h1>${report.company_name}</h1>
    <div class="header-meta">
      Generated on <strong>${new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}</strong> · Regulation (EU) 2022/2065
    </div>
  </div>

  <!-- Classification Summary -->
  <div class="section-label">Classification Summary</div>
  
  <div class="classification-grid">
    <div class="classification-card">
      <div class="label">Territorial Scope</div>
      <div class="value ${
        report.classification.territorial_scope.is_in_scope ? "success" : ""
      }">${
    report.classification.territorial_scope.is_in_scope
      ? "In Scope"
      : "Out of Scope"
  }</div>
      <div class="subtitle">Article 2 DSA</div>
    </div>
    <div class="classification-card">
      <div class="label">Service Category</div>
      <div class="value accent">${
        report.classification.service_classification.service_category
      }</div>
      <div class="subtitle">Articles 3-6 DSA</div>
    </div>
    <div class="classification-card">
      <div class="label">Size Designation</div>
      <div class="value ${
        report.classification.size_designation.is_vlop_vlose ? "warning" : ""
      }">${
    report.classification.size_designation.is_vlop_vlose
      ? "VLOP/VLOSE"
      : report.classification.size_designation.qualifies_for_sme_exemption
      ? "SME Exempt"
      : "Standard"
  }</div>
      <div class="subtitle">Recital 77 DSA</div>
      ${
        report.classification.size_designation.reasoning
          ? `<p style="font-size: 9pt; color: var(--stone); margin-top: 8px; line-height: 1.6;">${report.classification.size_designation.reasoning}</p>`
          : ""
      }
    </div>
  </div>

  <!-- Service Classification Details -->
  <div class="card">
    <div class="section-label">Service Classification Details</div>
    <div class="info-grid">
      <div>
        <div class="info-row">
          <span class="label">Intermediary Service</span>
          <span class="value ${
            report.classification.service_classification.is_intermediary
              ? "yes"
              : "no"
          }">${
    report.classification.service_classification.is_intermediary ? "Yes" : "No"
  }</span>
        </div>
        <div class="info-row">
          <span class="label">Online Platform</span>
          <span class="value ${
            report.classification.service_classification.is_online_platform
              ? "yes"
              : "no"
          }">${
    report.classification.service_classification.is_online_platform
      ? "Yes"
      : "No"
  }</span>
        </div>
      </div>
      <div>
        <div class="info-row">
          <span class="label">Online Marketplace</span>
          <span class="value ${
            report.classification.service_classification.is_marketplace
              ? "yes"
              : "no"
          }">${
    report.classification.service_classification.is_marketplace ? "Yes" : "No"
  }</span>
        </div>
        <div class="info-row">
          <span class="label">Search Engine</span>
          <span class="value ${
            report.classification.service_classification.is_search_engine
              ? "yes"
              : "no"
          }">${
    report.classification.service_classification.is_search_engine ? "Yes" : "No"
  }</span>
        </div>
      </div>
    </div>
    ${
      report.classification.territorial_scope.reasoning
        ? `<p style="font-size: 9pt; color: var(--stone); margin-top: 12px; line-height: 1.6;">${report.classification.territorial_scope.reasoning}</p>`
        : ""
    }
  </div>

  <!-- Page Break -->
  <div class="page-break">
    <div class="section-label">Applicable Obligations · ${
      applicableObligations.length
    } Articles</div>
  </div>

  ${applicableObligations
    .map(
      (o, idx) => `
    <div class="obligation">
      <div class="obligation-header">
        <div class="left">
          <span class="article-badge">Article ${o.article}</span>
          <span class="obligation-title">${o.title}</span>
        </div>
        <span class="status-badge applies">Applies</span>
      </div>
      <div class="obligation-body">
        <p>${o.implications}</p>
        ${
          o.action_items.length > 0
            ? `
          <div class="action-items">
            <div class="action-items-label">Required Actions</div>
            ${o.action_items
              .map(
                (item, i) => `
              <div class="action-item">
                <span class="number">${i + 1}</span>
                <span class="text">${item}</span>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    </div>
  `
    )
    .join("")}

  ${
    notApplicableObligations.length > 0
      ? `
    <div class="section-label" style="margin-top: 30px;">Not Applicable · ${
      notApplicableObligations.length
    } Articles</div>
    ${notApplicableObligations
      .slice(0, 5)
      .map(
        (o) => `
      <div class="obligation">
        <div class="obligation-header">
          <div class="left">
            <span class="article-badge" style="opacity: 0.5;">Article ${o.article}</span>
            <span class="obligation-title" style="color: var(--muted);">${o.title}</span>
          </div>
          <span class="status-badge not-applies">Not Applicable</span>
        </div>
      </div>
    `
      )
      .join("")}
    ${
      notApplicableObligations.length > 5
        ? `<p style="font-size: 8pt; color: var(--muted); text-align: center; margin-top: 8px;">+ ${
            notApplicableObligations.length - 5
          } more articles not applicable</p>`
        : ""
    }
  `
      : ""
  }

  <!-- Page Break -->
  <div class="page-break">
    <div class="section-label">Executive Summary</div>
  </div>

  <div class="summary-card">
    ${report.summary
      .split("\n")
      .filter((p) => p.trim())
      .map((p) => `<p>${p}</p>`)
      .join("")}
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>DSA Compliance Assessment Report · ${report.company_name}</p>
    <p>Generated by Corinna on ${new Date().toISOString()}</p>
    <p class="disclaimer">This report is for informational purposes only. For official legal advice, please consult with a qualified legal professional.</p>
  </div>
</body>
</html>
  `;
}
