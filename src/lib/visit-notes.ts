// src/lib/visit-notes.ts
// Clinical notes in the patient history (ticket #103, D3d). A note belongs to a visit, but a deleted visit is
// hidden from the history; its note must not vanish with it. Pure function, no I/O.

interface NoteShape {
  readonly appointmentId: string | null;
}

export type OrphanNote<N> = N & { readonly fromDeletedVisit: boolean };

export interface SplitNotes<N> {
  /** Note of each visit that is not deleted, by visit id (the history looks up the visits it shows). */
  readonly byVisit: ReadonlyMap<string, N>;
  /** Notes shown on their own: without a visit, or of a deleted visit. Original order is kept. */
  readonly orphans: readonly OrphanNote<N>[];
}

/**
 * `deletedVisitIds` are the patient's deleted visits. A note of a visit that is merely left out of the view (for
 * example another pet's visit) is not an orphan: it stays attached and is simply not looked up.
 */
export function splitVisitNotes<N extends NoteShape>(notes: readonly N[], deletedVisitIds: ReadonlySet<string>): SplitNotes<N> {
  const byVisit = new Map<string, N>();
  const orphans: OrphanNote<N>[] = [];
  for (const note of notes) {
    const visitId = note.appointmentId;
    if (visitId && !deletedVisitIds.has(visitId)) {
      // Same rule as the history had before (new Map of the list): a later note of the same visit wins.
      byVisit.set(visitId, note);
    } else {
      orphans.push({ ...note, fromDeletedVisit: visitId !== null });
    }
  }
  return { byVisit, orphans };
}
