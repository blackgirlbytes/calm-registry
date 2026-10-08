import { RETAILER_LABELS, SEED_FIELDS, type ParentProfile, type ProfileSeed } from "./types";

/** Plain-word versions of each answer, shared by the answers card, change previews, and prompts. */

export const HOME_LABELS: Record<ParentProfile["home"], string> = {
  apartment: "Apartment",
  house: "House",
  unknown: "Not sure",
};

export const FEEDING_LABELS: Record<ParentProfile["feeding"], string> = {
  breast: "Breastfeeding",
  formula: "Formula",
  both: "A mix",
  unsure: "Not sure yet",
};

export const BUDGET_LABELS: Record<ParentProfile["budget"], string> = {
  lean: "Keep it lean",
  moderate: "Moderate",
  generous: "Generous",
};

export function carLabel(hasCar: boolean | null) {
  return hasCar === true ? "Drives" : hasCar === false ? "Doesn't drive" : "Not sure";
}

export function dueLabel(dueDate: string | null) {
  if (!dueDate) return "Not sure yet";
  const date = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not sure yet";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function list(values: string[], empty: string) {
  return values.length ? values.join(", ") : empty;
}

export function storesLabel(stores: ParentProfile["preferredRetailers"]) {
  return stores.length ? stores.map((s) => RETAILER_LABELS[s]).join(", ") : "Any store";
}

/** Fields shown on the answers card, in the order the chat asks about them. */
export function describeAnswers(profile: ParentProfile) {
  return {
    dueDate: dueLabel(profile.dueDate),
    names: [profile.parentNames, profile.babyName && `baby ${profile.babyName}`].filter(Boolean).join(", ") || "Not shared",
    home: HOME_LABELS[profile.home],
    hasCar: carLabel(profile.hasCar),
    feeding: FEEDING_LABELS[profile.feeding],
    budget: BUDGET_LABELS[profile.budget],
    alreadyHave: list(profile.alreadyHave, "Nothing yet"),
    values: list(profile.values, "No preference"),
    preferredRetailers: storesLabel(profile.preferredRetailers),
    notes: profile.notes.trim() || "Nothing else",
  };
}

const CHANGE_LABELS: Array<[keyof ReturnType<typeof describeAnswers>, string]> = [
  ["dueDate", "due date"],
  ["home", "home"],
  ["hasCar", "driving"],
  ["feeding", "feeding"],
  ["budget", "budget"],
  ["alreadyHave", "already have"],
  ["values", "what matters to them"],
  ["preferredRetailers", "stores"],
  ["notes", "notes"],
];

/** e.g. ["home: Apartment → House"]. Names are left out because they don't change which items fit. */
export function describeChanges(before: ParentProfile, after: ParentProfile) {
  const a = describeAnswers(before);
  const b = describeAnswers(after);
  return CHANGE_LABELS.filter(([key]) => a[key] !== b[key]).map(([key, label]) => `${label}: ${a[key]} → ${b[key]}`);
}

export function seedFrom(profile: ParentProfile): ProfileSeed {
  return Object.fromEntries(SEED_FIELDS.map((key) => [key, profile[key]])) as ProfileSeed;
}

/** "Apartment, doesn't drive, formula…" for the seeded opening line. */
export function describeSeed(seed: ProfileSeed) {
  const parts = [
    seed.home && seed.home !== "unknown" ? HOME_LABELS[seed.home].toLowerCase() : "",
    seed.hasCar === undefined || seed.hasCar === null ? "" : carLabel(seed.hasCar).toLowerCase(),
    seed.feeding && seed.feeding !== "unsure" ? FEEDING_LABELS[seed.feeding].toLowerCase() : "",
    seed.budget ? `${BUDGET_LABELS[seed.budget].toLowerCase()} budget`.replace("keep it lean budget", "lean budget") : "",
    ...(seed.values ?? []),
    seed.preferredRetailers?.length ? storesLabel(seed.preferredRetailers) : "",
  ];
  return parts.filter(Boolean).join(", ");
}
