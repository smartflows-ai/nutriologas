"use client";
// src/components/admin/appointments/SlotGrid.tsx
// Times of one day for the "Nueva cita" form (ticket #103): free ones can be picked, taken ones are shown crossed
// out, same look as the storefront booking. AlternativesPicker lists the nearest free times when one was taken.
import { AlertCircle, Check, Clock } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { FreeSlot } from "./types";

interface SlotGridProps {
  slots: readonly { time: string; available: boolean }[];
  selected: string;
  onSelect: (time: string) => void;
  loading: boolean;
}

export function SlotGrid({ slots, selected, onSelect, loading }: SlotGridProps) {
  const { t } = useTranslation();
  if (loading) {
    return <p role="status" className="text-xs text-gray-500 dark:text-gray-400 py-3">{t.agenda.form.loadingSlots}</p>;
  }
  if (!slots.some((s) => s.available)) {
    return (
      <p role="status" className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
        <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
        {t.agenda.form.noSlots}
      </p>
    );
  }
  return (
    <div role="group" aria-label={t.agenda.form.slotsTime} className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {slots.map(({ time, available }) => {
        const isSelected = selected === time;
        return (
          <button
            type="button"
            key={time}
            aria-pressed={isSelected}
            disabled={!available}
            onClick={() => onSelect(time)}
            className={`min-h-11 sm:min-h-0 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
              !available
                ? "bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 border-gray-100 dark:border-gray-800 cursor-not-allowed line-through"
                : isSelected
                ? // The ring keeps the choice visible when the tenant color is close to the background (dark mode).
                  "bg-primary text-[color:var(--on-primary)] border-gray-900 ring-1 ring-gray-900 dark:border-white dark:ring-white"
                : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-primary/50"
            }`}
          >
            {isSelected ? <Check size={12} aria-hidden="true" /> : <Clock size={12} className="text-gray-400" aria-hidden="true" />}
            {time}
          </button>
        );
      })}
    </div>
  );
}

interface AlternativesProps {
  alternatives: readonly FreeSlot[];
  locale: string;
  onPick: (slot: FreeSlot) => void;
  disabled?: boolean;
}

/** The nearest free times, each with its day, as buttons. Empty: a short note to try another day. */
export function AlternativesPicker({ alternatives, locale, onPick, disabled = false }: AlternativesProps) {
  const { t } = useTranslation();
  if (alternatives.length === 0) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">{t.agenda.alternativesNone}</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-300">{t.agenda.alternativesHint}</p>
      <div className="flex flex-wrap gap-2">
        {alternatives.map((slot) => {
          const day = new Date(`${slot.date}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
          return (
            <button
              type="button"
              key={slot.iso}
              disabled={disabled}
              onClick={() => onPick(slot)}
              className="min-h-11 sm:min-h-0 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:border-primary/50 transition-colors disabled:opacity-50 capitalize"
            >
              {day} · {slot.time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
