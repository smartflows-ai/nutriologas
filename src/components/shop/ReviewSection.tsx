"use client";
// src/components/shop/ReviewSection.tsx
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Star, LogIn } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import ReviewForm from "./ReviewForm";

interface ReviewUser {
  name: string | null;
  image: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: ReviewUser;
}

interface Props {
  productId: string;
  initialReviews: Review[];
}

export default function ReviewSection({ productId, initialReviews }: Props) {
  const { data: session, status } = useSession();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [hasReviewed, setHasReviewed] = useState(false);

  const isCustomer = status === "authenticated" && (session?.user as any)?.role === "CUSTOMER";
  const isAdmin = status === "authenticated" && (session?.user as any)?.role === "ADMIN";

  const fetchReviews = useCallback(async () => {
    const res = await fetch(`/api/reviews?productId=${productId}&t=${Date.now()}`);
    if (res.ok) {
      const data: Review[] = await res.json();
      setReviews(data);
    }
  }, [productId]);

  // Check if the current user already left a review
  useEffect(() => {
    if (isCustomer && session?.user?.id) {
      const userId = session.user.id;
      setHasReviewed(reviews.some((r: any) => r.userId === userId));
    }
  }, [isCustomer, session, reviews]);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  const handleReviewSuccess = () => {
    fetchReviews();
    setHasReviewed(true);
  };

  return (
    <section className="mt-14">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Reseñas ({reviews.length})
        </h2>
        {avgRating && (
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={16}
                  className={
                    s <= Math.round(avgRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {avgRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Review form area */}
      {status === "loading" ? null : isCustomer && !hasReviewed ? (
        <ReviewForm productId={productId} onSuccess={handleReviewSuccess} />
      ) : isCustomer && hasReviewed ? (
        <div className="card mb-6 bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2">
          <Star size={16} className="fill-green-500 text-green-500 flex-shrink-0" />
          Ya dejaste una reseña para este producto. ¡Gracias por tu opinión!
        </div>
      ) : !isAdmin && status === "unauthenticated" ? (
        <div className="card mb-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            ¿Ya probaste este producto? Inicia sesión para dejar tu reseña.
          </p>
          <Link
            href="/login"
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 whitespace-nowrap"
          >
            <LogIn size={16} /> Iniciar sesión
          </Link>
        </div>
      ) : null}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-gray-400 text-sm py-4">
          Aún no hay reseñas para este producto. ¡Sé el primero en opinar!
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="card">
              <div className="flex items-center gap-3 mb-2">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                  {review.user.name?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {review.user.name ?? "Usuario"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(review.createdAt)}
                  </p>
                </div>
                {/* Stars */}
                <div className="flex flex-shrink-0">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      className={
                        s <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }
                    />
                  ))}
                </div>
              </div>
              {review.comment && (
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed pl-12">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
