"use client";

import { useState } from "react";
import Image from "next/image";

export default function ProductGallery({ name, images }: { name: string; images: string[] }) {
  const [index, setIndex] = useState(0);
  const hasImages = images && images.length > 0;
  const main = hasImages ? images[index] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-80 md:h-96 bg-gray-100 rounded-2xl overflow-hidden">
        {main ? (
          <Image src={main} alt={name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">Sin imagen</div>
        )}
      </div>
      {hasImages && images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setIndex(idx)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0 ${
                idx === index ? "border-primary" : "border-gray-200"
              }`}
            >
              <Image src={img} alt={`${name} ${idx + 1}`} fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

