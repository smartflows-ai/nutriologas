// src/app/admin/equipo/page.tsx
// The owner's team screen (ticket #22). Server gate first: STAFF is sent back to its own section.
import TeamManager from "@/components/admin/team/TeamManager";
import { requireAdminPage } from "@/lib/permission-guard";

export default async function TeamPage() {
  await requireAdminPage("/admin/equipo");
  return <TeamManager />;
}
