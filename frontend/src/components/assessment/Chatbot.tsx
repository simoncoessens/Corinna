"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
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
    const rawHtml = marked.parse(content ?? "", {
      breaks: true,
    }) as string;
    // Fallback to raw HTML if purifier not ready (should only happen during SSR)
    return purifier ? purifier.sanitize(rawHtml) : rawHtml;
  }, [content]);

  return (
    <div
      className="font-sans text-sm leading-relaxed text-[#0a0a0a] whitespace-pre-wrap"
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

interface ChatbotProps {
  context?: string;
}

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8001"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://snip-tool-backend.onrender.com";

export function Chatbot({ context }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I can help you understand the Digital Services Act and your compliance obligations. Ask me anything about the DSA.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

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
            const data = line.slice(6);
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
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[#e7e5e4] bg-[#fafaf9]">
        <h3 className="font-sans font-medium text-sm text-[#0a0a0a]">
          Assistant
        </h3>
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
                  "max-w-[85%] px-3 py-2",
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
              <div className="max-w-[85%] px-3 py-2 bg-[#eef2ff] text-[#312e81] flex items-center gap-2 rounded-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono text-[11px] uppercase tracking-wide">
                  {toolLabels[currentTool] || `Using ${currentTool}`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streaming message */}
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 justify-start"
          >
            <div className="max-w-[85%] px-3 py-2 bg-[#f5f5f4]">
              {streamingContent ? (
                <div className="font-sans text-sm text-[#0a0a0a] leading-relaxed whitespace-pre-wrap">
                  <MarkdownContent content={streamingContent} />
                  <span className="inline-block w-1 h-4 bg-[#0a0a0a] ml-0.5 animate-pulse align-middle" />
                </div>
              ) : (
                <Loader2 className="w-4 h-4 text-[#78716c] animate-spin" />
              )}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-[#e7e5e4]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about the DSA..."
            disabled={isStreaming}
            className={cn(
              "flex-1 h-10 px-3",
              "bg-[#fafaf9] border border-[#e7e5e4]",
              "font-sans text-sm text-[#0a0a0a] placeholder:text-[#a8a29e]",
              "focus:outline-none focus:border-[#0a0a0a]",
              "transition-colors duration-200",
              "disabled:opacity-50"
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={cn(
              "w-10 h-10 flex items-center justify-center",
              "bg-[#0a0a0a] text-white",
              "hover:bg-[#1a1a1a] transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
