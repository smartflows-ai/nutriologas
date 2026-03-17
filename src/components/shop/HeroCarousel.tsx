"use client";
// src/components/shop/HeroCarousel.tsx
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";

interface CarouselImage { id: string; url: string; alt?: string | null; }

export default function HeroCarousel({ images }: { images: CarouselImage[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 4000 })]);

  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!images.length) return null;

  return (
    <div className="relative overflow-hidden bg-gray-100" ref={emblaRef}>
      <div className="flex">
        {images.map((img) => (
          <div key={img.id} className="relative flex-[0_0_100%] h-[420px]">
            <Image
              src={img.url}
              alt={img.alt ?? "Banner"}
              fill
              className="object-cover"
              priority
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors">
            <ChevronRight size={24} />
          </button>
        </>
      )}
    </div>
  );
}
