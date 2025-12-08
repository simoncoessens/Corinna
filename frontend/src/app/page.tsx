"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function HomePage() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleBegin = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push("/assessment");
    }, 600);
  };

  return (
    <main className="relative h-screen flex flex-col overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative">
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
              style={{ backgroundImage: "url('/background.avif')" }}
            />
            <div className="absolute inset-0 bg-[#fafaf9]/85" />
          </motion.div>
        </div>

        {/* Transition Overlay */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              exit={{ scaleY: 0 }}
              transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
              className="fixed inset-0 z-50 bg-[#0a0a0a] origin-bottom"
            />
          )}
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence>
          {!isTransitioning && (
            <div className="relative z-10 w-full max-w-2xl mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center"
              >
                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="font-serif text-6xl sm:text-7xl text-[#0a0a0a] mb-8"
                >
                  snip-tool
                </motion.h1>

                {/* Description */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="space-y-4 mb-12 max-w-lg"
                >
                  <p className="font-sans text-[#57534e] leading-relaxed">
                    Determine your obligations under the EU Digital Services
                    Act.
                  </p>
                  <p className="font-sans text-sm text-[#78716c] leading-relaxed">
                    Provide your company name. The tool researches public
                    information, classifies your service type, and identifies
                    which DSA articles apply to your organization.
                  </p>
                </motion.div>

                {/* Steps */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="w-full grid grid-cols-3 gap-4 mb-12"
                >
                  {[
                    { step: "1", label: "Research" },
                    { step: "2", label: "Classify" },
                    { step: "3", label: "Report" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <span className="font-mono text-xs text-[#a8a29e]">
                        {item.step}
                      </span>
                      <span className="font-sans text-sm text-[#0a0a0a]">
                        {item.label}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                >
                  <Button
                    onClick={handleBegin}
                    size="lg"
                    variant="primary"
                    className="group"
                  >
                    Begin
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </motion.div>

                {/* Footer note */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.9 }}
                  className="mt-12 font-mono text-[10px] text-[#a8a29e] uppercase tracking-wider"
                >
                  Regulation (EU) 2022/2065
                </motion.p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
