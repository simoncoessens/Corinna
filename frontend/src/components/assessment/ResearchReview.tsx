"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  MapPin,
  Users,
  Server,
  ChevronRight,
  Check,
  Edit3,
  X,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SubQuestionAnswer } from "@/types/research";
import {
  ResearchSection,
  SECTION_LABELS,
  SECTION_DESCRIPTIONS,
  SECTION_INSTRUCTIONS,
} from "@/types/research";
import type { ChatContext } from "./ChatPopup";

interface AnswerStatus {
  accepted: boolean;
  edited: boolean;
}

interface ResearchReviewProps {
  section: ResearchSection;
  answers: SubQuestionAnswer[];
  currentStep: number;
  totalSteps: number;
  /**
   * When true, this screen is being shown for answers that were already
   * confirmed earlier (e.g. the user navigated back). In that case, we should
   * start in an "accepted" state while still allowing re-edits.
   */
  isPreviouslyConfirmed?: boolean;
  onConfirm: (editedAnswers: SubQuestionAnswer[]) => void;
  onBack: () => void;
  /**
   * Emits a snapshot of what the user can currently see in this screen.
   */
  onVisibleStateChange?: (state: ChatContext["visibleUi"]) => void;
  /**
   * Called when user wants to ask Corinna about a specific finding
   */
  onAskCorinna?: (finding: SubQuestionAnswer) => void;
}

const SECTION_ICONS: Record<ResearchSection, typeof Globe> = {
  "GEOGRAPHICAL SCOPE": MapPin,
  "COMPANY SIZE": Users,
  "TYPE OF SERVICE PROVIDED": Server,
};

