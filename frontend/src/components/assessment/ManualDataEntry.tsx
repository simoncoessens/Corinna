"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Users,
  Server,
  ChevronRight,
  Check,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SubQuestionAnswer } from "@/types/research";
import {
  ResearchSection,
  SECTION_LABELS,
  SECTION_DESCRIPTIONS,
} from "@/types/research";
import type { ChatContext } from "./ChatPopup";

interface ManualQuestion {
  id: string;
  question: string;
  placeholder: string;
  helpText?: string;
}

interface SectionData {
  section: ResearchSection;
  questions: ManualQuestion[];
}

// All questions from backend/agents/company_researcher/src/company_researcher/prompts/questions/
// q00-q06: GEOGRAPHICAL SCOPE
// q07-q09: COMPANY SIZE
// q10-q16: TYPE OF SERVICE PROVIDED
const MANUAL_SECTIONS: SectionData[] = [
  {
    section: "GEOGRAPHICAL SCOPE",
    questions: [
      {
        id: "q00_establishment_country",
        question: "What is the main establishment country for this company?",
        placeholder: "e.g., Germany, France, United States, Ireland...",
        helpText:
          "The country where the company is legally established or has its headquarters.",
      },
      {
        id: "q01_eu_user_base",
        question: "What is the EU user base for this company?",
        placeholder:
          "e.g., 5 million monthly active users in the EU, primarily in Germany and France...",
        helpText:
          "Describe the number and distribution of users in EU member states.",
      },
      {
        id: "q02_language",
        question:
          "What is the use of a language of a member state for this company?",
        placeholder:
          "e.g., The service is available in German, French, Spanish, Italian...",
        helpText: "List the EU languages supported by the service or platform.",
      },
      {
        id: "q03_currency",
        question:
          "What is the currency generally used in that member state for this company?",
        placeholder: "e.g., EUR (Euro), supports EUR and local currencies...",
        helpText: "Describe which currencies the service accepts or displays.",
      },
      {
        id: "q04_ordering_possibility",
        question:
          "What is the possibility of ordering products or services from EU member state for this company?",
        placeholder:
          "e.g., Yes, products can be ordered and shipped to all EU countries...",
        helpText:
          "Describe if and how EU users can order products or services.",
      },
      {
        id: "q05_top_level_domain",
        question:
          "What is the top level domain used for the service for this company?",
        placeholder: "e.g., .com, .eu, .de, .fr or country-specific domains...",
        helpText:
          "List the domain extensions used by the company's website(s).",
      },
      {
        id: "q06_accessibility",
        question:
          "What is the accessibility of the main website from the Union for this company?",
        placeholder:
          "e.g., The website is fully accessible from all EU countries without restrictions...",
        helpText:
          "Describe if the website is accessible from EU member states.",
      },
    ],
  },
  {
    section: "COMPANY SIZE",
    questions: [
      {
        id: "q07_employee_headcount",
        question: "What is the employee headcount of this company?",
        placeholder: "e.g., 50 employees, 250 employees, 10,000+ employees...",
        helpText:
          "The total number of full-time equivalent employees. SME threshold is <250 employees.",
      },
      {
        id: "q08_annual_turnover",
        question: "What is the annual turnover/revenue of this company?",
        placeholder: "e.g., €2 million, €10 million, €50 million+...",
        helpText:
          "The company's annual revenue or turnover in EUR. SME threshold is ≤€50 million.",
      },
      {
        id: "q09_balance_sheet",
        question: "What is the balance sheet total of this company?",
        placeholder: "e.g., €2 million, €10 million, €43 million+...",
        helpText:
          "The company's annual balance sheet total in EUR. SME threshold is ≤€43 million.",
      },
    ],
  },
  {
    section: "TYPE OF SERVICE PROVIDED",
    questions: [
      {
        id: "q10_service_type",
        question:
          "What type of digital/intermediary service does this company provide?",
        placeholder:
          "e.g., Social media platform, online marketplace, cloud hosting, video sharing...",
        helpText:
          "Describe the main digital or intermediary service offered by the company.",
      },
      {
        id: "q11_mere_conduit",
        question: "Does this company operate as a 'mere conduit'?",
        placeholder:
          "e.g., Yes/No. If yes, describe: transmits data without modification, like an ISP...",
        helpText:
          "A 'mere conduit' transmits information without initiating, selecting receiver, or modifying it (e.g., internet access providers).",
      },
      {
        id: "q12_caching",
        question: "Does this company operate as a 'caching service'?",
        placeholder:
          "e.g., Yes/No. If yes, describe: temporarily stores data for faster access...",
        helpText:
          "A 'caching' service automatically, intermediately, and temporarily stores information for more efficient onward transmission.",
      },
      {
        id: "q13_search_engine",
        question: "Does this company operate as a 'search engine'?",
        placeholder:
          "e.g., Yes/No. If yes, describe: allows users to search websites based on queries...",
        helpText:
          "An 'online search engine' allows users to search all websites based on a query.",
      },
      {
        id: "q14_hosting",
        question: "Does this company operate as a 'hosting service'?",
        placeholder:
          "e.g., Yes/No. If yes, describe: stores information provided by users...",
        helpText:
          "A 'hosting' service stores information provided by and at the request of users.",
      },
      {
        id: "q15_online_platform",
        question:
          "Does this company operate as an 'online platform' (subcategory of hosting service)?",
        placeholder:
          "e.g., Yes/No. If yes, describe: hosts user content and disseminates it to the public...",
        helpText:
          "An 'online platform' hosts and disseminates information to the public at the user's request (e.g., social networks, app stores).",
      },
      {
        id: "q16_marketplace",
        question:
          "Does this company operate as an 'online platform allowing consumers to conclude distance contracts with traders'?",
        placeholder:
          "e.g., Yes/No. If yes, describe: enables consumers to buy from third-party sellers...",
        helpText:
          "An online marketplace that allows consumers to conclude distance contracts with traders (e.g., Amazon Marketplace, eBay).",
      },
    ],
  },
];

