"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Search, Scale, FileText, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { startNewSession } from "@/services/api";

export default function HomePage() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPasswordModal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showPasswordModal]);

  const handleBeginClick = () => {
    setShowPasswordModal(true);
    setPassword("");
    setPasswordError("");
    setShowPassword(false);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setPasswordError("");

    const correctPassword = process.env.NEXT_PUBLIC_APP_PASSWORD;

    // Small delay for UX
    setTimeout(() => {
      if (password === correctPassword) {
        setShowPasswordModal(false);
        // Proceed with the original begin flow
        startNewSession();
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("corinna_assessment_state");
          sessionStorage.removeItem("corinna_company_matcher_state");
          sessionStorage.removeItem("corinna_deep_research_state");
        }
        setIsTransitioning(true);
        setTimeout(() => {
          router.push("/assessment");
        }, 625);
      } else {
        setPasswordError("Incorrect password");
      }
      setIsVerifying(false);
    }, 300);
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
      className="relative flex min-h-[100lvh] flex-col overflow-x-hidden"
      style={{
        // Use large viewport height - stays constant even when keyboard appears
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
                onClick={handleBeginClick}
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
        className="relative z-10 mt-auto w-full px-6 pb-4"
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

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-[#0a0a0a]/40 backdrop-blur-sm"
              onClick={() => setShowPasswordModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-sm pointer-events-auto bg-white border border-[#e7e5e4] shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8">
                  {/* Header */}
                  <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-full bg-[#0a0a0a]/5 flex items-center justify-center mb-4">
                      <Lock className="w-5 h-5 text-[#0a0a0a]" strokeWidth={1.5} />
                    </div>
                    <h2 className="font-serif text-2xl text-[#0a0a0a] mb-1">
                      Access Required
                    </h2>
                    <p className="font-sans text-sm text-[#78716c]">
                      Enter the password to continue
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handlePasswordSubmit}>
                    <div className="mb-4">
                      <label className="block font-mono text-xs uppercase tracking-wider text-[#78716c] mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          ref={inputRef}
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setPasswordError("");
                          }}
                          className="w-full h-12 px-4 pr-12 bg-[#fafaf9] border border-[#e7e5e4] font-sans text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] transition-colors"
                          placeholder="Enter password"
                          required
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#a8a29e] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                      {passwordError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-4 overflow-hidden"
                        >
                          <div className="bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm font-sans">
                            {passwordError}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="w-full h-12 bg-[#0a0a0a] text-white font-sans text-sm hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Cancel */}
                  <button
                    onClick={() => setShowPasswordModal(false)}
                    className="w-full mt-3 py-2 font-sans text-sm text-[#78716c] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
