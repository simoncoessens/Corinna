"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Search, Scale, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { startNewSession } from "@/services/api";

export default function HomePage() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleBegin = () => {
    // Start a new session for each assessment
    startNewSession();
    setIsTransitioning(true);
    // Navigate after the fade-out completes
    setTimeout(() => {
      router.push("/assessment");
    }, 625);
  };

  return (
    <motion.main
      initial={{ opacity: 1, filter: "blur(0px)" }}
      animate={{
        opacity: isTransitioning ? 0 : 1,
        filter: isTransitioning ? "blur(8px)" : "blur(0px)",
      }}
      transition={{
        duration: 0.625,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="relative flex flex-col overflow-hidden"
      style={{
        // Use large viewport height - stays constant even when keyboard appears
        height: "100lvh", // Large viewport height for iOS Safari
        // Add safe area padding for devices with notches and home indicators
        paddingTop: "max(0px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0px, env(safe-area-inset-right, 0px))",
      }}
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <motion.div
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/background.png')" }}
          />
          <div className="absolute inset-0 bg-[#fafaf9]/85" />
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Content */}
        <div className="relative z-10 w-full max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="font-serif leading-none text-7xl sm:text-7xl md:text-8xl lg:text-9xl text-[#0a0a0a] mb-4"
            >
              Corinna
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="font-sans italic text-sm sm:text-base md:text-lg text-[#57534e] tracking-wide mb-12"
            >
              Conversational Risk Navigator for DSA Normative Assessment
            </motion.p>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mb-12 max-w-xl"
            >
              <p className="font-sans text-sm sm:text-base text-[#57534e] leading-relaxed">
                Type your company name and let Corinna do the rest. It scans
                public information, identifies your digital service type, and
                delivers a tailored obligations report.
              </p>
            </motion.div>

            {/* Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="w-full flex justify-center mb-12 px-4"
            >
              <div className="inline-flex items-center gap-3 sm:gap-5 mx-auto whitespace-nowrap">
                {[
                  { step: "1", label: "Research", icon: Search },
                  { step: "2", label: "Classify", icon: Scale },
                  { step: "3", label: "Report", icon: FileText },
                ].map((item, i, arr) => (
                  <div key={item.step} className="flex items-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.6 + i * 0.15 }}
                      className="flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-5 text-center"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#0a0a0a]/5 flex items-center justify-center">
                        <item.icon
                          className="w-4 h-4 sm:w-5 sm:h-5 text-[#0a0a0a]"
                          strokeWidth={1.5}
                        />
                      </div>
                      <span className="font-sans text-xs sm:text-sm text-[#0a0a0a] tracking-wide">
                        {item.label}
                      </span>
                    </motion.div>
                    {i < arr.length - 1 && (
                      <motion.div
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{
                          duration: 0.4,
                          delay: 0.7 + i * 0.15,
                        }}
                        className="w-8 sm:w-14 h-px bg-[#d6d3d1] origin-left"
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <Button
                onClick={handleBegin}
                size="lg"
                variant="primary"
                className="group"
                disabled={isTransitioning}
              >
                Begin Assessment
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.0 }}
        className="block absolute bottom-0 left-0 right-0 z-10 w-full px-6 pb-4"
      >
        <div className="font-sans text-xs text-[#78716c] leading-relaxed max-w-4xl mx-auto text-center space-y-2">
          <p>
            Corinna is an automated tool and can make mistakes. All outputs are
            for informational purposes only and do not constitute legal advice.
          </p>
          <p>
            This project is part of{" "}
            <a
              href="https://www.antoniodavola.com/snip/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#57534e] transition-colors"
            >
              SNIP – Self-assessment Network Impact Program
            </a>{" "}
            (PRIN-PNRR 2023).
          </p>
        </div>
      </motion.div>
    </motion.main>
  );
}
