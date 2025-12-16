"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import {
  ProgressStepper,
  CompanyMatcher,
  DeepResearch,
  ResearchReview,
  ManualDataEntry,
  ChatPopup,
  ServiceClassification,
  ComplianceDashboard,
  type AssessmentPhase,
  type ChatPhase,
  type ChatContext,
  type ContextMode,
} from "@/components/assessment";
import { Button } from "@/components/ui";
import { startNewSession, getSessionId } from "@/services/api";
import type {
  CompanyResearchResult,
  SubQuestionAnswer,
  ResearchSection,
} from "@/types/research";
import type {
  CompanyMatch,
  CompanyProfile,
  ComplianceReport,
  ObligationAnalysis,
} from "@/types/api";

type ResearchStep =
  | "company_match"
  | "deep_research"
  | "review_scope"
  | "review_size"
  | "review_type"
  | "manual_scope"
  | "manual_size"
  | "manual_type"
  | "complete"
  | "error";

const PERSISTENCE_KEY = "corinna_assessment_state";

export default function AssessmentPage() {
  const [currentPhase, setCurrentPhase] = useState<AssessmentPhase>("research");
  const [completedPhases, setCompletedPhases] = useState<AssessmentPhase[]>([]);
  const [researchStep, setResearchStep] =
    useState<ResearchStep>("company_match");
  const [selectedCompany, setSelectedCompany] = useState<CompanyMatch | null>(
    null
  );
  const [researchResult, setResearchResult] =
    useState<CompanyResearchResult | null>(null);
  const [confirmedAnswers, setConfirmedAnswers] = useState<
    Record<ResearchSection, SubQuestionAnswer[]>
  >({} as Record<ResearchSection, SubQuestionAnswer[]>);
  const [error, setError] = useState<string | null>(null);
  const [complianceReport, setComplianceReport] =
    useState<ComplianceReport | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [visibleUiStep, setVisibleUiStep] =
    useState<ChatContext["visibleUi"]>();
  const [corinnaQuestion, setCorinnaQuestion] = useState<string>("");
  const [contextMode, setContextMode] = useState<ContextMode>("general");
  const [hasHydrated, setHasHydrated] = useState(false);

  const persistNow = useCallback(
    (
      partial: Partial<{
        currentPhase: AssessmentPhase;
        completedPhases: AssessmentPhase[];
        researchStep: ResearchStep;
        selectedCompany: CompanyMatch | null;
        researchResult: CompanyResearchResult | null;
        confirmedAnswers: Record<ResearchSection, SubQuestionAnswer[]>;
        error: string | null;
        complianceReport: ComplianceReport | null;
        isManualEntry: boolean;
        visibleUiStep: ChatContext["visibleUi"];
        contextMode: ContextMode;
        corinnaQuestion: string;
      }>
    ) => {
      if (typeof window === "undefined") return;
      try {
        const payload = {
          currentPhase,
          completedPhases,
          researchStep,
          selectedCompany,
          researchResult,
          confirmedAnswers,
          error,
          complianceReport,
          isManualEntry,
          visibleUiStep,
          contextMode,
          corinnaQuestion,
          ...partial,
        };
        sessionStorage.setItem(PERSISTENCE_KEY, JSON.stringify(payload));
      } catch {
        // ignore persistence errors
      }
    },
    [
      currentPhase,
      completedPhases,
      researchStep,
      selectedCompany,
      researchResult,
      confirmedAnswers,
      error,
      complianceReport,
      isManualEntry,
      visibleUiStep,
      contextMode,
      corinnaQuestion,
    ]
  );

  // Restore state from sessionStorage so a refresh continues the flow
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(PERSISTENCE_KEY);
    if (!raw) {
      setHasHydrated(true);
      return;
    }

    try {
      const data = JSON.parse(raw) as {
        currentPhase?: AssessmentPhase;
        completedPhases?: AssessmentPhase[];
        researchStep?: ResearchStep;
        selectedCompany?: CompanyMatch | null;
        researchResult?: CompanyResearchResult | null;
        confirmedAnswers?: Record<ResearchSection, SubQuestionAnswer[]>;
        error?: string | null;
        complianceReport?: ComplianceReport | null;
        isManualEntry?: boolean;
        visibleUiStep?: ChatContext["visibleUi"];
        contextMode?: ContextMode;
        corinnaQuestion?: string;
      };

      if (data.currentPhase) setCurrentPhase(data.currentPhase);
      if (data.completedPhases) setCompletedPhases(data.completedPhases);
      if (data.researchStep) setResearchStep(data.researchStep);
      if (data.selectedCompany) setSelectedCompany(data.selectedCompany);
      if (data.researchResult) setResearchResult(data.researchResult);
      if (data.confirmedAnswers) setConfirmedAnswers(data.confirmedAnswers);
      if (typeof data.error !== "undefined") setError(data.error);
      if (data.complianceReport) setComplianceReport(data.complianceReport);
      if (typeof data.isManualEntry === "boolean")
        setIsManualEntry(data.isManualEntry);
      if (data.visibleUiStep) setVisibleUiStep(data.visibleUiStep);
      if (data.contextMode) setContextMode(data.contextMode);
      if (data.corinnaQuestion) setCorinnaQuestion(data.corinnaQuestion);
    } catch (e) {
      console.warn("[SNIP] Failed to restore assessment state", e);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  // Persist state so refresh keeps the current position
  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated) return;

    const payload = {
      currentPhase,
      completedPhases,
      researchStep,
      selectedCompany,
      researchResult,
      confirmedAnswers,
      error,
      complianceReport,
      isManualEntry,
      visibleUiStep,
      contextMode,
      corinnaQuestion,
    };

    try {
      sessionStorage.setItem(PERSISTENCE_KEY, JSON.stringify(payload));
    } catch (e) {
      // sessionStorage might be full (quota exceeded), especially with large compliance reports
      // Try to persist at least the essential navigation state without the large report
      console.warn("[SNIP] Failed to persist full state, trying minimal:", e);
      try {
        const minimalPayload = {
          currentPhase,
          completedPhases,
          researchStep,
          selectedCompany,
          // Skip researchResult and complianceReport as they can be large
          confirmedAnswers,
          error,
          complianceReport: null, // Mark as needing re-fetch
          isManualEntry,
          contextMode,
        };
        sessionStorage.setItem(PERSISTENCE_KEY, JSON.stringify(minimalPayload));
      } catch (e2) {
        console.warn("[SNIP] Failed to persist even minimal state:", e2);
      }
    }
  }, [
    hasHydrated,
    currentPhase,
    completedPhases,
    researchStep,
    selectedCompany,
    researchResult,
    confirmedAnswers,
    error,
    complianceReport,
    isManualEntry,
    visibleUiStep,
    contextMode,
    corinnaQuestion,
  ]);

  // Reset visible UI snapshot when the user navigates to a different step.
  useEffect(() => {
    // This is an intentional reset when the route-level step changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleUiStep(undefined);
  }, [currentPhase, researchStep]);

  // Build comprehensive chat context from all visible data
  const chatContext = useMemo((): ChatContext => {
    // Determine chat phase based on current state
    let phase: ChatPhase = "company_match";
    if (currentPhase === "report") {
      phase = "report";
    } else if (currentPhase === "classify") {
      phase = "classify";
    } else {
      switch (researchStep) {
        case "company_match":
          phase = "company_match";
          break;
        case "deep_research":
          phase = "deep_research";
          break;
        case "review_scope":
        case "manual_scope":
          phase = "review_scope";
          break;
        case "review_size":
        case "manual_size":
          phase = "review_size";
          break;
        case "review_type":
        case "manual_type":
          phase = "review_type";
          break;
        default:
          phase = "company_match";
      }
    }

    // Build research data from confirmed answers
    const researchData: ChatContext["researchData"] = {};

    if (confirmedAnswers["GEOGRAPHICAL SCOPE"]) {
      researchData.geographicalScope = confirmedAnswers[
        "GEOGRAPHICAL SCOPE"
      ].map((a) => ({
        question: a.question,
        answer: a.answer,
        confidence: a.confidence,
      }));
    }

    if (confirmedAnswers["COMPANY SIZE"]) {
      researchData.companySize = confirmedAnswers["COMPANY SIZE"].map((a) => ({
        question: a.question,
        answer: a.answer,
        confidence: a.confidence,
      }));
    }

    if (confirmedAnswers["TYPE OF SERVICE PROVIDED"]) {
      researchData.serviceType = confirmedAnswers[
        "TYPE OF SERVICE PROVIDED"
      ].map((a) => ({
        question: a.question,
        answer: a.answer,
        confidence: a.confidence,
      }));
    }

    // Build classification data
    let classificationData: ChatContext["classificationData"];
    if (complianceReport) {
      classificationData = {
        serviceCategory:
          complianceReport.classification.service_classification
            .service_category,
        isIntermediary:
          complianceReport.classification.service_classification
            .is_intermediary,
        isOnlinePlatform:
          complianceReport.classification.service_classification
            .is_online_platform,
        isMarketplace:
          complianceReport.classification.service_classification.is_marketplace,
        isSearchEngine:
          complianceReport.classification.service_classification
            .is_search_engine,
        isVLOP: complianceReport.classification.size_designation.is_vlop_vlose,
        smeExemption:
          complianceReport.classification.size_designation
            .qualifies_for_sme_exemption,
      };
    }

    // Build compliance data
    let complianceData: ChatContext["complianceData"];
    if (complianceReport) {
      const applicableObligations = complianceReport.obligations.filter(
        (o) => o.applies
      );
      complianceData = {
        applicableObligations: applicableObligations.length,
        totalObligations: complianceReport.obligations.length,
        summary: complianceReport.summary?.substring(0, 500),
      };
    }

    return {
      phase,
      companyName: selectedCompany?.name || researchResult?.company_name,
      companyUrl: selectedCompany?.top_domain,
      visibleUi: {
        app: {
          currentPhase,
          researchStep,
          isManualEntry,
          completedPhases,
        },
        ...(visibleUiStep || {}),
      },
      researchData:
        Object.keys(researchData).length > 0 ? researchData : undefined,
      classificationData,
      complianceData,
    };
  }, [
    currentPhase,
    researchStep,
    selectedCompany,
    researchResult,
    confirmedAnswers,
    complianceReport,
    completedPhases,
    isManualEntry,
    visibleUiStep,
  ]);

  // Build company profile from confirmed answers
  const companyProfile = useMemo((): CompanyProfile => {
    if (!researchResult) {
      return { company_name: selectedCompany?.name || "" };
    }

    // Convert confirmed answers to the profile format
    const profile: CompanyProfile = {
      company_name: researchResult.company_name,
      research_answers: {
        geographical_scope: confirmedAnswers["GEOGRAPHICAL SCOPE"]?.map(
          (a) => ({
            question: a.question,
            answer: a.answer,
            source: a.source,
            confidence: a.confidence,
          })
        ),
        company_size: confirmedAnswers["COMPANY SIZE"]?.map((a) => ({
          question: a.question,
          answer: a.answer,
          source: a.source,
          confidence: a.confidence,
        })),
        service_type: confirmedAnswers["TYPE OF SERVICE PROVIDED"]?.map(
          (a) => ({
            question: a.question,
            answer: a.answer,
            source: a.source,
            confidence: a.confidence,
          })
        ),
      },
    };

    // Extract key information from answers
    const allAnswers = Object.values(confirmedAnswers).flat();

    // Try to extract description from service type answers
    const serviceAnswers = confirmedAnswers["TYPE OF SERVICE PROVIDED"] || [];
    if (serviceAnswers.length > 0) {
      profile.description = serviceAnswers.map((a) => a.answer).join(" ");
    }

    // Try to extract services list
    const serviceTypeAnswer = serviceAnswers.find(
      (a) =>
        a.question.toLowerCase().includes("service") ||
        a.question.toLowerCase().includes("platform")
    );
    if (serviceTypeAnswer) {
      profile.services = [serviceTypeAnswer.answer];
    }

    return profile;
  }, [researchResult, confirmedAnswers, selectedCompany]);

  // Get answers for a specific section
  const getAnswersForSection = (
    section: ResearchSection
  ): SubQuestionAnswer[] => {
    if (!researchResult) return [];
    return researchResult.answers.filter((a) => a.section === section);
  };

  // Current review section based on step
  const currentReviewSection = useMemo((): ResearchSection | null => {
    switch (researchStep) {
      case "review_scope":
      case "manual_scope":
        return "GEOGRAPHICAL SCOPE";
      case "review_size":
      case "manual_size":
        return "COMPANY SIZE";
      case "review_type":
      case "manual_type":
        return "TYPE OF SERVICE PROVIDED";
      default:
        return null;
    }
  }, [researchStep]);

  // Current step number for review
  const currentReviewStep = useMemo(() => {
    switch (researchStep) {
      case "review_scope":
      case "manual_scope":
        return 1;
      case "review_size":
      case "manual_size":
        return 2;
      case "review_type":
      case "manual_type":
        return 3;
      default:
        return 0;
    }
  }, [researchStep]);

  // Current manual section index (0-based)
  const currentManualSectionIndex = useMemo(() => {
    switch (researchStep) {
      case "manual_scope":
        return 0;
      case "manual_size":
        return 1;
      case "manual_type":
        return 2;
      default:
        return -1;
    }
  }, [researchStep]);

  const handleCompanySelected = useCallback(
    (company: CompanyMatch) => {
      setSelectedCompany(company);
      // Persist immediately so refresh can't drop us back
      persistNow({ selectedCompany: company });
    },
    [persistNow]
  );

  const handleStartResearch = useCallback(
    (_companyName: string) => {
      setResearchStep("deep_research");
      // Persist immediately so a refresh during stream stays on deep research
      persistNow({ researchStep: "deep_research" });
      // Clear company matcher state since we've moved past it
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("corinna_company_matcher_state");
      }
    },
    [persistNow]
  );

  const handleResearchComplete = useCallback(
    (result: CompanyResearchResult) => {
      setResearchResult(result);
      setResearchStep("review_scope");
      // Clear deep research state since we've moved past it
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("corinna_deep_research_state");
      }
    },
    []
  );

  const handleResearchError = useCallback((errorMsg: string) => {
    setError(
      typeof errorMsg === "string" && errorMsg.trim()
        ? errorMsg
        : "An unexpected error occurred during research."
    );
    setResearchStep("error");
  }, []);

  const handleConfirmSection = (
    section: ResearchSection,
    answers: SubQuestionAnswer[]
  ) => {
    setConfirmedAnswers((prev) => ({ ...prev, [section]: answers }));

    // Move to next step - different paths for manual vs research flow
    if (isManualEntry) {
      switch (section) {
        case "GEOGRAPHICAL SCOPE":
          setResearchStep("manual_size");
          break;
        case "COMPANY SIZE":
          setResearchStep("manual_type");
          break;
        case "TYPE OF SERVICE PROVIDED":
          setResearchStep("complete");
          setCompletedPhases(["research"]);
          setCurrentPhase("classify");
          break;
      }
    } else {
      switch (section) {
        case "GEOGRAPHICAL SCOPE":
          setResearchStep("review_size");
          break;
        case "COMPANY SIZE":
          setResearchStep("review_type");
          break;
        case "TYPE OF SERVICE PROVIDED":
          setResearchStep("complete");
          setCompletedPhases(["research"]);
          setCurrentPhase("classify");
          break;
      }
    }
  };

  const handleBack = () => {
    if (isManualEntry) {
      switch (researchStep) {
        case "manual_size":
          setResearchStep("manual_scope");
          break;
        case "manual_type":
          setResearchStep("manual_size");
          break;
      }
    } else {
      switch (researchStep) {
        case "review_size":
          setResearchStep("review_scope");
          break;
        case "review_type":
          setResearchStep("review_size");
          break;
      }
    }
  };

  const handleReset = () => {
    // Start a new session for the new assessment
    startNewSession();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PERSISTENCE_KEY);
      sessionStorage.removeItem("corinna_company_matcher_state");
      sessionStorage.removeItem("corinna_deep_research_state");
    }

    setResearchStep("company_match");
    setSelectedCompany(null);
    setResearchResult(null);
    setConfirmedAnswers({} as Record<ResearchSection, SubQuestionAnswer[]>);
    setError(null);
    setCurrentPhase("research");
    setCompletedPhases([]);
    setComplianceReport(null);
    setIsManualEntry(false);
  };

  const handleManualEntry = (companyName: string, country: string) => {
    // Create a minimal company match for manual entry
    const manualCompany: CompanyMatch = {
      name: companyName || "Unknown Company",
      top_domain: "",
      confidence: "low",
      summary_short: `Manual entry for ${companyName || "company"} in ${
        country || "unspecified location"
      }`,
      summary_long: "",
    };
    setSelectedCompany(manualCompany);

    // Create empty research result for manual filling
    const emptyResult: CompanyResearchResult = {
      company_name: companyName || "Unknown Company",
      generated_at: new Date().toISOString(),
      answers: [],
    };
    setResearchResult(emptyResult);

    // Set manual entry mode and go to manual entry flow
    setIsManualEntry(true);
    setResearchStep("manual_scope");
  };

  const handleClassificationComplete = (report: ComplianceReport) => {
    setComplianceReport(report);
    setCompletedPhases(["research", "classify"]);
    setCurrentPhase("report");

    // Persist immediately so a fast refresh doesn't drop back to classification
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(PERSISTENCE_KEY);
        let base: Record<string, unknown> = {};
        if (raw) {
          try {
            base = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            // ignore parse errors, we'll overwrite with minimal state
          }
        }

        const minimalPayload = {
          ...base,
          currentPhase: "report" as AssessmentPhase,
          completedPhases: ["research", "classify"] as AssessmentPhase[],
          researchStep,
          selectedCompany,
          confirmedAnswers,
          isManualEntry,
          contextMode,
          // Do not persist full complianceReport here to avoid quota issues;
          // the effect-based persistence will try to store it separately.
        };

        sessionStorage.setItem(PERSISTENCE_KEY, JSON.stringify(minimalPayload));
      } catch {
        // If this fails, we still have in-memory state; worst case, the user will re-run classification.
      }
    }
  };

  const handleClassificationError = (errorMsg: string) => {
    setError(errorMsg);
    setResearchStep("error");
    setCurrentPhase("classify");
  };

  const handleContinueToClassification = () => {
    setCompletedPhases(["research"]);
    setCurrentPhase("classify");
  };

  const handleBackFromDashboard = () => {
    setCurrentPhase("classify");
    setCompletedPhases(["research"]);
    setComplianceReport(null);
  };

  const handleAskCorinna = useCallback((finding: SubQuestionAnswer) => {
    // Format a helpful question about this finding
    const question = `Help me understand this research finding:\n\nQuestion: ${finding.question}\n\nAnswer: ${finding.answer}\n\nSource: ${finding.source}\nConfidence: ${finding.confidence}\n\nWhat does this question mean and why is it relevant for DSA compliance? I need to decide if this answer is correct.`;
    setContextMode("review_findings");
    setCorinnaQuestion(question);
  }, []);

  const handleAskCorinnaObligation = useCallback(
    (obligation: ObligationAnalysis) => {
      // Format a helpful question about this obligation
      const question = `Help me understand this DSA obligation:\n\nArticle: ${
        obligation.article
      }\nTitle: ${obligation.title}\n\nApplies to my service: ${
        obligation.applies ? "Yes" : "No"
      }\n\nImplications: ${
        obligation.implications
      }\n\nWhat does this article require and why does it ${
        obligation.applies ? "apply" : "not apply"
      } to my service?`;
      setContextMode("obligations");
      setCorinnaQuestion(question);
    },
    []
  );

  const handleCorinnaQuestionSent = useCallback(() => {
    setCorinnaQuestion("");
    setContextMode("general");
  }, []);

  // Phase indicator text
  const phaseText = useMemo(() => {
    if (currentPhase === "classify") {
      return "Service Classification";
    }
    if (currentPhase === "report") {
      return "Compliance Dashboard";
    }
    switch (researchStep) {
      case "company_match":
        return "Organization Lookup";
      case "deep_research":
        return "Deep Research";
      case "review_scope":
      case "review_size":
      case "review_type":
        return "Review Findings";
      case "manual_scope":
      case "manual_size":
      case "manual_type":
        return "Manual Data Entry";
      case "complete":
        return "Research Complete";
      default:
        return "Research";
    }
  }, [researchStep, currentPhase]);

  return (
    <motion.main
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.625, ease: [0.4, 0, 0.2, 1] }}
      className="bg-[#fafaf9] flex flex-col overflow-hidden"
      style={{
        // Use large viewport height - stays constant even when keyboard appears
        // This prevents content from shifting into the notch when typing
        height: "100lvh", // Large viewport height - assumes keyboard is hidden
      }}
    >
      {/* Header - With notch-specific safe area handling and fixed positioning on mobile */}
      <header className="shrink-0 bg-[#fafaf9]/80 backdrop-blur-lg border-b border-[#e7e5e4] max-sm:sticky max-sm:top-0 max-sm:z-10">
        <div
          className="md:px-6 md:py-0 md:h-14 flex flex-col md:flex-row items-center gap-3 md:gap-0"
          style={{
            // On mobile devices with notch (iPhone X+), add safe area padding at top
            // This ensures the Corinna logo is never obscured by the notch, even when keyboard appears
            paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
            paddingBottom: "0.75rem",
            paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
            paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
          }}
        >
          <Link href="/" className="flex items-center md:mr-auto">
            <span className="font-serif text-3xl text-[#0a0a0a]">Corinna</span>
          </Link>

          <div className="w-full md:w-auto md:flex-1 md:flex md:justify-center">
            <ProgressStepper
              currentPhase={currentPhase}
              completedPhases={completedPhases}
            />
          </div>

          <div className="hidden md:block md:w-32" />
        </div>
      </header>

      {/* Main Content - With safe area handling for bottom home indicator */}
      <div
        className="flex-1 flex overflow-hidden"
        style={{
          // Add safe area padding at bottom for devices with home indicator
          paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Left Panel - Main Flow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex-1 flex flex-col px-6 pt-8 pb-6 overflow-y-auto"
        >
          <div
            className={`w-full mx-auto ${
              currentPhase === "report"
                ? "max-w-6xl"
                : currentPhase === "classify"
                ? "max-w-4xl"
                : "max-w-2xl"
            }`}
          >
            {/* Phase indicator */}
            <motion.div
              key={phaseText}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 mb-8"
            >
              <div className="w-1.5 h-1.5 bg-[#0a0a0a]" />
              <span className="font-mono text-xs uppercase tracking-wider text-[#78716c]">
                Phase{" "}
                {currentPhase === "research"
                  ? "1"
                  : currentPhase === "classify"
                  ? "2"
                  : "3"}
                : {phaseText}
              </span>
            </motion.div>

            {/* Content based on step */}
            <AnimatePresence mode="wait">
              {/* Research Phase */}
              {currentPhase === "research" && (
                <>
                  {researchStep === "company_match" && (
                    <motion.div
                      key="company_match"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <CompanyMatcher
                        onCompanySelected={handleCompanySelected}
                        onStartResearch={handleStartResearch}
                        onManualEntry={handleManualEntry}
                        onVisibleStateChange={setVisibleUiStep}
                      />
                    </motion.div>
                  )}

                  {researchStep === "deep_research" && selectedCompany && (
                    <motion.div
                      key="deep_research"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <DeepResearch
                        companyName={selectedCompany.name}
                        topDomain={selectedCompany.top_domain}
                        summaryLong={selectedCompany.summary_long}
                        onComplete={handleResearchComplete}
                        onError={handleResearchError}
                        onVisibleStateChange={setVisibleUiStep}
                      />
                    </motion.div>
                  )}

                  {currentReviewSection && researchResult && !isManualEntry && (
                    <motion.div
                      key={`review_${currentReviewSection}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <ResearchReview
                        section={currentReviewSection}
                        answers={
                          confirmedAnswers[currentReviewSection] ||
                          getAnswersForSection(currentReviewSection)
                        }
                        currentStep={currentReviewStep}
                        totalSteps={3}
                        isPreviouslyConfirmed={
                          !!confirmedAnswers[currentReviewSection]
                        }
                        onConfirm={(answers) =>
                          handleConfirmSection(currentReviewSection, answers)
                        }
                        onBack={handleBack}
                        onVisibleStateChange={setVisibleUiStep}
                        onAskCorinna={handleAskCorinna}
                      />
                    </motion.div>
                  )}

                  {isManualEntry &&
                    currentManualSectionIndex >= 0 &&
                    selectedCompany && (
                      <motion.div
                        key={`manual_${currentManualSectionIndex}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                      >
                        <ManualDataEntry
                          companyName={selectedCompany.name}
                          currentSectionIndex={currentManualSectionIndex}
                          onComplete={(section, answers) =>
                            handleConfirmSection(section, answers)
                          }
                          onBack={handleBack}
                          onVisibleStateChange={setVisibleUiStep}
                        />
                      </motion.div>
                    )}

                  {researchStep === "error" && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center text-center"
                    >
                      <div className="w-14 h-14 bg-[#fee2e2] flex items-center justify-center mb-6">
                        <AlertCircle className="w-6 h-6 text-[#dc2626]" />
                      </div>
                      <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
                        Research Failed
                      </h2>
                      <p className="font-sans text-sm text-[#78716c] mb-6 max-w-md">
                        {error ||
                          "An unexpected error occurred during research."}
                      </p>
                      <Button onClick={handleReset} variant="outline" size="lg">
                        <RotateCcw className="w-4 h-4" />
                        Start Over
                      </Button>
                    </motion.div>
                  )}
                </>
              )}

              {/* Classification Phase */}
              {currentPhase === "classify" && (
                <motion.div
                  key="classify"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {researchStep === "complete" && !complianceReport ? (
                    // Show transition screen
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 bg-[#dcfce7] flex items-center justify-center mb-6">
                        <Scale className="w-6 h-6 text-[#16a34a]" />
                      </div>
                      <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
                        Research Complete
                      </h2>
                      <p className="font-sans text-sm text-[#78716c] mb-8 max-w-md">
                        All findings have been reviewed and confirmed. Ready to
                        proceed with DSA service classification.
                      </p>
                      <ServiceClassification
                        companyProfile={companyProfile}
                        topDomain={selectedCompany?.top_domain}
                        summaryLong={selectedCompany?.summary_long}
                        onComplete={handleClassificationComplete}
                        onError={handleClassificationError}
                        onVisibleStateChange={setVisibleUiStep}
                      />
                    </div>
                  ) : (
                    <ServiceClassification
                      companyProfile={companyProfile}
                      topDomain={selectedCompany?.top_domain}
                      summaryLong={selectedCompany?.summary_long}
                      onComplete={handleClassificationComplete}
                      onError={handleClassificationError}
                      onVisibleStateChange={setVisibleUiStep}
                    />
                  )}
                </motion.div>
              )}

              {/* Report Phase */}
              {currentPhase === "report" && (
                <motion.div
                  key="report"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full"
                >
                  {complianceReport ? (
                    <ComplianceDashboard
                      report={complianceReport}
                      companyProfile={companyProfile}
                      onBack={handleBackFromDashboard}
                      onVisibleStateChange={setVisibleUiStep}
                      onAskCorinna={handleAskCorinnaObligation}
                    />
                  ) : (
                    // Report is missing (possibly due to sessionStorage limits) - show loading or re-run categorizer
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 bg-[#fef3c7] flex items-center justify-center mb-6">
                        <Scale className="w-6 h-6 text-[#d97706]" />
                      </div>
                      <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
                        Report Not Available
                      </h2>
                      <p className="font-sans text-sm text-[#78716c] mb-8 max-w-md">
                        The compliance report could not be restored. This may
                        happen after a page refresh if the report data was too
                        large. Please re-run the classification.
                      </p>
                      <Button
                        onClick={() => {
                          setCurrentPhase("classify");
                          setCompletedPhases(["research"]);
                        }}
                        variant="primary"
                        size="lg"
                      >
                        <Scale className="w-4 h-4" />
                        Re-run Classification
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Floating Chat Popup */}
      <ChatPopup
        context={chatContext}
        initialQuestion={corinnaQuestion}
        onInitialQuestionSent={handleCorinnaQuestionSent}
        contextMode={contextMode}
      />
    </motion.main>
  );
}
