// src/components/marketing/HowItWorksSection.tsx
const steps = [
  {
    number: "01",
    title: "Create your account — 2 minutes",
    description:
      "You get a branded subdomain (yourbiz.newaigent.com), a private dashboard, and your AI workspace ready to configure. No card needed to start.",
    icon: "🚀",
    color: "#7C3AED",
  },
  {
    number: "02",
    title: "Turn on your agents",
    description:
      "Connect your social media, WhatsApp, calendar, and product catalog. Each agent learns your brand voice and starts working the moment you activate it.",
    icon: "🤖",
    color: "#06B6D4",
  },
  {
    number: "03",
    title: "Walk away. They've got it.",
    description:
      "Posts go live. Customers get answered. Appointments fill up. Sales close. You get a daily summary. That's it.",
    icon: "⚡",
    color: "#4F46E5",
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative py-28 overflow-hidden"
      style={{ background: "#0a0a14" }}
    >
      {/* Top & bottom borders */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.5), transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />

      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #4F46E5, transparent 70%)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 mb-6">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">Up and running today</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            Three steps.{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #06B6D4 0%, #7C3AED 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Then hands off.
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Most businesses go live in under 10 minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line */}
          <div
            className="hidden lg:block absolute top-1/2 left-[16.67%] right-[16.67%] h-px -translate-y-1/2"
            style={{
              background: "linear-gradient(90deg, #7C3AED, #06B6D4, #4F46E5)",
              opacity: 0.3,
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={step.number}
                id={`step-${step.number}`}
                className="relative flex flex-col items-center text-center group"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {/* Number badge */}
                <div
                  className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-3xl mb-6 z-10 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${step.color}40, ${step.color}10)`,
                    border: `2px solid ${step.color}40`,
                    boxShadow: `0 0 40px ${step.color}20`,
                  }}
                >
                  {step.icon}
                  <span
                    className="absolute -top-3 -right-3 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                    style={{ background: step.color, color: "white" }}
                  >
                    {step.number}
                  </span>
                </div>

                {/* Card */}
                <div
                  className="rounded-2xl p-6 border w-full transition-all duration-300 group-hover:-translate-y-2"
                  style={{
                    background: "#0d0d1a",
                    borderColor: `${step.color}20`,
                  }}
                >
                  <h3 className="text-white font-bold text-xl mb-4 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA nudge */}
        <div className="text-center mt-16">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 text-violet-400 font-semibold text-base hover:text-violet-300 transition-colors group"
          >
            See what it costs
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
