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
  subtitle?: string;
  placeholder: string;
  helpText?: string;
}

interface SectionData {
  section: ResearchSection;
  questions: ManualQuestion[];
}

// All questions from backend/agents/company_researcher/src/company_researcher/prompts/questions/
// q00-q07: GEOGRAPHICAL SCOPE (8 questions)
// q08-q09: COMPANY SIZE (2 questions: employee headcount, turnover/balance sheet combined)
// q10-q16: TYPE OF SERVICE PROVIDED (7 questions)
const MANUAL_SECTIONS: SectionData[] = [
  {
    section: "GEOGRAPHICAL SCOPE",
    questions: [
      {
        id: "q00_establishment_country",
        question:
          "In which country is the service provider's main establishment or registered office located?",
        placeholder: "e.g., Germany, France, United States, Ireland...",
        helpText:
          "Search the official website, Terms of Service, Legal Imprint, or Privacy Policy to identify the specific entity providing the service and the physical address of their registered head office or main establishment. If multiple entities exist, identify the entity contracting with EU users.",
      },
      {
        id: "q01_eu_user_base",
        question:
          "What is the estimated number of 'average monthly active recipients' of the service in the Union?",
        placeholder:
          "e.g., 45 million average monthly active recipients in the EU...",
        helpText:
          "Locate the most recent DSA Transparency Report or Information on average monthly active recipients published by the provider for the European Union. Extract the specific number declared. If no specific report exists, search for recent press releases or investor reports mentioning EU user numbers.",
      },
      {
        id: "q02_language",
        question:
          "Does the service interface or customer support operate in any official languages of EU Member States?",
        placeholder:
          "e.g., Yes, the interface is available in German, French, Spanish, Italian, Polish...",
        helpText:
          "List all the languages in which the user interface and customer support of the service are available. Determine if these include official languages of EU Member States (e.g., German, French, Italian, Polish, Spanish). Check the service website, help/support pages, and language selection options.",
      },
      {
        id: "q03_currency",
        question:
          "Does the service enable transactions in Euro (EUR) or other national currencies of EU Member States (e.g., PLN, SEK, HUF)?",
        placeholder:
          "e.g., Yes, accepts EUR, PLN (Polish Złoty), SEK (Swedish Krona)...",
        helpText:
          "Review the payment policy or initiate a mock checkout to identify which currencies are accepted. Determine if the service accepts payments in Euro (EUR) or other national currencies of EU Member States (e.g., PLN, SEK, CZK, HUF). Check payment pages, checkout processes, pricing pages, and terms of service for currency information.",
      },
      {
        id: "q04_ordering_possibility",
        question:
          "Is it possible for users located in the Union to successfully order products or fully access the service?",
        placeholder:
          "e.g., Yes, products can be ordered and shipped to all EU countries, including Germany, France, Italy, Spain...",
        helpText:
          "Check the shipping policy or service availability map to determine if products or services can be ordered for delivery to addresses within the European Union. List specific EU Member States mentioned as supported delivery destinations or service availability areas. Check terms of service, shipping/delivery pages, and service availability information.",
      },
      {
        id: "q05_top_level_domain",
        question:
          "Does the service operate under a Union-specific Top-Level Domain (e.g., .eu) or any national Member State domains (e.g., .it, .de, .fr)?",
        placeholder:
          "e.g., Yes, uses .eu domain and .de (Germany), .fr (France), .it (Italy)...",
        helpText:
          "Identify the Top-Level Domains (TLDs) used by the provider for its European operations. Determine if the provider utilizes the .eu domain or national domains of EU Member States (e.g., .de, .fr, .it, .es, .nl). Check the primary domain and search for any additional EU-specific or national domain variations and country-specific websites.",
      },
      {
        id: "q06_app_store",
        question:
          "Is your mobile app available for download in European Union countries appstores?",
        placeholder:
          "e.g., Yes, available in Apple App Store and Google Play Store for France, Germany, Italy, Spain...",
        helpText:
          "Search the Apple App Store and Google Play Store listings for the provider/service. Determine if the application is available for download in the national storefronts of major EU Member States (e.g., France, Germany, Italy, Spain, Netherlands). Check for availability in country-specific app stores or EU-specific app store regions.",
      },
      {
        id: "q07_accessibility",
        question:
          "Is the service technically accessible from IP addresses within the Union (i.e., is it free of geo-blocking measures)?",
        placeholder:
          "e.g., Yes, the service is accessible from EU IP addresses without geo-blocking measures...",
        helpText:
          "Verify if the main website of the provider/service is technically accessible from IP addresses located within the European Union, or if it implements geo-blocking measures preventing access from the EU. Check for information about regional restrictions, IP blocking, geographic access limitations, or geo-blocking policies.",
      },
    ],
  },
  {
    section: "COMPANY SIZE",
    questions: [
      {
        id: "q08_employee_headcount",
        question: "How many staff members does the provider employ?",
        placeholder:
          "e.g., 45 employees (FTE), 250 employees (consolidated group)...",
        helpText:
          "Search the most recent Annual Report, CSR Report, or Non-Financial Statement. Extract the Average number of employees or Full-Time Equivalents (FTE) for the last financial year. Determine if the figure represents the specific entity or the consolidated group. If the entity is a subsidiary (e.g., 'Google Ireland'), search for the headcount of the ultimate parent company. The DSA references Commission Recommendation 2003/361/EC - headcount is the primary filter (if this exceeds 50, financial numbers are irrelevant for SME exemption).",
      },
      {
        id: "q09_annual_turnover",
        question:
          "In your last closed financial year, was your company's annual turnover OR its total balance sheet €10 million or less?",
        placeholder:
          "e.g., Yes, turnover was €8 million (or balance sheet was €9 million)...",
        helpText:
          "Locate the most recent Consolidated Financial Statement or Annual Report. Extract two values: 1) Total Revenue (or Turnover) and 2) Total Assets (Balance Sheet Total) for the last closed financial year. Convert non-EUR currencies to EUR using the average exchange rate of that reporting year. Compare both against the €10 million threshold - the company qualifies if EITHER turnover OR balance sheet is €10 million or less. Under the SME Recommendation, an enterprise needs to pass the Headcount test AND (Turnover Test OR Balance Sheet Test). Use consolidated group figures if the entity is not autonomous.",
      },
    ],
  },
  {
    section: "TYPE OF SERVICE PROVIDED",
    questions: [
      {
        id: "q10_mere_conduit",
        question:
          "Does your service operate as a 'Mere conduit service' under the DSA?",
        subtitle:
          "i.e. you strictly transmit data or provide internet access, without modifying or permanently storing the content",
        placeholder:
          "e.g., Yes/No. If yes, describe: transmits data without modification, like an ISP...",
        helpText:
          "A 'mere conduit' transmits information without initiating, selecting receiver, or modifying it (e.g., internet access providers).",
      },
      {
        id: "q11_caching",
        question:
          "Does your service operate as a 'Caching Service' under the DSA?",
        subtitle:
          "i.e., your main function is to automatically store temporary copies of data to speed up its delivery to other users",
        placeholder:
          "e.g., Yes/No. If yes, describe: temporarily stores data for faster access...",
        helpText:
          "A 'caching' service automatically, intermediately, and temporarily stores information for more efficient onward transmission.",
      },
      {
        id: "q12_search_engine",
        question:
          "Does your service operate as an 'Online Search Engine' under the DSA?",
        subtitle:
          "i.e., you allow users to input queries to perform searches of the entire web",
        placeholder:
          "e.g., Yes/No. If yes, describe: allows users to search websites based on queries...",
        helpText:
          "An 'online search engine' allows users to search all websites based on a query.",
      },
      {
        id: "q13_hosting",
        question:
          "Does your service operate as a 'Hosting Service' under the DSA?",
        subtitle:
          "i.e., you store information provided by users at their request on a more than temporary basis?",
        placeholder:
          "e.g., Yes/No. If yes, describe: stores information provided by users...",
        helpText:
          "A 'hosting' service stores information provided by and at the request of users.",
      },
      {
        id: "q14_online_platform",
        question:
          "Does your service operate as an 'Online Platform' under the DSA?",
        subtitle:
          "i.e., as a primary feature, does your service allow users to publish content that is visible to an indefinite number of people?",
        placeholder:
          "e.g., Yes/No. If yes, describe: hosts user content and disseminates it to the public...",
        helpText:
          "An 'online platform' hosts and disseminates information to the public at the user's request (e.g., social networks, app stores).",
      },
      {
        id: "q15_marketplace",
        question: "Does your service operate as an 'Online Marketplace'?",
        subtitle:
          "i.e., you allow third-party sellers to sell products or services directly to consumers on your platform",
        placeholder:
          "e.g., Yes/No. If yes, describe: enables consumers to buy from third-party sellers...",
        helpText:
          "An online marketplace that allows consumers to conclude distance contracts with traders (e.g., Amazon Marketplace, eBay).",
      },
      {
        id: "q16_distance_contracts",
        question:
          "Does this company operate as an 'online platform allowing consumers to conclude distance contracts with traders'?",
        placeholder:
          "e.g., Yes/No. If yes, describe: allows consumers to conclude distance contracts with traders...",
        helpText:
          "An online platform that allows consumers to conclude distance contracts with traders is a specific category under the DSA with additional obligations.",
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
                <div className="px-4 py-3 border-b border-[#e7e5e4] bg-[#fafaf9]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <p className="font-sans text-sm font-medium text-[#0a0a0a]">
                        {question.question}
                      </p>
                      {question.subtitle && (
                        <p className="font-sans text-xs text-[#78716c] mt-1">
                          {question.subtitle}
                        </p>
                      )}
                    </div>
                    {isFilled && (
                      <div className="w-5 h-5 bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-[#16a34a]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Answer input */}
                <div className="p-4">
                  <textarea
                    value={value}
                    onChange={(e) => handleChange(question.id, e.target.value)}
                    placeholder={question.placeholder}
                    className={cn(
                      "w-full p-3 border border-[#e7e5e4] bg-white",
                      "font-sans text-base text-[#0a0a0a] placeholder:text-[#a8a29e]",
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
