"use client";
// src/components/admin/team/TeamManager.tsx
// The owner's team screen (ticket #22): list, add, reset password, deactivate and activate staff users.
// Everything it shows comes from /api/admin/users, which only answers the owner of the business.
import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import FormPanel from "@/components/admin/FormPanel";
import { useTenantMeta } from "@/components/admin/TenantMeta";
import { toast } from "@/hooks/useToast";
import { useTranslation } from "@/i18n";
import type { StaffUser } from "@/lib/staff-users";
import { getVerticalProfile } from "@/lib/vertical-profile";
import NewTeamUserForm from "./NewTeamUserForm";
import TeamUserRow from "./TeamUserRow";
import TempPasswordDialog from "./TempPasswordDialog";
import { useTeam, type TeamAction } from "./useTeam";

const LIMIT_TEXT_ID = "team-limit-text";

interface PendingAction {
  action: "reset_password" | "deactivate";
  user: StaffUser;
}

interface TempCredential {
  name: string;
  password: string;
}

const displayName = (user: StaffUser): string => user.name || user.email;
// A function replacer: a name is free text and may hold "$&" or "$1", which a string replacement would expand.
const withName = (text: string, name: string): string => text.replace("{name}", () => name);

export default function TeamManager() {
  const { t } = useTranslation();
  const tx = t.team;
  const { vertical, isBookingEnabled } = useTenantMeta();
  const roleLabel = t.staffUi.titles[getVerticalProfile(vertical, isBookingEnabled).staffTitle];
  const { team, hasLoadError, isBusy, load, run } = useTeam();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [credential, setCredential] = useState<TempCredential | null>(null);

  const act = async (user: StaffUser, action: TeamAction) => {
    const outcome = await run(user, action);
    setPending(null);
    if (!outcome.isDone) return;
    if (outcome.tempPassword) setCredential({ name: displayName(user), password: outcome.tempPassword });
    else toast(action === "activate" ? tx.activated : tx.deactivated);
  };

  const onCreated = (name: string, password: string) => {
    setIsFormOpen(false);
    setCredential({ name, password });
    void load();
  };

  const seats = team?.seats;
  const hasFreeSeat = (seats?.available ?? 0) > 0;
  const isResetPending = pending?.action === "reset_password";

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Users className="text-primary shrink-0" size={26} aria-hidden="true" />
            {tx.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{tx.subtitle}</p>
        </div>
        <button
          type="button"
          disabled={!hasFreeSeat}
          aria-describedby={seats && !hasFreeSeat ? LIMIT_TEXT_ID : undefined}
          onClick={() => setIsFormOpen(true)}
          className="btn-primary text-[color:var(--on-primary)] inline-flex items-center gap-2 min-h-11 shrink-0"
        >
          <UserPlus size={18} aria-hidden="true" />
          {tx.add}
        </button>
      </div>

      {!team && !hasLoadError && (
        <p aria-busy="true" className="card text-sm text-gray-500 dark:text-gray-400">{tx.loading}</p>
      )}

      {seats && (
        <div className="card mb-6">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {tx.seats.replace("{used}", String(seats.used)).replace("{limit}", String(seats.limit))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tx.seatsHint}</p>
          {!hasFreeSeat && (
            <p id={LIMIT_TEXT_ID} className="text-sm text-gray-600 dark:text-gray-300 mt-3">
              {tx.limitBody.replace("{limit}", String(seats.limit))}{" "}
              <span className="text-gray-500 dark:text-gray-400">{t.crm.apps.contactTeam}</span>
            </p>
          )}
        </div>
      )}

      {hasLoadError && (
        <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{tx.loadError}</p>
          <button type="button" onClick={() => void load()} className="btn-secondary min-h-11 sm:min-h-0">{tx.retry}</button>
        </div>
      )}

      {team && team.users.length === 0 && (
        <div className="card text-center py-10">
          <p className="font-medium text-gray-900 dark:text-white">{tx.emptyTitle}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tx.emptyBody}</p>
        </div>
      )}

      {team && team.users.length > 0 && (
        <ul className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-800">
          {team.users.map((user) => (
            <TeamUserRow
              key={user.id}
              user={user}
              roleLabel={roleLabel}
              isBusy={isBusy}
              hasFreeSeat={hasFreeSeat}
              onReset={() => setPending({ action: "reset_password", user })}
              onDeactivate={() => setPending({ action: "deactivate", user })}
              onActivate={() => void act(user, "activate")}
            />
          ))}
        </ul>
      )}

      {isFormOpen && (
        <FormPanel icon={<UserPlus size={18} className="text-primary" aria-hidden="true" />} title={tx.add} onClose={() => setIsFormOpen(false)}>
          <NewTeamUserForm onCreated={onCreated} onCancel={() => setIsFormOpen(false)} />
        </FormPanel>
      )}

      {pending && (
        <ConfirmModal
          title={withName(isResetPending ? tx.confirmResetTitle : tx.confirmDeactivateTitle, displayName(pending.user))}
          message={withName(isResetPending ? tx.confirmResetBody : tx.confirmDeactivateBody, displayName(pending.user))}
          confirmLabel={isResetPending ? tx.resetPassword : tx.deactivate}
          variant={isResetPending ? "primary" : "danger"}
          isBusy={isBusy}
          onConfirm={() => void act(pending.user, pending.action)}
          onCancel={() => setPending(null)}
        />
      )}

      {credential && (
        <TempPasswordDialog name={credential.name} password={credential.password} onClose={() => setCredential(null)} />
      )}
    </div>
  );
}
