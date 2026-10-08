import { ParentProfileSchema, SEED_FIELDS, type ParentProfile, type ProfileSeed } from "./types";

const SeedSchema = ParentProfileSchema.pick(Object.fromEntries(SEED_FIELDS.map((k) => [k, true])) as { [K in (typeof SEED_FIELDS)[number]]: true }).partial();

/** Carried-over answers from the browser; anything malformed is dropped rather than trusted. */
export function parseSeed(value: unknown): ProfileSeed | null {
  if (!value || typeof value !== "object") return null;
  const parsed = SeedSchema.safeParse(value);
  return parsed.success && Object.keys(parsed.data).length ? parsed.data : null;
}

/** Guards against a model picking a month that already passed this year. */
export function futureDueDate(dueDate: string | null) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const date = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  while (date.getTime() < today.getTime() - 24 * 3600 * 1000) date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/** Models sometimes write "[Last Name]" or "N/A" when they don't know a name. */
function cleanName(value: string | undefined) {
  const name = (value ?? "").trim().replace(/\s+/g, " ");
  if (!name || /[[\]{}<>]|^(n\/?a|none|unknown|not sure|skip|tbd|undecided|not decided( yet)?)$/i.test(name)) return "";
  return name.slice(0, 80);
}

export function normalizeProfile(profile: ParentProfile): ParentProfile {
  return {
    ...profile,
    parentNames: cleanName(profile.parentNames),
    babyName: cleanName(profile.babyName).slice(0, 40),
    dueDate: futureDueDate(profile.dueDate),
  };
}

/** Built from what the parent told us, so it never contains placeholders. Parents can rename it. */
export function registryTitle(profile: Pick<ParentProfile, "parentNames" | "babyName">) {
  const baby = cleanName(profile.babyName);
  const parents = cleanName(profile.parentNames);
  if (baby) return `${baby}'s registry`;
  if (parents) return `${parents}'s baby registry`;
  return "Our baby registry";
}
