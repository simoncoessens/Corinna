"use client";

import { motion } from "framer-motion";

export function ThinkingAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="px-4 py-3 bg-gradient-to-br from-[#fafaf9] to-[#f5f5f4] border border-[#e7e5e4]">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 rounded-full border-2 border-[#003399]/20 border-t-[#003399] flex items-center justify-center"
          />
          <div className="space-y-1">
            <span className="text-xs text-[#57534e] font-medium">
              Analyzing your query
            </span>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className="w-1 h-1 bg-[#003399]/40 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
