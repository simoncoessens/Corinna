"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionId } from "@/services/api";
import { streamSSE } from "@/services/streaming";
import { buildContextString } from "@/services/chatContext";
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
        let fullContent = "";

        for await (const event of streamSSE("/agents/main_agent/stream", {
          message: userMessage.content,
          frontend_context: fullContext,
          context_mode: contextMode,
          session_id: getSessionId(),
        })) {
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
