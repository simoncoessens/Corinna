"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  StreamEvent,
  ResultEvent,
  ToolEndEvent,
  SearchSource,
} from "@/types/api";
import type {
  CompanyResearchResult,
  RESEARCH_SECTIONS,
} from "@/types/research";

interface DeepResearchProps {
  companyName: string;
  onComplete: (result: CompanyResearchResult) => void;
  onError: (error: string) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

const MAX_VISIBLE_SOURCES = 4;
// Expected number of research questions from the CSV parser
const EXPECTED_QUESTIONS = 17;
// Progress phases: research (0-60%), summarization (60-95%), finalization (95-100%)
const RESEARCH_PHASE_MAX = 60;
const SUMMARIZATION_PHASE_MAX = 95;

export function DeepResearch({
  companyName,
  onComplete,
  onError,
}: DeepResearchProps) {
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [visibleSources, setVisibleSources] = useState<SearchSource[]>([]);
  const [totalSourceCount, setTotalSourceCount] = useState(0);
  const [currentSection, setCurrentSection] = useState<string>("Initializing");
  const [isSearching, setIsSearching] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<
    "research" | "summarization" | "finalizing"
  >("research");
  const searchCountRef = useRef(0);
  const llmCountRef = useRef(0);

  useEffect(() => {
    const lastFour = sources.slice(-MAX_VISIBLE_SOURCES);
    setVisibleSources(lastFour);
  }, [sources]);

  const runResearch = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/agents/company_researcher/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_name: companyName }),
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as StreamEvent;

              switch (event.type) {
                case "tool_start":
                  if (event.name === "web_search") {
                    setIsSearching(true);
                  }
                  break;
                case "tool_end":
                  const toolEndEvent = event as ToolEndEvent;
                  if (
                    toolEndEvent.name === "web_search" &&
                    toolEndEvent.sources
                  ) {
                    setSources((prev) => {
                      const existingUrls = new Set(prev.map((s) => s.url));
                      const newSources = toolEndEvent.sources!.filter(
                        (s) => !existingUrls.has(s.url)
                      );
                      setTotalSourceCount((c) => c + newSources.length);
                      return [...prev, ...newSources];
                    });
                    searchCountRef.current++;
                    // Research phase: 0-60% based on web searches
                    const searchProgress = Math.min(
                      (searchCountRef.current / EXPECTED_QUESTIONS) *
                        RESEARCH_PHASE_MAX,
                      RESEARCH_PHASE_MAX
                    );
                    setProgress(searchProgress);
                    setPhase("research");
                  }
                  setIsSearching(false);
                  break;
                case "llm_start":
                  // Track summarization LLM calls for progress (60-95%)
                  llmCountRef.current++;
                  // After research phase, LLM calls are for summarization
                  if (searchCountRef.current >= EXPECTED_QUESTIONS * 0.8) {
                    setPhase("summarization");
                    setIsSearching(false);
                    // Calculate summarization progress (each question gets summarized)
                    const summarizationProgress = Math.min(
                      RESEARCH_PHASE_MAX +
                        (llmCountRef.current / (EXPECTED_QUESTIONS * 2)) *
                          (SUMMARIZATION_PHASE_MAX - RESEARCH_PHASE_MAX),
                      SUMMARIZATION_PHASE_MAX
                    );
                    setProgress(summarizationProgress);
                  }
                  break;
                case "node_start":
                  if (event.chain?.includes("research")) {
                    setCurrentSection("Researching questions");
                  }
                  if (event.chain?.includes("finalize")) {
                    setPhase("finalizing");
                    setProgress(SUMMARIZATION_PHASE_MAX);
                  }
                  break;
                case "result":
                  const resultData = (
                    event as ResultEvent<CompanyResearchResult>
                  ).data;
                  setPhase("finalizing");
                  setProgress(100);
                  setTimeout(() => {
                    onComplete(resultData);
                  }, 500);
                  break;
                case "error":
                  onError(event.message);
                  break;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [companyName, onComplete, onError]);

  useEffect(() => {
    runResearch();
  }, [runResearch]);

  return (
    <div className="w-full max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center"
      >
        {/* Header */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-14 h-14 bg-[#0a0a0a] flex items-center justify-center mb-6"
        >
          <FileSearch className="w-6 h-6 text-white" />
        </motion.div>

        <h2 className="font-serif text-2xl text-[#0a0a0a] mb-1">
          Deep Research
        </h2>
        <p className="font-sans text-sm text-[#78716c] mb-6">
          Analyzing &quot;{companyName}&quot; for DSA compliance
        </p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-[#e7e5e4] mb-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-[#0a0a0a]"
          />
        </div>

        {/* Sources Panel */}
        <div className="w-full border border-[#e7e5e4] bg-white">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Sources
            </span>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="flex items-center gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="w-3 h-3 border border-[#0a0a0a] border-t-transparent"
              />
              <span className="font-mono text-[10px] text-[#57534e]">
                {phase === "research" && isSearching && "Searching"}
                {phase === "research" && !isSearching && "Processing"}
                {phase === "summarization" && "Summarizing"}
                {phase === "finalizing" && "Finalizing"}
              </span>
            </motion.div>
          </div>

          {/* Sources list */}
          <div className="h-[208px] relative overflow-hidden">
            <AnimatePresence mode="popLayout">
              {visibleSources.map((source) => (
                <motion.div
                  key={source.url}
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 52 }}
                  exit={{ opacity: 0, y: 20, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="px-4 flex items-center gap-3 border-b border-[#e7e5e4] last:border-b-0"
                  style={{ height: 52 }}
                >
                  <div className="w-6 h-6 bg-[#f5f5f4] flex items-center justify-center flex-shrink-0">
                    <Globe className="w-3 h-3 text-[#78716c]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {source.title && (
                      <p className="font-sans text-sm text-[#0a0a0a] truncate">
                        {source.title}
                      </p>
                    )}
                    <p className="font-mono text-[11px] text-[#78716c] truncate">
                      {extractDomain(source.url)}
                    </p>
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-4 h-4 bg-[#dcfce7] flex items-center justify-center flex-shrink-0"
                  >
                    <Check className="w-2.5 h-2.5 text-[#16a34a]" />
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>

            {visibleSources.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex gap-1 mb-3"
                >
                  <div className="w-1 h-4 bg-[#e7e5e4]" />
                  <div className="w-1 h-4 bg-[#e7e5e4]" />
                  <div className="w-1 h-4 bg-[#e7e5e4]" />
                </motion.div>
                <span className="font-mono text-[10px] text-[#a8a29e] uppercase tracking-wider">
                  Initializing research
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#a8a29e]">
              {totalSourceCount} source{totalSourceCount !== 1 ? "s" : ""}{" "}
              analyzed
            </span>
            <span className="font-mono text-[10px] text-[#57534e]">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Section indicators */}
        <div className="mt-6 flex gap-4">
          {["Scope", "Size", "Type"].map((section, i) => (
            <div key={section} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2",
                  progress > (i + 1) * 30 ? "bg-[#0a0a0a]" : "bg-[#e7e5e4]"
                )}
              />
              <span className="font-mono text-[10px] text-[#78716c]">
                {section}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
