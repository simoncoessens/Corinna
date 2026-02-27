"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Scale,
  FileText,
  Search,
  BookOpen,
  Gavel,
  Shield,
} from "lucide-react";

interface LegalLoadingAnimationProps {
  tool: string;
}

export function LegalLoadingAnimation({ tool }: LegalLoadingAnimationProps) {
  const isDSA = tool === "retrieve_dsa_knowledge";

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
    <div className="w-full">
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
            {steps.map((step) => {
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