export function ResearchReview({
  section,
  answers,
  currentStep,
  totalSteps,
  isPreviouslyConfirmed = false,
  onConfirm,
  onBack,
  onVisibleStateChange,
  onAskCorinna,
}: ResearchReviewProps) {
  const [editedAnswers, setEditedAnswers] =
    useState<SubQuestionAnswer[]>(answers);
  const [answerStatuses, setAnswerStatuses] = useState<
    Record<number, AnswerStatus>
  >(() =>
    Object.fromEntries(
      answers.map((_, i) => [
        i,
        { accepted: isPreviouslyConfirmed, edited: false },
      ])
    )
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const Icon = SECTION_ICONS[section];

  // Check if all answers are accepted
  const allAccepted = useMemo(() => {
    return Object.values(answerStatuses).every((s) => s.accepted);
  }, [answerStatuses]);

  // Count accepted
  const acceptedCount = useMemo(() => {
    return Object.values(answerStatuses).filter((s) => s.accepted).length;
  }, [answerStatuses]);

  // Emit visible UI snapshot for chat context
  useEffect(() => {
    if (!onVisibleStateChange) return;
    const findings = editedAnswers.map((a, i) => ({
      question: a.question,
      answer: i === editingIndex ? editValue : a.answer,
      source: a.source,
      confidence: a.confidence,
      accepted: !!answerStatuses[i]?.accepted,
      edited: !!answerStatuses[i]?.edited,
    }));
    onVisibleStateChange({
      review: {
        section,
        currentStep,
        totalSteps,
        acceptedCount,
        totalFindings: editedAnswers.length,
        allAccepted,
        editingIndex,
        editValue,
        findings,
      },
    });
  }, [
    onVisibleStateChange,
    section,
    currentStep,
    totalSteps,
    acceptedCount,
    allAccepted,
    editingIndex,
    editValue,
    editedAnswers,
    answerStatuses,
  ]);

  // Helper to check if an answer has no information found
  const hasNoInformation = (answer: SubQuestionAnswer) => {
    return (
      answer.information_found === false ||
      answer.answer.toLowerCase().includes("information not publicly available")
    );
  };

  const handleAccept = (index: number) => {
    setAnswerStatuses((prev) => ({
      ...prev,
      [index]: { ...prev[index], accepted: true },
    }));
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const answer = editedAnswers[index];
    // If no information was found, start with empty text instead of "Information not publicly available"
    if (hasNoInformation(answer)) {
      setEditValue("");
    } else {
      setEditValue(answer.answer);
    }
  };

  const handleSaveEdit = (index: number) => {
    setEditedAnswers((prev) =>
      prev.map((a, i) =>
        i === index
          ? {
              ...a,
              answer: editValue,
              confidence: "High",
              information_found: true, // User provided the information
            }
          : a
      )
    );
    setAnswerStatuses((prev) => ({
      ...prev,
      [index]: { accepted: true, edited: true },
    }));
    setEditingIndex(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const handleConfirm = () => {
    onConfirm(editedAnswers);
  };

  const confidenceColor = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "text-[#16a34a]";
      case "Medium":
        return "text-[#d97706]";
      case "Low":
        return "text-[#dc2626]";
      default:
        return "text-[#78716c]";
    }
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
          <div className="w-12 h-12 bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center shrink-0">
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

        {/* Instructions */}
        <div className="flex items-start gap-3 p-4 bg-[#fafaf9] border border-[#e7e5e4] mb-6">
          <AlertCircle className="w-4 h-4 text-[#78716c] mt-0.5 shrink-0" />
          <p className="font-sans text-sm text-[#57534e]">
            {SECTION_INSTRUCTIONS[section]}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
            Findings
          </span>
          <span className="font-mono text-[10px] text-[#57534e]">
            {acceptedCount} of {answers.length} confirmed
          </span>
        </div>

        {/* Answers */}
        <div className="space-y-3 mb-6">
          <AnimatePresence>
            {editedAnswers.map((answer, index) => {
              const status = answerStatuses[index];
              const isEditing = editingIndex === index;
              const noInfo = hasNoInformation(answer);

              return (
                <motion.div
                  key={answer.question}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "border bg-white transition-colors",
                    status.accepted
                      ? "border-[#16a34a]/30"
                      : noInfo
                      ? "border-[#d97706]/30 bg-[#fef3c7]/10"
                      : "border-[#e7e5e4]"
                  )}
                >
                  {/* Question header */}
                  <div className="px-4 py-3 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
                    <p className="font-sans text-sm font-medium text-[#0a0a0a] flex-1 pr-4">
                      {answer.question}
                    </p>
                    <div className="flex items-center gap-2">
                      {onAskCorinna && (
                        <button
                          onClick={() => onAskCorinna(answer)}
                          className={cn(
                            "px-2 py-1 flex items-center gap-1.5",
                            "text-[#78716c] hover:text-[#003399] transition-colors",
                            "group"
                          )}
                          title="Ask Corinna for more information"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="font-sans text-xs whitespace-nowrap">
                            Ask Corinna
                          </span>
                        </button>
                      )}
                      {status.accepted && (
                        <div className="flex items-center gap-1.5">
                          {status.edited && (
                            <span className="font-mono text-[9px] text-[#57534e] uppercase">
                              Edited
                            </span>
                          )}
                          <div className="w-5 h-5 bg-[#dcfce7] flex items-center justify-center">
                            <Check className="w-3 h-3 text-[#16a34a]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Answer content */}
                  <div className="p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className={cn(
                            "w-full p-3 border border-[#0a0a0a] bg-white",
                            "font-sans text-sm text-[#0a0a0a]",
                            "focus:outline-none resize-none",
                            "min-h-[100px]"
                          )}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 font-sans text-xs text-[#78716c] hover:text-[#0a0a0a] transition-colors flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(index)}
                            disabled={!editValue.trim()}
                            className="px-3 py-1.5 bg-[#0a0a0a] text-white font-sans text-xs hover:bg-[#1a1a1a] transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="w-3 h-3" />
                            Save & Accept
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {noInfo ? (
                          <>
                            {/* No information found message */}
                            <div className="flex items-start gap-3 p-3 bg-[#fef3c7] border border-[#d97706]/30 mb-4">
                              <AlertCircle className="w-4 h-4 text-[#d97706] mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="font-sans text-sm font-medium text-[#92400e] mb-1">
                                  No Information Found
                                </p>
                                <p className="font-sans text-xs text-[#92400e]/80">
                                  Our research could not find publicly available
                                  information for this question. Please provide
                                  the information manually.
                                </p>
                              </div>
                            </div>

                            {/* Only Edit button for no-info cases */}
                            <button
                              onClick={() => handleEdit(index)}
                              className="w-full px-4 py-2 bg-[#0a0a0a] text-white font-sans text-sm hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2"
                            >
                              <Edit3 className="w-4 h-4" />
                              Provide Information
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="font-sans text-sm text-[#57534e] leading-relaxed mb-3">
                              {answer.answer}
                            </p>

                            {/* Source and confidence */}
                            <div className="flex items-center gap-4 mb-4">
                              <div className="flex items-center gap-1">
                                <Globe className="w-3 h-3 text-[#a8a29e]" />
                                <span className="font-mono text-[10px] text-[#78716c]">
                                  {answer.source}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "font-mono text-[10px] uppercase",
                                  confidenceColor(answer.confidence)
                                )}
                              >
                                {answer.confidence} confidence
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              {!status.accepted && (
                                <button
                                  onClick={() => handleAccept(index)}
                                  className="flex-1 px-4 py-2 bg-[#0a0a0a] text-white font-sans text-sm hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2"
                                >
                                  <Check className="w-4 h-4" />
                                  Accept
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(index)}
                                className={cn(
                                  "flex-1 px-4 py-2 border border-[#e7e5e4] text-[#57534e] font-sans text-sm transition-colors flex items-center justify-center gap-2",
                                  "hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
                                )}
                              >
                                <Edit3 className="w-4 h-4" />
                                Edit
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
            disabled={!allAccepted}
            variant="primary"
            size="lg"
            className="flex-1 group"
          >
            {currentStep === totalSteps ? (
              <>
                Complete Review
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

        {!allAccepted && (
          <p className="mt-3 font-mono text-[10px] text-center text-[#a8a29e]">
            Please accept or edit all findings before continuing
          </p>
        )}
      </motion.div>
    </div>
  );
}
