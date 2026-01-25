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
  ChevronDown,
  ChevronUp,
  Loader2,
  Scale,
  Users,
  FileText,
  AlertCircle,
  BookOpen,
  Gavel,
  Eye,
  MessageSquare,
  Flag,
  ShieldAlert,
  Megaphone,
  Store,
  Search,
  Network,
  Clock,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui";
import { streamCategorizeService } from "@/services/api";
import type {
  CompanyProfile,
  Classification,
  ComplianceReport,
} from "@/types/api";
import type { ChatContext } from "./ChatPopup";

interface ServiceClassificationProps {
  companyProfile: CompanyProfile;
  topDomain?: string | null;
  summaryLong?: string | null;
  onComplete: (report: ComplianceReport) => void;
  onError: (error: string) => void;
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
  extracting: "Building Company Profile",
  classifying: "Determining DSA Classification",
  analyzing: "Mapping Applicable Obligations",
  generating: "Compiling Compliance Report",
  complete: "Classification Complete",
};

const stageDescriptions: Record<ClassificationStage, string> = {
  starting: "Preparing the analysis engine",
  extracting: "Extracting key business characteristics from research findings",
  classifying: "Evaluating service type, territorial reach, and platform status under DSA criteria",
  analyzing: "Identifying which DSA obligations apply based on your classification",
  generating: "Creating your personalized compliance assessment",
  complete: "Your DSA compliance classification is ready",
};

// Comprehensive article details for each stage with extended explanations
interface ArticleDetail {
  article: string;
  title: string;
  description: string;
  keyQuestion: string;
  icon: React.ReactNode;
}

