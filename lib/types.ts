import { z } from "zod";

export const RETAILERS = ["amazon", "walmart", "target"] as const;
export type RetailerId = (typeof RETAILERS)[number];

export const RETAILER_LABELS: Record<RetailerId, string> = {
  amazon: "Amazon",
  walmart: "Walmart",
  target: "Target",
};

export const CATEGORIES = [
  "Sleep",
  "Feeding",
  "Diapering",
  "Bath",
  "On-the-go",
  "Clothing",
  "Health",
  "Play",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["must-have", "nice-to-have", "later"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type ItemStatus = "pending" | "keep" | "skip";

export const ParentProfileSchema = z.object({
  dueDate: z.string().nullable(),
  home: z.enum(["apartment", "house", "unknown"]),
  hasCar: z.boolean().nullable(),
  feeding: z.enum(["breast", "formula", "both", "unsure"]),
  budget: z.enum(["lean", "moderate", "generous"]),
  values: z.array(z.string()),
  alreadyHave: z.array(z.string()),
  preferredRetailers: z.array(z.enum(RETAILERS)),
  notes: z.string(),
});
export type ParentProfile = z.infer<typeof ParentProfileSchema>;

export const GeneratedItemSchema = z.object({
  name: z.string(),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  reason: z.string(),
  // No max here: models sometimes over-count, and offers.ts clamps instead of rejecting the registry.
  qty: z.number().describe("Units to register for, 1-20. Count packs or sets, e.g. 4 packs of diapers, not 200 diapers."),
  searchQuery: z.string(),
});
export type GeneratedItem = z.infer<typeof GeneratedItemSchema>;

export type Offer = {
  retailer: RetailerId;
  externalId: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  url: string;
  rating: number | null;
  inStock: boolean;
};

export type RegistryItem = {
  id: string;
  name: string;
  category: Category;
  priority: Priority;
  reason: string;
  qty: number;
  status: ItemStatus;
  position: number;
  searchQuery: string;
  offers: Array<Offer & { id: string; isPrimary: boolean }>;
  purchased: { buyerName: string | null; retailer: RetailerId | null } | null;
};

export type Registry = {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  profile: ParentProfile;
  preferredRetailers: RetailerId[];
  dueDate: string | null;
  revision: number;
  items: RegistryItem[];
};

export type ChatMessage = { role: "assistant" | "user"; content: string };

export const EditDiffSchema = z.object({
  summary: z.string(),
  remove: z.array(z.string()).describe("ids of items to remove"),
  add: z.array(GeneratedItemSchema),
  swap: z
    .array(z.object({ id: z.string(), searchQuery: z.string(), reason: z.string() }))
    .describe("items to re-search with a new query"),
});
export type EditDiff = z.infer<typeof EditDiffSchema>;
