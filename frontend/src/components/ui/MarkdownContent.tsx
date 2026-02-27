"use client";

import { useMemo } from "react";
import createDOMPurify from "dompurify";
import { marked } from "marked";

const purifier = typeof window !== "undefined" ? createDOMPurify(window) : null;

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const sanitizedHtml = useMemo(() => {
    const normalized = (content ?? "").replace(/\r\n/g, "\n");
    const rawHtml = marked.parse(normalized, {
      breaks: false,
    }) as string;
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
      className={
        className ??
        "markdown-content font-sans text-sm leading-relaxed text-[#0a0a0a] whitespace-normal wrap-break-word prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-[#0a0a0a] prose-headings:font-medium prose-a:text-[#003399] prose-a:no-underline hover:prose-a:underline prose-strong:text-[#0a0a0a] prose-strong:font-medium"
      }
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