const stageArticleDetails: Record<ClassificationStage, ArticleDetail[]> = {
  starting: [],
  extracting: [
    {
      article: "Art. 2(1)",
      title: "Material Scope",
      description: "Determining if services fall within DSA's regulatory perimeter based on intermediary service provision to EU recipients.",
      keyQuestion: "Does the service transmit, store, or host information provided by recipients?",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      article: "Art. 2(2)",
      title: "Excluded Services",
      description: "Checking for exclusions including electronic communications services and services covered by sector-specific EU law.",
      keyQuestion: "Is the service excluded under telecommunications or other EU regulations?",
      icon: <XCircle className="w-4 h-4" />,
    },
    {
      article: "Art. 3(a)",
      title: "Recipient Definition",
      description: "Identifying who qualifies as a service recipient—any natural or legal person using the intermediary service.",
      keyQuestion: "Who are the end users and business users of this service?",
      icon: <Users className="w-4 h-4" />,
    },
    {
      article: "Art. 3(b)",
      title: "Consumer Definition",
      description: "Distinguishing consumers from business users for applicable consumer protection provisions.",
      keyQuestion: "Does the service primarily serve consumers or business customers?",
      icon: <Users className="w-4 h-4" />,
    },
    {
      article: "Art. 3(d)",
      title: "Establishment Location",
      description: "Determining the provider's establishment for jurisdictional and supervisory authority purposes.",
      keyQuestion: "Where is the provider legally established within the EU?",
      icon: <Building2 className="w-4 h-4" />,
    },
  ],
  classifying: [
    {
      article: "Art. 2(1)",
      title: "Territorial Scope Assessment",
      description: "Evaluating whether services are offered to recipients in the European Union, regardless of provider location.",
      keyQuestion: "Are services offered to or accessible by users in EU Member States?",
      icon: <Globe className="w-4 h-4" />,
    },
    {
      article: "Art. 3(g)",
      title: "Intermediary Service Definition",
      description: "Core classification as an information society service that transmits, caches, or hosts third-party content.",
      keyQuestion: "Does the service store or transmit information provided by users?",
      icon: <Network className="w-4 h-4" />,
    },
    {
      article: "Art. 4",
      title: "Mere Conduit Services",
      description: "Services that transmit information or provide network access without storing content beyond technical necessity.",
      keyQuestion: "Is the service limited to transmission without content selection or modification?",
      icon: <Network className="w-4 h-4" />,
    },
    {
      article: "Art. 5",
      title: "Caching Services",
      description: "Automatic, intermediate, and temporary storage for more efficient onward transmission to other recipients.",
      keyQuestion: "Does the service cache content to improve transmission efficiency?",
      icon: <Server className="w-4 h-4" />,
    },
    {
      article: "Art. 6",
      title: "Hosting Services",
      description: "Storage of information provided by and at the request of recipients—the foundation for platform classification.",
      keyQuestion: "Does the service store user-provided content on an ongoing basis?",
      icon: <Server className="w-4 h-4" />,
    },
    {
      article: "Art. 3(i)",
      title: "Online Platform Classification",
      description: "Hosting services that disseminate information to the public at the recipient's request. Triggers additional obligations.",
      keyQuestion: "Can users share content publicly through the service?",
      icon: <Megaphone className="w-4 h-4" />,
    },
    {
      article: "Art. 3(j)",
      title: "Online Search Engine",
      description: "Services allowing users to search all websites based on queries, returning results on any subject.",
      keyQuestion: "Does the service index and search across third-party websites?",
      icon: <Search className="w-4 h-4" />,
    },
    {
      article: "Art. 3(k)",
      title: "Online Marketplace",
      description: "Platforms enabling consumers to conclude distance contracts with traders for goods or services.",
      keyQuestion: "Can consumers purchase from third-party sellers through this platform?",
      icon: <Store className="w-4 h-4" />,
    },
    {
      article: "Art. 33",
      title: "VLOP/VLOSE Designation",
      description: "Very Large Online Platforms and Search Engines with 45+ million monthly EU users face enhanced obligations.",
      keyQuestion: "Does the service have over 45 million average monthly active users in the EU?",
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      article: "Recital 19",
      title: "SME Exemption Analysis",
      description: "Small and micro enterprises may qualify for exemptions from certain platform obligations under EU SME definitions.",
      keyQuestion: "Does the provider qualify as a small or micro enterprise under EU criteria?",
      icon: <Scale className="w-4 h-4" />,
    },
  ],
  analyzing: [
    {
      article: "Art. 8",
      title: "No General Monitoring",
      description: "Prohibition on imposing general obligations to monitor content or actively seek facts indicating illegal activity.",
      keyQuestion: "Does compliance avoid imposing general content surveillance requirements?",
      icon: <Eye className="w-4 h-4" />,
    },
    {
      article: "Art. 9",
      title: "Orders Against Illegal Content",
      description: "Requirements for acting on judicial or administrative orders to remove or disable access to illegal content.",
      keyQuestion: "What procedures exist for responding to removal orders from authorities?",
      icon: <Gavel className="w-4 h-4" />,
    },
    {
      article: "Art. 10",
      title: "Information Orders",
      description: "Obligations to provide specific information about recipients when ordered by competent authorities.",
      keyQuestion: "Can the service provide user information when legally required?",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      article: "Art. 11",
      title: "Points of Contact",
      description: "Designation of single points of contact for direct electronic communication with authorities and recipients.",
      keyQuestion: "Is there a designated contact point for regulatory communications?",
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      article: "Art. 12",
      title: "Legal Representatives",
      description: "Non-EU providers must designate a legal representative in an EU Member State where services are offered.",
      keyQuestion: "For non-EU providers: Is a legal representative designated in the EU?",
      icon: <Users className="w-4 h-4" />,
    },
    {
      article: "Art. 13",
      title: "Terms and Conditions",
      description: "Clear terms including content moderation policies, algorithmic decision-making, and complaint mechanisms.",
      keyQuestion: "Do terms of service clearly explain content policies and user rights?",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      article: "Art. 14",
      title: "Transparency Reporting",
      description: "Annual public reports on content moderation activities, orders received, and complaints handled.",
      keyQuestion: "Are annual transparency reports published with required metrics?",
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      article: "Art. 16",
      title: "Notice and Action Mechanism",
      description: "Systems allowing anyone to notify illegal content with sufficient precision for provider assessment.",
      keyQuestion: "Is there an accessible mechanism for reporting illegal content?",
      icon: <Flag className="w-4 h-4" />,
    },
    {
      article: "Art. 17",
      title: "Statement of Reasons",
      description: "Clear explanations when restricting content or accounts, including legal basis and redress options.",
      keyQuestion: "Are affected users informed of restriction reasons and appeal options?",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      article: "Art. 20",
      title: "Internal Complaint Handling",
      description: "Free electronic systems for users to contest content moderation decisions for at least six months.",
      keyQuestion: "Can users appeal content decisions through an internal process?",
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      article: "Art. 21",
      title: "Out-of-Court Settlement",
      description: "Information about and access to certified out-of-court dispute resolution bodies.",
      keyQuestion: "Are users informed about external dispute resolution options?",
      icon: <Scale className="w-4 h-4" />,
    },
    {
      article: "Art. 22",
      title: "Trusted Flaggers",
      description: "Priority processing for notices from entities with demonstrated expertise in illegal content detection.",
      keyQuestion: "Is there a system for prioritizing trusted flagger notifications?",
      icon: <Shield className="w-4 h-4" />,
    },
    {
      article: "Art. 23",
      title: "Misuse Measures",
      description: "Protections against abuse through manifestly illegal content, unfounded notices, or frivolous complaints.",
      keyQuestion: "Are there safeguards against systematic misuse of notice systems?",
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      article: "Art. 24",
      title: "Advertising Transparency",
      description: "Clear labeling of advertisements and disclosure of who paid for and is targeted by each ad.",
      keyQuestion: "Are ads clearly labeled with advertiser and targeting information?",
      icon: <Megaphone className="w-4 h-4" />,
    },
    {
      article: "Art. 25",
      title: "Recommender Transparency",
      description: "Disclosure of main parameters in recommender systems and options for users to modify recommendations.",
      keyQuestion: "Can users understand and influence how content is recommended to them?",
      icon: <Lightbulb className="w-4 h-4" />,
    },
    {
      article: "Art. 26",
      title: "Minor Protection",
      description: "Appropriate measures to ensure high privacy and safety for minors using the platform.",
      keyQuestion: "Are there specific protections for users under 18?",
      icon: <Shield className="w-4 h-4" />,
    },
    {
      article: "Art. 27",
      title: "Trader Verification",
      description: "Marketplace requirements to verify and display trader identity, contact, and registration information.",
      keyQuestion: "For marketplaces: Are seller identities verified before listing?",
      icon: <Store className="w-4 h-4" />,
    },
    {
      article: "Art. 28",
      title: "Consumer Information",
      description: "Marketplace obligations to inform consumers about third-party sellers and applicable consumer rights.",
      keyQuestion: "Are buyers informed about seller identity and their consumer rights?",
      icon: <AlertCircle className="w-4 h-4" />,
    },
    {
      article: "Art. 34-43",
      title: "VLOP Systemic Risk",
      description: "Enhanced obligations for very large platforms including risk assessments, audits, and crisis response.",
      keyQuestion: "For VLOPs: Are systemic risks assessed and mitigated?",
      icon: <ShieldAlert className="w-4 h-4" />,
    },
  ],
  generating: [
    {
      article: "Summary",
      title: "Classification Results",
      description: "Consolidating territorial scope, service category, and size designation into a unified classification.",
      keyQuestion: "What is the final DSA classification for this service?",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      article: "Obligations",
      title: "Applicable Requirements",
      description: "Mapping all DSA articles that apply based on the determined classification tier.",
      keyQuestion: "Which specific DSA obligations apply to this provider?",
      icon: <Gavel className="w-4 h-4" />,
    },
    {
      article: "Timeline",
      title: "Compliance Deadlines",
      description: "Identifying relevant dates for obligation phase-in and reporting requirements.",
      keyQuestion: "When must each obligation be implemented?",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      article: "Actions",
      title: "Recommended Steps",
      description: "Generating prioritized action items based on current compliance gaps.",
      keyQuestion: "What are the most urgent compliance actions needed?",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      article: "Report",
      title: "Final Assessment",
      description: "Compiling the complete compliance report with all findings and recommendations.",
      keyQuestion: "What does the complete compliance picture look like?",
      icon: <BookOpen className="w-4 h-4" />,
    },
  ],
  complete: [],
};

