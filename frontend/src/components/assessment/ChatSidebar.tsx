"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionId, API_BASE_URL } from "@/services/api";
import { MarkdownContent, LegalLoadingAnimation, ThinkingAnimation } from "@/components/ui";
import type { StreamEvent } from "@/types/api";
import type { Message } from "@/types/chat";
import { toolLabels } from "@/types/chat";
import type { ChatContext, ContextMode, ChatPhase } from "./ChatPopup";

// Contextual suggestions for report phase
const reportSuggestions = [
  "Explain these obligations",
  "What are the compliance deadlines?",
  "What are the penalties for non-compliance?",
];

// Build the full context string from ChatContext
function buildContextString(context: ChatContext): string {
  const parts: string[] = [];

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

  if (context.companyName) {
    parts.push(`Company: ${context.companyName}`);
    if (context.companyUrl) {
      parts.push(`Website: ${context.companyUrl}`);
    }
  }

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

interface ChatSidebarProps {
  context: ChatContext;
  initialQuestion?: string;
  onInitialQuestionSent?: () => void;
  contextMode?: ContextMode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ChatSidebar({
  context,
  initialQuestion,
  onInitialQuestionSent,
  contextMode = "general",
  isCollapsed = false,
  onToggleCollapse,
}: ChatSidebarProps) {
  const welcomeMessage = useMemo(() => {
    const baseWelcome = context.companyName
      ? `Working on **${context.companyName}**. I can help you understand obligations, explain DSA provisions, or clarify compliance requirements.`
      : "I can help you understand obligations, explain DSA provisions, or clarify compliance requirements.";
    return baseWelcome;
  }, [context.companyName]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage,
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fullContext = useMemo(() => {
    return buildContextString(context);
  }, [context]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Handle initial question
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim()) {
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
              session_id: getSessionId(),
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
                    if (fullContent) {
                      setLastTool(null);
                    }
                    break;
                  case "tool_start":
                    setCurrentTool(event.name);
                    setLastTool(event.name);
                    break;
                  case "tool_end":
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
    [input, isStreaming, fullContext, contextMode]
  );

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    handleSend(suggestion);
  };

  // Collapsed state - minimal bar
  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9] border-l border-[#e7e5e4]">
        <button
          onClick={onToggleCollapse}
          className="w-full flex justify-center py-5 hover:bg-[#f5f5f4] transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 bg-[#0a0a0a] flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
        </button>
      </div>
    );
  }

  // Expanded state - full chat
  return (
    <div className="h-full flex flex-col bg-white border-l border-[#e7e5e4]">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-[#e7e5e4] bg-[#fafaf9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0a0a0a] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-serif text-lg text-[#0a0a0a]">
              Ask Corinna
            </h3>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-[#78716c] hover:text-[#0a0a0a] transition-colors p-1"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
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
                  "max-w-[90%] px-4 py-3",
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

        {/* Legal loading animation when using tools */}
        <AnimatePresence mode="wait">
          {isStreaming && !streamingContent && (currentTool || lastTool) && (
            <motion.div
              key={`tool-${currentTool || lastTool}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex justify-start"
            >
              <LegalLoadingAnimation tool={currentTool || lastTool || ""} />
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
            <div className="max-w-[90%] px-4 py-3 bg-[#f5f5f4] border border-[#e7e5e4]">
              <div className="font-sans text-sm text-[#0a0a0a] leading-relaxed whitespace-normal wrap-break-word">
                <MarkdownContent content={streamingContent} />
                <span className="inline-block w-0.5 h-4 bg-[#0a0a0a] ml-0.5 animate-pulse align-middle" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Thinking animation */}
        <AnimatePresence mode="wait">
          {isStreaming && !streamingContent && !currentTool && !lastTool && (
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
            {reportSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "px-2.5 py-1.5 text-xs",
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

      {/* Input */}
      <div className="shrink-0 border-t border-[#e7e5e4] bg-[#fafaf9] p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && handleSend()
            }
            placeholder="Ask about DSA obligations..."
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
    </div>
  );
}
