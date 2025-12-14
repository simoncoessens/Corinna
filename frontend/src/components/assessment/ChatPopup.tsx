"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  X,
  MessageCircle,
  ArrowRight,
  Scale,
  FileText,
  Search,
  BookOpen,
  Gavel,
  Shield,
} from "lucide-react";
import createDOMPurify from "dompurify";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import type { StreamEvent } from "@/types/api";

const toolLabels: Record<string, string> = {
  web_search: "Searching the web",
  retrieve_dsa_knowledge: "Reading the DSA document",
};

// Legal-themed loading animation component
function LegalLoadingAnimation({ tool }: { tool: string }) {
  const isWebSearch = tool === "web_search";
  const isDSA = tool === "retrieve_dsa_knowledge";

  // Animated progress steps for legal research
  const steps = useMemo(() => {
    if (isDSA) {
      return [
        { label: "Opening DSA Regulation", icon: BookOpen, delay: 0 },
        { label: "Analyzing Articles", icon: FileText, delay: 0.3 },
        { label: "Cross-referencing Provisions", icon: Scale, delay: 0.6 },
      ];
    }
    return [
      { label: "Querying Legal Sources", icon: Search, delay: 0 },
      { label: "Validating Information", icon: Shield, delay: 0.3 },
      { label: "Compiling Findings", icon: Gavel, delay: 0.6 },
    ];
  }, [isDSA]);

  return (
    <div className="w-full max-w-[85%]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#fafaf9] to-[#f5f5f4] border border-[#e7e5e4] overflow-hidden"
      >
        {/* Header with animated EU-style bar */}
        <div className="relative h-1 bg-[#e7e5e4] overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#003399] via-[#003399] to-[#FFD700]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{
              duration: 2.5,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        </div>

        <div className="px-4 py-3">
          {/* Main title */}
          <div className="flex items-center gap-2 mb-3">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {isDSA ? (
                <BookOpen className="w-4 h-4 text-[#003399]" />
              ) : (
                <Search className="w-4 h-4 text-[#003399]" />
              )}
            </motion.div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#003399] font-medium">
              {isDSA ? "DSA Regulation Analysis" : "Legal Research in Progress"}
            </span>
          </div>

          {/* Animated steps */}
          <div className="space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: step.delay, duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    animate={{
                      opacity: [0.4, 1, 0.4],
                      scale: [0.95, 1, 0.95],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: step.delay,
                    }}
                    className="w-5 h-5 rounded-full bg-[#003399]/10 flex items-center justify-center"
                  >
                    <Icon className="w-2.5 h-2.5 text-[#003399]" />
                  </motion.div>
                  <motion.span
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: step.delay,
                    }}
                    className="text-xs text-[#57534e]"
                  >
                    {step.label}
                  </motion.span>
                  <motion.div
                    className="flex-1 h-px bg-gradient-to-r from-[#e7e5e4] to-transparent"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: step.delay + 0.2, duration: 0.5 }}
                    style={{ originX: 0 }}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Animated document lines */}
          <div className="mt-3 space-y-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1.5 bg-[#e7e5e4] rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.15 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-[#003399]/20 to-[#003399]/5"
                  initial={{ width: "0%" }}
                  animate={{ width: ["0%", "100%", "60%", "90%", "75%"] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer with regulation reference */}
        <div className="px-4 py-2 bg-[#003399]/5 border-t border-[#003399]/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Scale className="w-3 h-3 text-[#003399]/60" />
              <span className="font-mono text-[9px] text-[#003399]/60 uppercase tracking-wider">
                Regulation (EU) 2022/2065
              </span>
            </div>
            <motion.div
              className="flex gap-0.5"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1 h-1 bg-[#003399] rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Simple thinking animation when no tool is active
function ThinkingAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[85%]"
    >
      <div className="px-4 py-3 bg-gradient-to-br from-[#fafaf9] to-[#f5f5f4] border border-[#e7e5e4]">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 rounded-full border-2 border-[#003399]/20 border-t-[#003399] flex items-center justify-center"
          />
          <div className="space-y-1">
            <span className="text-xs text-[#57534e] font-medium">
              Analyzing your query
            </span>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className="w-1 h-1 bg-[#003399]/40 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const purifier = typeof window !== "undefined" ? createDOMPurify(window) : null;

function MarkdownContent({ content }: { content: string }) {
  const sanitizedHtml = useMemo(() => {
    const normalized = (content ?? "").replace(/\r\n/g, "\n");
    const rawHtml = marked.parse(normalized, {
      // Avoid turning every single newline into a <br/> (prevents "gappy" output).
      breaks: false,
    }) as string;
    // Explicitly allow list elements in DOMPurify to ensure bullets render
    return purifier
      ? purifier.sanitize(rawHtml, {
          ALLOWED_TAGS: [
            "p",
            "br",
            "strong",
            "em",
            "u",
            "s",
            "code",
            "pre",
            "blockquote",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "ul",
            "ol",
            "li",
            "a",
          ],
          ALLOWED_ATTR: ["href", "title", "target", "rel"],
        })
      : rawHtml;
  }, [content]);

  return (
    <div
      className="markdown-content font-sans text-sm leading-relaxed text-[#0a0a0a] whitespace-normal wrap-break-word prose prose-sm max-w-none
        prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
        prose-headings:text-[#0a0a0a] prose-headings:font-medium
        prose-a:text-[#003399] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-[#0a0a0a] prose-strong:font-medium"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export type ChatPhase =
  | "company_match"
  | "deep_research"
  | "review_scope"
  | "review_size"
  | "review_type"
  | "classify"
  | "report";

export interface ChatContext {
  phase: ChatPhase;
  companyName?: string;
  companyUrl?: string;
  /**
   * Snapshot of whatever the user is currently seeing in the UI.
   * Only the currently-visible step should be populated (others undefined).
   */
  visibleUi?: {
    app?: {
      currentPhase: string;
      researchStep?: string;
      isManualEntry?: boolean;
      completedPhases?: string[];
    };
    companyLookup?: {
      state: "input" | "searching" | "found" | "not_found" | "error";
      organizationName?: string;
      countryOfEstablishment?: string;
      isSearching?: boolean;
      error?: string | null;
      totalSourceCount?: number;
      visibleSources?: Array<{ title?: string; url: string }>;
      results?: {
        input_name?: string;
        exact_match?: {
          name: string;
          top_domain: string;
          confidence: string;
        } | null;
        suggestions?: Array<{
          name: string;
          top_domain: string;
          confidence: string;
        }>;
        selectedCompanyName?: string | null;
      } | null;
    };
    deepResearch?: {
      companyName: string;
      phase: "research" | "summarization" | "finalizing";
      totalSourceCount: number;
      visibleSources: Array<{ title?: string; url: string }>;
    };
    review?: {
      section: string;
      currentStep: number;
      totalSteps: number;
      acceptedCount: number;
      totalFindings: number;
      allAccepted: boolean;
      editingIndex: number | null;
      editValue: string;
      findings: Array<{
        question: string;
        answer: string;
        source: string;
        confidence: string;
        accepted: boolean;
        edited: boolean;
      }>;
    };
    manualEntry?: {
      section: string;
      currentStep: number;
      totalSteps: number;
      filledCount: number;
      totalQuestions: number;
      allFilled: boolean;
      fields: Array<{
        id: string;
        question: string;
        answer: string;
        placeholder?: string;
        helpText?: string;
      }>;
    };
    classification?: {
      stage: string;
      isProcessing: boolean;
      streamedText?: string;
      expandedSections?: string[];
      classificationSummary?: string;
      classification?: {
        territorial?: { in_scope: boolean; reasoning?: string };
        service?: {
          service_category: string;
          is_intermediary: boolean;
          is_online_platform: boolean;
          is_marketplace: boolean;
          is_search_engine: boolean;
          platform_reasoning?: string;
        };
        size?: {
          is_vlop_vlose: boolean;
          qualifies_for_sme_exemption?: boolean;
          reasoning?: string;
        };
      };
    };
    report?: {
      activeTab: "overview" | "obligations" | "company" | "download";
      obligationsFilter?: "all" | "applicable" | "not-applicable";
      selectedObligation?: {
        article: string;
        title: string;
        applies: boolean;
        implications: string;
        action_items: string[];
      } | null;
      visibleObligations?: Array<{
        article: string;
        title: string;
        applies: boolean;
        action_items_count: number;
      }>;
    };
  };
  researchData?: {
    geographicalScope?: Array<{
      question: string;
      answer: string;
      confidence: string;
    }>;
    companySize?: Array<{
      question: string;
      answer: string;
      confidence: string;
    }>;
    serviceType?: Array<{
      question: string;
      answer: string;
      confidence: string;
    }>;
  };
  classificationData?: {
    serviceCategory?: string;
    isIntermediary?: boolean;
    isOnlinePlatform?: boolean;
    isMarketplace?: boolean;
    isSearchEngine?: boolean;
    isVLOP?: boolean;
    smeExemption?: boolean;
  };
  complianceData?: {
    applicableObligations?: number;
    totalObligations?: number;
    summary?: string;
  };
}

export type ContextMode = "review_findings" | "obligations" | "general";

interface ChatPopupProps {
  context: ChatContext;
  /**
   * When this changes to a non-empty string, the chat will open and this question
   * will be sent automatically. The parent should reset this to empty after use.
   */
  initialQuestion?: string;
  /**
   * Called when initialQuestion has been consumed (after sending)
   */
  onInitialQuestionSent?: () => void;
  /**
   * Context mode for specialized behavior (review_findings, obligations, general)
   */
  contextMode?: ContextMode;
}

// Contextual suggestions based on current phase
const phaseSuggestions: Record<ChatPhase, string[]> = {
  company_match: [
    "What is the Digital Services Act?",
    "Which companies are in scope?",
    "What if my company isn't listed?",
  ],
  deep_research: [
    "What data is being collected?",
    "What sources are used?",
    "How is this information verified?",
  ],
  review_scope: [
    "What is territorial scope under Art. 2?",
    "How is EU presence determined?",
    "What constitutes offering services to EU?",
  ],
  review_size: [
    "What are the DSA size thresholds?",
    "What is VLOP/VLOSE designation?",
    "What is the SME exemption?",
  ],
  review_type: [
    "What is an intermediary service?",
    "What distinguishes hosting from platforms?",
    "What qualifies as an online marketplace?",
  ],
  classify: [
    "What service categories exist?",
    "How is classification determined?",
    "What about multiple service types?",
  ],
  report: [
    "Explain these obligations",
    "What are the compliance deadlines?",
    "What are the penalties for non-compliance?",
  ],
};

// Contextual welcome messages
const phaseWelcomes: Record<ChatPhase, string> = {
  company_match:
    "I can assist with company identification and DSA applicability questions.",
  deep_research:
    "Research in progress. I can clarify DSA provisions or assessment methodology.",
  review_scope:
    "Reviewing territorial scope pursuant to Article 2 DSA. I can explain the criteria.",
  review_size:
    "Reviewing size classification. I can clarify thresholds and exemptions.",
  review_type: "Reviewing service classification under Articles 3-6 DSA.",
  classify:
    "Determining applicable obligations based on service classification.",
  report:
    "Compliance assessment complete. I can explain any obligations or provisions.",
};

// Contextual hints for the FAB - specific to what user is doing
const phaseHints: Record<ChatPhase, string> = {
  company_match: "Can't find your company? I can help",
  deep_research: "What is being researched and why?",
  review_scope: "Not sure if you operate in the EU?",
  review_size: "Unsure about employee or revenue thresholds?",
  review_type: "What type of service do you provide?",
  classify: "How will my service be classified?",
  report: "What do these obligations mean for you?",
};

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://snip-tool-backend.onrender.com";

// Build the full context string from ChatContext
function buildContextString(context: ChatContext): string {
  const parts: string[] = [];

  // Current phase
  const phaseLabels: Record<ChatPhase, string> = {
    company_match: "Company Lookup",
    deep_research: "Deep Research in Progress",
    review_scope: "Reviewing Territorial scope",
    review_size: "Reviewing Company Size",
    review_type: "Reviewing Service Type",
    classify: "Service Classification",
    report: "Compliance Report",
  };

  parts.push(`Current Step: ${phaseLabels[context.phase]}`);

  // Visible UI snapshot (best-effort: "whatever user can see right now")
  if (context.visibleUi) {
    const ui = context.visibleUi;

    if (ui.app) {
      parts.push("\n--- Visible UI: App State ---");
      parts.push(`Current phase: ${ui.app.currentPhase}`);
      if (ui.app.researchStep)
        parts.push(`Research step: ${ui.app.researchStep}`);
      if (ui.app.isManualEntry !== undefined) {
        parts.push(`Manual entry mode: ${ui.app.isManualEntry ? "Yes" : "No"}`);
      }
      if (ui.app.completedPhases && ui.app.completedPhases.length > 0) {
        parts.push(`Completed phases: ${ui.app.completedPhases.join(", ")}`);
      }
    }

    if (ui.companyLookup) {
      parts.push("\n--- Visible UI: Company Lookup ---");
      parts.push(`Screen state: ${ui.companyLookup.state}`);
      if (ui.companyLookup.organizationName !== undefined) {
        parts.push(
          `Organization name input: ${ui.companyLookup.organizationName}`
        );
      }
      if (ui.companyLookup.countryOfEstablishment !== undefined) {
        parts.push(
          `Country of establishment input: ${ui.companyLookup.countryOfEstablishment}`
        );
      }
      if (ui.companyLookup.error) {
        parts.push(`Error: ${ui.companyLookup.error}`);
      }
      if (ui.companyLookup.totalSourceCount !== undefined) {
        parts.push(
          `Sources analyzed (visible): ${ui.companyLookup.totalSourceCount}`
        );
      }
      if (
        ui.companyLookup.visibleSources &&
        ui.companyLookup.visibleSources.length > 0
      ) {
        parts.push("Visible sources:");
        ui.companyLookup.visibleSources.forEach((s) =>
          parts.push(`- ${s.title ? `${s.title} — ` : ""}${s.url}`)
        );
      }
      if (ui.companyLookup.results) {
        parts.push("Visible results:");
        if (ui.companyLookup.results.exact_match) {
          const m = ui.companyLookup.results.exact_match;
          parts.push(
            `- Exact match: ${m.name} (${m.top_domain || "no domain"}) [${
              m.confidence
            }]`
          );
        }
        if (
          ui.companyLookup.results.suggestions &&
          ui.companyLookup.results.suggestions.length > 0
        ) {
          ui.companyLookup.results.suggestions.forEach((s) =>
            parts.push(
              `- Suggestion: ${s.name} (${s.top_domain || "no domain"}) [${
                s.confidence
              }]`
            )
          );
        }
        if (ui.companyLookup.results.selectedCompanyName) {
          parts.push(
            `Selected in UI: ${ui.companyLookup.results.selectedCompanyName}`
          );
        }
      }
    }

    if (ui.deepResearch) {
      parts.push("\n--- Visible UI: Deep Research ---");
      parts.push(`Company: ${ui.deepResearch.companyName}`);
      parts.push(`Phase: ${ui.deepResearch.phase}`);
      parts.push(`Sources analyzed: ${ui.deepResearch.totalSourceCount}`);
      if (ui.deepResearch.visibleSources.length > 0) {
        parts.push("Visible sources:");
        ui.deepResearch.visibleSources.forEach((s) =>
          parts.push(`- ${s.title ? `${s.title} — ` : ""}${s.url}`)
        );
      }
    }

    if (ui.review) {
      parts.push("\n--- Visible UI: Review Findings ---");
      parts.push(`Section: ${ui.review.section}`);
      parts.push(
        `Progress: ${ui.review.currentStep} / ${ui.review.totalSteps}`
      );
      parts.push(
        `Confirmed: ${ui.review.acceptedCount} / ${ui.review.totalFindings} (allAccepted=${ui.review.allAccepted})`
      );
      if (ui.review.editingIndex !== null) {
        parts.push(`Editing index: ${ui.review.editingIndex}`);
        parts.push(`Editing value: ${ui.review.editValue}`);
      }
      parts.push("Visible findings:");
      ui.review.findings.forEach((f) => {
        const flags = [
          f.accepted ? "accepted" : "not accepted",
          f.edited ? "edited" : "not edited",
        ].join(", ");
        parts.push(`Q: ${f.question}`);
        parts.push(`A: ${f.answer}`);
        parts.push(
          `Source: ${f.source} · Confidence: ${f.confidence} · ${flags}`
        );
      });
    }

    if (ui.manualEntry) {
      parts.push("\n--- Visible UI: Manual Data Entry ---");
      parts.push(`Section: ${ui.manualEntry.section}`);
      parts.push(
        `Progress: ${ui.manualEntry.currentStep} / ${ui.manualEntry.totalSteps}`
      );
      parts.push(
        `Answered: ${ui.manualEntry.filledCount} / ${ui.manualEntry.totalQuestions} (allFilled=${ui.manualEntry.allFilled})`
      );
      parts.push("Visible fields:");
      ui.manualEntry.fields.forEach((f) => {
        parts.push(`Q: ${f.question}`);
        parts.push(`A: ${f.answer}`);
      });
    }

    if (ui.classification) {
      parts.push("\n--- Visible UI: Service Classification ---");
      parts.push(`Stage: ${ui.classification.stage}`);
      parts.push(
        `Processing: ${ui.classification.isProcessing ? "Yes" : "No"}`
      );
      if (
        ui.classification.expandedSections &&
        ui.classification.expandedSections.length > 0
      ) {
        parts.push(
          `Expanded sections: ${ui.classification.expandedSections.join(", ")}`
        );
      }
      if (ui.classification.streamedText) {
        parts.push("Streamed text (tail):");
        parts.push(ui.classification.streamedText);
      }
      if (ui.classification.classificationSummary) {
        parts.push(`Summary: ${ui.classification.classificationSummary}`);
      }
      if (ui.classification.classification) {
        const c = ui.classification.classification;
        if (c.territorial) {
          parts.push(
            `Territorial scope: ${
              c.territorial.in_scope ? "In scope" : "Out of scope"
            }`
          );
        }
        if (c.service) {
          parts.push(`Service category: ${c.service.service_category}`);
          parts.push(
            `Flags: intermediary=${c.service.is_intermediary}, platform=${c.service.is_online_platform}, marketplace=${c.service.is_marketplace}, search=${c.service.is_search_engine}`
          );
        }
        if (c.size) {
          parts.push(
            `Size: vlop=${c.size.is_vlop_vlose}, sme_exemption=${
              c.size.qualifies_for_sme_exemption ?? "unknown"
            }`
          );
        }
      }
    }

    if (ui.report) {
      parts.push("\n--- Visible UI: Compliance Report ---");
      parts.push(`Active tab: ${ui.report.activeTab}`);
      if (ui.report.obligationsFilter) {
        parts.push(`Obligations filter: ${ui.report.obligationsFilter}`);
      }
      if (ui.report.selectedObligation) {
        const o = ui.report.selectedObligation;
        parts.push(`Selected obligation: Article ${o.article} — ${o.title}`);
        parts.push(`Applies: ${o.applies ? "Yes" : "No"}`);
        parts.push(`Implications: ${o.implications}`);
        if (o.action_items?.length) {
          parts.push("Action items:");
          o.action_items.forEach((a) => parts.push(`- ${a}`));
        }
      }
      if (
        ui.report.visibleObligations &&
        ui.report.visibleObligations.length > 0
      ) {
        parts.push("Visible obligations list:");
        ui.report.visibleObligations.forEach((o) =>
          parts.push(
            `- Article ${o.article}: ${o.title} (applies=${o.applies}, action_items=${o.action_items_count})`
          )
        );
      }
    }
  }

  // Company info
  if (context.companyName) {
    parts.push(`Company: ${context.companyName}`);
    if (context.companyUrl) {
      parts.push(`Website: ${context.companyUrl}`);
    }
  }

  // Research data
  if (context.researchData) {
    const { geographicalScope, companySize, serviceType } =
      context.researchData;

    if (geographicalScope && geographicalScope.length > 0) {
      parts.push("\n--- Territorial scope Findings ---");
      geographicalScope.forEach((item) => {
        parts.push(`Q: ${item.question}`);
        parts.push(`A: ${item.answer} (${item.confidence} confidence)`);
      });
    }

    if (companySize && companySize.length > 0) {
      parts.push("\n--- Company Size Findings ---");
      companySize.forEach((item) => {
        parts.push(`Q: ${item.question}`);
        parts.push(`A: ${item.answer} (${item.confidence} confidence)`);
      });
    }

    if (serviceType && serviceType.length > 0) {
      parts.push("\n--- Service Type Findings ---");
      serviceType.forEach((item) => {
        parts.push(`Q: ${item.question}`);
        parts.push(`A: ${item.answer} (${item.confidence} confidence)`);
      });
    }
  }

  // Classification data
  if (context.classificationData) {
    const c = context.classificationData;
    parts.push("\n--- DSA Classification ---");
    if (c.serviceCategory) {
      parts.push(`Service Category: ${c.serviceCategory}`);
    }
    if (c.isIntermediary !== undefined) {
      parts.push(`Is Intermediary Service: ${c.isIntermediary ? "Yes" : "No"}`);
    }
    if (c.isOnlinePlatform !== undefined) {
      parts.push(`Is Online Platform: ${c.isOnlinePlatform ? "Yes" : "No"}`);
    }
    if (c.isMarketplace !== undefined) {
      parts.push(`Is Marketplace: ${c.isMarketplace ? "Yes" : "No"}`);
    }
    if (c.isSearchEngine !== undefined) {
      parts.push(`Is Search Engine: ${c.isSearchEngine ? "Yes" : "No"}`);
    }
    if (c.isVLOP !== undefined) {
      parts.push(`Is VLOP/VLOSE: ${c.isVLOP ? "Yes" : "No"}`);
    }
    if (c.smeExemption !== undefined) {
      parts.push(
        `SME Exemption: ${c.smeExemption ? "Eligible" : "Not Eligible"}`
      );
    }
  }

  // Compliance data
  if (context.complianceData) {
    const comp = context.complianceData;
    parts.push("\n--- Compliance Summary ---");
    if (
      comp.applicableObligations !== undefined &&
      comp.totalObligations !== undefined
    ) {
      parts.push(
        `Applicable Obligations: ${comp.applicableObligations} out of ${comp.totalObligations}`
      );
    }
    if (comp.summary) {
      parts.push(`Summary: ${comp.summary}`);
    }
  }

  return parts.join("\n");
}

export function ChatPopup({
  context,
  initialQuestion,
  onInitialQuestionSent,
  contextMode = "general",
}: ChatPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Get contextual welcome message
  const welcomeMessage = useMemo(() => {
    const baseWelcome =
      phaseWelcomes[context.phase] || phaseWelcomes.company_match;
    if (context.companyName && context.phase !== "company_match") {
      return `Working on **${context.companyName}**. ${baseWelcome}`;
    }
    return baseWelcome;
  }, [context.phase, context.companyName]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage,
      timestamp: new Date(),
    },
  ]);

  const previousPhaseRef = useRef<ChatPhase>(context.phase);

  // Reset messages when phase changes
  useEffect(() => {
    if (previousPhaseRef.current !== context.phase) {
      // Phase changed - reset chat with new welcome message
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ]);
      setInput("");
      setIsStreaming(false);
      setStreamingContent("");
      setCurrentTool(null);
      setLastTool(null);
      previousPhaseRef.current = context.phase;
    } else {
      // Only phase didn't change, just update welcome if it's still the only message
      setMessages((prev) => {
        if (prev.length === 1 && prev[0].id === "welcome") {
          return [
            {
              id: "welcome",
              role: "assistant",
              content: welcomeMessage,
              timestamp: new Date(),
            },
          ];
        }
        return prev;
      });
    }
  }, [context.phase, welcomeMessage]);

  // Get contextual suggestions
  const suggestions = useMemo(() => {
    return phaseSuggestions[context.phase] || phaseSuggestions.company_match;
  }, [context.phase]);

  // Get contextual hint
  const hint = useMemo(() => {
    return phaseHints[context.phase] || "Need help?";
  }, [context.phase]);

  // Build full context string
  const fullContext = useMemo(() => {
    return buildContextString(context);
  }, [context]);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setShowHint(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Hide hint after a delay
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000);
    return () => clearTimeout(timer);
  }, [context.phase]);

  // Show hint again when phase changes
  useEffect(() => {
    if (!isOpen) {
      setShowHint(true);
    }
  }, [context.phase, isOpen]);

  // Handle initial question
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim()) {
      // Open the chat
      setIsOpen(true);
      // Send the question after a short delay to ensure the chat is open
      setTimeout(() => {
        handleSend(initialQuestion);
        onInitialQuestionSent?.();
      }, 100);
    }
  }, [initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(
    async (messageText?: string) => {
      const text = messageText || input;
      if (!text.trim() || isStreaming) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsStreaming(true);
      setStreamingContent("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/agents/main_agent/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: userMessage.content,
              frontend_context: fullContext,
              context_mode: contextMode,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              try {
                const event = JSON.parse(data) as StreamEvent;

                switch (event.type) {
                  case "token":
                    fullContent += event.content;
                    setStreamingContent(fullContent);
                    // Once content starts, clear lastTool so animation disappears
                    if (fullContent) {
                      setLastTool(null);
                    }
                    break;
                  case "tool_start":
                    setCurrentTool(event.name);
                    setLastTool(event.name);
                    break;
                  case "tool_end":
                    // Keep lastTool for continuity between tools
                    setCurrentTool(null);
                    break;
                  case "error":
                  case "done":
                    setCurrentTool(null);
                    setLastTool(null);
                    break;
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            fullContent || "I apologize, but I couldn't generate a response.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Show unread indicator if chat is closed
        if (!isOpen) {
          setHasUnread(true);
        }
      } catch (err) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I apologize, but I encountered an error. Please ensure the backend server is running.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        setCurrentTool(null);
        setLastTool(null);
      }
    },
    [input, isStreaming, fullContext, isOpen]
  );

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    handleSend(suggestion);
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className={cn(
              "fixed z-50",
              // Desktop positioning
              "sm:bottom-6 sm:right-6",
              // Mobile: safer margins to avoid notches and edges
              "max-sm:bottom-8 max-sm:right-6",
              "w-12 h-12",
              "bg-[#0a0a0a] text-white",
              "flex items-center justify-center",
              "shadow-lg hover:shadow-xl",
              "hover:bg-[#1a1a1a] transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] focus:ring-offset-2",
              "group"
            )}
            aria-label="Open Corinna"
          >
            <MessageCircle className="w-5 h-5 transition-transform group-hover:scale-105" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#003399] border-2 border-white" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Contextual Hint Tooltip */}
      <AnimatePresence>
        {!isOpen && showHint && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="fixed bottom-8 right-22 z-40 hidden sm:block"
          >
            <div
              className="bg-white px-3 py-2 shadow-md border border-[#e7e5e4] cursor-pointer hover:bg-[#fafaf9] transition-colors"
              onClick={() => setIsOpen(true)}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-[#003399]" />
                <span className="text-xs text-[#57534e] font-medium">
                  {hint}
                </span>
                <ArrowRight className="w-3 h-3 text-[#a8a29e]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "fixed z-50",
              // Desktop positioning
              "sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[520px]",
              // Mobile: full screen with safe margins
              "max-sm:left-4 max-sm:right-4 max-sm:bottom-4 max-sm:top-4 max-sm:w-auto max-sm:h-auto",
              "bg-white shadow-2xl",
              "border border-[#e7e5e4]",
              "flex flex-col overflow-hidden"
            )}
            style={{
              // Ensure chat never exceeds viewport on mobile
              // Use large viewport height to prevent shift when keyboard appears
              maxHeight: "calc(100lvh - 2rem)",
            }}
          >
            {/* Header - With notch-specific safe area handling */}
            <div
              className="shrink-0 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between sm:py-3 sm:px-4"
              style={{
                // On mobile devices with notch (iPhone X+), add safe area padding at top
                // This ensures the Corinna logo and title are never obscured by the notch
                paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
                paddingBottom: "0.75rem",
                paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
                paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#0a0a0a] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-[#0a0a0a] leading-none">
                    Corinna chat
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className={cn(
                  "w-7 h-7",
                  "flex items-center justify-center",
                  "text-[#78716c] hover:text-[#0a0a0a]",
                  "hover:bg-[#f5f5f4]",
                  "transition-colors duration-200"
                )}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] px-3 py-2",
                        message.role === "user"
                          ? "bg-[#0a0a0a] text-white"
                          : "bg-[#f5f5f4] text-[#0a0a0a] border border-[#e7e5e4]"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <MarkdownContent content={message.content} />
                      ) : (
                        <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Legal loading animation when using tools or between tools */}
              <AnimatePresence mode="wait">
                {isStreaming &&
                  !streamingContent &&
                  (currentTool || lastTool) && (
                    <motion.div
                      key={`tool-${currentTool || lastTool}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="flex justify-start"
                    >
                      <LegalLoadingAnimation
                        tool={currentTool || lastTool || ""}
                      />
                    </motion.div>
                  )}
              </AnimatePresence>

              {/* Streaming answer */}
              {isStreaming && streamingContent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 justify-start"
                >
                  <div className="max-w-[85%] px-3 py-2 bg-[#f5f5f4] border border-[#e7e5e4]">
                    <div className="font-sans text-sm text-[#0a0a0a] leading-relaxed whitespace-normal wrap-break-word">
                      <MarkdownContent content={streamingContent} />
                      <span className="inline-block w-0.5 h-4 bg-[#0a0a0a] ml-0.5 animate-pulse align-middle" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Thinking animation when streaming but no content or tools yet */}
              <AnimatePresence mode="wait">
                {isStreaming &&
                  !streamingContent &&
                  !currentTool &&
                  !lastTool && (
                    <motion.div
                      key="thinking"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex justify-start"
                    >
                      <ThinkingAnimation />
                    </motion.div>
                  )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions (only when no messages sent yet) */}
            {messages.length === 1 && (
              <div className="shrink-0 px-4 pb-3 border-t border-[#e7e5e4] pt-3 bg-[#fafaf9]">
                <p className="font-mono text-[10px] text-[#78716c] mb-2 uppercase tracking-wider">
                  Common questions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={cn(
                        "px-2.5 py-1 text-xs",
                        "bg-white text-[#57534e]",
                        "border border-[#e7e5e4]",
                        "hover:bg-[#0a0a0a] hover:text-white hover:border-[#0a0a0a]",
                        "transition-colors duration-150"
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input - With safe area handling for home indicator */}
            <div
              className="shrink-0 border-t border-[#e7e5e4] bg-[#fafaf9] sm:p-3"
              style={{
                // On mobile devices, add safe area padding at bottom for home indicator
                paddingTop: "0.75rem",
                paddingLeft: "calc(0.75rem + env(safe-area-inset-left, 0px))",
                paddingRight: "calc(0.75rem + env(safe-area-inset-right, 0px))",
                paddingBottom:
                  "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSend()
                  }
                  placeholder="Ask about the DSA..."
                  disabled={isStreaming}
                  className={cn(
                    "flex-1 h-10 px-3",
                    "bg-white border border-[#e7e5e4]",
                    "font-sans text-base text-[#0a0a0a] placeholder:text-[#a8a29e]",
                    "focus:outline-none focus:border-[#0a0a0a]",
                    "transition-colors duration-150",
                    "disabled:opacity-50"
                  )}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center",
                    "bg-[#0a0a0a] text-white",
                    "hover:bg-[#1a1a1a] transition-colors duration-150",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
