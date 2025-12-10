"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Search,
  Check,
  AlertCircle,
  RotateCcw,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  StreamEvent,
  ResultEvent,
  ToolEndEvent,
  SearchSource,
} from "@/types/api";

// Types for company match result
interface CompanyMatch {
  name: string;
  url: string;
  confidence: string;
}

interface CompanyMatchResult {
  input_name: string;
  exact_match: CompanyMatch | null;
  suggestions: CompanyMatch[];
}

type MatcherState = "input" | "searching" | "found" | "not_found" | "error";

interface CompanyMatcherProps {
  onCompanySelected: (company: CompanyMatch) => void;
  onStartResearch: (companyName: string) => void;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://snip-tool-backend.onrender.com";

// Extract domain from URL for cleaner display
function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return url;
  }
}

const MAX_VISIBLE_SOURCES = 3;

export function CompanyMatcher({
  onCompanySelected,
  onStartResearch,
}: CompanyMatcherProps) {
  const [state, setState] = useState<MatcherState>("input");
  const [companyName, setCompanyName] = useState("");
  const [allSources, setAllSources] = useState<SearchSource[]>([]);
  const [visibleSources, setVisibleSources] = useState<SearchSource[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalSourceCount, setTotalSourceCount] = useState(0);
  const [result, setResult] = useState<CompanyMatchResult | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyMatch | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Update visible sources when allSources changes - show last 3
  useEffect(() => {
    const lastThree = allSources.slice(-MAX_VISIBLE_SOURCES);
    setVisibleSources(lastThree);
  }, [allSources]);

  const handleSearch = useCallback(async () => {
    if (!companyName.trim()) return;

    setState("searching");
    setAllSources([]);
    setVisibleSources([]);
    setTotalSourceCount(0);
    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/agents/company_matcher/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_name: companyName.trim() }),
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
                    setAllSources((prev) => {
                      const existingUrls = new Set(prev.map((s) => s.url));
                      const newSources = toolEndEvent.sources!.filter(
                        (s) => !existingUrls.has(s.url)
                      );
                      setTotalSourceCount((c) => c + newSources.length);
                      return [...prev, ...newSources];
                    });
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
  }, [companyName]);

  const handleReset = () => {
    setState("input");
    setCompanyName("");
    setAllSources([]);
    setVisibleSources([]);
    setTotalSourceCount(0);
    setResult(null);
    setSelectedCompany(null);
    setError(null);
  };

  const handleConfirm = () => {
    if (selectedCompany) {
      onCompanySelected(selectedCompany);
      onStartResearch(selectedCompany.name);
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
              className="w-14 h-14 bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center mb-6"
            >
              <Building2 className="w-6 h-6 text-[#57534e]" strokeWidth={1.5} />
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              Organization Lookup
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-8">
              Enter the name of the organization
            </p>

            {/* Input */}
            <div className="w-full flex gap-2">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Enter organization name..."
                className={cn(
                  "flex-1 h-12 px-4",
                  "bg-white border border-[#e7e5e4]",
                  "font-sans text-sm text-[#0a0a0a] placeholder:text-[#a8a29e]",
                  "focus:outline-none focus:border-[#0a0a0a]",
                  "transition-colors duration-200"
                )}
              />
              <Button
                onClick={handleSearch}
                disabled={!companyName.trim()}
                size="lg"
                variant="primary"
                className="px-6"
              >
                <Search className="w-4 h-4" />
              </Button>
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
            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-1">
              Searching
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-8">
              Retrieving sources for &quot;{companyName}&quot;
            </p>

            {/* Sources List */}
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
                    {isSearching ? "Searching" : "Processing"}
                  </span>
                </motion.div>
              </div>

              {/* Sources - Fixed height container */}
              <div className="h-[156px] relative overflow-hidden">
                <AnimatePresence mode="popLayout">
                  {visibleSources.map((source, index) => (
                    <motion.div
                      key={source.url}
                      initial={{ opacity: 0, y: -20, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 52 }}
                      exit={{ opacity: 0, y: 20, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-4 flex items-center gap-3 border-b border-[#e7e5e4] last:border-b-0"
                      style={{ height: 52 }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="w-6 h-6 bg-[#f5f5f4] flex items-center justify-center flex-shrink-0"
                      >
                        <Globe className="w-3 h-3 text-[#78716c]" />
                      </motion.div>
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
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-4 h-4 bg-[#dcfce7] flex items-center justify-center flex-shrink-0"
                      >
                        <Check className="w-2.5 h-2.5 text-[#16a34a]" />
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Empty state / Loading */}
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
                      Initializing
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#a8a29e]">
                  {totalSourceCount} source
                  {totalSourceCount !== 1 ? "s" : ""} analyzed
                </span>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex gap-0.5"
                >
                  <div className="w-1 h-1 bg-[#0a0a0a]" />
                  <div className="w-1 h-1 bg-[#78716c]" />
                  <div className="w-1 h-1 bg-[#a8a29e]" />
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
              className="w-14 h-14 bg-[#dcfce7] flex items-center justify-center mb-6"
            >
              <Check className="w-6 h-6 text-[#16a34a]" strokeWidth={2} />
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              Organization Found
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-6">
              Confirm this is the correct entity
            </p>

            {/* Company Card */}
            {(result.exact_match || result.suggestions.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full space-y-3"
              >
                {/* Exact match or suggestions */}
                {[
                  result.exact_match,
                  ...result.suggestions.filter((s) => s !== result.exact_match),
                ]
                  .filter(Boolean)
                  .map((company, index) => (
                    <motion.button
                      key={company!.name + index}
                      onClick={() => setSelectedCompany(company)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className={cn(
                        "w-full p-4 border text-left transition-all duration-200",
                        selectedCompany?.name === company!.name
                          ? "border-[#0a0a0a] bg-white shadow-sm"
                          : "border-[#e7e5e4] bg-white hover:border-[#a8a29e]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-[#f5f5f4] flex items-center justify-center flex-shrink-0">
                          <Building2
                            className="w-5 h-5 text-[#57534e]"
                            strokeWidth={1.5}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-sans font-medium text-[#0a0a0a] truncate">
                            {company!.name}
                          </h3>
                          <div className="flex items-center gap-1 mt-1">
                            <Globe className="w-3 h-3 text-[#a8a29e]" />
                            <span className="font-mono text-xs text-[#78716c] truncate">
                              {company!.url}
                            </span>
                          </div>
                        </div>
                        {company!.confidence === "exact" && (
                          <span className="px-2 py-0.5 bg-[#f5f5f4] text-[#57534e] font-mono text-[10px] uppercase border border-[#e7e5e4]">
                            Exact
                          </span>
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
              className="flex gap-3 mt-6 w-full"
            >
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
              className="w-14 h-14 bg-[#fef3c7] flex items-center justify-center mb-6"
            >
              <AlertCircle
                className="w-6 h-6 text-[#d97706]"
                strokeWidth={1.5}
              />
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              No Match Found
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-6 text-center">
              We couldn&apos;t find &quot;{companyName}&quot;.
              <br />
              Try a different name or spelling.
            </p>

            <Button onClick={handleReset} variant="outline" size="lg">
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
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
              className="w-14 h-14 bg-[#fee2e2] flex items-center justify-center mb-6"
            >
              <AlertCircle
                className="w-6 h-6 text-[#dc2626]"
                strokeWidth={1.5}
              />
            </motion.div>

            <h2 className="font-serif text-2xl text-[#0a0a0a] mb-2">
              Something Went Wrong
            </h2>
            <p className="font-sans text-sm text-[#78716c] mb-6 text-center max-w-sm">
              {error || "An unexpected error occurred"}
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
