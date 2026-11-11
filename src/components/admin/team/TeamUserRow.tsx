"use client";
// src/components/admin/team/TeamUserRow.tsx
// One team member: who they are, their state and what the owner can do with the account.
import { KeyRound, UserCheck, UserX } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { StaffUser } from "@/lib/staff-users";

const ACTION_CLASS = "btn-secondary inline-flex items-center justify-center gap-2 min-h-11 sm:min-h-0 disabled:opacity-50";
const BADGE_CLASS = "inline-block text-xs px-2 py-0.5 rounded-md";

interface Props {
  user: StaffUser;
  roleLabel: string;
  isBusy: boolean;
  // False when the plan has no seat left: a deactivated user cannot be activated until one is freed.
  hasFreeSeat: boolean;
  onReset: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
}

export default function TeamUserRow({ user, roleLabel, isBusy, hasFreeSeat, onReset, onDeactivate, onActivate }: Props) {
  const { t } = useTranslation();
  const tx = t.team;
  const status = !user.isActive ? tx.statusInactive : user.mustChangePassword ? tx.statusPending : tx.statusActive;
  // Neutral tones on purpose: a tenant color can be very light or very dark and would vanish on one of the themes.
  const badgeTone = user.isActive && !user.mustChangePassword
    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 dark:text-white break-words">{user.name || user.email}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{user.email}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</span>
          <span className={`${BADGE_CLASS} ${badgeTone}`}>{status}</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        {user.isActive ? (
          <>
            <button type="button" disabled={isBusy} onClick={onReset} className={ACTION_CLASS}>
              <KeyRound size={16} aria-hidden="true" />
              {tx.resetPassword}
            </button>
            <button type="button" disabled={isBusy} onClick={onDeactivate} className={ACTION_CLASS}>
              <UserX size={16} aria-hidden="true" />
              {tx.deactivate}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isBusy || !hasFreeSeat}
            title={hasFreeSeat ? undefined : tx.noSeatToActivate}
            onClick={onActivate}
            className={ACTION_CLASS}
          >
            <UserCheck size={16} aria-hidden="true" />
            {tx.activate}
          </button>
        )}
      </div>
    </li>
  );
}
