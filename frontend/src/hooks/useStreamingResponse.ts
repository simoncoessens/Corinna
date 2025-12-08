"use client";

import { useState, useCallback, useRef } from "react";
import type { StreamEvent, ResultEvent } from "@/types/api";

interface UseStreamingResponseOptions<T> {
  onToken?: (content: string) => void;
  onToolStart?: (name: string, input: string) => void;
  onToolEnd?: (name: string) => void;
  onResult?: (data: T) => void;
  onError?: (error: string) => void;
}

interface StreamingState<T> {
  isStreaming: boolean;
  tokens: string;
  result: T | null;
  error: string | null;
  currentTool: string | null;
}

export function useStreamingResponse<T = unknown>(
  streamFn: () => AsyncGenerator<StreamEvent>,
  options: UseStreamingResponseOptions<T> = {}
) {
  const [state, setState] = useState<StreamingState<T>>({
    isStreaming: false,
    tokens: "",
    result: null,
    error: null,
    currentTool: null,
  });

  const abortRef = useRef(false);

  const start = useCallback(async () => {
    abortRef.current = false;
    setState({
      isStreaming: true,
      tokens: "",
      result: null,
      error: null,
      currentTool: null,
    });

    try {
      const stream = streamFn();

      for await (const event of stream) {
        if (abortRef.current) break;

        switch (event.type) {
          case "token":
            setState((prev) => ({
              ...prev,
              tokens: prev.tokens + event.content,
            }));
            options.onToken?.(event.content);
            break;

          case "tool_start":
            setState((prev) => ({
              ...prev,
              currentTool: event.name,
            }));
            options.onToolStart?.(event.name, event.input);
            break;

          case "tool_end":
            setState((prev) => ({
              ...prev,
              currentTool: null,
            }));
            options.onToolEnd?.(event.name);
            break;

          case "result":
            const resultData = (event as ResultEvent<T>).data;
            setState((prev) => ({
              ...prev,
              result: resultData,
            }));
            options.onResult?.(resultData);
            break;

          case "error":
            setState((prev) => ({
              ...prev,
              error: event.message,
            }));
            options.onError?.(event.message);
            break;

          case "done":
            break;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
      options.onError?.(errorMessage);
    } finally {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        currentTool: null,
      }));
    }
  }, [streamFn, options]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      tokens: "",
      result: null,
      error: null,
      currentTool: null,
    });
  }, []);

  return {
    ...state,
    start,
    abort,
    reset,
  };
}

