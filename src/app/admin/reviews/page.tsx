"use client";
// src/app/admin/reviews/page.tsx
import { useState, useEffect } from "react";
import { Star, Eye, EyeOff } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Review {
  id: string; rating: number; comment: string | null; isVisible: boolean; createdAt: string;
  user: { name: string | null }; product: { name: string };
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");

  const fetchReviews = async () => {
    // Al no pasar ?tenant=, el API backend usará el tenant del Admin autenticado
    const res = await fetch(`/api/reviews?t=${Date.now()}`);
    setReviews(await res.json());
  };

  useEffect(() => { fetchReviews(); }, []);

  const toggleVisibility = async (id: string, isVisible: boolean) => {
    await fetch(`/api/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isVisible: !isVisible }) });
    fetchReviews();
  };

  const filtered = filter === "all" ? reviews : reviews.filter(r => r.rating === parseInt(filter));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Reviews</h1>
      <p className="text-gray-500 text-sm mb-8">{reviews.length} reseñas en total</p>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "5", "4", "3", "2", "1"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${filter === f ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 hover:border-primary"}`}>
            {f === "all" ? "Todos" : `${"⭐".repeat(parseInt(f))} (${reviews.filter(r => r.rating === parseInt(f)).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((review) => (
          <div key={review.id} className={`card transition-opacity ${!review.isVisible ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{review.user.name ?? "Usuario"}</span>
                  <span className="text-xs text-gray-400">en</span>
                  <span className="text-sm text-primary font-medium truncate">{review.product.name}</span>
                  <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
                </div>
                <div className="flex mb-2">
                  {[1,2,3,4,5].map((s) => <Star key={s} size={14} className={s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />)}
                </div>
                {review.comment && <p className="text-gray-600 text-sm">{review.comment}</p>}
              </div>
              <button onClick={() => toggleVisibility(review.id, review.isVisible)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${review.isVisible ? "border-green-200 text-green-700 hover:bg-green-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {review.isVisible ? <><Eye size={14} /> Visible</> : <><EyeOff size={14} /> Oculto</>}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-400 text-sm py-6 text-center">No hay reseñas con este filtro.</p>}
      </div>
    </div>
  );
}
