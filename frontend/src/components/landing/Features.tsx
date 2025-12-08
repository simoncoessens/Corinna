"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import {
  Search,
  FileSearch,
  CheckCircle,
  MessageSquare,
  Database,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Autonomous Company Profiling",
    description:
      "Our Deep Research Agent autonomously examines publicly available information—Terms of Service, corporate disclosures, and operational data—to construct a comprehensive organizational profile without manual data entry.",
    article: "Pursuant to DSA Art. 11-12",
  },
  {
    icon: FileSearch,
    title: "Intelligent Service Classification",
    description:
      "The assessment engine determines your precise position within the DSA's regulatory hierarchy: Intermediary Service, Hosting Provider, Online Platform, or Very Large Online Platform (VLOP/VLOSE).",
    article: "DSA Art. 3 Definitions",
  },
  {
    icon: CheckCircle,
    title: "Obligation Mapping",
    description:
      "Receive a comprehensive enumeration of applicable legal obligations, from basic transparency requirements to enhanced due diligence measures, each linked to the specific DSA provisions governing your service category.",
    article: "DSA Art. 14-48",
  },
  {
    icon: MessageSquare,
    title: "Interactive Legal Counsel",
    description:
      "A context-aware AI assistant, grounded in the official DSA legal text through Retrieval-Augmented Generation, provides citation-backed answers to compliance inquiries while minimizing interpretive speculation.",
    article: "RAG-powered Q&A",
  },
  {
    icon: Database,
    title: "Knowledge Base Integration",
    description:
      "Direct access to the authoritative DSA text, enabling precise article retrieval, cross-referencing of related provisions, and comprehensive understanding of your regulatory landscape.",
    article: "Full DSA Text Indexed",
  },
  {
    icon: Zap,
    title: "Real-time Streaming Analysis",
    description:
      "Witness the assessment process in real-time with streaming responses, providing transparency into how conclusions are reached and enabling immediate engagement with preliminary findings.",
    article: "Streaming API",
  },
];

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 bg-white overflow-hidden">
      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-block font-mono text-xs uppercase tracking-wider text-[#b8860b] mb-4">
            Capabilities
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#0a0a0a] leading-tight">
            Comprehensive compliance
            <br />
            <span className="text-[#78716c]">
              through intelligent automation
            </span>
          </h2>
          <p className="mt-6 font-sans text-lg text-[#57534e] leading-relaxed">
            SNIP-tool employs a multi-agent architecture to deliver thorough,
            legally-grounded compliance assessments that would traditionally
            require extensive legal consultation.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: index * 0.1,
              }}
              className="group relative p-8 bg-[#fafaf9] rounded-2xl border border-[#0a0a0a]/5 hover:border-[#0a0a0a]/10 transition-all duration-300"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-white border border-[#0a0a0a]/10 flex items-center justify-center mb-6 group-hover:border-[#b8860b]/30 transition-colors">
                <feature.icon className="w-5 h-5 text-[#0a0a0a] group-hover:text-[#b8860b] transition-colors" />
              </div>

              {/* Content */}
              <h3 className="font-sans font-semibold text-lg text-[#0a0a0a] mb-3">
                {feature.title}
              </h3>
              <p className="font-sans text-sm text-[#57534e] leading-relaxed mb-4">
                {feature.description}
              </p>

              {/* Article Reference */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border border-[#0a0a0a]/5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
                  {feature.article}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Decorative gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0a0a0a]/10 to-transparent" />
    </section>
  );
}