interface ManualDataEntryProps {
  companyName: string;
  currentSectionIndex: number;
  onComplete: (section: ResearchSection, answers: SubQuestionAnswer[]) => void;
  onBack: () => void;
  /**
   * Emits a snapshot of what the user can currently see in this screen.
   */
  onVisibleStateChange?: (state: ChatContext["visibleUi"]) => void;
}

const SECTION_ICONS: Record<ResearchSection, typeof MapPin> = {
  "GEOGRAPHICAL SCOPE": MapPin,
  "COMPANY SIZE": Users,
  "TYPE OF SERVICE PROVIDED": Server,
};

export function ManualDataEntry({
  companyName,
  currentSectionIndex,
  onComplete,
  onBack,
  onVisibleStateChange,
}: ManualDataEntryProps) {
  const sectionData = MANUAL_SECTIONS[currentSectionIndex];
  const section = sectionData.section;
  const questions = sectionData.questions;

  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, ""]))
  );

  const Icon = SECTION_ICONS[section];
  const totalSteps = MANUAL_SECTIONS.length;
  const currentStep = currentSectionIndex + 1;

  // Check if all answers are filled
  const allFilled = useMemo(() => {
    return questions.every((q) => answers[q.id]?.trim().length > 0);
  }, [answers, questions]);

  // Count filled
  const filledCount = useMemo(() => {
    return questions.filter((q) => answers[q.id]?.trim().length > 0).length;
  }, [answers, questions]);

  useEffect(() => {
    if (!onVisibleStateChange) return;
    onVisibleStateChange({
      manualEntry: {
        section,
        currentStep,
        totalSteps,
        filledCount,
        totalQuestions: questions.length,
        allFilled,
        fields: questions.map((q) => ({
          id: q.id,
          question: q.question,
          answer: answers[q.id] || "",
          placeholder: q.placeholder,
          helpText: q.helpText,
        })),
      },
    });
  }, [
    onVisibleStateChange,
    section,
    currentStep,
    totalSteps,
    filledCount,
    allFilled,
    questions,
    answers,
  ]);

  const handleChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleConfirm = () => {
    // Convert answers to SubQuestionAnswer format
    const subQuestionAnswers: SubQuestionAnswer[] = questions.map((q) => ({
      section: section,
      question: q.question,
      answer: answers[q.id],
      source: "Manual entry",
      confidence: "High" as const,
      information_found: true, // User provided the information
    }));

    onComplete(section, subQuestionAnswers);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-[#57534e]" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-serif text-xl text-[#0a0a0a]">
                {SECTION_LABELS[section]}
              </h2>
              <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider px-2 py-0.5 bg-[#f5f5f4] border border-[#e7e5e4]">
                {currentStep} / {totalSteps}
              </span>
            </div>
            <p className="font-sans text-sm text-[#57534e] leading-relaxed">
              {SECTION_DESCRIPTIONS[section]}
            </p>
          </div>
        </div>

        {/* Manual Entry Notice */}
        <div className="flex items-start gap-3 p-4 bg-[#f5f5f4] border border-[#e7e5e4] mb-6">
          <PenLine className="w-4 h-4 text-[#57534e] mt-0.5 flex-shrink-0" />
          <p className="font-sans text-sm text-[#57534e]">
            Please provide information about{" "}
            <span className="font-medium text-[#0a0a0a]">{companyName}</span>.
            Fill in each field with as much detail as you have available.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
            Questions
          </span>
          <span className="font-mono text-[10px] text-[#57534e]">
            {filledCount} of {questions.length} answered
          </span>
        </div>

        {/* Questions */}
        <div className="space-y-4 mb-6">
          {questions.map((question, index) => {
            const value = answers[question.id] || "";
            const isFilled = value.trim().length > 0;

            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "border bg-white transition-colors",
                  isFilled ? "border-[#16a34a]/30" : "border-[#e7e5e4]"
                )}
              >
                {/* Question header */}
                <div className="px-4 py-3 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
                  <p className="font-sans text-sm font-medium text-[#0a0a0a] flex-1 pr-4">
                    {question.question}
                  </p>
                  {isFilled && (
                    <div className="w-5 h-5 bg-[#dcfce7] flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#16a34a]" />
                    </div>
                  )}
                </div>

                {/* Answer input */}
                <div className="p-4">
                  <textarea
                    value={value}
                    onChange={(e) => handleChange(question.id, e.target.value)}
                    placeholder={question.placeholder}
                    className={cn(
                      "w-full p-3 border border-[#e7e5e4] bg-white",
                      "font-sans text-sm text-[#0a0a0a] placeholder:text-[#a8a29e]",
                      "focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10",
                      "resize-none min-h-[80px]",
                      "transition-all duration-200"
                    )}
                  />
                  {question.helpText && (
                    <p className="mt-2 font-sans text-xs text-[#a8a29e]">
                      {question.helpText}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Continue button */}
        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button onClick={onBack} variant="outline" size="lg">
              Back
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!allFilled}
            variant="primary"
            size="lg"
            className="flex-1 group"
          >
            {currentStep === totalSteps ? (
              <>
                Complete Entry
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue to{" "}
                {currentStep === 1 ? "Company Size" : "Service Type"}
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </div>

        {!allFilled && (
          <p className="mt-3 font-mono text-[10px] text-center text-[#a8a29e]">
            Please answer all questions before continuing
          </p>
        )}
      </motion.div>
    </div>
  );
}
