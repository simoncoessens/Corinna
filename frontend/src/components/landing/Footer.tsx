"use client";

import { motion } from "framer-motion";
import { Scale } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative py-16 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-white/10 border border-white/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <span className="font-serif text-xl text-white">snip-tool</span>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
                DSA Compliance Navigator
              </p>
            </div>
          </motion.div>

          {/* Legal Text */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center md:text-right"
          >
            <p className="font-sans text-sm text-[#78716c]">
              © {currentYear} snip-tool. All rights reserved.
            </p>
            <p className="font-mono text-[10px] text-[#57534e] mt-1">
              This tool provides informational guidance only and does not
              constitute legal advice.
            </p>
          </motion.div>
        </div>

        {/* Bottom Border */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <p className="font-mono text-[10px] text-center text-[#57534e] uppercase tracking-wider">
            Regulation (EU) 2022/2065 — Digital Services Act
          </p>
        </div>
      </div>
    </footer>
  );
}
