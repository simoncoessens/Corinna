"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionId } from "@/services/api";
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
import type { ChatContext } from "./ChatPopup";

interface DeepResearchProps {
  companyName: string;
  topDomain: string;
  summaryLong: string;
  onComplete: (result: CompanyResearchResult) => void;
  onError: (error: string) => void;
  /**
   * Emits a snapshot of what the user can currently see in this screen.
   */
  onVisibleStateChange?: (state: ChatContext["visibleUi"]) => void;
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
// Slow down the reveal so the list feels calmer.
const SOURCE_ADD_DELAY = 900; // ms between adding each source

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
  topDomain,
  summaryLong,
  onComplete,
  onError,
  onVisibleStateChange,
}: DeepResearchProps) {
  // Queue for incoming sources (raw from API)
  const sourceQueueRef = useRef<SearchSource[]>([]);
  // Displayed sources (added with delay)
  const [displayedSources, setDisplayedSources] = useState<SearchSource[]>([]);
  const displayedSourcesRef = useRef<SearchSource[]>([]);
  // Total count for the header
  const [totalSourceCount, setTotalSourceCount] = useState(0);

  const [phase, setPhase] = useState<
    "research" | "summarization" | "finalizing"
  >("research");
  const searchCountRef = useRef(0);
  const llmCountRef = useRef(0);
  const researchPhaseComplete = useRef(false);
  const processingRef = useRef(false);
  const completedRef = useRef(false);
  const researchStartedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const lastCompanyRef = useRef<string | null>(null);

  // Keep unique sources by URL
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

  // Keep latest displayed sources in a ref so callbacks don't re-create on every render.
  useEffect(() => {
    displayedSourcesRef.current = displayedSources;
  }, [displayedSources]);

  // Process queue with delay to stagger source appearances
  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const processNext = () => {
      if (sourceQueueRef.current.length === 0) {
        processingRef.current = false;
        return;
      }

      const nextSource = sourceQueueRef.current.shift();
      if (nextSource) {
        setDisplayedSources((prev) => {
          const updated = [...prev, nextSource];
          return dedupeSources(updated);
        });
      }

      // Schedule next source with delay
      setTimeout(processNext, SOURCE_ADD_DELAY);
    };

    processNext();
  }, [dedupeSources]);

  // Add sources to queue and start processing
  const queueSources = useCallback(
    (newSources: SearchSource[]) => {
      // Filter out duplicates before adding to queue
      const existingUrls = new Set([
        ...sourceQueueRef.current.map((s) => s.url),
        ...displayedSourcesRef.current.map((s) => s.url),
      ]);

      const uniqueNew = newSources.filter((s) => !existingUrls.has(s.url));

      if (uniqueNew.length > 0) {
        sourceQueueRef.current.push(...uniqueNew);
        setTotalSourceCount((prev) => prev + uniqueNew.length);
        processQueue();
      }
    },
    [processQueue]
  );

  // Get last N sources for display (memoized to prevent unnecessary re-renders)
  const visibleSources = useMemo(
    () => displayedSources.slice(-MAX_VISIBLE_SOURCES),
    [displayedSources]
  );

  // Memoize the visible sources data to prevent unnecessary updates
  const visibleSourcesData = useMemo(
    () =>
      visibleSources.map((s) => ({
        title: s.title,
        url: s.url,
      })),
    [visibleSources]
  );

  // Track previous values to avoid unnecessary calls
  const prevValuesRef = useRef<{
    companyName: string;
    phase: string;
    totalSourceCount: number;
    visibleSourcesData: typeof visibleSourcesData;
  } | null>(null);

  // Keep onVisibleStateChange in a ref to avoid dependency issues
  const onVisibleStateChangeRef = useRef(onVisibleStateChange);
  useEffect(() => {
    onVisibleStateChangeRef.current = onVisibleStateChange;
  }, [onVisibleStateChange]);

  useEffect(() => {
    if (!onVisibleStateChangeRef.current) return;

    // Check if values actually changed
    const prev = prevValuesRef.current;
    if (
      prev &&
      prev.companyName === companyName &&
      prev.phase === phase &&
      prev.totalSourceCount === totalSourceCount &&
      prev.visibleSourcesData.length === visibleSourcesData.length &&
      prev.visibleSourcesData.every(
        (s, i) =>
          s.url === visibleSourcesData[i]?.url &&
          s.title === visibleSourcesData[i]?.title
      )
    ) {
      return; // No changes, skip update
    }

    // Update previous values
    prevValuesRef.current = {
      companyName,
      phase,
      totalSourceCount,
      visibleSourcesData,
    };

    // Call the callback
    onVisibleStateChangeRef.current({
      deepResearch: {
        companyName,
        phase,
        totalSourceCount,
        visibleSources: visibleSourcesData,
      },
    });
  }, [companyName, phase, totalSourceCount, visibleSourcesData]);

  useEffect(() => {
    // Check if company actually changed
    const companyChanged = lastCompanyRef.current !== companyName;

    // Guard against duplicate calls (e.g., React Strict Mode)
    // Check synchronously if research is already starting/running for the same company
    if (!companyChanged && researchStartedRef.current) {
      // Same company and research already started (even if not completed), don't start again
      return;
    }

    // Set flag IMMEDIATELY and synchronously to prevent duplicate runs
    // This must happen before any async operations
    researchStartedRef.current = true;

    // Update last company reference
    lastCompanyRef.current = companyName;

    // Reset per-run refs when company changes
    completedRef.current = false;
    searchCountRef.current = 0;
    llmCountRef.current = 0;
    researchPhaseComplete.current = false;

    // Abort any existing research
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    async function runResearch() {
      // Double-check: if controller was aborted or replaced, don't proceed
      if (controller.signal.aborted || controllerRef.current !== controller) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/agents/company_researcher/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_name: companyName,
              top_domain: topDomain,
              summary_long: summaryLong,
              session_id: getSessionId(),
            }),
            signal: controller.signal,
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

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();

              try {
                const event = JSON.parse(data) as StreamEvent;

                switch (event.type) {
                  case "tool_end": {
                    const toolEndEvent = event as ToolEndEvent;
                    if (
                      toolEndEvent.sources &&
                      toolEndEvent.sources.length > 0
                    ) {
                      queueSources(toolEndEvent.sources);
                      if (toolEndEvent.name === "web_search") {
                        searchCountRef.current++;
                      }
                    }
                    break;
                  }
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
                  case "result": {
                    // Guard against duplicate result events or replays.
                    if (completedRef.current) break;
                    completedRef.current = true;

                    const resultData = (
                      event as ResultEvent<CompanyResearchResult>
                    ).data;
                    setPhase("finalizing");
                    setTimeout(() => onComplete(resultData), 500);
                    break;
                  }
                  case "error":
                    if (!completedRef.current) {
                      onError(event.message);
                    }
                    break;
                  case "done":
                    // End the stream loop immediately.
                    return;
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err) {
        // Ignore abort errors (happen on unmount / strict mode)
        if (controller.signal.aborted) return;
        onError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    runResearch();

    // Cleanup: abort fetch/stream when leaving the component (prevents
    // background streaming continuing into review screens).
    return () => {
      // Only abort if this controller is still the current one
      if (controllerRef.current === controller) {
        controller.abort();
        controllerRef.current = null;
        // Reset flag only if this was the active controller
        // This allows a new research to start if company actually changes
        researchStartedRef.current = false;
      }
    };
  }, [companyName, topDomain, summaryLong, onComplete, onError, queueSources]);

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
            <span className="font-mono text-sm font-medium text-[#0a0a0a] tabular-nums">
              {totalSourceCount}
            </span>
          </div>

          {/* Sources list */}
          {/* Fixed height to avoid vertical growth as sources accumulate */}
          <div className="h-[216px] overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleSources.length === 0 ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-[216px] flex flex-col items-center justify-center"
                >
                  <motion.div
                    className="flex gap-1.5 mb-3"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="w-1.5 h-1.5 bg-[#0a0a0a]" />
                    <div className="w-1.5 h-1.5 bg-[#78716c]" />
                    <div className="w-1.5 h-1.5 bg-[#a8a29e]" />
                  </motion.div>
                  <span className="font-mono text-[11px] text-[#a8a29e]">
                    Searching for sources...
                  </span>
                </motion.div>
              ) : (
                <div className="h-full overflow-y-auto overscroll-contain divide-y divide-[#f5f5f4]">
                  {visibleSources.map((source) => (
                    <motion.div
                      key={source.url}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{
                        duration: 0.4,
                        ease: [0.25, 0.1, 0.25, 1],
                        layout: { duration: 0.3 },
                      }}
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
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: 0.2,
                          duration: 0.2,
                          ease: "backOut",
                        }}
                        className="w-5 h-5 bg-[#dcfce7] flex items-center justify-center shrink-0"
                      >
                        <Check className="w-3 h-3 text-[#16a34a]" />
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
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
