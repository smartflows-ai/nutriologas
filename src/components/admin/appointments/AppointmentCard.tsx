"use client";
// src/components/admin/appointments/AppointmentCard.tsx
// One visit in the /admin/citas list (moved out of the page, ticket #103). Native visits get the status buttons,
// Editar and Eliminar; calendar events only open in their calendar; a deleted visit shows who deleted or restored
// it and one action, Recuperar.
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  User,
  Video,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { fill } from "@/lib/utils";
import { priceViewFor } from "@/lib/price-display";
import { reminderNotDelivered } from "@/lib/reminder-badge";
import { isSyntheticEmail } from "@/lib/patient-intake";
import type { AppointmentItem, TrailEntry, VisitStatus } from "./types";
import { useBusinessTimeZone } from "@/components/shared/BusinessTimeZone";
import { clinicDateKeyOf } from "@/lib/clinic-time";
import { needsPermissionBadge } from "@/lib/whatsapp-permission";
import { canOfferReopen, canOfferRestore } from "@/lib/appointment-admin-rules";

// Status colors are semantic (pending, confirmed, cancelled), so they stay fixed and do not follow the tenant theme.
const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING:   { bg: "bg-gray-500/10",    text: "text-gray-600 dark:text-gray-300", border: "border-gray-500/30", dot: "bg-gray-400" },
  CONFIRMED: { bg: "bg-primary/10",     text: "text-primary",     border: "border-primary/30",     dot: "bg-primary" },
  COMPLETED: { bg: "bg-gray-900/10 dark:bg-white/10", text: "text-gray-900 dark:text-white", border: "border-gray-900/20 dark:border-white/20", dot: "bg-gray-900 dark:bg-white" },
  CANCELLED: { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
  NO_SHOW:   { bg: "bg-gray-500/10",    text: "text-gray-400",    border: "border-gray-500/20",    dot: "bg-gray-300 dark:bg-gray-600" },
};

const EDITABLE: readonly VisitStatus[] = ["PENDING", "CONFIRMED"];

interface Props {
  appt: AppointmentItem;
  locale: string;
  canNotes: boolean;
  /** True while an action on this visit is running: its buttons are disabled. */
  busy: boolean;
  onStatus: (id: string, status: VisitStatus) => void;
  onNotes: (id: string) => void;
  /** Present only for roles that may edit, delete or restore. */
  onEdit?: (appt: AppointmentItem) => void;
  onDelete?: (appt: AppointmentItem) => void;
  onRestore?: (appt: AppointmentItem) => void;
}

const TEXT_ACTION = "inline-flex items-center gap-1 px-2 py-1.5 min-h-11 sm:min-h-0 rounded-xl text-xs transition-colors disabled:opacity-50";

