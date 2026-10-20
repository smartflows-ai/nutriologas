"use client";
// src/components/shop/ReviewForm.tsx
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "@/hooks/useToast";
import { useTranslation } from "@/i18n";
import { fill } from "@/lib/utils";

interface Props {
  productId: string;
  onSuccess: () => void;
}

export default function ReviewForm({ productId, onSuccess }: Props) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const ratingLabels = ["", t.productUi.rating1, t.productUi.rating2, t.productUi.rating3, t.productUi.rating4, t.productUi.rating5];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast(t.productUi.selectRating);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? t.productUi.reviewError);
        return;
      }
      toast(t.productUi.reviewSent);
      setRating(0);
      setComment("");
      onSuccess();
    } catch {
      toast(t.productUi.reviewError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{t.productUi.writeReview}</h3>

      {/* Star picker */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="focus:outline-none transition-transform "
            aria-label={fill(s > 1 ? t.productUi.starsCount : t.productUi.starCount, { count: s })}
          >
            <Star
              size={28}
              className={
                s <= (hovered || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-500">{ratingLabels[rating]}</span>
        )}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t.productUi.reviewPlaceholder}
        rows={3}
        maxLength={500}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
      />
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">{comment.length}/500</span>
        <button
          type="submit"
          disabled={loading || rating === 0}
          className="btn-primary px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t.productUi.sending : t.productUi.publishReview}
        </button>
      </div>
    </form>
  );
}
