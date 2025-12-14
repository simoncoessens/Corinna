"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Search,
  Check,
  AlertCircle,
  RotateCcw,
  Globe,
  ExternalLink,
  MapPin,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  CompanyMatch,
  CompanyMatchResult,
  StreamEvent,
  ResultEvent,
  ToolEndEvent,
  SearchSource,
} from "@/types/api";
import type { ChatContext } from "./ChatPopup";

type MatcherState = "input" | "searching" | "found" | "not_found" | "error";

interface CompanyMatcherProps {
  onCompanySelected: (company: CompanyMatch) => void;
  onStartResearch: (companyName: string) => void;
  onManualEntry?: (companyName: string, country: string) => void;
  /**
   * Emits a snapshot of what the user can currently see in this screen,
   * so the assistant can get full UI context (including unconfirmed inputs).
   */
  onVisibleStateChange?: (state: ChatContext["visibleUi"]) => void;
}

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://snip-tool-backend.onrender.com";

// Extract domain from URL for cleaner display (used for search sources).
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function getShortSummary(company: CompanyMatch): string {
  return (
    company.summary_short ||
    // If no short summary is available, fall back to the long one (UI clamps it).
    company.summary_long ||
    ""
  ).trim();
}

const MAX_VISIBLE_SOURCES = 3;
const SOURCE_ADD_DELAY = 900; // ms between adding each source
// Allow multiple sources per search call; display rate is controlled separately.
const MAX_SOURCES_PER_TOOL_EVENT = 8;
const MAX_TOTAL_SOURCES = 25; // cap for UI stability

// Animated dots for loading
function LoadingDots() {
  return (
    <span className="inline-flex gap-[2px] ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </span>
  );
}

