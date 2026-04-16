"use client";
// src/components/marketing/MarketingPage.tsx
// Main orchestrator for the full marketing landing page
import { useState } from "react";
import MarketingNav from "./MarketingNav";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import PricingSection from "./PricingSection";
import TestimonialsSection from "./TestimonialsSection";
import CTASection from "./CTASection";
import MarketingFooter from "./MarketingFooter";
import DemoModal from "./DemoModal";
import SignInModal from "./SignInModal";

export default function MarketingPage() {
  const [showDemo, setShowDemo] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <div
      id="marketing-root"
      className="min-h-screen"
      style={{
        background: "#07070f",
        fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
      }}
    >
      {/* Nav — Sign In opens the modal */}
      <MarketingNav onSignIn={() => setShowSignIn(true)} />

      {/* Page sections */}
      <main>
        <HeroSection onWatchDemo={() => setShowDemo(true)} />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <MarketingFooter />

      {/* Modals */}
      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
    </div>
  );
}
