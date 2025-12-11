"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import {
  ProgressStepper,
  CompanyMatcher,
  DeepResearch,
  ResearchReview,
  Chatbot,
  ServiceClassification,
  ComplianceDashboard,
  type AssessmentPhase,
} from "@/components/assessment";
import { Button } from "@/components/ui";
import type {
  CompanyResearchResult,
  SubQuestionAnswer,
  ResearchSection,
} from "@/types/research";
import type { CompanyProfile, ComplianceReport } from "@/types/api";
import {
  SECTION_LABELS,
  RESEARCH_SECTIONS as SECTIONS,
} from "@/types/research";

interface CompanyMatch {
  name: string;
  url: string;
  confidence: string;
}

type ResearchStep =
  | "company_match"
  | "deep_research"
  | "review_scope"
  | "review_size"
  | "review_type"
  | "complete"
  | "error";

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
  const [chatContext, setChatContext] = useState<string>("");
  const [complianceReport, setComplianceReport] =
    useState<ComplianceReport | null>(null);

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
        return "GEOGRAPHICAL SCOPE";
      case "review_size":
        return "COMPANY SIZE";
      case "review_type":
        return "TYPE OF SERVICE PROVIDED";
      default:
        return null;
    }
  }, [researchStep]);

  // Current step number for review
  const currentReviewStep = useMemo(() => {
    switch (researchStep) {
      case "review_scope":
        return 1;
      case "review_size":
        return 2;
      case "review_type":
        return 3;
      default:
        return 0;
    }
  }, [researchStep]);

  const handleCompanySelected = (company: CompanyMatch) => {
    setSelectedCompany(company);
    setChatContext(
      `User is researching company: ${company.name} (${company.url})`
    );
  };

  const handleStartResearch = (companyName: string) => {
    setResearchStep("deep_research");
    setChatContext(
      `Starting deep research for "${companyName}" to determine DSA compliance requirements.`
    );
  };

  const handleResearchComplete = (result: CompanyResearchResult) => {
    setResearchResult(result);
    setResearchStep("review_scope");
    setChatContext(
      `Deep research complete for "${result.company_name}". Now reviewing geographical scope findings.`
    );
  };

  const handleResearchError = (errorMsg: string) => {
    setError(errorMsg);
    setResearchStep("error");
  };

  const handleConfirmSection = (
    section: ResearchSection,
    answers: SubQuestionAnswer[]
  ) => {
    setConfirmedAnswers((prev) => ({ ...prev, [section]: answers }));

    // Move to next step
    switch (section) {
      case "GEOGRAPHICAL SCOPE":
        setResearchStep("review_size");
        setChatContext(
          `Geographical scope confirmed. Now reviewing company size classification.`
        );
        break;
      case "COMPANY SIZE":
        setResearchStep("review_type");
        setChatContext(
          `Company size confirmed. Now reviewing service type classification.`
        );
        break;
      case "TYPE OF SERVICE PROVIDED":
        setResearchStep("complete");
        setCompletedPhases(["research"]);
        setCurrentPhase("classify");
        setChatContext(
          `All research sections confirmed. Ready to proceed with DSA classification.`
        );
        break;
    }
  };

  const handleBack = () => {
    switch (researchStep) {
      case "review_size":
        setResearchStep("review_scope");
        break;
      case "review_type":
        setResearchStep("review_size");
        break;
    }
  };

  const handleReset = () => {
    setResearchStep("company_match");
    setSelectedCompany(null);
    setResearchResult(null);
    setConfirmedAnswers({} as Record<ResearchSection, SubQuestionAnswer[]>);
    setError(null);
    setCurrentPhase("research");
    setCompletedPhases([]);
    setComplianceReport(null);
  };

  const handleClassificationComplete = (report: ComplianceReport) => {
    setComplianceReport(report);
    setCompletedPhases(["research", "classify"]);
    setCurrentPhase("report");
    setChatContext(
      `Classification complete for "${report.company_name}". ${
        report.obligations.filter((o) => o.applies).length
      } DSA obligations apply.`
    );
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
      case "complete":
        return "Research Complete";
      default:
        return "Research";
    }
  }, [researchStep, currentPhase]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-screen bg-[#fafaf9] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <header className="shrink-0 bg-[#fafaf9]/80 backdrop-blur-lg border-b border-[#e7e5e4]">
        <div className="px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center">
            <span className="font-serif text-lg text-[#0a0a0a]">Corinna</span>
          </Link>

          <div className="flex-1 flex justify-center">
            <ProgressStepper
              currentPhase={currentPhase}
              completedPhases={completedPhases}
            />
          </div>

          <div className="w-32" />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
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
                        onComplete={handleResearchComplete}
                        onError={handleResearchError}
                      />
                    </motion.div>
                  )}

                  {currentReviewSection && researchResult && (
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
                        onConfirm={(answers) =>
                          handleConfirmSection(currentReviewSection, answers)
                        }
                        onBack={handleBack}
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
                        onComplete={handleClassificationComplete}
                        onError={handleClassificationError}
                      />
                    </div>
                  ) : (
                    <ServiceClassification
                      companyProfile={companyProfile}
                      onComplete={handleClassificationComplete}
                      onError={handleClassificationError}
                    />
                  )}
                </motion.div>
              )}

              {/* Report Phase */}
              {currentPhase === "report" && complianceReport && (
                <motion.div
                  key="report"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full"
                >
                  <ComplianceDashboard
                    report={complianceReport}
                    companyProfile={companyProfile}
                    onBack={handleBackFromDashboard}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right Panel - Chatbot */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-[360px] shrink-0 hidden lg:flex border-l border-[#e7e5e4]"
        >
          <Chatbot context={chatContext} />
        </motion.div>
      </div>
    </motion.main>
  );
}
