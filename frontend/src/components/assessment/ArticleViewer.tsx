"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface ArticleViewerProps {
  articleNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedArticle {
  number: string;
  title: string;
  content: string;
}

// Cache the parsed articles to avoid re-fetching
let articlesCache: Map<string, ParsedArticle> | null = null;

// Clear cache (useful for development/debugging)
export function clearArticleCache() {
  articlesCache = null;
}

/**
 * Parse the DSA HTML and extract all articles
 */
async function parseArticles(): Promise<Map<string, ParsedArticle>> {
  if (articlesCache) return articlesCache;

  const response = await fetch("/dsa.html");
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const articles = new Map<string, ParsedArticle>();

  // Find all article elements - they have ids exactly like "art_11" (not "art_11.tit_1")
  const articleElements = doc.querySelectorAll('.eli-subdivision[id^="art_"]');

  articleElements.forEach((articleEl) => {
    const id = articleEl.getAttribute("id");
    if (!id) return;

    // Only match exact article IDs (art_11, art_11a) not nested IDs (art_11.tit_1)
    const numberMatch = id.match(/^art_(\d+[a-z]?)$/i);
    if (!numberMatch) return;
    const articleNumber = numberMatch[1];

    // Get the title (oj-sti-art contains the descriptive title)
    const subtitleEl = articleEl.querySelector(".oj-sti-art");
    const title = subtitleEl?.textContent?.trim() || "";

    // Build content by iterating through all paragraphs
    const allParagraphs = articleEl.querySelectorAll("p.oj-normal");
    let contentHtml = "";
    let lastSubPointLetter: string | null = null;

    allParagraphs.forEach((p) => {
      const text = p.textContent?.trim() || "";
      if (!text) return;

      // Check if it's a numbered main paragraph (1.   2.   3.   etc. - note multiple spaces)
      const numberedMatch = text.match(/^(\d+)\.\s+([\s\S]+)$/);
      // Check if it's a lettered sub-point marker only ((a), (b), etc.)
      const subPointMarkerMatch = text.match(/^\(([a-z])\)$/);
      // Check if it starts with a sub-point marker followed by content
      const subPointWithContent = text.match(/^\(([a-z])\)\s*([\s\S]+)$/);

      if (numberedMatch) {
        // Main numbered paragraph
        contentHtml += `<div class="article-paragraph"><span class="paragraph-number">${numberedMatch[1]}.</span><span class="paragraph-text">${escapeHtml(numberedMatch[2])}</span></div>`;
        lastSubPointLetter = null;
      } else if (subPointMarkerMatch) {
        // Just a sub-point marker - remember it for the next paragraph
        lastSubPointLetter = subPointMarkerMatch[1];
      } else if (subPointWithContent) {
        // Sub-point with content in same paragraph
        contentHtml += `<div class="article-subpoint"><span class="subpoint-letter">(${subPointWithContent[1]})</span><span class="subpoint-text">${escapeHtml(subPointWithContent[2])}</span></div>`;
        lastSubPointLetter = null;
      } else if (lastSubPointLetter) {
        // Content following a sub-point marker
        contentHtml += `<div class="article-subpoint"><span class="subpoint-letter">(${lastSubPointLetter})</span><span class="subpoint-text">${escapeHtml(text)}</span></div>`;
        lastSubPointLetter = null;
      } else if (text.length > 3) {
        // Regular paragraph
        contentHtml += `<p class="article-text">${escapeHtml(text)}</p>`;
      }
    });

    // If no content was parsed, use the raw innerHTML as fallback
    if (!contentHtml && articleEl instanceof HTMLElement) {
      // Get inner text of the article element, excluding title elements
      const clone = articleEl.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.oj-ti-art, .oj-sti-art, .eli-title').forEach(el => el.remove());
      const rawText = clone.textContent?.trim() || "";
      if (rawText) {
        contentHtml = `<p class="article-text">${escapeHtml(rawText)}</p>`;
      }
    }

    articles.set(articleNumber, {
      number: articleNumber,
      title,
      content: contentHtml,
    });
  });

  articlesCache = articles;
  return articles;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * ArticleViewer - A modal component that displays DSA articles
 */
export function ArticleViewer({
  articleNumber,
  isOpen,
  onClose,
}: ArticleViewerProps) {
  const [article, setArticle] = useState<ParsedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allArticleNumbers, setAllArticleNumbers] = useState<string[]>([]);

  const loadArticle = useCallback(async (num: string | number) => {
    setLoading(true);
    setError(null);

    // Ensure article number is a string for consistent lookup
    const articleKey = String(num);

    try {
      const articles = await parseArticles();
      const art = articles.get(articleKey);

      if (art) {
        setArticle(art);
        // Get sorted article numbers for navigation
        const numbers = Array.from(articles.keys()).sort(
          (a, b) => parseInt(a) - parseInt(b)
        );
        setAllArticleNumbers(numbers);
      } else {
        setError(`Article ${articleKey} not found`);
      }
    } catch (e) {
      setError("Failed to load article");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && articleNumber) {
      loadArticle(articleNumber);
    }
  }, [isOpen, articleNumber, loadArticle]);

  // Navigation helpers
  const currentIndex = allArticleNumbers.indexOf(article?.number || "");
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allArticleNumbers.length - 1;

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      loadArticle(allArticleNumbers[currentIndex - 1]);
    }
  }, [currentIndex, allArticleNumbers, loadArticle]);

  const goToNext = useCallback(() => {
    if (currentIndex < allArticleNumbers.length - 1) {
      loadArticle(allArticleNumbers[currentIndex + 1]);
    }
  }, [currentIndex, allArticleNumbers, loadArticle]);

  // Handle escape key and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, goToPrev, goToNext]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-4 md:inset-8 lg:inset-12 xl:inset-20 bg-white border border-[#e7e5e4] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#003399] font-medium">
                  Article {article?.number || articleNumber}
                </span>
                <span className="text-[#d4d4d4]">·</span>
                <span className="font-mono text-[10px] text-[#78716c] uppercase tracking-wider">
                  DSA
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Navigation */}
                <button
                  onClick={goToPrev}
                  disabled={!hasPrev}
                  className="p-1 text-[#78716c] hover:text-[#0a0a0a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="p-1 text-[#78716c] hover:text-[#0a0a0a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <span className="w-px h-4 bg-[#e7e5e4] mx-2" />

                {/* External link */}
                <a
                  href={`https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-[#78716c] hover:text-[#003399] transition-colors"
                  title="View on EUR-Lex"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="p-1 text-[#78716c] hover:text-[#0a0a0a] transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#e7e5e4] border-t-[#003399] rounded-full animate-spin" />
                    <span className="font-mono text-xs text-[#78716c]">
                      Loading article...
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-[#dc2626] mb-2">{error}</p>
                    <a
                      href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#003399] hover:underline"
                    >
                      View on EUR-Lex →
                    </a>
                  </div>
                </div>
              )}

              {!loading && !error && article && (
                <div className="max-w-2xl mx-auto px-6 py-6">
                  {/* Article title */}
                  <div className="mb-4 pb-3 border-b border-[#e7e5e4]">
                    <h1 className="font-sans text-lg font-medium text-[#0a0a0a]">
                      {article.title}
                    </h1>
                  </div>

                  {/* Article content */}
                  <div
                    className="article-content"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                  />
                </div>
              )}
            </div>

            </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
