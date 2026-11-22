"use client";
// src/components/admin/business/TimeZoneReview.tsx
// Ticket #127, /admin/negocio: before a new zone is saved the owner sees the booked visits that will read another
// hour (useZoneShift + TimeZoneShiftReview), and a zone that does not tell the hour of the address is pointed out
// with a button to use the address zone (TimeZoneMismatchNotice). Nothing here moves a visit.
import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { useTranslation } from "@/i18n";
import { fill } from "@/lib/utils";
import { timeZoneLabel } from "@/lib/time-zones";
import { sameClock, type ShiftedVisit } from "@/lib/time-zone-change";

export interface ZoneShiftState {
  loading: boolean;
  count: number;
  visits: ShiftedVisit[];
}

const EMPTY: ZoneShiftState = { loading: false, count: 0, visits: [] };

/** The visits that change hour when the zone goes from `savedZone` to `zone`; empty while they are the same. */
export function useZoneShift(savedZone: string, zone: string): ZoneShiftState {
  const [state, setState] = useState<ZoneShiftState>(EMPTY);

  useEffect(() => {
    if (zone === savedZone) {
      setState(EMPTY);
      return;
    }
    let active = true;
    setState({ ...EMPTY, loading: true });
    fetch(`/api/tenants/business/time-zone-impact?zone=${encodeURIComponent(zone)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setState(
          data && Array.isArray(data.visits)
            ? { loading: false, count: Number(data.count) || 0, visits: data.visits as ShiftedVisit[] }
            : EMPTY,
        );
      })
      // The server checks again on save (409 time_zone_shift_unconfirmed), so a failed preview never lets a change through.
      .catch(() => active && setState(EMPTY));
    return () => {
      active = false;
    };
  }, [savedZone, zone]);

  return state;
}

function shortDate(dateKey: string, locale: string): string {
  // The day key is already on the business calendar: read it at noon UTC so no zone moves it.
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

interface ShiftReviewProps {
  shift: ZoneShiftState;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
}

/** The list of visits that change hour, and the box the owner ticks to accept it. Renders nothing when none change. */
export function TimeZoneShiftReview({ shift, confirmed, onConfirmedChange }: ShiftReviewProps) {
  const { t, lang } = useTranslation();
  const tx = t.locationUi;
  const locale = lang === "en" ? "en-US" : "es-MX";

  if (shift.loading) {
    return (
      <p role="status" className="text-xs text-gray-500 dark:text-gray-400">
        {tx.timeZoneShiftLoading}
      </p>
    );
  }
  if (shift.count === 0) return null;

  const hidden = shift.count - shift.visits.length;
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <p className="flex items-start gap-2 text-sm font-medium text-gray-900 dark:text-white">
        <Clock size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        {tx.timeZoneShiftTitle}
      </p>
      <ul className="space-y-1.5">
        {shift.visits.map((visit) => (
          <li key={visit.id} className="text-xs text-gray-700 dark:text-gray-300 break-words">
            {fill(tx.timeZoneShiftRow, {
              nombre: visit.customerName || "—",
              servicio: visit.productName,
              fecha: shortDate(visit.fromDate, locale),
              antes: visit.fromTime,
              despues: visit.toDate === visit.fromDate ? visit.toTime : `${shortDate(visit.toDate, locale)} ${visit.toTime}`,
            })}
            {visit.outsideHours && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle size={12} aria-hidden="true" />
                {tx.timeZoneShiftOutside}
              </span>
            )}
          </li>
        ))}
        {hidden > 0 && (
          <li className="text-xs text-gray-500 dark:text-gray-400">{fill(tx.timeZoneShiftMore, { n: String(hidden) })}</li>
        )}
      </ul>
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm text-gray-900 dark:text-white">{tx.timeZoneShiftConfirm}</span>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="check-themed w-5 h-5 mt-0 shrink-0"
        />
      </label>
    </div>
  );
}

interface MismatchProps {
  /** The zone saved for the business: the check runs again after each save. */
  savedZone: string;
  /** The zone picked in the list right now: the notice hides once it is the address zone. */
  selectedZone: string;
  onUseAddressZone: (zone: string) => void;
}

/** Points out a saved zone that does not tell the hour of the business address (ticket #127). */
export function TimeZoneMismatchNotice({ savedZone, selectedZone, onUseAddressZone }: MismatchProps) {
  const { t, lang } = useTranslation();
  const [addressZone, setAddressZone] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/tenants/business/time-zone-check")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setAddressZone(data?.mismatch && typeof data.addressZone === "string" ? data.addressZone : null);
      })
      .catch(() => active && setAddressZone(null));
    return () => {
      active = false;
    };
  }, [savedZone]);

  // Hidden once the picked zone tells the address hour, also under another name (Mexico City for Monterrey).
  if (!addressZone || sameClock(selectedZone, addressZone, new Date())) return null;

  return (
    <div role="status" className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <p className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        {fill(t.locationUi.timeZoneMismatch, {
          guardada: timeZoneLabel(savedZone, lang),
          direccion: timeZoneLabel(addressZone, lang),
        })}
      </p>
      <button type="button" className="btn-secondary text-xs" onClick={() => onUseAddressZone(addressZone)}>
        {t.locationUi.timeZoneUseAddress}
      </button>
    </div>
  );
}
