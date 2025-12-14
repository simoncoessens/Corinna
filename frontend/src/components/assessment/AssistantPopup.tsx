"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, X, MessageCircleQuestion } from "lucide-react";
import createDOMPurify from "dompurify";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import type { StreamEvent } from "@/types/api";

const toolLabels: Record<string, string> = {
  web_search: "Searching the web",
  retrieve_dsa_knowledge: "Reading the DSA document",
};

const purifier = typeof window !== "undefined" ? createDOMPurify(window) : null;

function MarkdownContent({ content }: { content: string }) {
  const sanitizedHtml = useMemo(() => {
    const normalized = (content ?? "").replace(/\r\n/g, "\n");
    const rawHtml = marked.parse(normalized, {
      // Avoid turning every single newline into a <br/> (prevents "gappy" output).
      breaks: false,
    }) as string;
    // Explicitly allow list elements in DOMPurify to ensure bullets render
    return purifier
      ? purifier.sanitize(rawHtml, {
          ALLOWED_TAGS: [
            "p",
            "br",
            "strong",
            "em",
            "u",
            "s",
            "code",
            "pre",
            "blockquote",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "ul",
            "ol",
            "li",
            "a",
          ],
          ALLOWED_ATTR: ["href", "title", "target", "rel"],
        })
      : rawHtml;
  }, [content]);

  return (
    <div
      className="markdown-content font-sans text-sm leading-relaxed text-[#0a0a0a] whitespace-normal wrap-break-word prose prose-sm max-w-none
        prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
        prose-headings:text-[#0a0a0a] prose-headings:font-medium
        prose-a:text-[#003399] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-[#0a0a0a] prose-strong:font-medium"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type AssistantPhase =
  | "company_match"
  | "deep_research"
  | "review_scope"
  | "review_size"
  | "review_type"
  | "classify"
  | "report";

interface AssistantPopupProps {
  context?: string;
  phase?: AssistantPhase;
  companyName?: string;
}

// Contextual suggestions based on current phase
const phaseSuggestions: Record<AssistantPhase, string[]> = {
  company_match: [
    "How do I find the right company?",
    "What if my company isn't listed?",
    "Can I enter a company manually?",
  ],
  deep_research: [
    "What information is being gathered?",
    "How long does research take?",
    "What sources are being checked?",
  ],
  review_scope: [
    "What does Territorial scope mean?",
    "Why does EU presence matter?",
    "How do I edit these findings?",
  ],
  review_size: [
    "What thresholds define company size?",
    "Why does employee count matter?",
    "What if our size changed recently?",
  ],
  review_type: [
    "What are intermediary services?",
    "What's the difference between hosting and platform?",
    "What makes a service a marketplace?",
  ],
  classify: [
    "What service categories exist?",
    "How is my service being classified?",
    "What if we offer multiple services?",
  ],
  report: [
    "What do these obligations mean?",
    "Which articles are most important?",
    "How do I start compliance?",
  ],
};

// Contextual welcome messages
const phaseWelcomes: Record<AssistantPhase, string> = {
  company_match:
    "I can help you find and select the right company to assess. Just ask if you need guidance!",
  deep_research:
    "I'm here while the research runs. Feel free to ask what information we're gathering or how it's used.",
  review_scope:
    "Reviewing Territorial scope findings. I can explain why EU presence matters for DSA compliance.",
  review_size:
    "Reviewing company size. I can help clarify how size thresholds affect your DSA obligations.",
  review_type:
    "Reviewing service types. Ask me about the differences between intermediary services, hosting, and platforms.",
  classify:
    "Now classifying your service. I can explain the different DSA service categories and what they mean.",
  report:
    "Here's your compliance report. I can help explain any obligations or guide you on next steps.",
};

// Contextual subtitle for header
const phaseSubtitles: Record<AssistantPhase, string> = {
  company_match: "Help with company lookup",
  deep_research: "Questions about research",
  review_scope: "Help with scope review",
  review_size: "Help with size review",
  review_type: "Help with service type",
  classify: "Help with classification",
  report: "Help understanding your report",
};

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://snip-tool-backend.onrender.com";

export function AssistantPopup({
  context,
  phase = "company_match",
  companyName,
}: AssistantPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get contextual welcome message
  const welcomeMessage = useMemo(() => {
    const baseWelcome = phaseWelcomes[phase] || phaseWelcomes.company_match;
    if (companyName && phase !== "company_match") {
      return `Working on ${companyName}. ${baseWelcome}`;
    }
    return baseWelcome;
  }, [phase, companyName]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage,
      timestamp: new Date(),
    },
  ]);

  // Update welcome message when phase changes
  useEffect(() => {
    setMessages((prev) => {
      // Only update the welcome message, keep conversation history
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [
          {
            id: "welcome",
            role: "assistant",
            content: welcomeMessage,
            timestamp: new Date(),
          },
        ];
      }
      return prev;
    });
  }, [welcomeMessage]);

  // Get contextual suggestions
  const suggestions = useMemo(() => {
    return phaseSuggestions[phase] || phaseSuggestions.company_match;
  }, [phase]);

  // Get contextual subtitle
  const subtitle = useMemo(() => {
    return phaseSubtitles[phase] || "Ask anything about compliance";
  }, [phase]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`${API_BASE_URL}/agents/main_agent/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          frontend_context: context,
        }),
      });

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
                  break;
                case "tool_start":
                  setCurrentTool(event.name);
                  break;
                case "tool_end":
                  setCurrentTool(null);
                  break;
                case "error":
                case "done":
                  setCurrentTool(null);
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

      // Show unread indicator if chat is closed
      if (!isOpen) {
        setHasUnread(true);
      }
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
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className={cn(
              "fixed bottom-6 right-6 z-50",
              "w-14 h-14 rounded-full",
              "bg-[#0a0a0a] text-white",
              "flex items-center justify-center",
              "shadow-lg hover:shadow-xl",
              "hover:bg-[#1a1a1a] transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] focus:ring-offset-2",
              "group"
            )}
            aria-label="Open assistant"
          >
            <MessageCircleQuestion className="w-6 h-6 transition-transform group-hover:scale-110" />
            {hasUnread && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-[#b8860b] rounded-full border-2 border-white" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Tooltip hint (shows briefly on first load) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ delay: 1, duration: 0.3 }}
            className="fixed bottom-8 right-24 z-40 hidden sm:block"
          >
            <div className="bg-white px-3 py-2 rounded-lg shadow-md border border-[#e7e5e4] text-sm text-[#57534e]">
              Need help? Ask me anything
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full">
                <div className="border-8 border-transparent border-l-white" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "fixed bottom-6 right-6 z-50",
              "w-[380px] h-[520px]",
              "bg-white rounded-lg shadow-2xl",
              "border border-[#e7e5e4]",
              "flex flex-col overflow-hidden",
              // Mobile: full screen
              "max-sm:inset-4 max-sm:w-auto max-sm:h-auto max-sm:bottom-4 max-sm:right-4"
            )}
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0a0a0a] flex items-center justify-center">
                  <MessageCircleQuestion className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-sans font-medium text-sm text-[#0a0a0a]">
                    Corinna chat
                  </h3>
                  <p className="font-sans text-xs text-[#78716c]">{subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className={cn(
                  "w-8 h-8 rounded-full",
                  "flex items-center justify-center",
                  "text-[#78716c] hover:text-[#0a0a0a]",
                  "hover:bg-[#f5f5f4]",
                  "transition-colors duration-200"
                )}
                aria-label="Close assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] px-3 py-2 rounded-lg",
                        message.role === "user"
                          ? "bg-[#0a0a0a] text-white"
                          : "bg-[#f5f5f4] text-[#0a0a0a]"
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

              {/* Tool indicator */}
              <AnimatePresence>
                {currentTool && (
                  <motion.div
                    key={currentTool}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex gap-2 justify-start"
                  >
                    <div className="max-w-[85%] px-3 py-2 bg-[#eef2ff] text-[#312e81] flex items-center gap-2 rounded-lg">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="font-mono text-[11px] uppercase tracking-wide">
                        {toolLabels[currentTool] || `Using ${currentTool}`}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Streaming message */}
              {isStreaming && streamingContent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 justify-start"
                >
                  <div className="max-w-[85%] px-3 py-2 bg-[#f5f5f4] rounded-lg">
                    <div className="font-sans text-sm text-[#0a0a0a] leading-relaxed whitespace-normal wrap-break-word">
                      <MarkdownContent content={streamingContent} />
                      <span className="inline-block w-1 h-4 bg-[#0a0a0a] ml-0.5 animate-pulse align-middle" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Loading indicator when no content yet */}
              {isStreaming && !streamingContent && !currentTool && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 justify-start"
                >
                  <div className="px-3 py-2 bg-[#f5f5f4] rounded-lg">
                    <Loader2 className="w-4 h-4 text-[#78716c] animate-spin" />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions (only when no messages sent yet) */}
            {messages.length === 1 && (
              <div className="shrink-0 px-4 pb-2">
                <p className="text-xs text-[#78716c] mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className={cn(
                        "px-3 py-1.5 text-xs",
                        "bg-[#f5f5f4] text-[#57534e]",
                        "rounded-full border border-[#e7e5e4]",
                        "hover:bg-[#e7e5e4] hover:text-[#0a0a0a]",
                        "transition-colors duration-200"
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="shrink-0 p-3 border-t border-[#e7e5e4] bg-[#fafaf9]">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSend()
                  }
                  placeholder="Ask about the DSA..."
                  disabled={isStreaming}
                  className={cn(
                    "flex-1 h-10 px-3",
                    "bg-white border border-[#e7e5e4] rounded-lg",
                    "font-sans text-sm text-[#0a0a0a] placeholder:text-[#a8a29e]",
                    "focus:outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a]",
                    "transition-colors duration-200",
                    "disabled:opacity-50"
                  )}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg",
                    "bg-[#0a0a0a] text-white",
                    "hover:bg-[#1a1a1a] transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
