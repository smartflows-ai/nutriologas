// src/app/admin/calendario/page.tsx
// Unified with /admin/citas to provide a single, centralized scheduling hub
import { redirect } from "next/navigation";

export default function CalendarioPage() {
  redirect("/admin/citas?view=calendar");
}
