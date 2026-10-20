"use client";
// src/components/marketing/TestimonialsSection.tsx
import { useTranslation } from "@/i18n";
import { Star } from "lucide-react";

// Names, avatars and colors are fixed; role and quote come from the dictionary (testimonials.items).
const testimonials = [
  { id: 1, name: "Dr. Sofia Ramírez", avatar: "SR", color: "var(--mk-violet)" },
  { id: 2, name: "Carlos Mendez", avatar: "CM", color: "var(--mk-cyan)" },
  { id: 3, name: "Ana Torres", avatar: "AT", color: "var(--mk-pink)" },
  { id: 4, name: "Miguel Fuentes", avatar: "MF", color: "var(--mk-amber)" },
  { id: 5, name: "Laura Chen", avatar: "LC", color: "var(--mk-indigo)" },
  { id: 6, name: "Roberto Vega", avatar: "RV", color: "var(--mk-emerald)" },
];

function StarRating() {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
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
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent)" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 mb-6">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
              {t.testimonials.badge}
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            {t.testimonials.headline1}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--mk-violet-light) 0%, var(--mk-cyan) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t.testimonials.headline2}
            </span>
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            {t.testimonials.subtitle}
          </p>
        </div>

        {/* Masonry-style grid */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {testimonials.map((person, idx) => {
            const item = t.testimonials.items[idx];
            return (
              <div
                key={person.id}
                id={`testimonial-${person.id}`}
                className="break-inside-avoid rounded-2xl p-6 border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
                style={{ background: "var(--mk-card)" }}
              >
                <StarRating />
                <p className="text-white/70 text-sm leading-relaxed mt-4 mb-6">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${person.color}, ${person.color}80)` }}
                  >
                    {person.avatar}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{person.name}</p>
                    <p className="text-white/50 text-xs">{item.role}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Social proof numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 p-8 rounded-3xl border border-white/10" style={{ background: "var(--mk-card)" }}>
          {[
            { value: "500+", hasStar: false, label: t.testimonials.stats.businesses },
            { value: "10M+", hasStar: false, label: t.testimonials.stats.tasks },
            { value: "99.9%", hasStar: false, label: t.testimonials.stats.uptime },
            { value: "4.9", hasStar: true, label: t.testimonials.stats.rated },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="text-3xl sm:text-4xl font-black mb-2 flex items-center justify-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, var(--mk-violet-light), var(--mk-cyan))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                <span>{stat.value}</span>
                {stat.hasStar && (
                  <Star size={24} className="fill-amber-400 text-amber-400 inline-block shrink-0 -mt-1" style={{ WebkitTextFillColor: "initial" }} />
                )}
              </div>
              <p className="text-white/50 text-sm font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
