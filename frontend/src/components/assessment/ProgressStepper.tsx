"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssessmentPhase = "research" | "classify" | "report";

interface Step {
  id: AssessmentPhase;
  label: string;
  number: string;
}

const steps: Step[] = [
  { id: "research", label: "Research", number: "1" },
  { id: "classify", label: "Classify", number: "2" },
  { id: "report", label: "Report", number: "3" },
];

interface ProgressStepperProps {
  currentPhase: AssessmentPhase;
  completedPhases: AssessmentPhase[];
}

export function ProgressStepper({
  currentPhase,
  completedPhases,
}: ProgressStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentPhase);

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = completedPhases.includes(step.id);
        const isCurrent = step.id === currentPhase;
        const isPast = index < currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step */}
            <div className="flex items-center gap-2">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isCompleted
                    ? "#0a0a0a"
                    : isCurrent
                    ? "#0a0a0a"
                    : "#e7e5e4",
                  scale: isCurrent ? 1.05 : 1,
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "w-7 h-7 flex items-center justify-center",
                  "text-xs font-mono"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <span
                    className={cn(isCurrent ? "text-white" : "text-[#78716c]")}
                  >
                    {step.number}
                  </span>
                )}
              </motion.div>
              <span
                className={cn(
                  "font-sans text-sm hidden sm:block",
                  isCurrent || isCompleted
                    ? "text-[#0a0a0a] font-medium"
                    : "text-[#a8a29e]"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div className="mx-4 w-12 h-px relative">
                <div className="absolute inset-0 bg-[#e7e5e4]" />
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isPast || isCompleted ? 1 : 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute inset-0 bg-[#0a0a0a] origin-left"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
