"use client";

import { motion } from "framer-motion";
import { ArrowRight, Scale, Shield, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1.2,
      ease: "easeOut" as const,
    },
  },
};

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/background.avif')" }}
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#fafaf9]/90 via-[#fafaf9]/70 to-[#fafaf9]/95" />
        </motion.div>
      </div>

      {/* Decorative Elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      >
        {/* Vertical lines pattern */}
        <div className="absolute top-0 left-[10%] w-px h-full bg-gradient-to-b from-transparent via-[#0a0a0a]/10 to-transparent" />
        <div className="absolute top-0 left-[25%] w-px h-full bg-gradient-to-b from-transparent via-[#0a0a0a]/5 to-transparent" />
        <div className="absolute top-0 right-[25%] w-px h-full bg-gradient-to-b from-transparent via-[#0a0a0a]/5 to-transparent" />
        <div className="absolute top-0 right-[10%] w-px h-full bg-gradient-to-b from-transparent via-[#0a0a0a]/10 to-transparent" />
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          {/* Legal Badge */}
          <motion.div variants={itemVariants}>
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-white/60 backdrop-blur-sm border border-[#0a0a0a]/10">
              <Scale className="w-4 h-4 text-[#57534e]" strokeWidth={1.5} />
              <span className="font-mono text-xs uppercase tracking-wider text-[#78716c]">
                EU Digital Services Act Compliance
              </span>
            </div>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-serif text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-normal leading-[1.1] tracking-tight text-[#0a0a0a] max-w-5xl"
          >
            Regulatory clarity
            <br />
            <span className="text-[#78716c]">for digital services</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="mt-8 font-sans text-lg sm:text-xl text-[#57534e] max-w-2xl leading-relaxed"
          >
            SNIP-tool conducts autonomous compliance assessments under the
            Digital Services Act, determining your regulatory obligations with
            precision and providing actionable guidance grounded in EU law.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="mt-12 flex flex-col sm:flex-row gap-4"
          >
            <Link href="/assessment">
              <Button size="xl" variant="primary" className="group">
                Commence Assessment
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Button size="xl" variant="outline">
              Review Methodology
            </Button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            variants={fadeInVariants}
            className="mt-20 pt-12 border-t border-[#0a0a0a]/10 w-full max-w-4xl"
          >
            <p className="font-mono text-xs uppercase tracking-wider text-[#a8a29e] mb-8">
              Comprehensive DSA Coverage
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  icon: Shield,
                  title: "Intermediary Services",
                  desc: "Mere conduit, caching, and hosting obligations",
                },
                {
                  icon: Scale,
                  title: "Online Platforms",
                  desc: "Content moderation and transparency duties",
                },
                {
                  icon: FileText,
                  title: "VLOP/VLOSE",
                  desc: "Enhanced due diligence for large platforms",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + i * 0.15, duration: 0.6 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="w-12 h-12 bg-white/80 backdrop-blur-sm border border-[#0a0a0a]/10 flex items-center justify-center mb-4">
                    <item.icon
                      className="w-5 h-5 text-[#0a0a0a]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="font-sans font-medium text-sm text-[#0a0a0a]">
                    {item.title}
                  </h3>
                  <p className="mt-1 font-sans text-xs text-[#78716c]">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#a8a29e]">
            Scroll
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-[#a8a29e] to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  );
}