export default function AppointmentCard({ appt, locale, canNotes, busy, onStatus, onNotes, onEdit, onDelete, onRestore }: Props) {
  const { t } = useTranslation();
  const statusLabel: Record<string, string> = {
    PENDING: t.agenda.statusPending,
    CONFIRMED: t.agenda.statusConfirmed,
    COMPLETED: t.agenda.statusCompleted,
    CANCELLED: t.agenda.statusCancelled,
    NO_SHOW: t.agenda.statusNoShow,
  };

  // Dates and times on the business clock (Tenant.timeZone), never the browser's (ticket #111).
  const timeZone = useBusinessTimeZone();
  const dateObj = new Date(appt.appointmentDate);
  const dateStr = dateObj.toLocaleDateString(locale, { timeZone, weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const timeStr = dateObj.toLocaleTimeString(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: true });
  const [dayYear, , dayNumber] = clinicDateKeyOf(dateObj, timeZone).split("-");
  const style = STATUS_STYLE[appt.status] || STATUS_STYLE.PENDING;
  const patientName = appt.customerName || appt.user?.name || t.agenda.patientFallback;
  const titleText = appt.product?.name ?? t.agenda.consultFallback;
  const patientPhone = appt.customerPhone;
  const contactEmail = appt.customerEmail || appt.user?.email;
  const isExternal = appt.source === "google" || appt.source === "microsoft";
  const isDeleted = Boolean(appt.deletedAt);

  const trailLine = (entry: TrailEntry) =>
    fill(entry.action === "DELETED" ? t.agenda.deletedByLine : t.agenda.restoredByLine, {
      name: entry.by || t.agenda.someone,
      date: new Date(entry.at).toLocaleString(locale, { timeZone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    });

  return (
    <div className="card p-5 flex flex-col sm:flex-row items-start gap-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Date and time */}
      <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:w-36 shrink-0">
        <div className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-primary">
          <span className="text-xs font-medium leading-tight">{dateObj.toLocaleDateString(locale, { timeZone, month: "short" })}</span>
          <span className="text-xl font-semibold leading-none">{Number(dayNumber)}</span>
          <span className="text-xs font-medium leading-tight">{dayYear}</span>
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{timeStr}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{fill(t.productUi.minutesShort, { minutes: appt.durationMinutes })}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{dateStr}</p>
        </div>
      </div>

      {/* Service, patient and notes */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900 dark:text-white break-words">{titleText}</h3>

          {/* Integration source badge */}
          {appt.source === "google" && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Google Calendar
            </span>
          )}
          {appt.source === "microsoft" && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              Outlook
            </span>
          )}

          {/* Reminder that failed to send: neutral style so it follows the tenant theme in light and dark */}
          {!isDeleted && reminderNotDelivered(appt) && (
            <span
              title={fill(t.agenda.reminderNotDeliveredHint, { count: appt.reminderAttempts ?? 0 })}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800"
            >
              <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
              {t.agenda.reminderNotDelivered}
            </span>
          )}

          {/* Holes 4 and 5: no WhatsApp permission, or the patient asked not to receive messages. Icon and word, neutral. */}
          {needsPermissionBadge(appt.whatsappPermission ?? "YES", { status: appt.status, customerPhone: appt.customerPhone, deleted: isDeleted }) && (
            <span
              title={appt.whatsappPermission === "OPTED_OUT" ? t.crm.waRisk.optedOutHint : t.crm.waRisk.noPermissionHint}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            >
              <ShieldAlert size={12} strokeWidth={2} aria-hidden="true" />
              {appt.whatsappPermission === "OPTED_OUT" ? t.crm.waRisk.optedOutBadge : t.crm.waRisk.noPermissionBadge}
            </span>
          )}

          {/* In person or online: neutral style so it follows the tenant theme in light and dark */}
          {appt.modality && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800">
              {appt.modality === "ONLINE" ? <Video size={12} strokeWidth={2} aria-hidden="true" /> : <MapPin size={12} strokeWidth={2} aria-hidden="true" />}
              {appt.modality === "ONLINE" ? t.agenda.modalityOnline : t.agenda.modalityInPerson}
            </span>
          )}

          {/* Price badge for native consultations */}
          {!isExternal && appt.product && (appt.product.price > 0 || appt.product.priceMode === "ON_REQUEST") ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {priceViewFor(appt.product, t.price, locale).text}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 text-sm">
          {patientName !== titleText && (
            <span className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200 min-w-0">
              <User size={14} className="text-gray-400 shrink-0" />
              <span className="break-words min-w-0">{patientName}</span>
              {appt.customerAge != null && (
                <span className="font-normal text-gray-500 dark:text-gray-400 shrink-0">{fill(t.agenda.ageYears, { age: appt.customerAge })}</span>
              )}
            </span>
          )}
          {appt.referredByKey && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {fill(t.agenda.referredBy, { name: appt.referredByName || `+${appt.referredByKey}` })}
            </span>
          )}
          {appt.pet?.name && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t.crm.history.petUi.petsColumn}: {appt.pet.name}
            </span>
          )}
          {patientPhone ? (
            <a
              href={`https://wa.me/${patientPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary hover:underline w-fit"
            >
              <Phone size={14} />
              {patientPhone}
            </a>
          ) : null}
          {contactEmail && !isSyntheticEmail(contactEmail) ? (
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 break-all">
              <Mail size={14} className="text-gray-400 shrink-0" />
              {contactEmail}
            </span>
          ) : null}
          {!isDeleted && appt.modality === "ONLINE" && appt.meetUrl ? (
            <a href={appt.meetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline w-fit">
              <Video size={14} aria-hidden="true" />
              {t.agenda.openMeeting}
            </a>
          ) : null}
        </div>

        {appt.notes && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 px-3 py-2.5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.agenda.reason}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">{appt.notes}</p>
          </div>
        )}
        {canNotes && appt.internalNotes && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 dark:border-primary/30 px-3 py-2.5">
            <p className="text-xs font-medium text-primary mb-1">{t.agenda.clinicalNotes}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words line-clamp-3">{appt.internalNotes}</p>
          </div>
        )}

        {/* Who deleted or restored this visit, and when (oldest first) */}
        {isDeleted && appt.trail && appt.trail.length > 0 && (
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            {appt.trail.map((entry) => (
              <li key={`${entry.action}-${entry.at}`}>{trailLine(entry)}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex flex-col items-end gap-2 shrink-0 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {statusLabel[appt.status] || statusLabel.PENDING}
          </span>
          {!isExternal && !isDeleted && canNotes && (
            <button onClick={() => onNotes(appt.id)} className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
              <MessageSquare size={12} />
              {appt.internalNotes ? t.agenda.edit : t.agenda.notes}
            </button>
          )}
        </div>

        {isDeleted ? (
          onRestore && canOfferRestore(new Date(appt.appointmentDate), new Date()) && (
            <button
              disabled={busy}
              onClick={() => onRestore(appt)}
              className="px-3 py-1.5 min-h-11 sm:min-h-0 rounded-xl bg-primary hover:opacity-90 text-[color:var(--on-primary)] font-semibold text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={13} aria-hidden="true" />
              {t.agenda.restoreAction}
            </button>
          )
        ) : (
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            {/* External event direct link */}
            {isExternal && appt.htmlLink && (
              <a
                href={appt.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <span>{t.agenda.openCalendar}</span>
                <ExternalLink size={12} />
              </a>
            )}

            {/* Native appointment status buttons */}
            {!isExternal && appt.status === "PENDING" && (
              <>
                <button
                  disabled={busy}
                  onClick={() => onStatus(appt.id, "CONFIRMED")}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-secondary text-[color:var(--on-primary)] font-semibold text-xs flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                >
                  <Check size={13} />
                  {t.agenda.confirm}
                </button>
                <button
                  disabled={busy}
                  onClick={() => onStatus(appt.id, "CANCELLED")}
                  className="px-2.5 py-1.5 rounded-xl text-red-600 dark:text-red-400 text-xs hover:underline transition-all disabled:opacity-50"
                >
                  {t.agenda.cancel}
                </button>
              </>
            )}
            {!isExternal && appt.status === "CONFIRMED" && (
              <>
                <button
                  disabled={busy}
                  onClick={() => onStatus(appt.id, "COMPLETED")}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:opacity-90 text-[color:var(--on-primary)] font-semibold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={13} />
                  {t.agenda.attended}
                </button>
                <button
                  disabled={busy}
                  onClick={() => onStatus(appt.id, "NO_SHOW")}
                  className="px-2 py-1.5 rounded-xl text-gray-500 text-xs hover:underline transition-all disabled:opacity-50"
                >
                  {t.agenda.noShow}
                </button>
                <button
                  disabled={busy}
                  onClick={() => onStatus(appt.id, "CANCELLED")}
                  className="px-2 py-1.5 rounded-xl text-red-600 dark:text-red-400 text-xs hover:underline transition-all disabled:opacity-50"
                >
                  {t.agenda.cancel}
                </button>
              </>
            )}
            {!isExternal &&
              (appt.status === "COMPLETED" || appt.status === "CANCELLED" || appt.status === "NO_SHOW") &&
              canOfferReopen(appt.status, new Date(appt.appointmentDate), new Date()) && (
              <button
                disabled={busy}
                onClick={() => onStatus(appt.id, "CONFIRMED")}
                className="px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {t.agenda.reopen}
              </button>
            )}
          </div>
        )}

        {/* Edit and delete (ticket #103): native visits only */}
        {!isExternal && !isDeleted && (onEdit || onDelete) && (
          <div className="flex items-center gap-1 justify-end">
            {onEdit && EDITABLE.includes(appt.status) && (
              <button
                disabled={busy}
                onClick={() => onEdit(appt)}
                className={`${TEXT_ACTION} text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800`}
              >
                <Pencil size={12} aria-hidden="true" />
                {t.agenda.editAction}
              </button>
            )}
            {onDelete && (
              <button
                disabled={busy}
                onClick={() => onDelete(appt)}
                className={`${TEXT_ACTION} text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800`}
              >
                <Trash2 size={12} aria-hidden="true" />
                {t.agenda.deleteAction}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
