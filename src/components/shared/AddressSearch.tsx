"use client";
// src/components/shared/AddressSearch.tsx
// Address picker backed by Google Places (through /api/places/*). When search is unavailable it falls back
// to a plain typed address (no coordinates), so sign-up and Negocio never block.
import { useEffect, useRef, useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import type { BusinessLocation } from "@/lib/location";

interface Suggestion {
  placeId: string;
  text: string;
}

interface Props {
  value: BusinessLocation | null;
  onChange: (value: BusinessLocation | null) => void;
  inputClassName?: string;
  panelClassName?: string;
  mutedClassName?: string;
  textClassName?: string;
}

const DEFAULT_INPUT =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary";
const DEFAULT_PANEL = "border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900";

const newToken = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));

export default function AddressSearch({
  value,
  onChange,
  inputClassName = DEFAULT_INPUT,
  panelClassName = DEFAULT_PANEL,
  mutedClassName = "text-gray-500 dark:text-gray-400",
  textClassName = "text-gray-900 dark:text-white",
}: Props) {
  const { t, lang } = useTranslation();
  const tx = t.locationUi;
  // A saved typed address (no place id) starts as the input text, so it stays visible and editable.
  const [query, setQuery] = useState(value && !value.placeId ? value.address : "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionToken = useRef(newToken());

  // Debounced search for suggestions. Skipped after a real pick and when search is unavailable.
  useEffect(() => {
    if (value?.placeId || unavailable) return;
    const text = query.trim();
    if (text.length < 3) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, sessionToken: sessionToken.current, lang }),
        });
        if (!res.ok) {
          setUnavailable(true);
          return;
        }
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setSearched(true);
      } catch {
        setUnavailable(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, value, unavailable, lang]);

  const pick = async (suggestion: Suggestion) => {
    setError(null);
    setSearching(true);
    try {
      const res = await fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: suggestion.placeId, sessionToken: sessionToken.current, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(translateApiError(t, data.error) || tx.unavailableHint);
      onChange({
        address: data.address,
        placeId: data.placeId,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      setQuery("");
      setSuggestions([]);
      setSearched(false);
      sessionToken.current = newToken();
    } catch (err: any) {
      setError(err.message || tx.unavailableHint);
    } finally {
      setSearching(false);
    }
  };

  // The input is always editable. A picked place is shown below it; typing over a pick clears the pick.
  return (
    <div className="relative space-y-1.5">
      <div className="relative">
        <input
          type="text"
          value={query}
          maxLength={300}
          onChange={(e) => {
            const text = e.target.value;
            setQuery(text);
            // The typed text is always the address (a draft without coordinates) until a suggestion is picked.
            onChange(text.trim().length >= 5 ? { address: text.trim() } : null);
          }}
          placeholder={value?.placeId ? value.address : tx.searchPlaceholder}
          className={inputClassName}
        />
        {searching && <Loader2 size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 animate-spin ${mutedClassName}`} />}
      </div>
      {value?.placeId && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2 ${panelClassName}`}>
          <MapPin size={16} className={`mt-0.5 shrink-0 ${mutedClassName}`} />
          <span className={`flex-1 text-sm break-words ${textClassName}`}>{value.address}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={tx.clear}
            title={tx.clear}
            className={`shrink-0 p-1 rounded-lg hover:opacity-80 ${mutedClassName}`}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {unavailable && <p className={`text-xs ${mutedClassName}`}>{tx.unavailableHint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!unavailable && suggestions.length > 0 && (
        <ul className={`absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden ${panelClassName}`}>
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => pick(s)}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:opacity-80 ${textClassName}`}
              >
                <MapPin size={16} className={`mt-0.5 shrink-0 ${mutedClassName}`} />
                <span className="break-words">{s.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!unavailable && searched && !searching && suggestions.length === 0 && (
        <p className={`text-xs ${mutedClassName}`}>{tx.noResults}</p>
      )}
    </div>
  );
}
