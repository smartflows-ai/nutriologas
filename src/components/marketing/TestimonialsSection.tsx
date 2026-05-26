"use client";
// src/components/marketing/TestimonialsSection.tsx
import { useTranslation } from "@/i18n";
import { useState, useRef } from "react";

const testimonials = [
  {
    id: 1,
    name: "Dr. Sofia Ramírez",
    role: "Nutritionist, MexCity",
    avatar: "SR",
    color: "#7C3AED",
    quote:
      "NeoAigent's social media agent posts daily content for my business while I'm seeing patients. My Instagram following grew 3x in just 2 months!",
  },
  {
    id: 2,
    name: "Carlos Mendez",
    role: "Boutique Owner, Guadalajara",
    avatar: "CM",
    color: "#06B6D4",
    quote:
      "The WhatsApp sales agent was a game changer. It answers questions, shares product photos, and closes orders at 2am when I'm asleep. Wild.",
  },
  {
    id: 3,
    name: "Ana Torres",
    role: "Yoga Studio Director",
    avatar: "AT",
    color: "#EC4899",
    quote:
      "Appointment scheduling used to eat 2 hours of my day. Now the AI handles it all. I just show up and teach. Honestly magic.",
  },
  {
    id: 4,
    name: "Miguel Fuentes",
    role: "E-commerce Entrepreneur",
    avatar: "MF",
    color: "#F59E0B",
    quote:
      "I run 3 different online stores on the same NeoAigent platform. Each has its own subdomain, brand, and AI agents. Insanely powerful for the price.",
  },
  {
    id: 5,
    name: "Laura Chen",
    role: "Digital Agency, CDMX",
    avatar: "LC",
    color: "#4F46E5",
    quote:
      "We resell NeoAigent to our clients under our own brand. The multi-tenant white-label feature is the reason we chose this over everything else.",
  },
  {
    id: 6,
    name: "Roberto Vega",
    role: "Restaurant Chain Owner",
    avatar: "RV",
    color: "#10B981",
    quote:
      "Our AI agent posts daily specials, handles reservations, and sends WhatsApp reminders. Customer satisfaction scores went up 40% this quarter.",
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  const { t } = useTranslation();

  return (
    <section
      id="testimonials"
      className="relative py-28 overflow-hidden"
      style={{ background: "#0a0a14" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent)" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 mb-6">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
              {t.testimonials.badge}
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            {t.testimonials.headline1}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t.testimonials.headline2}
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            {t.testimonials.subtitle}
          </p>
        </div>

        {/* Masonry-style grid */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {testimonials.map((t) => (
            <div
              key={t.id}
              id={`testimonial-${t.id}`}
              className="break-inside-avoid rounded-2xl p-6 border border-white/6 transition-all duration-300 hover:-translate-y-1 hover:border-white/12"
              style={{ background: "#0d0d1a" }}
            >
              <StarRating />
              <p className="text-gray-300 text-sm leading-relaxed mt-4 mb-6">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)` }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{t.name}</p>
                  <p className="text-gray-600 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 p-8 rounded-3xl border border-white/6" style={{ background: "#0d0d1a" }}>
          {[
            { value: "500+", label: t.testimonials.stats.businesses },
            { value: "10M+", label: t.testimonials.stats.tasks },
            { value: "99.9%", label: t.testimonials.stats.uptime },
            { value: "4.9★", label: t.testimonials.stats.rated },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="text-3xl sm:text-4xl font-black mb-2"
                style={{
                  background: "linear-gradient(135deg, #A78BFA, #06B6D4)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {stat.value}
              </p>
              <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
