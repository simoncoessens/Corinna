"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FileSearch, Check, Globe } from "lucide-react";
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

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://snip-tool-backend.onrender.com";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

const MAX_VISIBLE_SOURCES = 6;

const PHASE_CONFIG = {
  research: {
    label: "Researching",
    description: "Gathering information from the web",
  },
  summarization: {
    label: "Analyzing",
    description: "Processing and synthesizing findings",
  },
  finalizing: {
    label: "Finalizing",
    description: "Preparing your compliance report",
  },
};

export function DeepResearch({
  companyName,
  onComplete,
  onError,
}: DeepResearchProps) {
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [phase, setPhase] = useState<
    "research" | "summarization" | "finalizing"
  >("research");
  const searchCountRef = useRef(0);
  const llmCountRef = useRef(0);
  const researchPhaseComplete = useRef(false);

  // Keep newest unique sources (prefer latest when duplicate URLs appear)
  const dedupeSources = useCallback((list: SearchSource[]) => {
    const seen = new Set<string>();
    const ordered: SearchSource[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      ordered.push(s);
    }
    return ordered.reverse();
  }, []);

  // Get last N unique sources for display
  const visibleSources = dedupeSources(sources).slice(-MAX_VISIBLE_SOURCES);

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
                case "tool_end":
                  const toolEndEvent = event as ToolEndEvent;
                  if (
                    toolEndEvent.name === "web_search" &&
                    toolEndEvent.sources
                  ) {
                    setSources((prev) =>
                      dedupeSources([...prev, ...(toolEndEvent.sources ?? [])])
                    );
                    searchCountRef.current++;
                  }
                  break;
                case "llm_start":
                  llmCountRef.current++;
                  if (
                    searchCountRef.current >= 30 &&
                    !researchPhaseComplete.current
                  ) {
                    if (llmCountRef.current > searchCountRef.current) {
                      researchPhaseComplete.current = true;
                      setPhase("summarization");
                    }
                  }
                  break;
                case "node_start":
                  if (event.chain?.includes("finalize")) {
                    setPhase("finalizing");
                  }
                  break;
                case "result":
                  const resultData = (
                    event as ResultEvent<CompanyResearchResult>
                  ).data;
                  setPhase("finalizing");
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
    <div className="w-full max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center"
      >
        {/* Animated header icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-20 h-20 mb-8"
        >
          {/* Pulsing rings */}
          <motion.div
            className="absolute inset-0 border border-[#e7e5e4] rounded-full"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0 border border-[#e7e5e4] rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3,
            }}
          />
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 bg-[#0a0a0a] flex items-center justify-center">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>

        <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
          Deep Research
        </h2>
        <p className="font-sans text-sm text-[#78716c] mb-2">{companyName}</p>

        {/* Phase description */}
        <motion.p
          key={phase}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-sans text-xs text-[#a8a29e] mb-8"
        >
          {PHASE_CONFIG[phase].description}
        </motion.p>

        {/* Main card */}
        <div className="w-full border border-[#e7e5e4] bg-white">
          {/* Sources header */}
          <div className="px-5 py-4 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Sources analyzed
            </span>
            <motion.span
              key={sources.length}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="font-mono text-sm font-medium text-[#0a0a0a]"
            >
              {sources.length}
            </motion.span>
          </div>

          {/* Sources list */}
          <div className="min-h-[216px]">
            {visibleSources.length === 0 ? (
              <div className="h-[216px] flex flex-col items-center justify-center">
                <motion.div
                  className="flex gap-1 mb-3"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-1.5 h-1.5 bg-[#0a0a0a] rounded-full" />
                  <div className="w-1.5 h-1.5 bg-[#78716c] rounded-full" />
                  <div className="w-1.5 h-1.5 bg-[#a8a29e] rounded-full" />
                </motion.div>
                <span className="font-mono text-[11px] text-[#a8a29e]">
                  Searching for sources...
                </span>
              </div>
            ) : (
              <div className="divide-y divide-[#f5f5f4]">
                {visibleSources.map((source, i) => (
                  <motion.div
                    key={`${source.url}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 py-3 flex items-center gap-3"
                  >
                    <div className="w-6 h-6 bg-[#f5f5f4] flex items-center justify-center shrink-0">
                      <Globe className="w-3 h-3 text-[#78716c]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {source.title && (
                        <p className="font-sans text-sm text-[#0a0a0a] truncate mb-0.5">
                          {source.title}
                        </p>
                      )}
                      <p className="font-mono text-[11px] text-[#78716c] truncate">
                        {extractDomain(source.url)}
                      </p>
                    </div>
                    <div className="w-5 h-5 bg-[#dcfce7] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-[#16a34a]" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Phase indicators footer */}
          <div className="px-5 py-4 border-t border-[#e7e5e4] bg-[#fafaf9]">
            <div className="flex items-center justify-center gap-3">
              {(["research", "summarization", "finalizing"] as const).map(
                (p, i) => {
                  const isComplete =
                    (p === "research" && phase !== "research") ||
                    (p === "summarization" && phase === "finalizing");
                  const isCurrent = p === phase;

                  return (
                    <div key={p} className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300",
                            isComplete
                              ? "bg-[#0a0a0a]"
                              : isCurrent
                              ? "bg-[#0a0a0a]"
                              : "bg-[#e7e5e4]"
                          )}
                        >
                          {isComplete ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : isCurrent ? (
                            <motion.div
                              className="w-2 h-2 bg-white rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          ) : (
                            <div className="w-2 h-2 bg-[#a8a29e] rounded-full" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "font-mono text-[10px] uppercase tracking-wider transition-colors duration-300",
                            isCurrent || isComplete
                              ? "text-[#0a0a0a]"
                              : "text-[#a8a29e]"
                          )}
                        >
                          {PHASE_CONFIG[p].label}
                        </span>
                      </div>
                      {i < 2 && (
                        <div
                          className={cn(
                            "w-8 h-px transition-colors duration-300",
                            isComplete ? "bg-[#0a0a0a]" : "bg-[#e7e5e4]"
                          )}
                        />
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
