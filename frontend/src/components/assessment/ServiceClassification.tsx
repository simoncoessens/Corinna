"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Building2,
  Server,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Scale,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui";
import { streamCategorizeService } from "@/services/api";
import type {
  CompanyProfile,
  Classification,
  ComplianceReport,
  StreamEvent,
} from "@/types/api";
import type { ChatContext } from "./ChatPopup";

interface ServiceClassificationProps {
  companyProfile: CompanyProfile;
  topDomain?: string | null;
  summaryLong?: string | null;
  onComplete: (report: ComplianceReport) => void;
  onError: (error: string) => void;
  /**
   * Emits a snapshot of what the user can currently see in this screen.
   */
  onVisibleStateChange?: (state: ChatContext["visibleUi"]) => void;
}

type ClassificationStage =
  | "starting"
  | "extracting"
  | "classifying"
  | "analyzing"
  | "generating"
  | "complete";

const stageLabels: Record<ClassificationStage, string> = {
  starting: "Initializing Analysis",
  extracting: "Extracting Company Profile",
  classifying: "Determining DSA Classification",
  analyzing: "Analyzing Obligations",
  generating: "Generating Compliance Report",
  complete: "Classification Complete",
};

const stageDescriptions: Record<ClassificationStage, string> = {
  starting: "Preparing to analyze your company under the Digital Services Act",
  extracting:
    "Processing the research findings to build a comprehensive company profile",
  classifying:
    "Applying DSA criteria to determine territorial scope, service category, and size designation",
  analyzing:
    "Identifying which DSA articles and obligations apply to your organization",
  generating: "Compiling the final compliance assessment report",
  complete: "Your DSA compliance classification is ready for review",
};

