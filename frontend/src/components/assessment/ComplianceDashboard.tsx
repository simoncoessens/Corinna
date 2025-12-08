"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Scale,
  FileText,
  Building2,
  Download,
  ChevronRight,
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
} from "lucide-react";
import { Button } from "@/components/ui";
import type {
  ComplianceReport,
  ObligationAnalysis,
  CompanyProfile,
} from "@/types/api";

interface ComplianceDashboardProps {
  report: ComplianceReport;
  companyProfile: CompanyProfile;
  onBack?: () => void;
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
}: ComplianceDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [selectedObligation, setSelectedObligation] =
    useState<ObligationAnalysis | null>(null);

  const applicableObligations = useMemo(
    () => report.obligations.filter((o) => o.applies),
    [report.obligations]
  );

  const notApplicableObligations = useMemo(
    () => report.obligations.filter((o) => !o.applies),
    [report.obligations]
  );

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* Header */}
      <header className="bg-[#0a0a0a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1 text-[#a8a29e] hover:text-white text-sm mb-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Assessment
                </button>
              )}
              <h1 className="font-serif text-2xl md:text-3xl">
                DSA Compliance Dashboard
              </h1>
              <p className="text-[#a8a29e] mt-1">{report.company_name}</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-[#a8a29e] uppercase tracking-wider">
                  Classification
                </div>
                <div className="font-mono text-sm text-[#b8860b]">
                  {
                    report.classification.service_classification
                      .service_category
                  }
                </div>
              </div>
              <div className="w-px h-10 bg-[#333]" />
              <div className="text-right">
                <div className="text-xs text-[#a8a29e] uppercase tracking-wider">
                  Applicable Articles
                </div>
                <div className="font-mono text-sm text-white">
                  {applicableObligations.length}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 mt-6 overflow-x-auto pb-px">
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-[#0a0a0a] rounded-t-lg"
                    : "text-[#a8a29e] hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
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
      </main>
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={<Globe className="w-5 h-5" />}
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
          icon={<Server className="w-5 h-5" />}
          title="Service Category"
          value={report.classification.service_classification.service_category}
          status="neutral"
          subtitle="Articles 3-6 DSA"
        />
        <SummaryCard
          icon={<Users className="w-5 h-5" />}
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
      <div className="bg-white border border-[#e7e5e4] rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[#b8860b]" />
          <h2 className="font-serif text-xl text-[#0a0a0a]">
            Executive Summary
          </h2>
        </div>
        <div className="prose prose-stone max-w-none">
          <p className="text-[#57534e] leading-relaxed whitespace-pre-wrap">
            {report.summary}
          </p>
        </div>
      </div>

      {/* Key Obligations Preview */}
      <div className="bg-white border border-[#e7e5e4] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e7e5e4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-[#0a0a0a]" />
            <h2 className="font-serif text-xl text-[#0a0a0a]">
              Key Obligations
            </h2>
          </div>
          <span className="bg-[#0a0a0a] text-white px-3 py-1 rounded-full text-xs font-medium">
            {applicableCount} applicable
          </span>
        </div>
        <div className="divide-y divide-[#e7e5e4]">
          {report.obligations
            .filter((o) => o.applies)
            .slice(0, 5)
            .map((obligation, idx) => (
              <button
                key={obligation.article}
                onClick={() => onViewObligation(obligation)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#fafaf9] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#003399]/10 flex items-center justify-center rounded">
                    <span className="font-mono text-sm text-[#003399] font-medium">
                      {obligation.article}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-[#0a0a0a]">
                      {obligation.title}
                    </h3>
                    <p className="text-sm text-[#78716c] line-clamp-1 max-w-md">
                      {obligation.implications}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#a8a29e]" />
              </button>
            ))}
        </div>
        {applicableCount > 5 && (
          <div className="px-6 py-3 bg-[#fafaf9] border-t border-[#e7e5e4]">
            <button
              onClick={() =>
                onViewObligation(report.obligations.find((o) => o.applies)!)
              }
              className="text-sm text-[#003399] hover:underline cursor-pointer"
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
    success: "border-l-[#16a34a]",
    error: "border-l-[#dc2626]",
    warning: "border-l-[#b8860b]",
    neutral: "border-l-[#0a0a0a]",
  };

  return (
    <div
      className={`bg-white border border-[#e7e5e4] border-l-4 ${statusColors[status]} rounded-lg p-5`}
    >
      <div className="flex items-center gap-2 text-[#78716c] mb-2">
        {icon}
        <span className="text-sm">{title}</span>
      </div>
      <div className="font-serif text-xl text-[#0a0a0a] mb-1">{value}</div>
      <div className="font-mono text-xs text-[#a8a29e] uppercase tracking-wider">
        {subtitle}
      </div>
    </div>
  );
}

// Obligations Tab Component
interface ObligationsTabProps {
  obligations: ObligationAnalysis[];
  selectedObligation: ObligationAnalysis | null;
  onSelectObligation: (o: ObligationAnalysis | null) => void;
}

function ObligationsTab({
  obligations,
  selectedObligation,
  onSelectObligation,
}: ObligationsTabProps) {
  const [filter, setFilter] = useState<"all" | "applicable" | "not-applicable">(
    "all"
  );

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
      className="flex gap-6"
    >
      {/* Obligations List */}
      <div className="flex-1">
        {/* Filters */}
        <div className="flex gap-2 mb-4">
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
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                filter === f.id
                  ? "bg-[#0a0a0a] text-white"
                  : "bg-white border border-[#e7e5e4] text-[#57534e] hover:bg-[#f5f5f4]"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Obligations Grid */}
        <div className="space-y-3">
          {filteredObligations.map((obligation) => (
            <ObligationCard
              key={obligation.article}
              obligation={obligation}
              isSelected={selectedObligation?.article === obligation.article}
              onClick={() => onSelectObligation(obligation)}
            />
          ))}
        </div>
      </div>

      {/* Obligation Detail Panel */}
      <AnimatePresence>
        {selectedObligation && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-96 shrink-0"
          >
            <ObligationDetail
              obligation={selectedObligation}
              onClose={() => onSelectObligation(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
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
      className={`w-full text-left bg-white border rounded-lg p-4 transition-all cursor-pointer ${
        isSelected
          ? "border-[#003399] ring-2 ring-[#003399]/20"
          : "border-[#e7e5e4] hover:border-[#a8a29e]"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 flex items-center justify-center rounded ${
            obligation.applies ? "bg-[#003399]/10" : "bg-[#f5f5f4]"
          }`}
        >
          <span
            className={`font-mono text-sm font-medium ${
              obligation.applies ? "text-[#003399]" : "text-[#a8a29e]"
            }`}
          >
            Art.{obligation.article}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-[#0a0a0a] truncate">
              {obligation.title}
            </h3>
            {obligation.applies ? (
              <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-[#a8a29e] shrink-0" />
            )}
          </div>
          <p className="text-sm text-[#78716c] line-clamp-2">
            {obligation.implications}
          </p>
          {obligation.applies && obligation.action_items.length > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-[#b8860b]">
              <ListChecks className="w-3.5 h-3.5" />
              {obligation.action_items.length} action items
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// Obligation Detail Component
interface ObligationDetailProps {
  obligation: ObligationAnalysis;
  onClose: () => void;
}

function ObligationDetail({ obligation, onClose }: ObligationDetailProps) {
  return (
    <div className="bg-white border border-[#e7e5e4] rounded-lg sticky top-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e7e5e4]">
        <div className="flex items-center justify-between mb-2">
          <span className="article-reference">
            Article {obligation.article}
          </span>
          <button
            onClick={onClose}
            className="text-[#78716c] hover:text-[#0a0a0a] cursor-pointer"
          >
            ×
          </button>
        </div>
        <h3 className="font-serif text-lg text-[#0a0a0a]">
          {obligation.title}
        </h3>
        <div className="flex items-center gap-2 mt-2">
          {obligation.applies ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Applies
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#78716c] bg-[#f5f5f4] px-2 py-0.5 rounded-full">
              <XCircle className="w-3 h-3" />
              Does Not Apply
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Implications */}
        <div>
          <h4 className="text-xs font-medium text-[#78716c] uppercase tracking-wider mb-2">
            Implications for Your Organization
          </h4>
          <p className="text-sm text-[#57534e] leading-relaxed">
            {obligation.implications}
          </p>
        </div>

        {/* Action Items */}
        {obligation.applies && obligation.action_items.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[#78716c] uppercase tracking-wider mb-3">
              Required Actions
            </h4>
            <div className="space-y-2">
              {obligation.action_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-[#fafaf9] border border-[#e7e5e4] rounded"
                >
                  <div className="w-5 h-5 bg-[#b8860b]/10 flex items-center justify-center rounded-full shrink-0 mt-0.5">
                    <span className="text-[10px] font-medium text-[#b8860b]">
                      {idx + 1}
                    </span>
                  </div>
                  <p className="text-sm text-[#57534e]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* External Link */}
        <a
          href={`https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-[#003399] hover:underline"
        >
          <BookOpen className="w-4 h-4" />
          View Article {obligation.article} in EUR-Lex
          <ExternalLink className="w-3 h-3" />
        </a>
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
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Company Profile */}
      <div className="bg-white border border-[#e7e5e4] rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-5 h-5 text-[#0a0a0a]" />
          <h2 className="font-serif text-xl text-[#0a0a0a]">Company Profile</h2>
        </div>
        <dl className="space-y-4">
          <InfoRow label="Company Name" value={report.company_name} />
          {companyProfile.description && (
            <InfoRow label="Description" value={companyProfile.description} />
          )}
          {companyProfile.services && companyProfile.services.length > 0 && (
            <InfoRow
              label="Services"
              value={companyProfile.services.join(", ")}
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
      <div className="bg-white border border-[#e7e5e4] rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <Scale className="w-5 h-5 text-[#0a0a0a]" />
          <h2 className="font-serif text-xl text-[#0a0a0a]">
            DSA Classification
          </h2>
        </div>
        <dl className="space-y-4">
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
      </div>

      {/* Research Findings */}
      {companyProfile.research_answers && (
        <div className="lg:col-span-2 bg-white border border-[#e7e5e4] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-[#0a0a0a]" />
            <h2 className="font-serif text-xl text-[#0a0a0a]">
              Research Findings
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {companyProfile.research_answers.geographical_scope && (
              <ResearchSection
                title="Geographical Scope"
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
}

function InfoRow({ label, value, highlight }: InfoRowProps) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-[#e7e5e4] last:border-b-0">
      <dt className="text-sm text-[#78716c]">{label}</dt>
      <dd
        className={`text-sm text-right max-w-[60%] ${
          highlight ? "text-[#b8860b] font-medium" : "text-[#0a0a0a]"
        }`}
      >
        {value}
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
    <div>
      <h3 className="font-medium text-[#0a0a0a] mb-3">{title}</h3>
      <div className="space-y-3">
        {answers.map((a, idx) => (
          <div key={idx} className="text-sm">
            <div className="text-[#78716c] mb-1">{a.question}</div>
            <div className="text-[#0a0a0a]">{a.answer}</div>
            <div
              className={`text-xs mt-1 ${
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
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
          Download Compliance Report
        </h2>
        <p className="text-[#78716c]">
          Export your DSA compliance assessment in various formats
        </p>
      </div>

      <div className="space-y-4">
        {/* PDF Download */}
        <div className="bg-white border border-[#e7e5e4] rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#dc2626]/10 flex items-center justify-center rounded">
              <FileText className="w-6 h-6 text-[#dc2626]" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-[#0a0a0a] mb-1">PDF Report</h3>
              <p className="text-sm text-[#78716c] mb-4">
                Professional compliance report formatted for printing and
                sharing
              </p>
              <Button
                variant="primary"
                onClick={handleDownloadPDF}
                loading={generating}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Generate PDF
              </Button>
            </div>
          </div>
        </div>

        {/* JSON Download */}
        <div className="bg-white border border-[#e7e5e4] rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#b8860b]/10 flex items-center justify-center rounded">
              <FileText className="w-6 h-6 text-[#b8860b]" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-[#0a0a0a] mb-1">JSON Data</h3>
              <p className="text-sm text-[#78716c] mb-4">
                Machine-readable format for integration with other systems
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadJSON}>
                  <Download className="w-4 h-4" />
                  Download JSON
                </Button>
                <Button variant="ghost" onClick={handleCopyJSON}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="bg-[#0a0a0a] rounded-lg p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-[#b8860b]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[#a8a29e]">
              Report Preview
            </span>
          </div>
          <pre className="text-xs text-[#a8a29e] overflow-x-auto max-h-64">
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DSA Compliance Report - ${report.company_name}</title>
  <style>
    @page { margin: 2cm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 21cm;
      margin: 0 auto;
      padding: 2cm;
    }
    h1 { 
      font-size: 24pt; 
      border-bottom: 2px solid #003399; 
      padding-bottom: 10px; 
      margin-bottom: 20px;
    }
    h2 { 
      font-size: 16pt; 
      color: #003399; 
      margin-top: 30px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    h3 { font-size: 12pt; margin-top: 20px; }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header img { max-height: 50px; }
    .meta {
      background: #f5f5f4;
      padding: 15px;
      margin-bottom: 30px;
      border-left: 4px solid #003399;
    }
    .meta p { margin: 5px 0; }
    .classification-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .classification-card {
      border: 1px solid #e7e5e4;
      padding: 15px;
      text-align: center;
    }
    .classification-card h4 {
      font-size: 10pt;
      color: #666;
      margin: 0 0 10px 0;
      text-transform: uppercase;
    }
    .classification-card .value {
      font-size: 14pt;
      font-weight: bold;
      color: #003399;
    }
    .obligation {
      border: 1px solid #e7e5e4;
      padding: 15px;
      margin: 15px 0;
      page-break-inside: avoid;
    }
    .obligation h4 {
      margin: 0 0 10px 0;
      color: #003399;
    }
    .obligation .article {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      color: #003399;
      background: #f0f4ff;
      padding: 2px 8px;
      display: inline-block;
      margin-bottom: 10px;
    }
    .action-items {
      list-style: decimal;
      padding-left: 20px;
      margin-top: 10px;
    }
    .action-items li {
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      font-size: 10pt;
      color: #666;
      text-align: center;
    }
    .summary {
      background: #fafaf9;
      padding: 20px;
      margin: 20px 0;
      border: 1px solid #e7e5e4;
    }
    @media print {
      body { padding: 0; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Digital Services Act<br>Compliance Assessment Report</h1>
    <p><strong>${report.company_name}</strong></p>
    <p>Generated: ${new Date().toLocaleDateString("en-EU", {
      dateStyle: "long",
    })}</p>
  </div>

  <div class="meta">
    <p><strong>Report Type:</strong> DSA Service Categorization & Obligation Analysis</p>
    <p><strong>Regulation Reference:</strong> Regulation (EU) 2022/2065 (Digital Services Act)</p>
    <p><strong>Assessment Date:</strong> ${
      new Date().toISOString().split("T")[0]
    }</p>
  </div>

  <h2>1. Classification Summary</h2>
  <div class="classification-grid">
    <div class="classification-card">
      <h4>Territorial Scope</h4>
      <div class="value">${
        report.classification.territorial_scope.is_in_scope
          ? "In Scope"
          : "Out of Scope"
      }</div>
    </div>
    <div class="classification-card">
      <h4>Service Category</h4>
      <div class="value">${
        report.classification.service_classification.service_category
      }</div>
    </div>
    <div class="classification-card">
      <h4>Size Designation</h4>
      <div class="value">${
        report.classification.size_designation.is_vlop_vlose
          ? "VLOP/VLOSE"
          : report.classification.size_designation.qualifies_for_sme_exemption
          ? "SME Exempt"
          : "Standard"
      }</div>
    </div>
  </div>

  <h3>1.1 Territorial Scope Analysis</h3>
  <p>${report.classification.territorial_scope.reasoning}</p>

  <h3>1.2 Service Classification Details</h3>
  <ul>
    <li><strong>Intermediary Service:</strong> ${
      report.classification.service_classification.is_intermediary
        ? "Yes"
        : "No"
    }</li>
    <li><strong>Online Platform:</strong> ${
      report.classification.service_classification.is_online_platform
        ? "Yes"
        : "No"
    }</li>
    <li><strong>Online Marketplace:</strong> ${
      report.classification.service_classification.is_marketplace ? "Yes" : "No"
    }</li>
    <li><strong>Search Engine:</strong> ${
      report.classification.service_classification.is_search_engine
        ? "Yes"
        : "No"
    }</li>
  </ul>
  ${
    report.classification.service_classification.platform_reasoning
      ? `<p>${report.classification.service_classification.platform_reasoning}</p>`
      : ""
  }

  <div class="page-break"></div>

  <h2>2. Applicable Obligations</h2>
  <p>Based on the classification above, the following ${
    applicableObligations.length
  } DSA obligations apply to ${report.company_name}:</p>

  ${applicableObligations
    .map(
      (o) => `
    <div class="obligation">
      <span class="article">Article ${o.article}</span>
      <h4>${o.title}</h4>
      <p>${o.implications}</p>
      ${
        o.action_items.length > 0
          ? `
        <h5>Required Actions:</h5>
        <ol class="action-items">
          ${o.action_items.map((item) => `<li>${item}</li>`).join("")}
        </ol>
      `
          : ""
      }
    </div>
  `
    )
    .join("")}

  <div class="page-break"></div>

  <h2>3. Executive Summary</h2>
  <div class="summary">
    ${report.summary
      .split("\n")
      .map((p) => `<p>${p}</p>`)
      .join("")}
  </div>

  <div class="footer">
    <p>This report was generated by SNIP-tool DSA Compliance Assessment</p>
    <p>For official legal advice, please consult with a qualified legal professional.</p>
    <p>© ${new Date().getFullYear()} - Report generated on ${new Date().toISOString()}</p>
  </div>
</body>
</html>
  `;
}