export function CompanyMatcher({
  onCompanySelected,
  onStartResearch,
  onManualEntry,
  onVisibleStateChange,
}: CompanyMatcherProps) {
  const [state, setState] = useState<MatcherState>("input");
  const [companyName, setCompanyName] = useState("");
  const [countryOfEstablishment, setCountryOfEstablishment] = useState("");
  const [allSources, setAllSources] = useState<SearchSource[]>([]);
  const allSourcesRef = useRef<SearchSource[]>([]);
  const sourceQueueRef = useRef<SearchSource[]>([]);
  const processingRef = useRef(false);
  const nextTimerRef = useRef<number | null>(null);
  const [visibleSources, setVisibleSources] = useState<SearchSource[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalSourceCount, setTotalSourceCount] = useState(0);
  const [sourceCountCapped, setSourceCountCapped] = useState(false);
  const [result, setResult] = useState<CompanyMatchResult | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyMatch | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Emit "what user can see" snapshot for chat context
  useEffect(() => {
    if (!onVisibleStateChange) return;
    onVisibleStateChange({
      companyLookup: {
        state,
        organizationName: companyName,
        countryOfEstablishment,
        isSearching,
        error,
        totalSourceCount,
        visibleSources: visibleSources.map((s) => ({
          title: s.title,
          url: s.url,
        })),
        results: result
          ? {
              input_name: result.input_name,
              exact_match: result.exact_match
                ? {
                    name: result.exact_match.name,
                    top_domain: result.exact_match.top_domain,
                    confidence: result.exact_match.confidence,
                  }
                : null,
              suggestions: (result.suggestions || []).map((c) => ({
                name: c.name,
                top_domain: c.top_domain,
                confidence: c.confidence,
              })),
              selectedCompanyName: selectedCompany?.name ?? null,
            }
          : null,
      },
    });
  }, [
    onVisibleStateChange,
    state,
    companyName,
    countryOfEstablishment,
    isSearching,
    error,
    totalSourceCount,
    visibleSources,
    result,
    selectedCompany,
  ]);

  // Update visible sources when allSources changes - show last 3
  useEffect(() => {
    const lastThree = allSources.slice(-MAX_VISIBLE_SOURCES);
    setVisibleSources(lastThree);
  }, [allSources]);

  useEffect(() => {
    allSourcesRef.current = allSources;
  }, [allSources]);

  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const processNext = () => {
      if (sourceQueueRef.current.length === 0) {
        processingRef.current = false;
        return;
      }
      const next = sourceQueueRef.current.shift();
      if (next) {
        setAllSources((prev) => {
          if (prev.some((s) => s.url === next.url)) return prev;
          return [...prev, next];
        });
      }
      nextTimerRef.current = window.setTimeout(processNext, SOURCE_ADD_DELAY);
    };

    processNext();
  }, []);

  const queueSources = useCallback(
    (incoming: SearchSource[]) => {
      if (totalSourceCount >= MAX_TOTAL_SOURCES) {
        setSourceCountCapped(true);
        return;
      }

      const existingUrls = new Set([
        ...allSourcesRef.current.map((s) => s.url),
        ...sourceQueueRef.current.map((s) => s.url),
      ]);
      const uniqueNew = incoming.filter((s) => !existingUrls.has(s.url));
      if (uniqueNew.length === 0) return;

      const remaining = Math.max(0, MAX_TOTAL_SOURCES - totalSourceCount);
      const toAdd = uniqueNew.slice(
        0,
        Math.min(remaining, MAX_SOURCES_PER_TOOL_EVENT)
      );
      if (toAdd.length < uniqueNew.length || remaining === 0) {
        setSourceCountCapped(true);
      }
      if (toAdd.length === 0) return;

      sourceQueueRef.current.push(...toAdd);
      setTotalSourceCount((c) => Math.min(MAX_TOTAL_SOURCES, c + toAdd.length));
      processQueue();
    },
    [processQueue, totalSourceCount]
  );

  const handleSearch = useCallback(async () => {
    if (!companyName.trim() || !countryOfEstablishment.trim()) return;

    setState("searching");
    setAllSources([]);
    setVisibleSources([]);
    setTotalSourceCount(0);
    setSourceCountCapped(false);
    setIsSearching(true);
    setError(null);
    setResult(null);
    allSourcesRef.current = [];
    sourceQueueRef.current = [];
    processingRef.current = false;
    if (nextTimerRef.current) {
      window.clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/agents/company_matcher/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: companyName.trim(),
            country_of_establishment: countryOfEstablishment.trim(),
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
                    queueSources(toolEndEvent.sources);
                  }
                  setIsSearching(false);
                  break;
                case "result":
                  const resultData = (event as ResultEvent<CompanyMatchResult>)
                    .data;
                  setResult(resultData);
                  if (resultData.exact_match) {
                    setSelectedCompany(resultData.exact_match);
                    setState("found");
                  } else if (resultData.suggestions?.length > 0) {
                    setState("found");
                  } else {
                    setState("not_found");
                  }
                  break;
                case "error":
                  setError(event.message);
                  setState("error");
                  break;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, [companyName, countryOfEstablishment, queueSources]);

  const handleReset = () => {
    setState("input");
    setCompanyName("");
    setCountryOfEstablishment("");
    setAllSources([]);
    setVisibleSources([]);
    setTotalSourceCount(0);
    setSourceCountCapped(false);
    setResult(null);
    setSelectedCompany(null);
    setError(null);
    allSourcesRef.current = [];
    sourceQueueRef.current = [];
    processingRef.current = false;
    if (nextTimerRef.current) {
      window.clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
  };

  const handleConfirm = () => {
    if (selectedCompany) {
      onCompanySelected(selectedCompany);
      onStartResearch(selectedCompany.name);
    }
  };

  const handleManualEntry = () => {
    if (onManualEntry) {
      onManualEntry(companyName.trim(), countryOfEstablishment.trim());
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {/* Input State */}
        {state === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mb-8"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-[#f5f5f4] to-[#e7e5e4] border border-[#e7e5e4] flex items-center justify-center shadow-sm">
                <Building2
                  className="w-7 h-7 text-[#57534e]"
                  strokeWidth={1.5}
                />
              </div>
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              Organization Lookup
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-8 text-center max-w-xs">
              Enter the organization name and country of establishment to begin
              verification
            </p>

            {/* Input Form */}
            <div className="w-full space-y-4">
              {/* Organization Name Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Building2 className="w-4 h-4 text-[#a8a29e] group-focus-within:text-[#57534e] transition-colors" />
                </div>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      companyName.trim() &&
                      countryOfEstablishment.trim()
                    ) {
                      handleSearch();
                    }
                  }}
                  placeholder="Organization name"
                  className={cn(
                    "w-full h-12 pl-11 pr-4",
                    "bg-white border border-[#e7e5e4]",
                    "font-sans text-base text-[#0a0a0a] placeholder:text-[#a8a29e]",
                    "focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10",
                    "transition-all duration-200"
                  )}
                />
              </div>

              {/* Country Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin className="w-4 h-4 text-[#a8a29e] group-focus-within:text-[#57534e] transition-colors" />
                </div>
                <input
                  type="text"
                  value={countryOfEstablishment}
                  onChange={(e) => setCountryOfEstablishment(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      companyName.trim() &&
                      countryOfEstablishment.trim()
                    ) {
                      handleSearch();
                    }
                  }}
                  placeholder="Country of establishment"
                  className={cn(
                    "w-full h-12 pl-11 pr-4",
                    "bg-white border border-[#e7e5e4]",
                    "font-sans text-base text-[#0a0a0a] placeholder:text-[#a8a29e]",
                    "focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10",
                    "transition-all duration-200"
                  )}
                />
              </div>

              <Button
                onClick={handleSearch}
                disabled={!companyName.trim() || !countryOfEstablishment.trim()}
                size="lg"
                variant="primary"
                className="w-full h-12 flex items-center justify-center gap-2 mt-2"
              >
                <Search className="w-4 h-4" />
                <span>Search Organization</span>
              </Button>

              {/* Manual entry option (available before search) */}
              {onManualEntry && (
                <Button
                  onClick={handleManualEntry}
                  variant="ghost"
                  size="lg"
                  className="w-full h-12 flex items-center justify-center gap-2 text-[#78716c] hover:text-[#0a0a0a]"
                >
                  <PenLine className="w-4 h-4" />
                  <span>Enter data manually</span>
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Searching State */}
        {state === "searching" && (
          <motion.div
            key="searching"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            {/* Simple Search Icon */}
            <div className="w-16 h-16 bg-gradient-to-br from-[#f5f5f4] to-[#e7e5e4] border border-[#e7e5e4] flex items-center justify-center shadow-sm mb-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Search className="w-7 h-7 text-[#57534e]" />
              </motion.div>
            </div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-1">
              Searching
              <LoadingDots />
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-6 text-center">
              Finding information about{" "}
              <span className="font-medium text-[#0a0a0a]">
                &quot;{companyName}&quot;
              </span>
            </p>

            {/* Sources Card */}
            <div className="w-full border border-[#e7e5e4] bg-white overflow-hidden shadow-sm">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#e7e5e4] bg-gradient-to-r from-[#fafaf9] to-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#0a0a0a] animate-pulse" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#57534e]">
                    Live Sources
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#78716c]">
                  {isSearching ? "Fetching..." : "Processing..."}
                </span>
              </div>

              {/* Indeterminate progress bar */}
              <div className="h-1 bg-[#e7e5e4] overflow-hidden">
                <motion.div
                  className="h-full bg-[#0a0a0a]"
                  style={{ width: "35%" }}
                  animate={{ x: ["-120%", "320%"] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>

              {/* Sources List - Fixed height container */}
              <div className="h-[180px] relative overflow-hidden">
                <AnimatePresence mode="sync" initial={false}>
                  {visibleSources.map((source) => (
                    <motion.div
                      key={source.url}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="px-4 flex items-center gap-3 border-b border-[#f5f5f4] last:border-b-0"
                      style={{ height: 60 }}
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          delay: 0.1,
                          type: "spring",
                          stiffness: 200,
                        }}
                        className="w-8 h-8 bg-gradient-to-br from-[#f5f5f4] to-[#e7e5e4] flex items-center justify-center shrink-0"
                      >
                        <Globe className="w-4 h-4 text-[#78716c]" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        {source.title && (
                          <p className="font-sans text-sm text-[#0a0a0a] truncate leading-tight">
                            {source.title}
                          </p>
                        )}
                        <p className="font-mono text-[11px] text-[#a8a29e] truncate mt-0.5">
                          {extractDomain(source.url)}
                        </p>
                      </div>
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="w-6 h-6 bg-[#dcfce7] flex items-center justify-center shrink-0"
                      >
                        <Check className="w-3 h-3 text-[#16a34a]" />
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Empty state / Initial Loading */}
                {visibleSources.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="flex gap-2 mb-4 h-6 items-end">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-[#0a0a0a]/60"
                          initial={{ height: 8 }}
                          animate={{
                            height: [8, 24, 8],
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                        />
                      ))}
                    </div>
                    <span className="font-mono text-[11px] text-[#a8a29e] uppercase tracking-wider">
                      Initializing search
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#e7e5e4] bg-gradient-to-r from-[#fafaf9] to-white flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#57534e]">
                  {sourceCountCapped
                    ? `${MAX_TOTAL_SOURCES}+`
                    : totalSourceCount}{" "}
                  source
                  {sourceCountCapped || totalSourceCount !== 1 ? "s" : ""}{" "}
                  analyzed
                </span>
                <motion.div
                  className="flex gap-1"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-1.5 h-1.5 bg-[#0a0a0a]" />
                  <div className="w-1.5 h-1.5 bg-[#0a0a0a]/60" />
                  <div className="w-1.5 h-1.5 bg-[#0a0a0a]/30" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Found State */}
        {state === "found" && result && (
          <motion.div
            key="found"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.1,
              }}
              className="relative mb-6"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] flex items-center justify-center shadow-sm">
                <Check className="w-7 h-7 text-[#16a34a]" strokeWidth={2.5} />
              </div>
              {/* Success ring animation */}
              <motion.div
                className="absolute inset-0 border-2 border-[#16a34a]"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              />
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              Organization Found
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-6 text-center">
              {result.suggestions.length > 1
                ? "Select the correct entity to continue"
                : "Confirm this is the correct entity"}
            </p>

            {/* Company Cards */}
            {(result.exact_match || result.suggestions.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full space-y-3"
              >
                {[
                  result.exact_match,
                  ...result.suggestions.filter((s) => s !== result.exact_match),
                ]
                  .filter(Boolean)
                  .map((company, index) => (
                    <motion.button
                      key={company!.name + index}
                      onClick={() => setSelectedCompany(company)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className={cn(
                        "w-full p-5 border text-left transition-all duration-200",
                        "hover:shadow-md",
                        selectedCompany?.name === company!.name
                          ? "border-[#0a0a0a] bg-[#f5f5f4] shadow-sm ring-2 ring-[#0a0a0a]/20"
                          : "border-[#e7e5e4] bg-white hover:border-[#0a0a0a]/50"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 flex items-center justify-center shrink-0 transition-colors",
                            selectedCompany?.name === company!.name
                              ? "bg-[#0a0a0a]/10"
                              : "bg-[#f5f5f4]"
                          )}
                        >
                          <Building2
                            className={cn(
                              "w-5 h-5 transition-colors",
                              selectedCompany?.name === company!.name
                                ? "text-[#0a0a0a]"
                                : "text-[#57534e]"
                            )}
                            strokeWidth={1.5}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-sans font-semibold text-[#0a0a0a] leading-tight">
                              {company!.name}
                            </h3>
                            {company!.confidence === "exact" && (
                              <span className="px-2 py-1 bg-gradient-to-r from-[#0a0a0a]/10 to-[#0a0a0a]/5 text-[#0a0a0a] font-mono text-[10px] uppercase tracking-wider border border-[#0a0a0a]/20 shrink-0">
                                Exact Match
                              </span>
                            )}
                          </div>
                          <a
                            href={`https://${company!.top_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-1.5 group/link"
                          >
                            <Globe className="w-3 h-3 text-[#a8a29e]" />
                            <span className="font-mono text-xs text-[#78716c] group-hover/link:text-[#0a0a0a] transition-colors">
                              {company!.top_domain}
                            </span>
                            <ExternalLink className="w-3 h-3 text-[#a8a29e] opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                          {getShortSummary(company!) && (
                            <p className="mt-3 font-sans text-sm text-[#57534e] leading-relaxed line-clamp-3">
                              {getShortSummary(company!)}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Selection indicator */}
                      <div
                        className={cn(
                          "absolute top-4 right-4 w-5 h-5 border-2 flex items-center justify-center transition-all",
                          selectedCompany?.name === company!.name
                            ? "border-[#0a0a0a] bg-[#0a0a0a]"
                            : "border-[#d6d3d1]"
                        )}
                      >
                        {selectedCompany?.name === company!.name && (
                          <Check
                            className="w-3 h-3 text-white"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                    </motion.button>
                  ))}
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col gap-3 mt-8 w-full"
            >
              <div className="flex gap-3">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  Search Again
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedCompany}
                  variant="primary"
                  size="lg"
                  className="flex-1"
                >
                  Start Research
                </Button>
              </div>
              {onManualEntry && (
                <Button
                  onClick={handleManualEntry}
                  variant="ghost"
                  size="lg"
                  className="w-full text-[#78716c] hover:text-[#0a0a0a]"
                >
                  <PenLine className="w-4 h-4" />
                  Company not found? Add data manually
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Not Found State */}
        {state === "not_found" && (
          <motion.div
            key="not_found"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 bg-gradient-to-br from-[#fef3c7] to-[#fde68a] flex items-center justify-center mb-6 shadow-sm"
            >
              <AlertCircle
                className="w-7 h-7 text-[#d97706]"
                strokeWidth={1.5}
              />
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              No Match Found
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-8 text-center max-w-xs">
              We couldn&apos;t find{" "}
              <span className="font-medium text-[#0a0a0a]">
                &quot;{companyName}&quot;
              </span>{" "}
              in {countryOfEstablishment}. Try checking the spelling or using a
              different name variation.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                onClick={handleReset}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
              {onManualEntry && (
                <Button
                  onClick={handleManualEntry}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  <PenLine className="w-4 h-4" />
                  Add my data manually
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 bg-gradient-to-br from-[#fee2e2] to-[#fecaca] flex items-center justify-center mb-6 shadow-sm"
            >
              <AlertCircle
                className="w-7 h-7 text-[#dc2626]"
                strokeWidth={1.5}
              />
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              Something Went Wrong
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-8 text-center max-w-sm">
              {error || "An unexpected error occurred. Please try again."}
            </p>

            <Button onClick={handleReset} variant="outline" size="lg">
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
