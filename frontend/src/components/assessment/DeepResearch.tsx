"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, Check } from "lucide-react";
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
  /**
   * Sends the list of gathered sources to the parent once available.
   */
  onSourcesReady?: (payload: {
    sources: SearchSource[];
    totalCount: number;
  }) => void;
}

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://snip-tool-backend.onrender.com";

const RESEARCH_PERSISTENCE_KEY = "corinna_deep_research_state";

interface PersistedResearchState {
  companyName: string;
  displayedSources: SearchSource[];
  totalSourceCount: number;
  phase: "research" | "summarization" | "finalizing";
}

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
    label: "Data collection",
    description: "Gathering public records and company disclosures",
  },
  summarization: {
    label: "Analysis",
    description: "Interpreting services, operations, and risk signals",
  },
  finalizing: {
    label: "Summary",
    description: "Compiling sourced findings for review",
  },
};

export function DeepResearch({
  companyName,
  topDomain,
  summaryLong,
  onComplete,
  onError,
  onVisibleStateChange,
  onSourcesReady,
}: DeepResearchProps) {
  // Queue for incoming sources (raw from API)
  const sourceQueueRef = useRef<SearchSource[]>([]);
  // Displayed sources (added with delay)
  const [displayedSources, setDisplayedSources] = useState<SearchSource[]>([]);
  const displayedSourcesRef = useRef<SearchSource[]>([]);
  // Total count for the header
  const [totalSourceCount, setTotalSourceCount] = useState(0);
  const [fakeProgress, setFakeProgress] = useState(12);

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
  const [hasHydrated, setHasHydrated] = useState(false);
  const seenUrlsRef = useRef<Set<string>>(new Set());

  // Hydrate state from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setHasHydrated(true);
      return;
    }
    const raw = sessionStorage.getItem(RESEARCH_PERSISTENCE_KEY);
    if (!raw) {
      setHasHydrated(true);
      return;
    }
    try {
      const data = JSON.parse(raw) as PersistedResearchState;
      // Only restore if it's for the same company
      if (data.companyName === companyName) {
        if (data.displayedSources) {
          setDisplayedSources(data.displayedSources);
          displayedSourcesRef.current = data.displayedSources;
          seenUrlsRef.current = new Set(
            data.displayedSources.map((s) => s.url)
          );
        }
        if (typeof data.totalSourceCount === "number") {
          setTotalSourceCount(data.totalSourceCount);
        }
        if (data.phase) {
          setPhase(data.phase);
        }
      }
    } catch (e) {
      console.warn("[DeepResearch] Failed to restore state", e);
    } finally {
      setHasHydrated(true);
    }
  }, [companyName]);

  // Persist state whenever it changes
  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated) return;
    try {
      const payload: PersistedResearchState = {
        companyName,
        displayedSources,
        totalSourceCount,
        phase,
      };
      sessionStorage.setItem(RESEARCH_PERSISTENCE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [hasHydrated, companyName, displayedSources, totalSourceCount, phase]);

  // Keep callbacks stable so the streaming effect doesn't restart
  // just because parent re-rendered.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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

  useEffect(() => {
    const target =
      phase === "research" ? 68 : phase === "summarization" ? 88 : 97;
    const floor =
      phase === "research" ? 12 : phase === "summarization" ? 56 : 82;

    setFakeProgress((prev) => Math.max(prev, floor));

    const interval = window.setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= target) return prev;
        const increment = 1.5 + Math.random() * 5;
        return Math.min(prev + increment, target);
      });
    }, 4500);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!onSourcesReady) return;
    onSourcesReady({
      sources: [...displayedSourcesRef.current],
      totalCount: totalSourceCount,
    });
  }, [displayedSources, totalSourceCount, onSourcesReady]);

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
        seenUrlsRef.current.add(nextSource.url);
        setTotalSourceCount(seenUrlsRef.current.size);
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
        ...Array.from(seenUrlsRef.current.values()),
      ]);

      const uniqueNew = newSources.filter((s) => !existingUrls.has(s.url));

      if (uniqueNew.length > 0) {
        sourceQueueRef.current.push(...uniqueNew);
        uniqueNew.forEach((s) => seenUrlsRef.current.add(s.url));
        setTotalSourceCount(seenUrlsRef.current.size);
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
    setFakeProgress(12);

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
          const bodyText = await response.text().catch(() => "");
          const detail = bodyText ? bodyText.slice(0, 500) : "";
          throw new Error(
            detail
              ? `API Error: ${response.status} - ${detail}`
              : `API Error: ${response.status}`
          );
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
                      toolEndEvent.sources.forEach((s) =>
                        seenUrlsRef.current.add(s.url)
                      );
                      setTotalSourceCount(seenUrlsRef.current.size);
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
                    // Clear persisted state since research is complete
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem(RESEARCH_PERSISTENCE_KEY);
                    }
                    setTimeout(() => onCompleteRef.current(resultData), 500);
                    break;
                  }
                  case "error":
                    if (!completedRef.current) {
                      const message = (event as { message?: unknown }).message;
                      onErrorRef.current(
                        typeof message === "string" && message.trim()
                          ? message
                          : "Unknown error"
                      );
                    }
                    break;
                  case "done":
                    // End the stream loop immediately.
                    if (!completedRef.current) {
                      onErrorRef.current(
                        "Research completed but no result was returned."
                      );
                    }
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
        onErrorRef.current(
          err instanceof Error ? err.message : "Unknown error"
        );
      }
    }

    // React StrictMode (dev) intentionally mounts/unmounts components once to
    // detect unsafe effects. If we start the backend stream immediately, we can
    // accidentally kick off the full research twice. Deferring one tick lets the
    // StrictMode "test mount" clean up before we start any network work.
    const startTimer = window.setTimeout(() => {
      if (controller.signal.aborted || controllerRef.current !== controller) {
        return;
      }
      runResearch();
    }, 0);

    // Cleanup: abort fetch/stream when leaving the component (prevents
    // background streaming continuing into review screens).
    return () => {
      window.clearTimeout(startTimer);
      // Only abort if this controller is still the current one
      if (controllerRef.current === controller) {
        controller.abort();
        controllerRef.current = null;
        // Reset flag only if this was the active controller
        // This allows a new research to start if company actually changes
        researchStartedRef.current = false;
      }
    };
  }, [companyName, topDomain, summaryLong, queueSources]);

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
          <div className="px-5 py-4 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
                Detailed research in progress
              </span>
              <p className="font-sans text-sm text-[#57534e]">
                Collecting corporate records, product details, and operational
                signals
              </p>
            </div>
            <div className="px-3 py-1 bg-[#0a0a0a] text-white font-mono text-xs uppercase tracking-wider">
              {Math.min(99, Math.max(14, Math.round(fakeProgress)))}%
            </div>
          </div>

          <div className="px-5 py-6 space-y-5">
            <div className="relative h-2 bg-[#f5f5f4] border border-[#e7e5e4] overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-[#0a0a0a]"
                animate={{
                  width: `${Math.min(99, Math.max(fakeProgress, 10))}%`,
                }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              />
              <motion.div
                className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-60"
                animate={{ x: ["-30%", "120%"] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            <div className="grid gap-3">
              {(
                [
                  {
                    label: "Searching public records",
                    description: "Registries, statutory filings, open-web evidence",
                    phaseKey: "research",
                  },
                {
                  label: "Analyzing services offered",
                  description:
                    "Mapping products, markets, and governance signals",
                  phaseKey: "summarization",
                },
                {
                  label: "Building the profile",
                  description: "Assembling a sourced company dossier",
                  phaseKey: "finalizing",
                },
                ] as const
              ).map((item) => {
                const phaseOrder = [
                  "research",
                  "summarization",
                  "finalizing",
                ] as const;
                const currentIndex = phaseOrder.indexOf(phase);
                const itemIndex = phaseOrder.indexOf(item.phaseKey);
                const isComplete = currentIndex > itemIndex;
                const isCurrent = currentIndex === itemIndex;

                return (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-start gap-3 rounded-sm border border-transparent px-2 py-1",
                      isCurrent ? "border-[#e7e5e4] bg-[#fafaf9]" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center mt-0.5 transition-colors duration-300",
                        isComplete || isCurrent
                          ? "bg-[#0a0a0a]"
                          : "bg-[#f5f5f4] border border-[#e7e5e4]"
                      )}
                    >
                      {isComplete ? (
                        <Check className="w-3.5 h-3.5 text-white" />
                      ) : isCurrent ? (
                        <motion.div
                          className="w-2 h-2 bg-white rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.1, repeat: Infinity }}
                        />
                      ) : (
                        <motion.div
                          className="w-2 h-2 rounded-full bg-[#78716c]"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.6, 1, 0.6],
                          }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-[#0a0a0a]">
                        {item.label}
                      </p>
                      <p className="font-mono text-[11px] text-[#a8a29e]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
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
