import type { ParentProfile } from "./types";

/** Guards against a model picking a month that already passed this year. */
export function futureDueDate(dueDate: string | null) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const date = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  while (date.getTime() < today.getTime() - 24 * 3600 * 1000) date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export function normalizeProfile(profile: ParentProfile): ParentProfile {
  return { ...profile, dueDate: futureDueDate(profile.dueDate) };
}
