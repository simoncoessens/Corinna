"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

export function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 bg-[#fafaf9] overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#0a0a0a]/5 to-transparent" />
        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#0a0a0a]/5 to-transparent" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Legal disclaimer style header */}
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="w-12 h-px bg-[#b8860b]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[#78716c]">
              Initiate Assessment
            </span>
            <div className="w-12 h-px bg-[#b8860b]" />
          </div>

          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#0a0a0a] leading-tight mb-6">
            Establish your compliance
            <br />
            <span className="text-[#78716c]">posture with certainty</span>
          </h2>

          <p className="font-sans text-lg text-[#57534e] max-w-2xl mx-auto mb-12 leading-relaxed">
            The Digital Services Act imposes significant obligations on
            providers of intermediary services within the European Union.
            Determine your regulatory status and obligations with precision.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/assessment">
              <Button size="xl" variant="primary" className="group">
                Begin Compliance Assessment
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* Trust note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-8 font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]"
          >
            No account required • Immediate results • Data not retained
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
