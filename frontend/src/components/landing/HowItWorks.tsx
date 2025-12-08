"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    number: "01",
    title: "Company Identification",
    description:
      "Provide only your company name. Our autonomous research agents will examine publicly available sources to construct your organizational profile.",
  },
  {
    number: "02",
    title: "Profile Verification",
    description:
      "Review the AI-generated company profile. Apply corrections through our JSON Patch mechanism to ensure accuracy before classification proceeds.",
  },
  {
    number: "03",
    title: "Regulatory Classification",
    description:
      "The assessment engine analyzes your profile against DSA criteria, determining your position within the regulatory hierarchy and applicable service category.",
  },
  {
    number: "04",
    title: "Obligation Enumeration",
    description:
      "Receive a comprehensive mapping of your specific legal obligations under the DSA, with direct citations to the relevant Articles and Sections.",
  },
  {
    number: "05",
    title: "Compliance Roadmap",
    description:
      "Obtain actionable guidance translating legal requirements into concrete implementation steps for your organization.",
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 bg-[#0a0a0a] overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, white 0, white 1px, transparent 1px, transparent 80px)`,
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-block font-mono text-xs uppercase tracking-wider text-[#b8860b] mb-4">
            Procedure
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">
            A systematic approach
            <br />
            <span className="text-[#78716c]">to compliance assessment</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-[39px] top-0 bottom-0 w-px bg-gradient-to-b from-[#b8860b] via-[#78716c]/30 to-transparent hidden lg:block" />

          <div className="space-y-8 lg:space-y-0">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{
                  duration: 0.8,
                  ease: [0.16, 1, 0.3, 1],
                  delay: index * 0.15,
                }}
                className="relative lg:pl-24"
              >
                {/* Step Number */}
                <div className="lg:absolute lg:left-0 lg:top-0 inline-flex items-center justify-center w-[78px] h-[78px] rounded-full bg-[#0a0a0a] border-2 border-[#b8860b]/30 mb-4 lg:mb-0">
                  <span className="font-mono text-lg text-[#b8860b]">
                    {step.number}
                  </span>
                </div>

                {/* Content Card */}
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-[#b8860b]/20 transition-colors duration-300">
                  <h3 className="font-sans font-semibold text-xl text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="font-sans text-[#a8a29e] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
