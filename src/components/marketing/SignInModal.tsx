"use client";
// src/components/marketing/SignInModal.tsx
// Shown when clicking "Sign In" on the root marketing page.
// Redirects user to their correct subdomain login page.
import { useState, useEffect } from "react";
import Image from "next/image";

export default function SignInModal({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = slug.trim().toLowerCase();
    if (!clean) {
      setError("Please enter your subdomain.");
      return;
    }
    // In development: slug.localhost:3000/login
    // In production:  slug.newaigent.com/login
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const port = window.location.port ? `:${window.location.port}` : "";
    const target = isLocalhost
      ? `http://${clean}.localhost${port}/login`
      : `https://${clean}.newaigent.com/login`;
    window.location.href = target;
  };

  return (
    <div
      id="signin-modal-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl p-8 border border-white/10 shadow-[0_0_60px_rgba(124,58,237,0.2)]"
        style={{ background: "#0d0d1a" }}
      >
        <button
          id="signin-modal-close"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-all hover:scale-110"
          aria-label="Close"
        >
          ×
        </button>

        <div className="flex justify-center mb-6">
          <Image
            src="/newaigent-mascot.png"
            alt="NeoAigent"
            width={60}
            height={60}
            style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 10px rgba(124,58,237,0.5))" }}
          />
        </div>

        <h3 className="text-white text-xl font-black text-center mb-1">
          Sign in to your workspace
        </h3>
        <p className="text-gray-500 text-sm text-center mb-8">
          Enter your subdomain to go to your dashboard
        </p>

        <form id="signin-subdomain-form" onSubmit={handleGo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Your Subdomain
            </label>
            <div className="flex items-center bg-[#12121e] border border-white/10 rounded-xl overflow-hidden focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all">
              <input
                id="signin-subdomain-input"
                type="text"
                autoFocus
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  setError("");
                }}
                placeholder="yourbusiness"
                className="flex-1 min-w-0 bg-transparent px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none"
              />
              <span className="shrink-0 px-3 text-gray-600 text-xs font-medium border-l border-white/10 bg-[#0d0d1a] py-3 whitespace-nowrap text-center">
                .newaigent.com
              </span>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>

          <button
            id="signin-go-button"
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
          >
            Go to my dashboard →
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          Don't have a workspace yet?{" "}
          <a href="#contact" onClick={onClose} className="text-violet-400 hover:text-violet-300 font-semibold">
            Sign up free
          </a>
        </p>
      </div>
    </div>
  );
}