// Stage progress configuration
const stageOrder: ClassificationStage[] = ["extracting", "classifying", "analyzing", "generating"];

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
  const [classification, setClassification] = useState<Classification | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["territorial", "service", "size", "summary"])
  );
  const [isProcessing, setIsProcessing] = useState(true);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const streamRef = useRef<boolean>(false);

  // Track current article for animated progress
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const currentStageArticles = stageArticleDetails[stage];

  // Cycle through articles (8 seconds per article)
  useEffect(() => {
    if (!isProcessing || currentStageArticles.length === 0) {
      setCurrentArticleIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentArticleIndex((prev) => (prev + 1) % currentStageArticles.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [isProcessing, stage, currentStageArticles.length]);

  // Reset article index when stage changes
  useEffect(() => {
    setCurrentArticleIndex(0);
  }, [stage]);

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
                service_category: classification.service_classification.service_category,
                is_intermediary: classification.service_classification.is_intermediary,
                is_online_platform: classification.service_classification.is_online_platform,
                is_marketplace: classification.service_classification.is_marketplace,
                is_search_engine: classification.service_classification.is_search_engine,
                platform_reasoning: classification.service_classification.platform_reasoning,
              },
              size: {
                is_vlop_vlose: classification.size_designation.is_vlop_vlose,
                qualifies_for_sme_exemption: classification.size_designation.qualifies_for_sme_exemption,
                reasoning: classification.size_designation.reasoning,
              },
            }
          : undefined,
      },
    });
  }, [onVisibleStateChange, stage, isProcessing, streamedTextTail, expandedSections, classification]);

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
  }, [companyProfile, topDomain, summaryLong, onComplete, onError]);

  const handleContinue = () => {
    if (report) {
      onComplete(report);
    }
  };

  const currentArticle = currentStageArticles[currentArticleIndex];
  const currentStageIndex = stageOrder.indexOf(stage as typeof stageOrder[number]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Processing State */}
      {isProcessing && (
        <div className="space-y-6">
          {/* Timeline */}
          <div className="border border-[#e7e5e4] p-5">
            <div className="flex items-center justify-between">
              {stageOrder.map((s, idx) => {
                const isComplete = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div key={s} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-8 h-8 flex items-center justify-center text-xs font-mono transition-all ${
                          isComplete || isCurrent
                            ? "bg-[#0a0a0a] text-white"
                            : "border border-[#e7e5e4] text-[#78716c]"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span className={`text-[10px] font-mono uppercase tracking-wider mt-2 ${
                        isComplete || isCurrent ? "text-[#0a0a0a]" : "text-[#a8a29e]"
                      }`}>
                        {stageLabels[s].split(" ").slice(-1)[0]}
                      </span>
                    </div>
                    {idx < stageOrder.length - 1 && (
                      <div
                        className={`h-px flex-1 mx-3 ${
                          idx < currentStageIndex ? "bg-[#0a0a0a]" : "bg-[#e7e5e4]"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content Card */}
          <AnimatePresence mode="wait">
            {currentArticle && (
              <motion.div
                key={`${stage}-${currentArticleIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border border-[#e7e5e4] p-5"
              >
                <p className="font-mono text-xs text-[#78716c] mb-1">
                  {currentArticle.article}
                </p>
                <p className="text-sm text-[#0a0a0a] font-medium mb-2">
                  {currentArticle.title}
                </p>
                <p className="text-sm text-[#78716c] leading-relaxed">
                  {currentArticle.description}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Classification Results */}
      <AnimatePresence mode="wait">
        {classification && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            {/* Success Header */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Scale className="w-6 h-6 text-[#16a34a]" />
                <h2 className="font-serif text-2xl text-[#0a0a0a]">
                  Classification Complete
                </h2>
              </div>
              <p className="text-sm text-[#78716c]">
                Your DSA compliance classification is ready for review
              </p>
            </div>

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
              statusLabel={classification.service_classification.service_category}
              isExpanded={expandedSections.has("service")}
              onToggle={() => toggleSection("service")}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <StatusBadge
                    label="Mere Conduit"
                    value={classification.service_classification.service_category === "Mere Conduit"}
                    highlight={classification.service_classification.service_category === "Mere Conduit"}
                  />
                  <StatusBadge
                    label="Caching"
                    value={classification.service_classification.service_category === "Caching"}
                    highlight={classification.service_classification.service_category === "Caching"}
                  />
                  <StatusBadge
                    label="Hosting"
                    value={classification.service_classification.service_category === "Hosting"}
                    highlight={classification.service_classification.service_category === "Hosting"}
                  />
                  <StatusBadge
                    label="Online Platform"
                    value={classification.service_classification.is_online_platform}
                    highlight={classification.service_classification.is_online_platform}
                  />
                  <StatusBadge
                    label="Online Marketplace"
                    value={classification.service_classification.is_marketplace}
                    highlight={classification.service_classification.is_marketplace}
                  />
                  <StatusBadge
                    label="Search Engine"
                    value={classification.service_classification.is_search_engine}
                    highlight={classification.service_classification.is_search_engine}
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
                    value={classification.size_designation.qualifies_for_sme_exemption || false}
                    highlight={classification.size_designation.qualifies_for_sme_exemption}
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