export function ServiceClassification({
  companyProfile,
  topDomain,
  summaryLong,
  onComplete,
  onError,
  onVisibleStateChange,
}: ServiceClassificationProps) {
  const [stage, setStage] = useState<ClassificationStage>("starting");
  const [streamedText, setStreamedText] = useState<string>("");
  const [classification, setClassification] = useState<Classification | null>(
    null
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["territorial", "service", "size", "summary"])
  );
  const [isProcessing, setIsProcessing] = useState(true);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const streamRef = useRef<boolean>(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const streamedTextTail = useMemo(() => {
    if (!streamedText) return undefined;
    // Keep context bounded; user only sees the latest portion in the UI anyway.
    const max = 1200;
    return streamedText.length > max ? streamedText.slice(-max) : streamedText;
  }, [streamedText]);

  useEffect(() => {
    if (!onVisibleStateChange) return;
    onVisibleStateChange({
      classification: {
        stage: stageLabels[stage] || stage,
        isProcessing,
        streamedText: streamedTextTail,
        expandedSections: Array.from(expandedSections),
        classificationSummary: classification?.summary,
        classification: classification
          ? {
              territorial: {
                in_scope: classification.territorial_scope.is_in_scope,
                reasoning: classification.territorial_scope.reasoning,
              },
              service: {
                service_category:
                  classification.service_classification.service_category,
                is_intermediary:
                  classification.service_classification.is_intermediary,
                is_online_platform:
                  classification.service_classification.is_online_platform,
                is_marketplace:
                  classification.service_classification.is_marketplace,
                is_search_engine:
                  classification.service_classification.is_search_engine,
                platform_reasoning:
                  classification.service_classification.platform_reasoning,
              },
              size: {
                is_vlop_vlose: classification.size_designation.is_vlop_vlose,
                qualifies_for_sme_exemption:
                  classification.size_designation.qualifies_for_sme_exemption,
                reasoning: classification.size_designation.reasoning,
              },
            }
          : undefined,
      },
    });
  }, [
    onVisibleStateChange,
    stage,
    isProcessing,
    streamedTextTail,
    expandedSections,
    classification,
  ]);

  useEffect(() => {
    if (streamRef.current) return;
    streamRef.current = true;

    async function runClassification() {
      try {
        setStage("extracting");

        const stream = streamCategorizeService({
          company_profile: companyProfile,
          top_domain: topDomain || null,
          summary_long: summaryLong || null,
        });

        let currentNode = "";
        let fullText = "";

        for await (const event of stream) {
          switch (event.type) {
            case "node_start":
              const nodeEvent = event as { node: string };
              if (nodeEvent.node.includes("extract")) {
                setStage("extracting");
              } else if (nodeEvent.node.includes("classify")) {
                setStage("classifying");
              } else if (nodeEvent.node.includes("obligation")) {
                setStage("analyzing");
              } else if (nodeEvent.node.includes("report")) {
                setStage("generating");
              }
              currentNode = nodeEvent.node;
              break;

            case "token":
              const tokenEvent = event as { content: string };
              fullText += tokenEvent.content;
              setStreamedText(fullText);
              break;

            case "result":
              const resultEvent = event as { data: ComplianceReport };
              if (resultEvent.data) {
                setClassification(resultEvent.data.classification);
                setReport(resultEvent.data);
                setStage("complete");
                setIsProcessing(false);
              }
              break;

            case "error":
              const errorEvent = event as { message: string };
              onError(errorEvent.message);
              setIsProcessing(false);
              return;

            case "done":
              break;
          }
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : "Classification failed");
        setIsProcessing(false);
      }
    }

    runClassification();
  }, [companyProfile, onComplete, onError]);

  const handleContinue = () => {
    if (report) {
      onComplete(report);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Stage Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          {isProcessing ? (
            <Loader2 className="w-5 h-5 text-[#b8860b] animate-spin" />
          ) : (
            <Scale className="w-5 h-5 text-[#16a34a]" />
          )}
          <h2 className="font-serif text-2xl text-[#0a0a0a]">
            {stageLabels[stage]}
          </h2>
        </div>
        <p className="text-center text-sm text-[#78716c] max-w-lg mx-auto">
          {stageDescriptions[stage]}
        </p>
      </motion.div>

      {/* Classification Results */}
      <AnimatePresence mode="wait">
        {classification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            {/* Territorial Scope */}
            <ClassificationCard
              icon={<Globe className="w-5 h-5" />}
              title="Territorial Scope"
              subtitle="Article 2 DSA"
              status={classification.territorial_scope.is_in_scope}
              statusLabel={
                classification.territorial_scope.is_in_scope
                  ? "In Scope"
                  : "Out of Scope"
              }
              isExpanded={expandedSections.has("territorial")}
              onToggle={() => toggleSection("territorial")}
            >
              <div className="prose prose-sm max-w-none text-[#57534e]">
                <p className="leading-relaxed">
                  {classification.territorial_scope.reasoning}
                </p>
              </div>
            </ClassificationCard>

            {/* Service Classification */}
            <ClassificationCard
              icon={<Server className="w-5 h-5" />}
              title="Service Classification"
              subtitle="Articles 3-6 DSA"
              status={classification.service_classification.is_intermediary}
              statusLabel={
                classification.service_classification.service_category
              }
              isExpanded={expandedSections.has("service")}
              onToggle={() => toggleSection("service")}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <StatusBadge
                    label="Mere Conduit"
                    value={
                      classification.service_classification.service_category ===
                      "Mere Conduit"
                    }
                    highlight={
                      classification.service_classification.service_category ===
                      "Mere Conduit"
                    }
                  />
                  <StatusBadge
                    label="Caching"
                    value={
                      classification.service_classification.service_category ===
                      "Caching"
                    }
                    highlight={
                      classification.service_classification.service_category ===
                      "Caching"
                    }
                  />
                  <StatusBadge
                    label="Hosting"
                    value={
                      classification.service_classification.service_category ===
                      "Hosting"
                    }
                    highlight={
                      classification.service_classification.service_category ===
                      "Hosting"
                    }
                  />
                  <StatusBadge
                    label="Online Platform"
                    value={
                      classification.service_classification.is_online_platform
                    }
                    highlight={
                      classification.service_classification.is_online_platform
                    }
                  />
                  <StatusBadge
                    label="Online Marketplace"
                    value={classification.service_classification.is_marketplace}
                    highlight={
                      classification.service_classification.is_marketplace
                    }
                  />
                  <StatusBadge
                    label="Search Engine"
                    value={
                      classification.service_classification.is_search_engine
                    }
                    highlight={
                      classification.service_classification.is_search_engine
                    }
                  />
                </div>
                {classification.service_classification.platform_reasoning && (
                  <div className="mt-4 p-4 bg-[#fafaf9] border-l-2 border-[#b8860b]">
                    <p className="text-sm text-[#57534e] leading-relaxed">
                      {classification.service_classification.platform_reasoning}
                    </p>
                  </div>
                )}
              </div>
            </ClassificationCard>

            {/* Size Designation */}
            <ClassificationCard
              icon={<Building2 className="w-5 h-5" />}
              title="Size Designation"
              subtitle="Article 3(e-f) DSA"
              status={
                classification.size_designation.is_vlop_vlose
                  ? "vlop"
                  : classification.size_designation.qualifies_for_sme_exemption
                  ? "sme"
                  : "standard"
              }
              statusLabel={
                classification.size_designation.is_vlop_vlose
                  ? "VLOP/VLOSE"
                  : classification.size_designation.qualifies_for_sme_exemption
                  ? "SME Exemption"
                  : "Standard Provider"
              }
              isExpanded={expandedSections.has("size")}
              onToggle={() => toggleSection("size")}
            >
              <div className="space-y-3">
                <div className="flex gap-3">
                  <StatusBadge
                    label="Very Large Platform (VLOP/VLOSE)"
                    value={classification.size_designation.is_vlop_vlose}
                    highlight={classification.size_designation.is_vlop_vlose}
                  />
                  <StatusBadge
                    label="SME Exemption Eligible"
                    value={
                      classification.size_designation
                        .qualifies_for_sme_exemption || false
                    }
                    highlight={
                      classification.size_designation
                        .qualifies_for_sme_exemption
                    }
                  />
                </div>
                {classification.size_designation.reasoning && (
                  <p className="text-sm text-[#57534e] leading-relaxed">
                    {classification.size_designation.reasoning}
                  </p>
                )}
              </div>
            </ClassificationCard>

            {/* Summary */}
            <ClassificationCard
              icon={<Shield className="w-5 h-5" />}
              title="Classification Summary"
              subtitle="DSA Compliance Assessment"
              status={true}
              statusLabel="Complete"
              isExpanded={expandedSections.has("summary")}
              onToggle={() => toggleSection("summary")}
            >
              <div className="prose prose-sm max-w-none text-[#57534e]">
                <p className="leading-relaxed">{classification.summary}</p>
              </div>
            </ClassificationCard>

            {/* Continue Button */}
            {!isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center pt-4"
              >
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleContinue}
                  className="min-w-48"
                >
                  Continue to Compliance Report
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Classification Card Component
interface ClassificationCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: boolean | string;
  statusLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ClassificationCard({
  icon,
  title,
  subtitle,
  status,
  statusLabel,
  isExpanded,
  onToggle,
  children,
}: ClassificationCardProps) {
  const getStatusColor = () => {
    if (typeof status === "boolean") {
      return status
        ? "text-[#16a34a] bg-[#dcfce7]"
        : "text-[#dc2626] bg-[#fee2e2]";
    }
    if (status === "vlop") return "text-[#7c3aed] bg-[#ede9fe]";
    if (status === "sme") return "text-[#2563eb] bg-[#dbeafe]";
    return "text-[#0a0a0a] bg-[#f5f5f4]";
  };

  const getStatusIcon = () => {
    if (typeof status === "boolean") {
      return status ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      );
    }
    return <Users className="w-3.5 h-3.5" />;
  };

  return (
    <motion.div
      layout
      className="bg-white border border-[#e7e5e4] rounded-lg overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#fafaf9] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#f5f5f4] flex items-center justify-center rounded">
            {icon}
          </div>
          <div className="text-left">
            <h3 className="font-serif text-lg text-[#0a0a0a]">{title}</h3>
            <span className="font-mono text-xs text-[#78716c] uppercase tracking-wider">
              {subtitle}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
          >
            {getStatusIcon()}
            {statusLabel}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#78716c]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#78716c]" />
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 pt-2 border-t border-[#e7e5e4]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Status Badge Component
interface StatusBadgeProps {
  label: string;
  value: boolean;
  highlight?: boolean;
}

function StatusBadge({ label, value, highlight }: StatusBadgeProps) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded border ${
        highlight
          ? "border-[#b8860b] bg-[#b8860b]/5"
          : "border-[#e7e5e4] bg-[#fafaf9]"
      }`}
    >
      <span className="text-sm text-[#57534e]">{label}</span>
      {value ? (
        <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
      ) : (
        <XCircle className="w-4 h-4 text-[#a8a29e]" />
      )}
    </div>
  );
}
