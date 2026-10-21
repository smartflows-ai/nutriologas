"use client";
// src/components/shop/HeroCarousel.tsx
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "@/i18n";

interface CarouselImage { id: string; url: string; alt?: string | null; }

export default function HeroCarousel({ images }: { images: CarouselImage[] }) {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 4000 })]);

  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!images.length) return null;

  return (
    <div className="relative overflow-hidden bg-gray-900 group" ref={emblaRef}>
      <div className="flex">
        {images.map((img) => (
          <div key={img.id} className="relative flex-[0_0_100%] h-[60vh] lg:h-[75vh]">
            <Image
              src={img.url}
              alt={img.alt ?? t.storefrontUi.bannerAlt}
              fill
              className="object-cover"
              priority
            />
            {/* Subtle gradient overlay to make things feel premium */}
            <div className="absolute inset-0 bg-gray-900/40 pointer-events-none" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button 
            onClick={prev} 
            className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-full p-3 transition-all duration-300 opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft size={28} />
          </button>
          <button 
            onClick={next} 
            className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-full p-3 transition-all duration-300 opacity-0 group-hover:opacity-100"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>
  );
}
