"use client";

import { useState, useEffect, useRef } from "react";
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
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui";
import { streamCategorizeService } from "@/services/api";
import type {
  CompanyProfile,
  Classification,
  ComplianceReport,
  StreamEvent,
} from "@/types/api";

interface ServiceClassificationProps {
  companyProfile: CompanyProfile;
  onComplete: (report: ComplianceReport) => void;
  onError: (error: string) => void;
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
  onComplete,
  onError,
}: ServiceClassificationProps) {
  const [stage, setStage] = useState<ClassificationStage>("starting");
  const [streamedText, setStreamedText] = useState<string>("");
  const [classification, setClassification] = useState<Classification | null>(
    null
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["territorial", "service", "size"])
  );
  const [isProcessing, setIsProcessing] = useState(true);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const streamRef = useRef<boolean>(false);
  const textContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (streamRef.current) return;
    streamRef.current = true;

    async function runClassification() {
      try {
        setStage("extracting");

        const stream = streamCategorizeService({
          company_profile: companyProfile,
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
              // Auto-scroll to bottom
              if (textContainerRef.current) {
                textContainerRef.current.scrollTop =
                  textContainerRef.current.scrollHeight;
              }
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

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center gap-1 mb-8"
      >
        {(
          [
            "extracting",
            "classifying",
            "analyzing",
            "generating",
            "complete",
          ] as ClassificationStage[]
        ).map((s, i) => {
          const stages: ClassificationStage[] = [
            "extracting",
            "classifying",
            "analyzing",
            "generating",
            "complete",
          ];
          const currentIdx = stages.indexOf(stage);
          const stepIdx = i;
          const isActive = stepIdx === currentIdx;
          const isCompleted = stepIdx < currentIdx;

          return (
            <motion.div
              key={s}
              animate={{
                backgroundColor: isCompleted
                  ? "#0a0a0a"
                  : isActive
                  ? "#b8860b"
                  : "#e7e5e4",
              }}
              className="h-1.5 w-12 rounded-full"
            />
          );
        })}
      </motion.div>

      {/* Streaming Text Display */}
      {isProcessing && streamedText && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-8"
        >
          <div className="bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-[#0a0a0a] text-white flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              <span className="font-mono text-xs uppercase tracking-wider">
                Analysis Stream
              </span>
            </div>
            <div
              ref={textContainerRef}
              className="p-4 h-32 overflow-y-auto font-mono text-xs text-[#78716c] leading-relaxed"
            >
              {streamedText}
              <span className="inline-block w-1.5 h-3 bg-[#b8860b] ml-0.5 animate-pulse" />
            </div>
          </div>
        </motion.div>
      )}

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
                <div className="grid grid-cols-2 gap-3">
                  <StatusBadge
                    label="Intermediary Service"
                    value={
                      classification.service_classification.is_intermediary
                    }
                  />
                  <StatusBadge
                    label="Online Platform"
                    value={
                      classification.service_classification.is_online_platform
                    }
                  />
                  <StatusBadge
                    label="Online Marketplace"
                    value={classification.service_classification.is_marketplace}
                  />
                  <StatusBadge
                    label="Search Engine"
                    value={
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#0a0a0a] text-white p-6 rounded-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-[#b8860b]" />
                <h3 className="font-serif text-lg">Classification Summary</h3>
              </div>
              <p className="text-sm text-[#a8a29e] leading-relaxed">
                {classification.summary}
              </p>
            </motion.div>

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
                  View Full Compliance Report
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
        <CheckCircle2
          className={`w-4 h-4 ${
            highlight ? "text-[#b8860b]" : "text-[#16a34a]"
          }`}
        />
      ) : (
        <XCircle className="w-4 h-4 text-[#a8a29e]" />
      )}
    </div>
  );
}
